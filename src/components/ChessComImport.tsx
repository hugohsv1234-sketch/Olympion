'use client';
import { useT, useLocale } from '@/lib/i18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Check,
  Clock3,
  Globe2,
  Loader2,
  Search,
  Swords,
  X,
} from 'lucide-react';
import {
  chessCom,
  formatTimeControl,
  type ArchiveMonth,
  type ChessComAccount,
  type ChessComGame,
} from '@/lib/chesscom';
import type { AnalysisRecord } from '@/lib/types';
import { useStore } from './Provider';
const resultName = { win: 'Sieg', loss: 'Niederlage', draw: 'Remis' };
export default function ChessComImport({
  onSelect,
  analyzing,
  activeId,
}: {
  onSelect: (game: ChessComGame) => Promise<void>;
  analyzing: boolean;
  activeId?: string;
}) {
  const locale = useLocale();
  const tr = useT();
  const { records } = useStore();
  const [username, setUsername] = useState('');
  const [account, setAccount] = useState<ChessComAccount | null>(null);
  const [month, setMonth] = useState('');
  const [games, setGames] = useState<ChessComGame[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [opponent, setOpponent] = useState('');
  const [visible, setVisible] = useState(9);
  const [opening, setOpening] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const connect = useCallback(async (name: string) => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError('');
    setGames([]);
    setAccount(null);
    setTimeFilter('all');
    setResultFilter('all');
    setOpponent('');
    setVisible(9);
    try {
      const profile = await chessCom.account(name, request.signal);
      if (request.signal.aborted) return;
      setAccount(profile);
      try {
        localStorage.setItem('olympion-chesscom-name', profile.username);
      } catch {}
      const latest = profile.archives[0];
      setMonth(latest?.key || '');
      if (latest) {
        const list = await chessCom.games(profile.username, latest, request.signal);
        if (!request.signal.aborted) setGames(list);
      }
    } catch (e) {
      if (!request.signal.aborted)
        setError(e instanceof Error ? e.message : 'Partien konnten nicht geladen werden.');
    } finally {
      if (controller.current === request) setBusy(false);
    }
  }, []);
  useEffect(() => {
    let name = new URLSearchParams(location.search).get('chesscom') || '';
    const auto = Boolean(name);
    if (!name) {
      try {
        name = localStorage.getItem('olympion-chesscom-name') || '';
      } catch {}
    }
    setUsername(name);
    const timer = auto ? setTimeout(() => void connect(name), 0) : undefined;
    return () => {
      if (timer) clearTimeout(timer);
      controller.current?.abort();
    };
  }, [connect]);
  const changeMonth = async (next: ArchiveMonth) => {
    if (!account) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setMonth(next.key);
    setGames([]);
    setVisible(9);
    setError('');
    setBusy(true);
    try {
      const list = await chessCom.games(account.username, next, request.signal);
      if (!request.signal.aborted) setGames(list);
    } catch (e) {
      if (!request.signal.aborted)
        setError(e instanceof Error ? e.message : 'Archiv konnte nicht geladen werden.');
    } finally {
      if (controller.current === request) setBusy(false);
    }
  };
  const completed = useMemo(
    () =>
      new Set(
        records
          .filter((r) => r.kind === 'analysis' && (r.value as AnalysisRecord).complete)
          .map((r) => (r.value as AnalysisRecord).gameId),
      ),
    [records],
  );
  const filtered = useMemo(
    () =>
      games.filter(
        (game) =>
          (timeFilter === 'all' || game.source.timeClass === timeFilter) &&
          (resultFilter === 'all' || game.source.result === resultFilter) &&
          (game.source.color === 'w' ? game.source.black : game.source.white)
            .toLowerCase()
            .includes(opponent.trim().toLowerCase()),
      ),
    [games, timeFilter, resultFilter, opponent],
  );
  const wins = games.filter((g) => g.source.result === 'win').length;
  const draws = games.filter((g) => g.source.result === 'draw').length;
  const select = async (game: ChessComGame) => {
    setOpening(game.id);
    setError('');
    try {
      await onSelect(game);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Diese Partie konnte nicht geöffnet werden.');
    } finally {
      setOpening(null);
    }
  };
  return (
    <section className="chesscom-hub" aria-labelledby="chesscom-heading">
      <div className="chesscom-heading">
        <div className="import-emblem">
          <Globe2 size={24} />
        </div>
        <div>
          <span className="eyebrow">{tr('DEINE PARTIEN. DEIN FORTSCHRITT.')}</span>
          <h2 id="chesscom-heading">{tr('Von Chess.com auf den Olymp.')}</h2>
          <p>{tr('Name eingeben. Partie ausw\u00E4hlen. Deine Entscheidungen verstehen.')}</p>
        </div>
        <span className="integration-tag">
          <span />
          {tr(' Ohne Passwort')}
        </span>
      </div>
      <form
        className="chesscom-form"
        onSubmit={(e) => {
          e.preventDefault();
          void connect(username);
        }}
      >
        <label className="chesscom-input" htmlFor="chesscom-username">
          <Search size={19} />
          <input
            id="chesscom-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={tr('Dein Chess.com-Name')}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={50}
            aria-label={tr('Chess.com-Benutzername')}
          />
        </label>
        <button className="button primary" disabled={busy || !username.trim()} type="submit">
          {busy ? <Loader2 className="spin" size={18} /> : <Swords size={18} />}
          {busy ? tr('Partien werden geladen') : tr('Partien laden')} <ArrowRight size={17} />
        </button>
        {busy && (
          <button
            type="button"
            className="icon-button"
            aria-label={tr('Chess.com-Anfrage abbrechen')}
            onClick={() => {
              controller.current?.abort();
              setBusy(false);
            }}
          >
            <X size={18} />
          </button>
        )}
      </form>
      <p className="import-caption">
        {tr(
          '\u00D6ffentliche, abgeschlossene Partien. Die Analyse rechnet mit Stockfish auf deinem Ger\u00E4t.',
        )}
      </p>
      {error && (
        <p className="inline-error" role="alert">
          {tr(error)}
        </p>
      )}
      {account && (
        <div className="chesscom-archive">
          <div className="chesscom-account">
            <div className="account-letter">{account.username[0].toUpperCase()}</div>
            <div className="account-name">
              <strong>{account.username}</strong>
              <span>{tr('Chess.com \u00B7 \u00F6ffentliches Archiv')}</span>
            </div>
            <div className="chesscom-ratings">
              {account.ratings.map((r) => (
                <div key={r.label}>
                  <strong>{r.rating}</strong>
                  <span>{r.label}</span>
                </div>
              ))}
            </div>
            <label className="archive-month">
              <span>{tr('Monat')}</span>
              <select
                aria-label={tr('Partienmonat')}
                value={month}
                disabled={busy || !account.archives.length}
                onChange={(e) => {
                  const next = account.archives.find((m) => m.key === e.target.value);
                  if (next) void changeMonth(next);
                }}
              >
                {!account.archives.length && <option value="">{tr('Kein Archiv')}</option>}
                {account.archives.map((m) => (
                  <option key={m.key} value={m.key}>
                    {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
                      new Date(m.year, m.month - 1, 1),
                    )}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!busy && games.length > 0 && (
            <>
              <div className="archive-summary">
                <span>
                  <strong>{games.length}</strong>
                  {tr(' Partien im Monat')}
                </span>
                <span>
                  <strong>{wins}</strong>
                  {tr(' Siege')}
                </span>
                <span>
                  <strong>{draws}</strong>
                  {tr(' Remis')}
                </span>
                <span>
                  <strong>{games.length - wins - draws}</strong>
                  {tr(' Niederlagen')}
                </span>
                <div className="result-track" aria-label={tr('Monatsbilanz')}>
                  <i style={{ width: (wins / games.length) * 100 + '%' }} />
                  <i style={{ width: (draws / games.length) * 100 + '%' }} />
                </div>
              </div>
              <div className="archive-filters">
                <label>
                  <span className="sr-only">{tr('Bedenkzeit filtern')}</span>
                  <select
                    value={timeFilter}
                    aria-label={tr('Bedenkzeit filtern')}
                    onChange={(e) => {
                      setTimeFilter(e.target.value);
                      setVisible(9);
                    }}
                  >
                    <option value="all">{tr('Alle Bedenkzeiten')}</option>
                    <option value="rapid">{tr('Rapid')}</option>
                    <option value="blitz">{tr('Blitz')}</option>
                    <option value="bullet">{tr('Bullet')}</option>
                    <option value="daily">{tr('Daily')}</option>
                  </select>
                </label>
                <label>
                  <span className="sr-only">{tr('Ergebnis filtern')}</span>
                  <select
                    value={resultFilter}
                    aria-label={tr('Ergebnis filtern')}
                    onChange={(e) => {
                      setResultFilter(e.target.value);
                      setVisible(9);
                    }}
                  >
                    <option value="all">{tr('Alle Ergebnisse')}</option>
                    <option value="win">{tr('Siege')}</option>
                    <option value="loss">{tr('Niederlagen')}</option>
                    <option value="draw">{tr('Remis')}</option>
                  </select>
                </label>
                <label className="opponent-search">
                  <Search size={15} />
                  <input
                    value={opponent}
                    placeholder={tr('Gegner suchen')}
                    aria-label={tr('Gegner suchen')}
                    onChange={(e) => {
                      setOpponent(e.target.value);
                      setVisible(9);
                    }}
                  />
                </label>
                <span>
                  {filtered.length}
                  {tr(' Treffer')}
                </span>
              </div>
            </>
          )}
          {busy ? (
            <div className="archive-loading" role="status">
              <Loader2 className="spin" size={24} />
              {tr(' Archiv wird geladen \u2026')}
            </div>
          ) : !filtered.length ? (
            <div className="archive-empty">
              <Swords size={26} />
              <h3>
                {games.length
                  ? tr('Kein Treffer f\u00FCr diese Filter.')
                  : tr('Noch keine Standardpartien in diesem Archiv.')}
              </h3>
              <p>
                {games.length
                  ? tr('W\u00E4hle eine andere Bedenkzeit oder ein anderes Ergebnis.')
                  : tr(
                      'W\u00E4hle einen anderen Monat. Neue Partien k\u00F6nnen bei Chess.com zeitversetzt erscheinen.',
                    )}
              </p>
            </div>
          ) : (
            <div className="import-game-grid">
              {filtered.slice(0, visible).map((game) => {
                const source = game.source;
                const opponentName = source.color === 'w' ? source.black : source.white;
                const opponentRating =
                  source.color === 'w' ? source.blackRating : source.whiteRating;
                const done = completed.has(game.id);
                return (
                  <article
                    className={
                      'import-game result-' +
                      source.result +
                      (activeId === game.id ? ' is-current' : '')
                    }
                    key={game.id}
                  >
                    <div className="import-game-top">
                      <span className={'result-badge ' + source.result}>
                        {tr(resultName[source.result])}
                      </span>
                      <span className="game-type">
                        <Clock3 size={13} /> {source.timeClass} ·{' '}
                        {formatTimeControl(source.timeControl)}
                      </span>
                    </div>
                    <div className="import-opponent">
                      <span className={'side-indicator side-' + source.color} />
                      <div>
                        <small>
                          {tr('Du spielst ')}
                          {source.color === 'w' ? tr('Wei\u00DF') : tr('Schwarz')}
                          {tr(' gegen')}
                        </small>
                        <strong>
                          {opponentName} <em>{opponentRating ?? '–'}</em>
                        </strong>
                      </div>
                    </div>
                    <div className="import-game-meta">
                      <time dateTime={new Date(source.endedAt).toISOString()}>
                        {new Date(source.endedAt).toLocaleDateString(locale, {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </time>
                      {done && (
                        <span>
                          <Check size={13} />
                          {tr(' Analyse gespeichert')}
                        </span>
                      )}
                    </div>
                    <button
                      className={'button ' + (done ? 'secondary' : 'primary')}
                      disabled={analyzing || opening !== null}
                      onClick={() => void select(game)}
                    >
                      {opening === game.id || (analyzing && activeId === game.id) ? (
                        <Loader2 className="spin" size={16} />
                      ) : (
                        <ArrowRight size={16} />
                      )}
                      {analyzing && activeId === game.id
                        ? tr('Analyse l\u00E4uft')
                        : done
                          ? tr('Analyse \u00F6ffnen')
                          : tr('Partie analysieren')}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
          {filtered.length > visible && !busy && (
            <button className="button secondary load-more" onClick={() => setVisible((n) => n + 9)}>
              {tr('Weitere Partien ')}
              <ArrowDown size={16} />
            </button>
          )}
        </div>
      )}
      <div className="chesscom-disclaimer">
        {tr('OLYMPION ist ein unabh\u00E4ngiges Projekt und nicht mit Chess.com verbunden.')}
      </div>
    </section>
  );
}
