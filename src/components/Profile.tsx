'use client';
import { useEffect, useState } from 'react';
import { Check, Download, HardDrive, Smartphone, Upload } from 'lucide-react';
import AccountPanel from './AccountPanel';
import { useT } from '@/lib/i18n';
import { download, validateBackup } from '@/lib/storage';
import { restore } from '@/lib/chess';
import { cacheUrls, CACHE_VERSION, installApp, standalone } from '@/lib/pwa';
import { puzzleIndex } from '@/lib/puzzles';
import type { AnalysisRecord, GameRecord, RecordItem } from '@/lib/types';
import { useStore } from './Provider';
import { ErrorText, Heading, Modal, Toggle } from './Common';
export default function Profile() {
  const tr = useT();
  const { settings, records, ready, put, putMany, user } = useStore();
  const t = useT();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [instructions, setInstructions] = useState(false),
    [installed, setInstalled] = useState(false),
    [progress, setProgress] = useState(''),
    [engineCached, setEngineCached] = useState(false),
    [puzzlesCached, setPuzzlesCached] = useState(0),
    [usage, setUsage] = useState(''),
    [backup, setBackup] = useState<RecordItem[] | null>(null),
    [updateWaiting, setUpdateWaiting] = useState(false);
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
        god={tr('DEIN PROFIL \u00B7 DEINE EINSTELLUNGEN')}
        title={tr('Deine Akademie. Dein Rhythmus.')}
        description={tr(
          'Fortschritte sichern, Darstellung anpassen und unterwegs weitertrainieren.',
        )}
      />
      <div className="profile-grid">
        <AccountPanel />
        <section className="panel">
          <div className="panel-top">
            <h2>{t('Deine Einstellungen', 'Your settings')}</h2>
            <span className="tag">{tr('OLYMPION')}</span>
          </div>

          <div className="settings-intro">
            <span className="eyebrow">
              {t('DEIN STIL. DEINE REGELN.', 'YOUR STYLE. YOUR RULES.')}
            </span>
            <p>
              {t('Passe die Akademie an deinen Rhythmus an.', 'Make the academy work your way.')}
            </p>
          </div>
          <Toggle
            label={t('Nachtmodus', 'Dark mode')}
            description={t(
              'Aus: heller Marmor und schwarze Schrift',
              'Off: light marble and black text',
            )}
            checked={settings.theme === 'dark'}
            onChange={(v) =>
              void action(
                () => put('settings', 'settings', { ...settings, theme: v ? 'dark' : 'light' }),
                t('Design gespeichert.', 'Theme saved.'),
              )
            }
          />
          <label className="field language-field">
            {t('Sprache der App', 'App language')}
            <select
              value={settings.language}
              onChange={(e) =>
                void action(
                  () =>
                    put('settings', 'settings', {
                      ...settings,
                      language: e.target.value as 'de' | 'en',
                    }),
                  t('Sprache gespeichert.', 'Language saved.'),
                )
              }
            >
              <option value="de">{tr('Deutsch')}</option>
              <option value="en">{tr('English')}</option>
            </select>
          </label>
          <Toggle
            label={t('Premoves', 'Premoves')}
            description={t(
              'Züge während des gegnerischen Zugs vormerken',
              'Queue a move while the bot is thinking',
            )}
            checked={settings.premoves}
            onChange={(v) =>
              void action(
                () => put('settings', 'settings', { ...settings, premoves: v }),
                t('Spieleinstellung gespeichert.', 'Game setting saved.'),
              )
            }
          />
          <Toggle
            label={t('Live-Analyse gegen Bots', 'Live analysis against bots')}
            description={t(
              'Zugqualität nach deinem Zug. Auch im Spiel umschaltbar.',
              'Move quality after you move. You can change this during a game.',
            )}
            checked={settings.liveAnalysis}
            onChange={(v) =>
              void action(
                () => put('settings', 'settings', { ...settings, liveAnalysis: v }),
                t('Spieleinstellung gespeichert.', 'Game setting saved.'),
              )
            }
          />
          <label className="field goal-field">
            {tr('Tagesziel')}
            <select
              value={settings.goal}
              onChange={(e) =>
                void action(
                  () => put('settings', 'settings', { ...settings, goal: Number(e.target.value) }),
                  'Tagesziel gespeichert.',
                )
              }
            >
              <option value={10}>{tr('10 Minuten')}</option>
              <option value={20}>{tr('20 Minuten')}</option>
              <option value={30}>{tr('30 Minuten')}</option>
            </select>
          </label>
          <Toggle
            label={tr('Brettkoordinaten')}
            checked={settings.coordinates}
            onChange={(v) =>
              void action(
                () => put('settings', 'settings', { ...settings, coordinates: v }),
                'Darstellung gespeichert.',
              )
            }
          />
          <Toggle
            label={tr('Hoher Brettkontrast')}
            checked={settings.contrast}
            onChange={(v) =>
              void action(
                () => put('settings', 'settings', { ...settings, contrast: v }),
                'Darstellung gespeichert.',
              )
            }
          />
          <Toggle
            label={tr('Animationen')}
            description={tr('Die Systemeinstellung f\u00FCr reduzierte Bewegung hat Vorrang.')}
            checked={settings.motion}
            onChange={(v) =>
              void action(
                () => put('settings', 'settings', { ...settings, motion: v }),
                'Bewegung gespeichert.',
              )
            }
          />
          <Toggle
            label={tr('Zugklang')}
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
              <Smartphone size={20} />
              {tr('OLYMPION als App')}
            </h2>
            {installed && <Check size={19} />}
          </div>
          <p>
            {installed
              ? tr('Du nutzt OLYMPION bereits als eigenst\u00E4ndige App.')
              : tr(
                  'Installiere die Akademie auf deinem Home-Bildschirm und starte direkt ins Training.',
                )}
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
            {installed ? tr('Bereits als App ge\u00F6ffnet') : tr('App installieren')}
          </button>
          <div className="offline-section">
            <h3>{tr('Dein Training f\u00FCr unterwegs')}</h3>
            <p className="small-text">
              {tr(
                'App-Rahmen und besuchte Inhalte werden zwischengespeichert. Lade Engine und Aufgaben gezielt f\u00FCr Offlinebetrieb herunter.',
              )}
            </p>
            <div className="offline-item">
              <span>
                <strong>{tr('Schachengine')}</strong>
                <small>
                  {engineCached
                    ? tr('Offline bereit \u00B7 1,9 MB')
                    : tr('Stockfish 19 \u00B7 etwa 1,9 MB')}
                </small>
              </span>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void offline('engine')}
              >
                {engineCached ? tr('Neu laden') : tr('Herunterladen')}
              </button>
            </div>
            <div className="offline-item">
              <span>
                <strong>{tr('Alle 1.001 Aufgaben')}</strong>
                <small>
                  {puzzlesCached}
                  {tr(' von 21 Paketen offline')}
                </small>
              </span>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void offline('puzzles')}
              >
                {tr('Herunterladen')}
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
              {tr('Browser um dauerhaften Speicher bitten')}
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
              {tr('Offlinepakete entfernen')}
            </button>
          </div>
          {updateWaiting && (
            <div className="update-note">
              <h3>{tr('Eine neue Version ist verf\u00FCgbar.')}</h3>
              <p>{tr('Laufende Partien werden vor dem Update pausiert und gespeichert.')}</p>
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
                {tr('Gespeichert aktualisieren')}
              </button>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-top">
            <h2>
              <HardDrive size={19} />
              {tr('Deine Daten sichern')}
            </h2>
            <span className="tag">{tr('VERSION 1')}</span>
          </div>
          <p>
            {tr(
              'Exportiere dein aktuelles Profil mit Partien, Puzzleversuchen, Lektionen und Analysen. Die Datei enth\u00E4lt keine Passw\u00F6rter oder Sitzungsschl\u00FCssel.',
            )}
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
            {tr('JSON-Backup herunterladen')}
          </button>
          <label className="button secondary full file-button">
            <Upload size={16} />
            {tr('JSON-Backup importieren')}
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
            {tr(
              'Importe werden \u00FCber stabile IDs zusammengef\u00FChrt. Bei denselben IDs gilt der neuere \u00C4nderungszeitpunkt. Bei einem Zeitgleichstand entscheidet die Ger\u00E4te-ID.',
            )}
          </p>
          <details>
            <summary>{tr('Was wird gespeichert?')}</summary>
            <p>
              {tr(
                'Puzzleversuche, Ergebnisse, Hilfen, Zeit, Lektionen, Partien mit Zuggeschichte und Uhren, Analysen, eigene Fehlerstellungen und Einstellungen. Kontodaten anderer Nutzer sind auf diesem Ger\u00E4t getrennt. Der Service Worker speichert nur \u00F6ffentliche App-Dateien und Puzzlepakete.',
              )}
            </p>
          </details>
          <a href="/engine/COPYING.txt" className="text-button" target="_blank" rel="noreferrer">
            {tr('Stockfish \u00B7 GPL-3.0-Lizenz')}
          </a>
          <a href="/engine/source.tar.gz" className="text-button" download>
            {tr('Stockfish \u00B7 zugeh\u00F6riger Quellcode')}
          </a>
        </section>
      </div>
      {error && <ErrorText>{tr(error)}</ErrorText>}
      {message && (
        <div className="notice" role="status">
          {tr(message)}
        </div>
      )}
      {instructions && (
        <Modal title={tr('OLYMPION installieren')} onClose={() => setInstructions(false)}>
          <p>
            <strong>{tr('iPhone oder iPad:')}</strong>
            {tr(
              ' \u00D6ffne diese Website im Browser. Tippe auf \u201ETeilen\u201C oder das Browsermen\u00FC und dann auf \u201EZum Home-Bildschirm\u201C. In Safari findest du \u201ETeilen\u201C als Quadrat mit Pfeil nach oben.',
            )}
          </p>
          <p>
            <strong>{tr('Android, Windows oder Mac:')}</strong>
            {tr(
              ' Nutze \u201EApp installieren\u201C im Browsermen\u00FC oder das Installationssymbol in der Adressleiste, falls angeboten.',
            )}
          </p>
          <p>
            {tr(
              'Die genaue Option h\u00E4ngt vom Browser ab. Die Website bleibt auch ohne Installation nutzbar.',
            )}
          </p>
          <button className="button primary" onClick={() => setInstructions(false)}>
            {tr('Verstanden')}
          </button>
        </Modal>
      )}
      {backup && (
        <Modal title={tr('Backup in dieses Profil importieren?')} onClose={() => setBackup(null)}>
          <p>
            {backup.length}
            {tr(' gepr\u00FCfte Eintr\u00E4ge werden mit dem aktuellen')}{' '}
            {user ? tr('Konto') : tr('Gastprofil')}
            {tr(' zusammengef\u00FChrt.')}
          </p>
          <div className="button-row">
            <button className="button secondary" onClick={() => setBackup(null)}>
              {tr('Abbrechen')}
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
              {tr('Importieren')}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
