'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Apple,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  ShieldCheck,
  Trophy,
  UserRound,
} from 'lucide-react';
import { cloud, cloudConfigured } from '@/lib/cloud';
import { authProviders, avatarUrl, type SocialProvider } from '@/lib/account';
import { prepareAvatar } from '@/lib/avatar';
import { lifetimeScore } from '@/lib/elo';
import { useT } from '@/lib/i18n';
import { useStore } from './Provider';
type Mode = 'signin' | 'signup' | 'reset' | 'password';
export default function AccountPanel() {
  const {
    user,
    profile,
    records,
    settings,
    ready,
    put,
    refreshProfile,
    recovering,
    setRecovering,
    importGuest,
  } = useStore();
  const t = useT();
  const [mode, setMode] = useState<Mode>('signin'),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [repeat, setRepeat] = useState(''),
    [name, setName] = useState(settings.name),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [confirmation, setConfirmation] = useState(''),
    [providers, setProviders] = useState<SocialProvider[]>([]),
    [cooldown, setCooldown] = useState(0),
    [preview, setPreview] = useState<string>();
  const upload = useRef<HTMLInputElement>(null);
  const preferences = useRef(settings);
  preferences.current = settings;
  useEffect(() => {
    if (ready) setName(profile?.display_name || settings.name);
  }, [ready, profile?.display_name, settings.name]);
  useEffect(() => {
    let active = true;
    void authProviders().then((ps) => {
      if (active) setProviders(ps);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (recovering) setMode('password');
  }, [recovering]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  const action = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(
        raw === 'Invalid login credentials'
          ? t('E-Mail oder Passwort stimmt nicht.', 'The email or password is incorrect.')
          : raw === 'Email not confirmed'
            ? t('Bitte bestätige zuerst deine E-Mail-Adresse.', 'Please verify your email first.')
            : raw,
      );
    } finally {
      setBusy(false);
      setPassword('');
      setRepeat('');
    }
  };
  const authenticate = async () => {
    const c = cloud();
    if (!c)
      throw new Error(
        t('Online-Konten werden noch eingerichtet.', 'Online accounts are being set up.'),
      );
    if (mode === 'reset') {
      const { error } = await c.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: location.origin + '/profil?auth=recovery',
      });
      if (error) throw error;
      setMessage(
        t(
          'Falls ein Konto zu dieser E-Mail existiert, erhältst du einen Link zum Zurücksetzen.',
          'If an account exists for this email, you will receive a password reset link.',
        ),
      );
      setCooldown(60);
      return;
    }
    if (mode === 'password') {
      if (!user)
        throw new Error(
          t(
            'Der Link ist abgelaufen. Fordere bitte einen neuen Link an.',
            'This link expired. Please request a new one.',
          ),
        );
      if (password !== repeat)
        throw new Error(t('Die Passwörter stimmen nicht überein.', 'The passwords do not match.'));
      const { error } = await c.auth.updateUser({ password });
      if (error) throw error;
      setRecovering(false);
      setMode('signin');
      setMessage(t('Dein neues Passwort ist gespeichert.', 'Your new password has been saved.'));
      return;
    }
    if (mode === 'signup') {
      if (password !== repeat)
        throw new Error(t('Die Passwörter stimmen nicht überein.', 'The passwords do not match.'));
      const { data, error } = await c.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: location.origin + '/profil?auth=confirmed',
          data: { display_name: name.trim() || t('Spieler', 'Player') },
        },
      });
      if (error) throw error;
      if (data.session && !data.user?.email_confirmed_at) await c.auth.signOut();
      if (!data.session) {
        setConfirmation(email.trim());
        setCooldown(60);
      }
      setMessage(
        t(
          'Bestätige deine E-Mail über den Link in deinem Postfach. Danach kannst du dich anmelden.',
          'Verify your email using the link in your inbox. You can then sign in.',
        ),
      );
      return;
    }
    const { data, error } = await c.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    if (!data.user.email_confirmed_at) {
      await c.auth.signOut();
      throw new Error('Email not confirmed');
    }
    setConfirmation('');
    setMessage(t('Willkommen zurück auf dem Olymp.', 'Welcome back to Olympus.'));
  };
  const saveName = () =>
    action(async () => {
      const value = name.trim();
      if (!value) throw new Error(t('Gib einen Anzeigenamen ein.', 'Enter a display name.'));
      if (user) {
        const { error } = await cloud()!
          .from('player_profiles')
          .update({ display_name: value })
          .eq('user_id', user.id);
        if (error) throw error;
        await refreshProfile();
      }
      await put('settings', 'settings', { ...preferences.current, name: value });
      setMessage(t('Profil gespeichert.', 'Profile saved.'));
    });
  const selectImage = (file: File) =>
    action(async () => {
      const image = await prepareAvatar(file);
      if (user) {
        const c = cloud()!,
          path = user.id + '/avatar.webp';
        const { error } = await c.storage
          .from('avatars')
          .upload(path, image.blob, { upsert: true, contentType: 'image/webp', cacheControl: '0' });
        if (error) throw error;
        const result = await c
          .from('player_profiles')
          .update({ avatar_path: path })
          .eq('user_id', user.id);
        if (result.error) throw result.error;
        await refreshProfile();
      }
      await put('settings', 'settings', { ...preferences.current, avatar: image.preview });
      setPreview(image.preview);
      setMessage(
        t('Dein neues Profilbild ist gespeichert.', 'Your new profile picture has been saved.'),
      );
    });
  const social = (provider: SocialProvider) =>
    action(async () => {
      const c = cloud();
      if (!c) return;
      const { error } = await c.auth.signInWithOAuth({
        provider,
        options: { redirectTo: location.origin + '/profil' },
      });
      if (error) throw error;
    });
  const source = preview || avatarUrl(profile, settings.avatar),
    score = user ? profile?.elo || 0 : lifetimeScore(records).elo;
  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setMessage('');
    setPassword('');
    setRepeat('');
    setConfirmation('');
  };
  return (
    <section className="panel account-panel">
      <div className="identity-hero">
        <div className="identity-avatar">
          <span>
            {source ? (
              <img
                src={source}
                alt={t('Dein Profilbild', 'Your profile picture')}
                width="96"
                height="96"
              />
            ) : (
              <UserRound size={42} />
            )}
          </span>
          <button
            type="button"
            className="avatar-edit"
            disabled={busy || !ready}
            onClick={() => upload.current?.click()}
            aria-label={t('Profilbild hochladen', 'Upload profile picture')}
          >
            <Camera size={17} />
          </button>
          <input
            ref={upload}
            type="file"
            className="visually-hidden"
            accept="image/jpeg,image/png,image/webp"
            aria-label={t('Profilbild auswählen', 'Choose profile picture')}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void selectImage(file);
            }}
          />
        </div>
        <div>
          <span className="eyebrow">
            {user
              ? t('DEIN PLATZ AUF DEM OLYMP', 'YOUR PLACE ON OLYMPUS')
              : t('DEIN WEG BEGINNT HIER', 'YOUR JOURNEY STARTS HERE')}
          </span>
          <h2>{profile?.display_name || settings.name}</h2>
          <span className="identity-status">
            {user ? (
              <>
                <ShieldCheck size={14} />
                {t('E-Mail bestätigt', 'Email verified')}
              </>
            ) : (
              t('Lokales Gastprofil', 'Local guest profile')
            )}
          </span>
        </div>
        <div className="identity-elo">
          <Trophy size={18} />
          <strong>
            {user && !profile
              ? '—'
              : score.toLocaleString(settings.language === 'de' ? 'de-DE' : 'en-US')}
          </strong>
          <span>{t('All-Time-Elo', 'All-time Elo')}</span>
        </div>
      </div>
      <form
        className="name-editor"
        onSubmit={(e) => {
          e.preventDefault();
          void saveName();
        }}
      >
        <label className="field">
          {t('Dein öffentlicher Anzeigename', 'Your public display name')}
          <input
            value={name}
            maxLength={32}
            required
            onChange={(e) => setName(e.target.value)}
            autoComplete="nickname"
          />
        </label>
        <button className="button secondary" disabled={busy || !ready}>
          <Check size={17} />
          {t('Speichern', 'Save')}
        </button>
      </form>
      <p className="small-text">
        {t(
          'In der Rangliste erscheinen nur Anzeigename, Profilbild und Trainings-Elo. Deine E-Mail bleibt privat.',
          'The leaderboard only displays your name, picture and training Elo. Your email stays private.',
        )}
      </p>
      <div className="account-divider" />
      {user && mode !== 'password' ? (
        <div className="connected-account">
          <div className="panel-top">
            <h3>
              <CheckCircle2 size={20} />
              {t('Dein Konto ist verbunden', 'Your account is connected')}
            </h3>
            <span className="tag">OLYMPION ID</span>
          </div>
          <p>{user.email}</p>
          <p>
            {t(
              'Dein Training wird auf deinen Geräten synchronisiert. Bestätigte Erfolge zählen für die öffentliche Rangliste.',
              'Your training syncs across devices. Verified achievements count towards the public leaderboard.',
            )}
          </p>
          <div className="button-row">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await importGuest();
                  setMessage(
                    t(
                      'Gasttraining übernommen. Bereits gespeicherte Erfolge bleiben erhalten.',
                      'Guest training imported. Existing achievements are preserved.',
                    ),
                  );
                })
              }
            >
              {t('Gasttraining übernehmen', 'Import guest training')}
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setEmail(user.email || '');
                switchMode('reset');
              }}
            >
              <KeyRound size={15} />
              {t('Passwort zurücksetzen', 'Reset password')}
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  const { error } = await cloud()!.auth.signOut();
                  if (error) throw error;
                  setPreview(undefined);
                  switchMode('signin');
                })
              }
            >
              <LogOut size={15} />
              {t('Abmelden', 'Sign out')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="auth-heading">
            <span className="auth-seal">
              <ShieldCheck size={24} />
            </span>
            <div>
              <h3>
                {mode === 'signup'
                  ? t('Dein Aufstieg beginnt.', 'Your ascent begins.')
                  : mode === 'reset'
                    ? t('Zurück in dein Konto.', 'Back to your account.')
                    : mode === 'password'
                      ? t('Dein neues Passwort.', 'Your new password.')
                      : t('Willkommen auf dem Olymp.', 'Welcome to Olympus.')}
              </h3>
              <p>
                {t(
                  'Ein Konto. Dein Training. Dein Platz in der Rangliste.',
                  'One account. Your training. Your place on the leaderboard.',
                )}
              </p>
            </div>
          </div>
          {!cloudConfigured && (
            <p className="account-setup-status" role="status">
              {t(
                'Die Online-Anmeldung wird noch freigeschaltet. Dein Profil und Gasttraining kannst du schon nutzen.',
                'Online sign-in is being enabled. You can already use your profile and guest training.',
              )}
            </p>
          )}
          {(mode === 'signin' || mode === 'signup') && (
            <>
              <div className="social-signin">
                {SOCIAL.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="social-button"
                    disabled={busy || !providers.includes(p.id)}
                    onClick={() => void social(p.id)}
                    title={
                      !providers.includes(p.id)
                        ? t('Wird noch eingerichtet', 'Being set up')
                        : undefined
                    }
                  >
                    {p.id === 'apple' ? (
                      <Apple size={18} />
                    ) : p.id === 'google' ? (
                      <GoogleLogo />
                    ) : (
                      <span className="samsung-wordmark">S</span>
                    )}
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
              <p className="social-caption">
                {t(
                  'Mit Google, Apple oder Samsung entfällt die zusätzliche E-Mail-Bestätigung.',
                  'Google, Apple and Samsung sign-in do not require an additional verification email.',
                )}
              </p>
              <div className="auth-or">
                <span />
                {t('ODER MIT E-MAIL', 'OR WITH EMAIL')}
                <span />
              </div>
              <div className="segmented auth-tabs">
                <button
                  type="button"
                  className={mode === 'signin' ? 'selected' : ''}
                  onClick={() => switchMode('signin')}
                >
                  {t('Anmelden', 'Sign in')}
                </button>
                <button
                  type="button"
                  className={mode === 'signup' ? 'selected' : ''}
                  onClick={() => switchMode('signup')}
                >
                  {t('Konto erstellen', 'Create account')}
                </button>
              </div>
            </>
          )}
          {confirmation ? (
            <div className="verify-card">
              <Mail size={30} />
              <h3>{t('Schau in dein Postfach.', 'Check your inbox.')}</h3>
              <p>{confirmation}</p>
              <p>
                {t(
                  'Öffne den Bestätigungslink. Prüfe auch deinen Spam-Ordner.',
                  'Open the verification link. Check your spam folder too.',
                )}
              </p>
              <button
                className="button secondary"
                disabled={busy || cooldown > 0}
                onClick={() =>
                  void action(async () => {
                    const { error } = await cloud()!.auth.resend({
                      type: 'signup',
                      email: confirmation,
                      options: { emailRedirectTo: location.origin + '/profil?auth=confirmed' },
                    });
                    if (error) throw error;
                    setCooldown(60);
                    setMessage(
                      t('Bestätigung erneut angefordert.', 'Verification email requested again.'),
                    );
                  })
                }
              >
                {cooldown > 0 ? `${cooldown}s` : t('Link erneut senden', 'Resend link')}
              </button>
              <button className="text-button" onClick={() => switchMode('signin')}>
                {t('Zur Anmeldung', 'Back to sign in')}
              </button>
            </div>
          ) : (
            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault();
                void action(authenticate);
              }}
            >
              {mode !== 'password' && (
                <label className="field">
                  {t('E-Mail-Adresse', 'Email address')}
                  <input
                    type="email"
                    value={email}
                    maxLength={254}
                    required
                    autoComplete="email"
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              )}
              {mode !== 'reset' && (
                <label className="field">
                  {mode === 'password'
                    ? t('Neues Passwort', 'New password')
                    : t('Passwort', 'Password')}
                  <span className="password-input">
                    <input
                      type={show ? 'text' : 'password'}
                      value={password}
                      minLength={mode === 'signin' ? 1 : 10}
                      maxLength={128}
                      required
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setShow((v) => !v)}
                      aria-label={
                        show
                          ? t('Passwort verbergen', 'Hide password')
                          : t('Passwort anzeigen', 'Show password')
                      }
                    >
                      {show ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </span>
                </label>
              )}
              {(mode === 'signup' || mode === 'password') && (
                <>
                  <label className="field">
                    {t('Passwort wiederholen', 'Repeat password')}
                    <input
                      type={show ? 'text' : 'password'}
                      value={repeat}
                      minLength={10}
                      maxLength={128}
                      required
                      autoComplete="new-password"
                      onChange={(e) => setRepeat(e.target.value)}
                    />
                  </label>
                  <p className="small-text">
                    {t(
                      'Mindestens 10 Zeichen. Verwende ein eigenes, langes Passwort.',
                      'At least 10 characters. Use a long, unique password.',
                    )}
                  </p>
                </>
              )}
              <button
                className="button primary full"
                disabled={busy || !cloudConfigured || (mode === 'reset' && cooldown > 0)}
              >
                {busy ? (
                  <Loader2 size={18} className="spin" />
                ) : mode === 'reset' ? (
                  <Mail size={18} />
                ) : (
                  <ArrowRight size={18} />
                )}{' '}
                {mode === 'signup'
                  ? t('Konto erstellen & E-Mail bestätigen', 'Create account & verify email')
                  : mode === 'reset'
                    ? t('Link zum Zurücksetzen senden', 'Send reset link')
                    : mode === 'password'
                      ? t('Neues Passwort speichern', 'Save new password')
                      : t('Anmelden', 'Sign in')}
              </button>
              {mode === 'signin' ? (
                <button
                  type="button"
                  className="text-button forgot-password"
                  onClick={() => switchMode('reset')}
                >
                  {t('Passwort vergessen?', 'Forgot password?')}
                </button>
              ) : (
                mode !== 'signup' && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => switchMode('signin')}
                  >
                    {t('Zurück zur Anmeldung', 'Back to sign in')}
                  </button>
                )
              )}
            </form>
          )}
        </>
      )}
      {user && mode === 'reset' && (
        <form
          className="auth-form compact-reset"
          onSubmit={(e) => {
            e.preventDefault();
            void action(authenticate);
          }}
        >
          <label className="field">
            {t('E-Mail-Adresse', 'Email address')}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <button className="button secondary" disabled={busy || cooldown > 0}>
            {t('Link zum Zurücksetzen senden', 'Send reset link')}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="account-success">
          <CheckCircle2 size={16} />
          {message}
        </p>
      )}
    </section>
  );
}
const SOCIAL: { id: SocialProvider; name: string }[] = [
  { id: 'google', name: 'Google' },
  { id: 'apple', name: 'Apple' },
  { id: 'custom:samsung', name: 'Samsung' },
];
function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.6 12.2c0-.7-.1-1.4-.2-2.2H12v4h5.4a4.6 4.6 0 0 1-2 3 5.9 5.9 0 0 1-9-3.7 6 6 0 0 1 9.8-5.7l3-3A10 10 0 1 0 12 22c5.8 0 9.6-4 9.6-9.8Z"
      />
    </svg>
  );
}
