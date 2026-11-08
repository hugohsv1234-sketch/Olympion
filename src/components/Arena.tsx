'use client';
import { useT } from '@/lib/i18n';
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
  Trophy,
  X,
} from 'lucide-react';
import { legalQueuedMove } from '@/lib/premove';
import { botReward, wonGame } from '@/lib/elo';
import { rankedRequest } from '@/lib/account';
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
const TIMES: Record<
  string,
  {
    ms: number;
    increment: number;
  }
> = {
  'Ohne Uhr': { ms: 0, increment: 0 },
  '3+2': { ms: 180000, increment: 2000 },
  '5+0': { ms: 300000, increment: 0 },
  '10+0': { ms: 600000, increment: 0 },
  '15+10': { ms: 900000, increment: 10000 },
};
export default function Arena() {
  const tr = useT();
  const { ready, records, put, settings, user, refreshProfile } = useStore();
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
  const [queued, setQueued] = useState<{
    id: string;
    move: string;
  } | null>(null);
  const [reward, setReward] = useState<number | null>(null);
  const booted = useRef(false),
    liveAbort = useRef<AbortController | null>(null),
    hintAbort = useRef<AbortController | null>(null),
    current = useRef<GameRecord | null>(game),
    actionLock = useRef(false);
  current.current = game;
  useEffect(() => {
    if (!ready || booted.current) return;
    booted.current = true;
    setLive(settings.liveAnalysis);
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
  }, [ready, records, put, settings.liveAnalysis]);
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
    (game.rankedId
      ? rankedRequest<{
          move: string;
          earned: number;
        }>({ action: 'move', gameId: game.rankedId, moves: game.moves }, controller.signal).then(
          async (result) => {
            if (result.earned) {
              setReward(result.earned);
              await refreshProfile();
            }
            return result.move;
          },
        )
      : botMove({ initialFen: game.initialFen, moves: game.moves }, game.level, controller.signal)
    )
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
  }, [game, chess, applyMove, commit, retry, refreshProfile]);
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
      if (
        current.current?.rankedId &&
        current.current.reason === 'Schachmatt' &&
        wonGame(current.current)
      ) {
        await rankedRequest({
          action: 'finish',
          gameId: current.current.rankedId,
          moves: current.current.moves,
        });
        await refreshProfile();
      }
      const t = TIMES[time];
      const ranked = user
        ? await rankedRequest<{
            id: string;
          }>({ action: 'start', level, color })
        : null;
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
        ...(ranked ? { rankedId: ranked.id } : {}),
      };
      setQueued(null);
      setReward(null);
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
    if (
      !g ||
      g.paused ||
      g.result ||
      restore(g).turn() !== g.color ||
      actionLock.current ||
      !legalQueuedMove(restore(g).fen(), m, g.color)
    )
      return;
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
  const moveRef = useRef(move);
  moveRef.current = move;
  useEffect(() => {
    if (!queued || !game || !chess) return;
    if (!settings.premoves || game.id !== queued.id || game.paused || game.result) {
      setQueued(null);
      return;
    }
    if (chess.turn() !== game.color) return;
    const timer = setTimeout(() => {
      setQueued(null);
      if (legalQueuedMove(chess.fen(), queued.move, game.color)) moveRef.current(queued.move);
    }, 0);
    return () => clearTimeout(timer);
  }, [queued, game, chess, settings.premoves]);
  useEffect(() => {
    if (!game?.rankedId || game.reason !== 'Schachmatt' || !wonGame(game)) return;
    let active = true;
    void rankedRequest<{
      earned: number;
    }>({ action: 'finish', gameId: game.rankedId, moves: game.moves })
      .then(async (result) => {
        if (active) {
          setReward(result.earned || botReward(game.level));
          await refreshProfile();
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [game, refreshProfile]);
  const pause = () => {
    if (!game || game.result) return;
    setHint(undefined);
    setQueued(null);
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
    setQueued(null);
    if (game.rankedId) return;
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
        god={tr('ARES \u00B7 DIE ARENA')}
        title={tr('Fordere die G\u00F6tter heraus.')}
        description={tr('20 Gegner. Dein Tempo. Eine echte Herausforderung.')}
      >
        {game && (
          <button className="button secondary" onClick={() => setSetup(!setup)}>
            <Swords size={17} />
            {setup ? tr('Zur Partie') : tr('Gegner & Einstellungen')}
            <ChevronDown size={15} />
          </button>
        )}
      </Heading>
      {setup && (
        <section className="arena-setup panel">
          <div className="setup-main">
            <div className="panel-top">
              <h2>{tr('W\u00E4hle deinen Gegner')}</h2>
              <span className="tag">{tr('ALLE STUFEN FREI')}</span>
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
                <span className="eyebrow">
                  {tr('STUFE ')}
                  {level}
                  {tr(' VON 20')}
                </span>
                <h2>{BOTS[level - 1].name}</h2>
                <p>{tr(BOTS[level - 1].description)}</p>
                <span className="elo-prize">
                  <Trophy size={15} /> +{botReward(level)}
                  {tr(' Elo pro Sieg')}
                </span>
              </div>
            </div>
            <div className="field">
              {tr('Deine Farbe')}
              <div className="segmented">
                <button className={color === 'w' ? 'selected' : ''} onClick={() => setColor('w')}>
                  <span className="color-dot white" />
                  {tr('Wei\u00DF')}
                </button>
                <button className={color === 'b' ? 'selected' : ''} onClick={() => setColor('b')}>
                  <span className="color-dot black" />
                  {tr('Schwarz')}
                </button>
              </div>
            </div>
            <label className="field">
              {tr('Bedenkzeit')}
              <select value={time} onChange={(e) => setTime(e.target.value)}>
                {Object.keys(TIMES).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <Toggle
              label={tr('Premoves')}
              description={tr('Plane deinen n\u00E4chsten Zug w\u00E4hrend der Bot nachdenkt')}
              checked={settings.premoves}
              onChange={(v) => {
                setQueued(null);
                void put('settings', 'settings', { ...settings, premoves: v });
              }}
            />
            <Toggle
              label={tr('Live-Zugbewertung')}
              description={tr('Bewertung erst nach deinem Zug')}
              checked={live}
              onChange={setLive}
            />
            <Toggle
              label={tr('Hinweise vor dem Zug')}
              description={tr('Markiert die Partie als mit Hilfen gespielt')}
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
              {loadingEngine ? tr('Engine wird geladen \u2026') : tr('Partie starten')}
              <ArrowRight size={18} />
            </button>
            <p className="small-text">
              {tr(
                'Stockfish 19 \u00B7 Engine-Download etwa 1,9 MB beim ersten Spiel. Die Stufen sind keine kalibrierten Elo-Werte.',
              )}
            </p>
          </div>
        </section>
      )}
      {error && (
        <ErrorText>
          {tr(error)}{' '}
          <button className="text-button" onClick={() => setRetry((x) => x + 1)}>
            {tr('Erneut versuchen')}
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
                  <span className="tag">
                    {tr('STUFE ')}
                    {game.level}
                  </span>
                </strong>
                <span>
                  {busy
                    ? tr('\u00DCberlegt \u2026')
                    : game.result
                      ? game.reason
                      : game.paused
                        ? tr('Training pausiert')
                        : tr('Dein Gegner')}
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
                disabled={
                  game.paused ||
                  Boolean(game.result) ||
                  (chess.turn() !== game.color && !settings.premoves)
                }
                premoveColor={settings.premoves ? game.color : undefined}
                onPremove={(m) => {
                  const latest = current.current;
                  if (latest && !latest.paused && !latest.result) {
                    if (restore(latest).turn() === latest.color) move(m);
                    else setQueued({ id: latest.id, move: m });
                  }
                }}
                queuedMove={queued?.id === game.id ? queued.move : undefined}
                cancelPremove={() => setQueued(null)}
                lastMove={game.moves.at(-1)}
                arrow={hint}
              />
              {queued && (
                <div className="premove-notice" role="status">
                  <Zap size={15} />
                  {tr(' Zug vorgemerkt: ')}
                  {queued.move}
                  <button
                    className="icon-button"
                    aria-label={tr('Premove abbrechen')}
                    onClick={() => setQueued(null)}
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
              {game.paused && !game.result && (
                <div className="board-pause">
                  <Pause size={28} />
                  <h3>{tr('Dein Training pausiert.')}</h3>
                  <p>{tr('Stellung und Uhr sind gespeichert.')}</p>
                  <button className="button primary" onClick={pause} disabled={loadingEngine}>
                    <Play size={16} />
                    {tr('Fortsetzen')}
                  </button>
                </div>
              )}
            </div>
            <div className="player-bar bottom-player">
              <span className="avatar">{settings.name[0]}</span>
              <div>
                <strong>
                  {settings.name}
                  <span className="tag">{game.color === 'w' ? tr('WEISS') : tr('SCHWARZ')}</span>
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
                aria-label={tr('Brett drehen')}
              >
                <FlipVertical2 size={19} />
              </button>
              <button
                className="icon-button"
                onClick={undo}
                disabled={!game.moves.length || Boolean(game.result) || Boolean(game.rankedId)}
                aria-label={tr('Zug zur\u00FCcknehmen (Trainingshilfe)')}
              >
                <Undo2 size={19} />
              </button>
              <button
                className="icon-button"
                onClick={pause}
                disabled={Boolean(game.result)}
                aria-label={game.paused ? tr('Partie fortsetzen') : tr('Partie pausieren')}
              >
                {game.paused ? <Play size={19} /> : <Pause size={19} />}
              </button>
              <button
                className="icon-button"
                onClick={() =>
                  download('olympion-partie.pgn', gamePgn(game), 'application/x-chess-pgn')
                }
                aria-label={tr('PGN exportieren')}
              >
                <Download size={19} />
              </button>
              <span className="board-tool-label">
                {game.assists ? tr('Mit Trainingshilfen') : tr('Ohne Zughinweise')}
              </span>
            </div>
          </div>
          <aside className="play-panel">
            <section className="panel move-panel">
              <div className="panel-top">
                <h2>{tr('Deine Partie')}</h2>
                <span className="tag">{game.clock}</span>
              </div>
              {game.result ? (
                <div className="game-result">
                  <strong>{game.result === '*' ? tr('Beendet') : game.result}</strong>
                  <p>{tr(game.reason || '')}</p>
                  {wonGame(game) && (!game.rankedId || game.reason === 'Schachmatt') && (
                    <div className="earned-elo">
                      <Trophy size={21} />
                      <strong>
                        +{reward ?? botReward(game.level)}
                        {tr(' Elo')}
                      </strong>
                      <span>
                        {game.rankedId
                          ? reward === null
                            ? 'Wird bestätigt …'
                            : 'Für deine All-Time-Rangliste'
                          : tr('In deinem Gastprofil gespeichert')}
                      </span>
                    </div>
                  )}
                  <div className="button-stack">
                    <Link className="button primary" href={'/analyse?game=' + game.id}>
                      {tr('Partie analysieren ')}
                      <ArrowRight size={16} />
                    </Link>
                    <button
                      className="button secondary"
                      onClick={() => void start()}
                      disabled={loadingEngine}
                    >
                      <RotateCcw size={16} />
                      {tr('Revanche')}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="small-text">
                  {game.paused
                    ? tr('Die Uhr ist angehalten.')
                    : chess.isCheck()
                      ? tr('Schach! Sch\u00FCtze deinen K\u00F6nig.')
                      : chess.turn() === game.color
                        ? tr('Du bist am Zug.')
                        : tr('Dein Gegner berechnet einen Zug.')}
                </p>
              )}
              <div className="move-list" aria-label={tr('Zugliste')}>
                {history.length ? (
                  history.map((m, i) => (
                    <span className={'move ' + (i === history.length - 1 ? 'current' : '')} key={i}>
                      {m.color === 'w' && <small>{Math.floor(i / 2) + 1}.</small>}
                      {m.san}
                    </span>
                  ))
                ) : (
                  <p>{tr('Noch keine Z\u00FCge.')}</p>
                )}
              </div>
              {!game.result && (
                <div className="game-actions">
                  <button className="text-button" onClick={() => setConfirm('resign')}>
                    <Flag size={15} />
                    {tr('Aufgeben')}
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
                      {tr('Remis beanspruchen')}
                    </button>
                  )}
                  {chess.turn() === game.color && claims.length > 0 && (
                    <details>
                      <summary>{tr('Remis mit angek\u00FCndigtem Zug')}</summary>
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
                          {c.san} · {tr(c.reason)}
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
                  {tr('Live-Analyse')}
                </h2>
                <span className="status-dot" />
              </div>
              <Toggle
                label={tr('Zugqualit\u00E4t anzeigen')}
                checked={game.live}
                onChange={(v) => {
                  setLive(v);
                  if (!v) {
                    liveAbort.current?.abort();
                    setAnalysing(false);
                    setQuality(null);
                  }
                  void commit({ ...game, live: v }).catch(() => undefined);
                }}
              />
              <Toggle
                label={tr('Premoves')}
                checked={settings.premoves}
                onChange={(v) => {
                  setQueued(null);
                  void put('settings', 'settings', { ...settings, premoves: v });
                }}
              />
              {analysing ? (
                <Loading text={tr('Analyse l\u00E4uft \u00B7 noch keine Bewertung')} />
              ) : quality ? (
                <QualityCard result={quality} />
              ) : (
                <p>
                  {tr(
                    'Nach deinem Zug vergleichen wir ihn mit dem besten gefundenen Zug. Die Analyse rechnet unabh\u00E4ngig von der Botstufe.',
                  )}
                </p>
              )}
              {hintMode && !game.result && (
                <button
                  className="button secondary full"
                  onClick={() => void getHint()}
                  disabled={analysing || game.paused || chess.turn() !== game.color}
                >
                  {tr('Bestzug als Hilfe anzeigen')}
                </button>
              )}
            </section>
            <div className="small-text">
              {tr(
                'Beim App-Wechsel pausiert dieses Training sichtbar. Zeit wird aus Zeitstempeln berechnet. Zugr\u00FCcknahmen und Bestzughinweise werden als Hilfen gespeichert.',
              )}
            </div>
          </aside>
        </div>
      )}
      {confirm && (
        <Modal
          title={confirm === 'new' ? tr('Neue Partie beginnen?') : tr('Partie aufgeben?')}
          onClose={() => setConfirm(null)}
        >
          <p>
            {confirm === 'new'
              ? tr(
                  'Deine laufende Partie wird als beendet gespeichert. Danach startet die neue Herausforderung.',
                )
              : tr('Die Partie bleibt gespeichert und kann anschlie\u00DFend analysiert werden.')}
          </p>
          <div className="button-row">
            <button className="button secondary" onClick={() => setConfirm(null)}>
              {tr('Abbrechen')}
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
              {confirm === 'new' ? tr('Neue Partie starten') : tr('Aufgeben')}
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
