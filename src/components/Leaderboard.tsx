'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Crown,
  Globe2,
  Medal,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { cloud, cloudConfigured } from '@/lib/cloud';
import { avatarUrl } from '@/lib/account';
import { botReward, lifetimeScore } from '@/lib/elo';
import { useT } from '@/lib/i18n';
import type { PlayerProfile } from '@/lib/types';
import { useStore } from './Provider';
import { Heading, Loading } from './Common';
const PAGE = 25;
export default function Leaderboard() {
  const t = useT(),
    { user, profile, records, settings } = useStore();
  const [rows, setRows] = useState<PlayerProfile[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(0),
    [total, setTotal] = useState(0),
    [ownRank, setOwnRank] = useState<number | null>(null),
    [revision, setRevision] = useState(0),
    [updated, setUpdated] = useState<string>();
  useEffect(() => {
    const c = cloud();
    if (!c) return;
    const abort = new AbortController();
    const timer = setTimeout(
      () => {
        setBusy(true);
        setError('');
        let query = c
          .from('leaderboard')
          .select('*', { count: 'exact' })
          .order('rank')
          .range(page * PAGE, page * PAGE + PAGE - 1);
        if (search.trim())
          query = query.ilike('display_name', '%' + search.trim().replace(/[\\%_]/g, '\\$&') + '%');
        void query.abortSignal(abort.signal).then(({ data, error, count }) => {
          if (abort.signal.aborted) return;
          if (error) {
            setError(
              t(
                'Die Rangliste konnte gerade nicht geladen werden. Versuche es erneut.',
                'The leaderboard could not be loaded. Please try again.',
              ),
            );
            setRows([]);
          } else {
            setRows((data as PlayerProfile[]) || []);
            setTotal(count || 0);
            setUpdated(
              new Date().toLocaleTimeString(settings.language === 'de' ? 'de-DE' : 'en-US', {
                hour: '2-digit',
                minute: '2-digit',
              }),
            );
          }
          setBusy(false);
        });
        if (user)
          void c
            .from('leaderboard')
            .select('rank')
            .eq('user_id', user.id)
            .abortSignal(abort.signal)
            .maybeSingle()
            .then(({ data }) => {
              if (!abort.signal.aborted) setOwnRank(data ? Number(data.rank) : null);
            });
      },
      search ? 300 : 0,
    );
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [search, page, revision, user, t, settings.language]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden && navigator.onLine) setRevision((n) => n + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  const score = user ? profile?.elo || 0 : lifetimeScore(records).elo;
  const podium = page === 0 && !search.trim() ? rows.slice(0, 3) : [];
  return (
    <>
      <Heading
        god={t('DER OLYMP · ALL-TIME-RANGLISTE', 'OLYMPUS · ALL-TIME LEADERBOARD')}
        title={t('Verdiene dir deinen Platz.', 'Earn your place.')}
        description={t(
          'Jedes gelöste Puzzle. Jeder gewonnene Kampf. Dein Aufstieg zählt.',
          'Every solved puzzle. Every battle won. Your ascent counts.',
        )}
      >
        <button
          className="button secondary"
          disabled={busy || !cloudConfigured}
          onClick={() => setRevision((n) => n + 1)}
        >
          <RefreshCw size={16} className={busy ? 'spin' : ''} />
          {t('Aktualisieren', 'Refresh')}
        </button>
      </Heading>
      <section className="ranking-hero">
        <div className="ranking-hero-art" />
        <div className="ranking-hero-copy">
          <span className="eyebrow">
            <Globe2 size={14} />
            {t('EIN OLYMP. ALLE SPIELER.', 'ONE OLYMPUS. EVERY PLAYER.')}
          </span>
          <h2>{t('Größe wird erspielt.', 'Greatness is earned.')}</h2>
          <p>
            {t(
              'Die öffentliche Rangliste aller bestätigten Konten. Sortiert nach deiner gesamten, verdienten OLYMPION-Elo.',
              'The public leaderboard of all verified accounts. Ranked by total earned OLYMPION Elo.',
            )}
          </p>
          <div className="ranking-rule-pills">
            <span>
              <Sparkles size={15} /> +1 {t('pro Puzzle', 'per puzzle')}
            </span>
            <span>
              <SwordsIcon /> +3–20 {t('pro Botsieg', 'per bot win')}
            </span>
            <span>
              <ShieldCheck size={15} />
              {t('Vom Server bestätigt', 'Verified by the server')}
            </span>
          </div>
        </div>
        <div className="ranking-own">
          <Trophy size={26} />
          <span>{t('DEINE ALL-TIME-ELO', 'YOUR ALL-TIME ELO')}</span>
          <strong>
            {user && !profile
              ? '—'
              : score.toLocaleString(settings.language === 'de' ? 'de-DE' : 'en-US')}
          </strong>
          <small>
            {user
              ? ownRank
                ? `${t('Platz', 'Rank')} #${ownRank}`
                : t('Dein Aufstieg beginnt', 'Your ascent begins')
              : t('Gasttraining · lokal gespeichert', 'Guest training · saved locally')}
          </small>
          {!user && (
            <Link className="button primary" href="/profil">
              {t('Konto erstellen', 'Create account')}
              <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </section>
      {podium.length > 0 && (
        <div className="ranking-podium">
          {podium.map((p) => (
            <article key={p.user_id} className={'podium-card podium-' + p.rank}>
              <div className="podium-place">
                {Number(p.rank) === 1 ? <Crown size={24} /> : <Medal size={23} />}
                <span>#{p.rank}</span>
              </div>
              <PlayerAvatar player={p} />
              <h3>{p.display_name}</h3>
              <strong>
                {Number(p.elo).toLocaleString()} <small>Elo</small>
              </strong>
              <p>
                {p.puzzles_solved} {t('Puzzle', 'puzzles')} · {p.bots_won} {t('Siege', 'wins')}
              </p>
            </article>
          ))}
        </div>
      )}
      <section className="panel ranking-list">
        <div className="panel-top">
          <div>
            <span className="eyebrow">
              {t('ALLE ZEITEN. ALLE ERFOLGE.', 'ALL TIME. EVERY ACHIEVEMENT.')}
            </span>
            <h2>{t('Die Rangliste', 'The leaderboard')}</h2>
          </div>
          <span className="tag">
            <Users size={14} />
            {cloudConfigured ? total : '—'} {t('Spieler', 'players')}
          </span>
        </div>
        <label className="ranking-search">
          <Search size={18} />
          <input
            type="search"
            placeholder={t('Spieler suchen …', 'Search players …')}
            aria-label={t('Spieler in der Rangliste suchen', 'Search the leaderboard')}
            value={search}
            maxLength={32}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </label>
        {!cloudConfigured ? (
          <div className="ranking-empty">
            <Trophy size={42} />
            <h3>
              {t(
                'Der Olymp wartet auf seine ersten Namen.',
                'Olympus is waiting for its first names.',
              )}
            </h3>
            <p>
              {t(
                'Die Online-Konten und gemeinsame Rangliste werden noch freigeschaltet. Du kannst schon als Gast trainieren und dein Profil gestalten.',
                'Online accounts and the shared leaderboard are being enabled. You can already train as a guest and customize your profile.',
              )}
            </p>
            <Link className="button primary" href="/profil">
              {t('Zu deinem Profil', 'Go to your profile')}
              <ArrowRight size={16} />
            </Link>
          </div>
        ) : busy && !rows.length ? (
          <Loading text={t('Die Rangliste wird geladen …', 'Loading leaderboard …')} />
        ) : error ? (
          <div className="ranking-empty">
            <p role="alert" className="inline-error">
              {error}
            </p>
            <button className="button secondary" onClick={() => setRevision((n) => n + 1)}>
              {t('Erneut versuchen', 'Try again')}
            </button>
          </div>
        ) : !rows.length ? (
          <div className="ranking-empty">
            <Users size={36} />
            <h3>
              {search
                ? t('Kein Spieler gefunden.', 'No players found.')
                : t('Sei der erste Name auf dem Olymp.', 'Be the first name on Olympus.')}
            </h3>
            <p>
              {t(
                'Löse ein Puzzle oder besiege einen Bot und verdiene deine ersten Elo-Punkte.',
                'Solve a puzzle or beat a bot to earn your first Elo points.',
              )}
            </p>
          </div>
        ) : (
          <div
            className="ranking-table"
            role="table"
            aria-label={t('Öffentliche All-Time-Rangliste', 'Public all-time leaderboard')}
          >
            <div className="ranking-row ranking-table-head" role="row">
              <span role="columnheader">#</span>
              <span role="columnheader">{t('Spieler', 'Player')}</span>
              <span className="ranking-extra" role="columnheader">
                {t('Puzzle', 'Puzzles')}
              </span>
              <span className="ranking-extra" role="columnheader">
                {t('Botsiege', 'Bot wins')}
              </span>
              <span role="columnheader">Elo</span>
            </div>
            {rows.map((p) => (
              <div
                className={'ranking-row ' + (p.user_id === user?.id ? 'is-you' : '')}
                role="row"
                key={p.user_id}
              >
                <span className="rank-number" role="cell">
                  {p.rank}
                </span>
                <span className="rank-player" role="cell">
                  <PlayerAvatar player={p} />
                  <span>
                    <strong>{p.display_name}</strong>
                    {p.user_id === user?.id && <small>{t('Das bist du', 'You')}</small>}
                  </span>
                </span>
                <span className="ranking-extra" role="cell">
                  {p.puzzles_solved}
                </span>
                <span className="ranking-extra" role="cell">
                  {p.bots_won}
                </span>
                <strong className="rank-elo" role="cell">
                  {Number(p.elo).toLocaleString()}
                </strong>
              </div>
            ))}
          </div>
        )}
        {cloudConfigured && total > PAGE && (
          <div className="ranking-pagination">
            <button
              className="button secondary"
              disabled={page === 0 || busy}
              onClick={() => setPage((n) => n - 1)}
            >
              <ChevronLeft size={16} />
              {t('Zurück', 'Previous')}
            </button>
            <span>
              {page + 1} / {Math.ceil(total / PAGE)}
            </span>
            <button
              className="button secondary"
              disabled={(page + 1) * PAGE >= total || busy}
              onClick={() => setPage((n) => n + 1)}
            >
              {t('Weiter', 'Next')}
              <ChevronRight size={16} />
            </button>
          </div>
        )}
        {updated && (
          <p className="small-text ranking-updated">
            {t('Aktualisiert um', 'Updated at')} {updated} ·{' '}
            {t('Aktualisiert sich jede Minute', 'Refreshes every minute')}
          </p>
        )}
      </section>
      <div className="elo-explained">
        <div>
          <span className="eyebrow">{t('DEIN AUFSTIEG IN ZAHLEN', 'YOUR ASCENT IN NUMBERS')}</span>
          <h2>{t('So sammelst du Elo.', 'How you earn Elo.')}</h2>
          <p>
            {t(
              'Jedes Puzzle zählt einmal. Jeder neue Botsieg zählt. Deine All-Time-Elo sinkt nicht. Sie ist dein OLYMPION-Fortschritt und keine FIDE- oder Chess.com-Wertung.',
              'Each puzzle counts once. Every new bot win counts. Your all-time Elo never goes down. It measures your OLYMPION progress and is separate from FIDE or Chess.com ratings.',
            )}
          </p>
        </div>
        <div className="elo-reward-scale">
          {[1, 5, 10, 15, 20].map((level) => (
            <span key={level}>
              <small>
                {t('Bot-Stufe', 'Bot level')} {level}
              </small>
              <strong>
                +{botReward(level)} <small>Elo</small>
              </strong>
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
function PlayerAvatar({ player }: { player: PlayerProfile }) {
  const source = avatarUrl(player);
  return (
    <span className="ranking-avatar">
      {source ? (
        <img src={source} alt="" width="48" height="48" loading="lazy" />
      ) : (
        player.display_name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
function SwordsIcon() {
  return <Medal size={15} />;
}
