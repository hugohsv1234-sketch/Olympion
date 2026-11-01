'use client';
import { useEffect, useState } from 'react';
import {
  Check,
  Cloud,
  Download,
  HardDrive,
  LogOut,
  RefreshCw,
  Save,
  Smartphone,
  Upload,
} from 'lucide-react';
import { cloud, cloudConfigured } from '@/lib/cloud';
import { download, validateBackup, loadRecords } from '@/lib/storage';
import { restore } from '@/lib/chess';
import { cacheUrls, CACHE_VERSION, installApp, standalone } from '@/lib/pwa';
import { puzzleIndex } from '@/lib/puzzles';
import type { AnalysisRecord, GameRecord, RecordItem } from '@/lib/types';
import { useStore } from './Provider';
import { ErrorText, Heading, Modal, Toggle } from './Common';
export default function Profile() {
  const { settings, records, ready, put, putMany, user, sync, importGuest, status } = useStore();
  const [name, setName] = useState(settings.name),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [mode, setMode] = useState<'signin' | 'signup'>('signin'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [instructions, setInstructions] = useState(false),
    [installed, setInstalled] = useState(false),
    [progress, setProgress] = useState(''),
    [engineCached, setEngineCached] = useState(false),
    [puzzlesCached, setPuzzlesCached] = useState(0),
    [usage, setUsage] = useState(''),
    [backup, setBackup] = useState<RecordItem[] | null>(null),
    [guestCount, setGuestCount] = useState(0),
    [updateWaiting, setUpdateWaiting] = useState(false);
  useEffect(() => {
    if (ready) setName(settings.name);
  }, [ready, settings.name]);
  const refreshCache = async () => {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_VERSION);
      const keys = (await cache.keys()).map((k) => new URL(k.url).pathname);
      setEngineCached(
        keys.some((k) => k.endsWith('.wasm')) && keys.some((k) => /stockfish.*\.js$/.test(k)),
      );
      setPuzzlesCached(keys.filter((k) => k.startsWith('/puzzles/pack-')).length);
    }
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      setUsage(Math.round(((est.usage || 0) / 1024 / 1024) * 10) / 10 + ' MB belegt');
    }
  };
  useEffect(() => {
    setInstalled(standalone());
    void refreshCache();
    void loadRecords('guest').then((rs) => setGuestCount(rs.length));
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker.getRegistration().then((reg) => {
        setUpdateWaiting(Boolean(reg?.waiting));
      });
  }, []);
  const action = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      setMessage(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const auth = async (e: React.FormEvent) => {
    e.preventDefault();
    await action(
      async () => {
        const c = cloud();
        if (!c) throw new Error('Cloudzugang wurde noch nicht eingerichtet.');
        if (mode === 'signup') {
          const { data, error } = await c.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: location.origin + '/profil' },
          });
          if (error) throw error;
          setPassword('');
          return data;
        }
        const { error } = await c.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setPassword('');
      },
      mode === 'signup'
        ? 'Registrierung angenommen. Falls die E-Mail-Bestätigung aktiv ist, bestätige bitte den Link in deinem Postfach.'
        : 'Du bist angemeldet. Deine Kontodaten werden geladen.',
    );
  };
  const offline = async (kind: 'engine' | 'puzzles') => {
    await action(
      async () => {
        if (!navigator.onLine) throw new Error('Für den Download musst du online sein.');
        if (!window.isSecureContext || !('caches' in window))
          throw new Error(
            'Offline-Downloads brauchen HTTPS oder localhost. Öffne die veröffentlichte HTTPS-Adresse.',
          );
        if (kind === 'engine') {
          const r = await fetch('/engine/manifest.json');
          if (!r.ok) throw new Error('Enginemanifest konnte nicht geladen werden.');
          const manifest = await r.json();
          const cache = await caches.open(CACHE_VERSION);
          for (const [i, file] of manifest.files.entries()) {
            setProgress(`Engine ${i + 1} / ${manifest.files.length}`);
            const response = await fetch(file.url);
            if (!response.ok) throw new Error('Enginedownload fehlgeschlagen.');
            const bytes = await response.clone().arrayBuffer();
            const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');
            if (hash !== file.sha256)
              throw new Error('Die Engineprüfung ist fehlgeschlagen. Bitte erneut laden.');
            await cache.put(file.url, response);
          }
          await cacheUrls(['/engine/manifest.json']);
        } else {
          const idx = await puzzleIndex();
          const packs = [...new Set(idx.puzzles.map((p) => '/puzzles/' + p.pack))];
          await cacheUrls(['/puzzles/index.json', ...packs], (n, total) =>
            setProgress(`Puzzlepakete ${n} / ${total}`),
          );
        }
        setProgress('');
        await refreshCache();
      },
      kind === 'engine'
        ? 'Engine heruntergeladen und auf Integrität geprüft. Offline-Botspiel und Analyse sind vorbereitet.'
        : 'Alle Puzzlepakete sind offline verfügbar.',
    );
  };
  return (
    <>
      <Heading
        god="DEIN PROFIL · DEINE EINSTELLUNGEN"
        title="Deine Akademie. Dein Rhythmus."
        description="Fortschritte sichern, Darstellung anpassen und unterwegs weitertrainieren."
      />
      <div className="profile-grid">
        <section className="panel">
          <div className="panel-top">
            <h2>Dein Profil</h2>
            <span className="tag">{user ? 'KONTO' : 'GAST'}</span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(
                () => put('settings', 'settings', { ...settings, name: name.trim() || 'Gast' }),
                'Profil gespeichert.',
              );
            }}
          >
            <label className="field">
              Dein Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                required
              />
            </label>
            <button className="button primary" disabled={!ready || busy}>
              <Save size={16} />
              Profil speichern
            </button>
          </form>
          <label className="field goal-field">
            Tagesziel
            <select
              value={settings.goal}
              onChange={(e) =>
                void action(
                  () => put('settings', 'settings', { ...settings, goal: Number(e.target.value) }),
                  'Tagesziel gespeichert.',
                )
              }
            >
              <option value={10}>10 Minuten</option>
              <option value={20}>20 Minuten</option>
              <option value={30}>30 Minuten</option>
            </select>
          </label>
          <Toggle
            label="Brettkoordinaten"
            checked={settings.coordinates}
            onChange={(v) =>
              void action(
                () => put('settings', 'settings', { ...settings, coordinates: v }),
                'Darstellung gespeichert.',
              )
            }
          />
          <Toggle
            label="Hoher Brettkontrast"
            checked={settings.contrast}
            onChange={(v) =>
              void action(
                () => put('settings', 'settings', { ...settings, contrast: v }),
                'Darstellung gespeichert.',
              )
            }
          />
          <Toggle
            label="Animationen"
            description="Die Systemeinstellung für reduzierte Bewegung hat Vorrang."
            checked={settings.motion}
            onChange={(v) =>
              void action(
                () => put('settings', 'settings', { ...settings, motion: v }),
                'Bewegung gespeichert.',
              )
            }
          />
          <Toggle
            label="Zugklang"
            checked={settings.sound}
            onChange={(v) =>
              void action(
                () => put('settings', 'settings', { ...settings, sound: v }),
                'Toneinstellung gespeichert.',
              )
            }
          />
        </section>
        <section className="panel">
          <div className="panel-top">
            <h2>
              <Cloud size={20} />
              Konto & Synchronisierung
            </h2>
            <span className="status-dot" />
          </div>
          {user ? (
            <>
              <p>
                Angemeldet als <strong>{user.email}</strong>
              </p>
              <p className="sync-status">{status}</p>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void action(sync, 'Synchronisierung angestoßen. Der Status zeigt das Ergebnis.')
                }
              >
                <RefreshCw size={16} />
                Jetzt synchronisieren
              </button>
              {guestCount > 0 && (
                <div className="guest-migration">
                  <h3>Gasttraining übernehmen</h3>
                  <p>
                    {guestCount} lokale Einträge können in dieses Konto übernommen werden. Bereits
                    vorhandene IDs werden ausgelassen.
                  </p>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      void action(
                        importGuest,
                        'Gastdaten übernommen. Vorhandene Einträge wurden beibehalten.',
                      )
                    }
                  >
                    Gastdaten übernehmen
                  </button>
                </div>
              )}
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    const { error } = await cloud()!.auth.signOut();
                    if (error) throw error;
                  }, 'Abgemeldet. Das separate Gastprofil ist jetzt aktiv.')
                }
              >
                <LogOut size={15} />
                Abmelden
              </button>
            </>
          ) : cloudConfigured ? (
            <>
              <p>
                Nutze dein Training auf Handy, iPad und Desktop. Gastdaten bleiben getrennt, bis du
                sie ausdrücklich übernimmst.
              </p>
              <div className="segmented">
                <button
                  className={mode === 'signin' ? 'selected' : ''}
                  onClick={() => setMode('signin')}
                >
                  Anmelden
                </button>
                <button
                  className={mode === 'signup' ? 'selected' : ''}
                  onClick={() => setMode('signup')}
                >
                  Registrieren
                </button>
              </div>
              <form onSubmit={(e) => void auth(e)}>
                <label className="field">
                  E-Mail
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  Passwort
                  <input
                    type="password"
                    minLength={8}
                    maxLength={128}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </label>
                <button className="button primary full" disabled={busy}>
                  {mode === 'signup' ? 'Konto erstellen' : 'Anmelden'}
                </button>
              </form>
            </>
          ) : (
            <div className="cloud-unconfigured">
              <HardDrive size={30} />
              <h3>Dein Gasttraining funktioniert sofort.</h3>
              <p>
                Die Kontofunktion ist in dieser Installation noch nicht eingerichtet. Der Betreiber
                muss die Supabase-Konfiguration und Datenbankmigration aus DEPLOYMENT.md aktivieren.
              </p>
              <p className="small-text">
                Gastdaten sind an diesen Browser gebunden. Sichere sie regelmäßig als JSON.
              </p>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-top">
            <h2>
              <Smartphone size={20} />
              OLYMPION als App
            </h2>
            {installed && <Check size={19} />}
          </div>
          <p>
            {installed
              ? 'Du nutzt OLYMPION bereits als eigenständige App.'
              : 'Installiere die Akademie auf deinem Home-Bildschirm und starte direkt ins Training.'}
          </p>
          <button
            className="button primary"
            disabled={installed}
            onClick={() =>
              void action(async () => {
                const result = await installApp();
                if (result === 'instructions') setInstructions(true);
                setInstalled(standalone());
              }, 'Installationsoption geöffnet.')
            }
          >
            <Download size={16} />
            {installed ? 'Bereits als App geöffnet' : 'App installieren'}
          </button>
          <div className="offline-section">
            <h3>Dein Training für unterwegs</h3>
            <p className="small-text">
              App-Rahmen und besuchte Inhalte werden zwischengespeichert. Lade Engine und Aufgaben
              gezielt für Offlinebetrieb herunter.
            </p>
            <div className="offline-item">
              <span>
                <strong>Schachengine</strong>
                <small>
                  {engineCached ? 'Offline bereit · 1,9 MB' : 'Stockfish 19 · etwa 1,9 MB'}
                </small>
              </span>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void offline('engine')}
              >
                {engineCached ? 'Neu laden' : 'Herunterladen'}
              </button>
            </div>
            <div className="offline-item">
              <span>
                <strong>Alle 1.001 Aufgaben</strong>
                <small>{puzzlesCached} von 21 Paketen offline</small>
              </span>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void offline('puzzles')}
              >
                Herunterladen
              </button>
            </div>
            {progress && <p role="status">{progress}</p>}
            <span className="small-text">{usage}</span>
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  const granted = await navigator.storage?.persist?.();
                  if (!granted)
                    throw new Error(
                      'Der Browser hat dauerhaften Speicher nicht freigegeben. Downloads bleiben innerhalb der Browsergrenzen verfügbar.',
                    );
                }, 'Dauerhafter lokaler Speicher angefragt und freigegeben.')
              }
            >
              Browser um dauerhaften Speicher bitten
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  if (!('caches' in window)) throw new Error('Kein Offlinecache verfügbar.');
                  const c = await caches.open(CACHE_VERSION);
                  for (const request of await c.keys()) {
                    const path = new URL(request.url).pathname;
                    if (path.startsWith('/engine/') || path.startsWith('/puzzles/'))
                      await c.delete(request);
                  }
                  await refreshCache();
                }, 'Offlinepakete entfernt. Dein Trainingsfortschritt bleibt gespeichert.')
              }
            >
              Offlinepakete entfernen
            </button>
          </div>
          {updateWaiting && (
            <div className="update-note">
              <h3>Eine neue Version ist verfügbar.</h3>
              <p>Laufende Partien werden vor dem Update pausiert und gespeichert.</p>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    for (const r of records.filter((r) => r.kind === 'game')) {
                      const g = r.value as GameRecord;
                      if (!g.result && !g.paused)
                        await put(r.id, 'game', { ...g, paused: true, turnStarted: null });
                    }
                    const reg = await navigator.serviceWorker.getRegistration();
                    reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
                    navigator.serviceWorker.addEventListener(
                      'controllerchange',
                      () => location.reload(),
                      { once: true },
                    );
                  }, 'Update wird aktiviert.')
                }
              >
                Gespeichert aktualisieren
              </button>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-top">
            <h2>
              <HardDrive size={19} />
              Deine Daten sichern
            </h2>
            <span className="tag">VERSION 1</span>
          </div>
          <p>
            Exportiere dein aktuelles Profil mit Partien, Puzzleversuchen, Lektionen und Analysen.
            Die Datei enthält keine Passwörter oder Sitzungsschlüssel.
          </p>
          <button
            className="button secondary full"
            disabled={!ready}
            onClick={() =>
              download(
                'olympion-backup.json',
                JSON.stringify(
                  { schemaVersion: 1, exportedAt: new Date().toISOString(), records },
                  null,
                  2,
                ),
              )
            }
          >
            <Download size={16} />
            JSON-Backup herunterladen
          </button>
          <label className="button secondary full file-button">
            <Upload size={16} />
            JSON-Backup importieren
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 20000000) {
                  setError('Maximal 20 MB pro Backup.');
                  return;
                }
                void action(async () => {
                  const rs = validateBackup(JSON.parse(await file.text()));
                  for (const r of rs) {
                    if (r.kind === 'game') restore(r.value as GameRecord);
                    if (r.kind === 'analysis') restore(r.value as AnalysisRecord);
                  }
                  setBackup(rs);
                }, 'Backup geprüft. Bestätige den Import.');
                e.target.value = '';
              }}
            />
          </label>
          <p className="small-text">
            Importe werden über stabile IDs zusammengeführt. Bei denselben IDs gilt der neuere
            Änderungszeitpunkt. Bei einem Zeitgleichstand entscheidet die Geräte-ID.
          </p>
          <details>
            <summary>Was wird gespeichert?</summary>
            <p>
              Puzzleversuche, Ergebnisse, Hilfen, Zeit, Lektionen, Partien mit Zuggeschichte und
              Uhren, Analysen, eigene Fehlerstellungen und Einstellungen. Kontodaten anderer Nutzer
              sind auf diesem Gerät getrennt. Der Service Worker speichert nur öffentliche
              App-Dateien und Puzzlepakete.
            </p>
          </details>
          <a href="/engine/COPYING.txt" className="text-button" target="_blank" rel="noreferrer">
            Stockfish · GPL-3.0-Lizenz
          </a>
          <a href="/engine/source.tar.gz" className="text-button" download>
            Stockfish · zugehöriger Quellcode
          </a>
        </section>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      {instructions && (
        <Modal title="OLYMPION installieren" onClose={() => setInstructions(false)}>
          <p>
            <strong>iPhone oder iPad:</strong> Öffne diese Website im Browser. Tippe auf „Teilen“
            oder das Browsermenü und dann auf „Zum Home-Bildschirm“. In Safari findest du „Teilen“
            als Quadrat mit Pfeil nach oben.
          </p>
          <p>
            <strong>Android, Windows oder Mac:</strong> Nutze „App installieren“ im Browsermenü oder
            das Installationssymbol in der Adressleiste, falls angeboten.
          </p>
          <p>
            Die genaue Option hängt vom Browser ab. Die Website bleibt auch ohne Installation
            nutzbar.
          </p>
          <button className="button primary" onClick={() => setInstructions(false)}>
            Verstanden
          </button>
        </Modal>
      )}
      {backup && (
        <Modal title="Backup in dieses Profil importieren?" onClose={() => setBackup(null)}>
          <p>
            {backup.length} geprüfte Einträge werden mit dem aktuellen{' '}
            {user ? 'Konto' : 'Gastprofil'} zusammengeführt.
          </p>
          <div className="button-row">
            <button className="button secondary" onClick={() => setBackup(null)}>
              Abbrechen
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await putMany(backup.map((r) => ({ ...r, pending: true })));
                  setBackup(null);
                }, 'Backup importiert.')
              }
            >
              Importieren
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
