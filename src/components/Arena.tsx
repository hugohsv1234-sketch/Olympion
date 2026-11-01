'use client';
import { uuid } from '@/lib/id';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Color } from 'chess.js';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronDown,
  Download,
  Flag,
  FlipVertical2,
  Pause,
  Play,
  RotateCcw,
  Swords,
  Undo2,
  Zap,
} from 'lucide-react';
import { BOTS } from '@/lib/bots';
import {
  automaticResult,
  captured,
  claimReason,
  DEFAULT_POSITION,
  gamePgn,
  getRemaining,
  intendedClaims,
  playUci,
  restore,
  timeoutResult,
} from '@/lib/chess';
import { botMove, evaluateMove, getEngine } from '@/lib/engine';
import type { GameRecord, MoveQuality } from '@/lib/types';
import { download } from '@/lib/storage';
import { useStore } from './Provider';
import { ErrorText, Heading, Loading, Modal, Portrait, QualityCard, Toggle } from './Common';
import Chessboard, { Piece } from './Chessboard';
const TIMES: Record<string, { ms: number; increment: number }> = {
  'Ohne Uhr': { ms: 0, increment: 0 },
  '3+2': { ms: 180000, increment: 2000 },
  '5+0': { ms: 300000, increment: 0 },
  '10+0': { ms: 600000, increment: 0 },
  '15+10': { ms: 900000, increment: 10000 },
};
export default function Arena() {
  const { ready, records, put, settings } = useStore();
  const [level, setLevel] = useState(1),
    [color, setColor] = useState<Color>('w'),
    [time, setTime] = useState('10+0'),
    [live, setLive] = useState(true),
    [hintMode, setHintMode] = useState(false),
    [game, setGame] = useState<GameRecord | null>(null),
    [orientation, setOrientation] = useState<Color>('w'),
    [busy, setBusy] = useState(false),
    [loadingEngine, setLoadingEngine] = useState(false),
    [analysing, setAnalysing] = useState(false),
    [quality, setQuality] = useState<MoveQuality | null>(null),
    [error, setError] = useState(''),
    [now, setNow] = useState(() => Date.now()),
    [setup, setSetup] = useState(true),
    [confirm, setConfirm] = useState<'new' | 'resign' | null>(null),
    [hint, setHint] = useState<string | undefined>(),
    [retry, setRetry] = useState(0);
  const booted = useRef(false),
    liveAbort = useRef<AbortController | null>(null),
    hintAbort = useRef<AbortController | null>(null),
    current = useRef<GameRecord | null>(game),
    actionLock = useRef(false);
  current.current = game;
  useEffect(() => {
    if (!ready || booted.current) return;
    booted.current = true;
    const active = records
      .filter((r) => r.kind === 'game')
      .map((r) => r.value as GameRecord)
      .filter((g) => !g.result)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (active) {
      const resumed = { ...active, remaining: active.remaining, paused: true, turnStarted: null };
      setGame(resumed);
      setLevel(active.level);
      setColor(active.color);
      setOrientation(active.color);
      setLive(active.live);
      setSetup(false);
      void put('game:' + active.id, 'game', resumed).catch(() => undefined);
    }
  }, [ready, records, put]);
  const commit = useCallback(
    async (next: GameRecord) => {
      current.current = next;
      setGame(next);
      await put('game:' + next.id, 'game', next);
    },
    [put],
  );
  const chess = useMemo(() => (game ? restore(game) : null), [game]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const pause = () => {
      const g = current.current;
      if (document.hidden && g && !g.paused && !g.result) {
        void commit({
          ...g,
          remaining: getRemaining(g),
          paused: true,
          turnStarted: null,
          updatedAt: Date.now(),
        }).catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, [commit]);
  useEffect(
    () => () => {
      liveAbort.current?.abort();
      hintAbort.current?.abort();
      const g = current.current;
      if (g && !g.result && !g.paused)
        void commit({
          ...g,
          remaining: getRemaining(g),
          paused: true,
          turnStarted: null,
          updatedAt: Date.now(),
        }).catch(() => undefined);
    },
    [commit],
  );
  const applyMove = useCallback(
    async (g: GameRecord, move: string) => {
      const c = restore(g);
      const side = c.turn();
      const remaining = getRemaining(g);
      if (g.clock !== 'Ohne Uhr' && remaining[side] <= 0) {
        await commit({
          ...g,
          ...timeoutResult(c, side),
          remaining,
          turnStarted: null,
          updatedAt: Date.now(),
        });
        return;
      }
      const before = { ...remaining };
      playUci(c, move);
      if (g.clock !== 'Ohne Uhr') remaining[side] += g.increment;
      const end = automaticResult(c);
      await commit({
        ...g,
        moves: [...g.moves, move],
        remaining,
        clockHistory: [...(g.clockHistory || []), before],
        turnStarted: end ? null : Date.now(),
        updatedAt: Date.now(),
        result: end?.result || null,
        reason: end?.reason,
      });
    },
    [commit],
  );
  useEffect(() => {
    if (!game || !chess || game.paused || game.result || chess.turn() === game.color) return;
    const controller = new AbortController();
    const id = game.id,
      ply = game.moves.length;
    setBusy(true);
    setError('');
    const reason = claimReason(chess);
    if (reason) {
      void commit({ ...game, result: '½-½', reason, turnStarted: null }).catch(() => undefined);
      setBusy(false);
      return;
    }
    botMove({ initialFen: game.initialFen, moves: game.moves }, game.level, controller.signal)
      .then(async (move) => {
        const latest = current.current;
        if (
          !controller.signal.aborted &&
          latest?.id === id &&
          latest.moves.length === ply &&
          !latest.paused &&
          !latest.result
        )
          await applyMove(latest, move);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => {
      controller.abort();
      setBusy(false);
    };
  }, [game, chess, applyMove, commit, retry]);
  useEffect(() => {
    if (!game || !chess || game.paused || game.result || game.clock === 'Ohne Uhr') return;
    const remaining = getRemaining(game, now);
    if (remaining[chess.turn()] <= 0)
      void commit({
        ...game,
        ...timeoutResult(chess, chess.turn()),
        remaining,
        turnStarted: null,
        updatedAt: Date.now(),
      }).catch(() => undefined);
  }, [now, game, chess, commit]);
  const start = async () => {
    if (actionLock.current) return;
    actionLock.current = true;
    setLoadingEngine(true);
    setError('');
    liveAbort.current?.abort();
    hintAbort.current?.abort();
    try {
      await getEngine().init();
      if (current.current && !current.current.result)
        await commit({
          ...current.current,
          result: '*',
          reason: 'Training beendet',
          paused: true,
          turnStarted: null,
        });
      const t = TIMES[time];
      const next: GameRecord = {
        id: uuid(),
        initialFen: DEFAULT_POSITION,
        moves: [],
        level,
        color,
        clock: time,
        remaining: { w: t.ms, b: t.ms },
        clockHistory: [],
        increment: t.increment,
        turnStarted: Date.now(),
        paused: false,
        result: null,
        assists: hintMode ? 1 : 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        live,
      };
      setOrientation(color);
      setQuality(null);
      setHint(undefined);
      await commit(next);
      setSetup(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      actionLock.current = false;
      setLoadingEngine(false);
      setConfirm(null);
    }
  };
  const move = (m: string) => {
    const g = current.current;
    if (!g || g.paused || g.result || restore(g).turn() !== g.color || actionLock.current) return;
    actionLock.current = true;
    setHint(undefined);
    hintAbort.current?.abort();
    liveAbort.current?.abort();
    if (g.live) {
      const controller = new AbortController();
      liveAbort.current = controller;
      setAnalysing(true);
      setQuality(null);
      evaluateMove({ initialFen: g.initialFen, moves: g.moves }, m, 120000, controller.signal)
        .then(async (result) => {
          if (controller.signal.aborted || current.current?.id !== g.id) return;
          setQuality(result);
          await put(`live:${g.id}:${g.moves.length}`, 'review', result);
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setError('Zugbewertung: ' + (e instanceof Error ? e.message : String(e)));
        })
        .finally(() => {
          if (!controller.signal.aborted) setAnalysing(false);
        });
    }
    void applyMove(g, m)
      .catch((e) => setError(String(e.message)))
      .finally(() => {
        actionLock.current = false;
      });
  };
  const pause = () => {
    if (!game || game.result) return;
    setHint(undefined);
    if (game.paused) {
      setLoadingEngine(true);
      getEngine()
        .init()
        .then(() => commit({ ...game, paused: false, turnStarted: Date.now() }))
        .catch((e) => setError(String(e.message)))
        .finally(() => setLoadingEngine(false));
    } else
      void commit({
        ...game,
        remaining: getRemaining(game),
        paused: true,
        turnStarted: null,
      }).catch(() => undefined);
  };
  const undo = () => {
    if (!game || !game.moves.length || game.result) return;
    liveAbort.current?.abort();
    hintAbort.current?.abort();
    setAnalysing(false);
    setQuality(null);
    setHint(undefined);
    const g = restore(game);
    const remove = g.turn() === game.color ? Math.min(2, game.moves.length) : 1;
    const n = game.moves.length - remove;
    void commit({
      ...game,
      moves: game.moves.slice(0, n),
      clockHistory: game.clockHistory?.slice(0, n),
      remaining: game.clockHistory?.[n] || game.remaining,
      turnStarted: game.paused ? null : Date.now(),
      assists: game.assists + 1,
      updatedAt: Date.now(),
    }).catch(() => undefined);
  };
  const getHint = async () => {
    if (!game || !chess || chess.turn() !== game.color || game.result) return;
    hintAbort.current?.abort();
    const controller = new AbortController();
    hintAbort.current = controller;
    setAnalysing(true);
    try {
      await commit({ ...game, assists: game.assists + 1 });
      const r = await getEngine().search(game, {
        nodes: 120000,
        skill: 20,
        signal: controller.signal,
      });
      if (
        !controller.signal.aborted &&
        current.current?.id === game.id &&
        current.current.moves.length === game.moves.length
      )
        setHint(r.bestMove);
    } catch (e) {
      if (!controller.signal.aborted) setError(String((e as Error).message));
    } finally {
      if (!controller.signal.aborted) setAnalysing(false);
    }
  };
  const remaining = game ? getRemaining(game, now) : { w: 0, b: 0 };
  const bot = BOTS[(game?.level || level) - 1];
  const claims = chess ? intendedClaims(chess) : [];
  const history = chess?.history({ verbose: true }) || [];
  return (
    <>
      <Heading
        god="ARES · DIE ARENA"
        title="Fordere die Götter heraus."
        description="20 Gegner. Dein Tempo. Eine echte Herausforderung."
      >
        {game && (
          <button className="button secondary" onClick={() => setSetup(!setup)}>
            <Swords size={17} />
            {setup ? 'Zur Partie' : 'Gegner & Einstellungen'}
            <ChevronDown size={15} />
          </button>
        )}
      </Heading>
      {setup && (
        <section className="arena-setup panel">
          <div className="setup-main">
            <div className="panel-top">
              <h2>Wähle deinen Gegner</h2>
              <span className="tag">ALLE STUFEN FREI</span>
            </div>
            <div className="bot-grid">
              {BOTS.map((b) => (
                <button
                  className={'bot-choice ' + (b.level === level ? 'selected' : '')}
                  aria-pressed={b.level === level}
                  key={b.level}
                  onClick={() => setLevel(b.level)}
                >
                  <Portrait level={b.level} />
                  <strong>{b.name}</strong>
                  <small>{String(b.level).padStart(2, '0')}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="setup-side">
            <div className="selected-bot">
              <Portrait level={level} size="large" />
              <div>
                <span className="eyebrow">STUFE {level} VON 20</span>
                <h2>{BOTS[level - 1].name}</h2>
                <p>{BOTS[level - 1].description}</p>
              </div>
            </div>
            <div className="field">
              Deine Farbe
              <div className="segmented">
                <button className={color === 'w' ? 'selected' : ''} onClick={() => setColor('w')}>
                  <span className="color-dot white" />
                  Weiß
                </button>
                <button className={color === 'b' ? 'selected' : ''} onClick={() => setColor('b')}>
                  <span className="color-dot black" />
                  Schwarz
                </button>
              </div>
            </div>
            <label className="field">
              Bedenkzeit
              <select value={time} onChange={(e) => setTime(e.target.value)}>
                {Object.keys(TIMES).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <Toggle
              label="Live-Zugbewertung"
              description="Bewertung erst nach deinem Zug"
              checked={live}
              onChange={setLive}
            />
            <Toggle
              label="Hinweise vor dem Zug"
              description="Markiert die Partie als mit Hilfen gespielt"
              checked={hintMode}
              onChange={setHintMode}
            />
            <button
              className="button primary full"
              disabled={!ready || loadingEngine}
              onClick={() => {
                if (game && !game.result) setConfirm('new');
                else void start();
              }}
            >
              {loadingEngine ? 'Engine wird geladen …' : 'Partie starten'}
              <ArrowRight size={18} />
            </button>
            <p className="small-text">
              Stockfish 19 · Engine-Download etwa 1,9 MB beim ersten Spiel. Die Stufen sind keine
              kalibrierten Elo-Werte.
            </p>
          </div>
        </section>
      )}
      {error && (
        <ErrorText>
          {error}{' '}
          <button className="text-button" onClick={() => setRetry((x) => x + 1)}>
            Erneut versuchen
          </button>
        </ErrorText>
      )}
      {game && chess && (
        <div className="play-layout arena-layout">
          <div className="board-column">
            <div className="player-bar">
              <Portrait level={game.level} />
              <div>
                <strong>
                  {bot.name}
                  <span className="tag">STUFE {game.level}</span>
                </strong>
                <span>
                  {busy
                    ? 'Überlegt …'
                    : game.result
                      ? game.reason
                      : game.paused
                        ? 'Training pausiert'
                        : 'Dein Gegner'}
                </span>
              </div>
              <Clock
                ms={remaining[game.color === 'w' ? 'b' : 'w']}
                hidden={game.clock === 'Ohne Uhr'}
                active={!game.paused && !game.result && chess.turn() !== game.color}
              />
            </div>
            <div className="board-wrap">
              <Chessboard
                fen={chess.fen()}
                orientation={orientation}
                onMove={move}
                disabled={game.paused || Boolean(game.result) || chess.turn() !== game.color}
                lastMove={game.moves.at(-1)}
                arrow={hint}
              />
              {game.paused && !game.result && (
                <div className="board-pause">
                  <Pause size={28} />
                  <h3>Dein Training pausiert.</h3>
                  <p>Stellung und Uhr sind gespeichert.</p>
                  <button className="button primary" onClick={pause} disabled={loadingEngine}>
                    <Play size={16} />
                    Fortsetzen
                  </button>
                </div>
              )}
            </div>
            <div className="player-bar bottom-player">
              <span className="avatar">{settings.name[0]}</span>
              <div>
                <strong>
                  {settings.name}
                  <span className="tag">{game.color === 'w' ? 'WEISS' : 'SCHWARZ'}</span>
                </strong>
                <div className="captured-pieces">
                  {captured(chess, game.color).map((p, i) => (
                    <Piece type={p} color={game.color === 'w' ? 'b' : 'w'} key={i} />
                  ))}
                </div>
              </div>
              <Clock
                ms={remaining[game.color]}
                hidden={game.clock === 'Ohne Uhr'}
                active={!game.paused && !game.result && chess.turn() === game.color}
              />
            </div>
            <div className="board-tools">
              <button
                className="icon-button"
                onClick={() => setOrientation((o) => (o === 'w' ? 'b' : 'w'))}
                aria-label="Brett drehen"
              >
                <FlipVertical2 size={19} />
              </button>
              <button
                className="icon-button"
                onClick={undo}
                disabled={!game.moves.length || Boolean(game.result)}
                aria-label="Zug zurücknehmen (Trainingshilfe)"
              >
                <Undo2 size={19} />
              </button>
              <button
                className="icon-button"
                onClick={pause}
                disabled={Boolean(game.result)}
                aria-label={game.paused ? 'Partie fortsetzen' : 'Partie pausieren'}
              >
                {game.paused ? <Play size={19} /> : <Pause size={19} />}
              </button>
              <button
                className="icon-button"
                onClick={() =>
                  download('olympion-partie.pgn', gamePgn(game), 'application/x-chess-pgn')
                }
                aria-label="PGN exportieren"
              >
                <Download size={19} />
              </button>
              <span className="board-tool-label">
                {game.assists ? 'Mit Trainingshilfen' : 'Ohne Zughinweise'}
              </span>
            </div>
          </div>
          <aside className="play-panel">
            <section className="panel move-panel">
              <div className="panel-top">
                <h2>Deine Partie</h2>
                <span className="tag">{game.clock}</span>
              </div>
              {game.result ? (
                <div className="game-result">
                  <strong>{game.result === '*' ? 'Beendet' : game.result}</strong>
                  <p>{game.reason}</p>
                  <div className="button-stack">
                    <Link className="button primary" href={'/analyse?game=' + game.id}>
                      Partie analysieren <ArrowRight size={16} />
                    </Link>
                    <button
                      className="button secondary"
                      onClick={() => void start()}
                      disabled={loadingEngine}
                    >
                      <RotateCcw size={16} />
                      Revanche
                    </button>
                  </div>
                </div>
              ) : (
                <p className="small-text">
                  {game.paused
                    ? 'Die Uhr ist angehalten.'
                    : chess.isCheck()
                      ? 'Schach! Schütze deinen König.'
                      : chess.turn() === game.color
                        ? 'Du bist am Zug.'
                        : 'Dein Gegner berechnet einen Zug.'}
                </p>
              )}
              <div className="move-list" aria-label="Zugliste">
                {history.length ? (
                  history.map((m, i) => (
                    <span className={'move ' + (i === history.length - 1 ? 'current' : '')} key={i}>
                      {m.color === 'w' && <small>{Math.floor(i / 2) + 1}.</small>}
                      {m.san}
                    </span>
                  ))
                ) : (
                  <p>Noch keine Züge.</p>
                )}
              </div>
              {!game.result && (
                <div className="game-actions">
                  <button className="text-button" onClick={() => setConfirm('resign')}>
                    <Flag size={15} />
                    Aufgeben
                  </button>
                  {chess.turn() === game.color && claimReason(chess) && (
                    <button
                      className="button secondary"
                      onClick={() =>
                        void commit({
                          ...game,
                          result: '½-½',
                          reason: claimReason(chess)!,
                          turnStarted: null,
                        }).catch(() => undefined)
                      }
                    >
                      Remis beanspruchen
                    </button>
                  )}
                  {chess.turn() === game.color && claims.length > 0 && (
                    <details>
                      <summary>Remis mit angekündigtem Zug</summary>
                      {claims.map((c) => (
                        <button
                          className="text-button"
                          key={c.move}
                          onClick={() =>
                            void commit({
                              ...game,
                              result: '½-½',
                              reason: c.reason + ' · angekündigt: ' + c.san,
                              turnStarted: null,
                            }).catch(() => undefined)
                          }
                        >
                          {c.san} · {c.reason}
                        </button>
                      ))}
                    </details>
                  )}
                </div>
              )}
            </section>
            <section className="panel live-panel">
              <div className="panel-top">
                <h2>
                  <Zap size={17} />
                  Live-Analyse
                </h2>
                <span className="status-dot" />
              </div>
              <Toggle
                label="Zugqualität anzeigen"
                checked={game.live}
                onChange={(v) => {
                  setLive(v);
                  void commit({ ...game, live: v }).catch(() => undefined);
                }}
              />
              {analysing ? (
                <Loading text="Analyse läuft · noch keine Bewertung" />
              ) : quality ? (
                <QualityCard result={quality} />
              ) : (
                <p>
                  Nach deinem Zug vergleichen wir ihn mit dem besten gefundenen Zug. Die Analyse
                  rechnet unabhängig von der Botstufe.
                </p>
              )}
              {hintMode && !game.result && (
                <button
                  className="button secondary full"
                  onClick={() => void getHint()}
                  disabled={analysing || game.paused || chess.turn() !== game.color}
                >
                  Bestzug als Hilfe anzeigen
                </button>
              )}
            </section>
            <div className="small-text">
              Beim App-Wechsel pausiert dieses Training sichtbar. Zeit wird aus Zeitstempeln
              berechnet. Zugrücknahmen und Bestzughinweise werden als Hilfen gespeichert.
            </div>
          </aside>
        </div>
      )}
      {confirm && (
        <Modal
          title={confirm === 'new' ? 'Neue Partie beginnen?' : 'Partie aufgeben?'}
          onClose={() => setConfirm(null)}
        >
          <p>
            {confirm === 'new'
              ? 'Deine laufende Partie wird als beendet gespeichert. Danach startet die neue Herausforderung.'
              : 'Die Partie bleibt gespeichert und kann anschließend analysiert werden.'}
          </p>
          <div className="button-row">
            <button className="button secondary" onClick={() => setConfirm(null)}>
              Abbrechen
            </button>
            <button
              className="button primary"
              disabled={loadingEngine}
              onClick={() => {
                if (confirm === 'new') void start();
                else if (game) {
                  void commit({
                    ...game,
                    result: game.color === 'w' ? '0-1' : '1-0',
                    reason: 'Aufgegeben',
                    turnStarted: null,
                  }).catch(() => undefined);
                  setConfirm(null);
                }
              }}
            >
              {confirm === 'new' ? 'Neue Partie starten' : 'Aufgeben'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function Clock({ ms, active, hidden }: { ms: number; active: boolean; hidden: boolean }) {
  if (hidden) return <span className="clock untimed">∞</span>;
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return (
    <div
      className={'clock ' + (active ? 'active' : '')}
      aria-label={`${Math.floor(seconds / 60)} Minuten ${seconds % 60} Sekunden`}
    >
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
    </div>
  );
}
