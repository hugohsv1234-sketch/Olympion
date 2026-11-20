'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type Color } from 'chess.js';
import { BookOpen, Check, Lightbulb, RotateCcw, Swords, Undo2 } from 'lucide-react';
import {
  OPENINGS,
  compileOpening,
  matchesOpeningMove,
  openingProgressId,
  undoOpeningTurn,
  type Opening,
  type OpeningLine,
} from '@/lib/openings';
import { automaticResult, claimReason, DEFAULT_POSITION, playUci, restore } from '@/lib/chess';
import { botMove } from '@/lib/engine';
import { BOTS } from '@/lib/bots';
import { useT } from '@/lib/i18n';
import type { LessonResult } from '@/lib/types';
import Chessboard from './Chessboard';
import { ErrorText, Heading } from './Common';
import { useStore } from './Provider';

interface OpeningProgress extends LessonResult {
  assisted: boolean;
}
export default function Openings() {
  const tr = useT();
  const { records, ready } = useStore();
  const [openingId, setOpeningId] = useState(OPENINGS[0].id);
  const [lineId, setLineId] = useState(OPENINGS[0].lines[0].id);
  const [color, setColor] = useState<Color>('w');
  const [level, setLevel] = useState(5);
  const opening = OPENINGS.find((o) => o.id === openingId)!;
  const line = opening.lines.find((l) => l.id === lineId) || opening.lines[0];
  const learned = new Set(
    records
      .filter((r) => r.kind === 'lesson' && (r.value as LessonResult).completed)
      .map((r) => (r.value as LessonResult).lessonId),
  );
  return (
    <>
      <Heading
        god={tr('ATHENE · ERÖFFNUNGSTRAINING', 'ATHENA · OPENING TRAINING')}
        title={tr('Deine ersten Züge. Dein Plan.', 'Your first moves. Your plan.')}
        description={tr(
          'Übe die Zugfolge selbst. Spiele danach die entstandene Stellung gegen einen Bot weiter.',
          'Practise the move order yourself. Then play the resulting position against a bot.',
        )}
      />
      <div className="opening-layout">
        <aside
          className="panel opening-library"
          aria-label={tr('Eröffnungen auswählen', 'Choose an opening')}
        >
          <div className="opening-library-title">
            <BookOpen size={21} />
            <div>
              <h2>{tr('Dein Repertoire', 'Your repertoire')}</h2>
              <p>{tr('8 Eröffnungen · 16 Varianten', '8 openings · 16 variations')}</p>
            </div>
          </div>
          {OPENINGS.map((o) => (
            <button
              key={o.id}
              className={'opening-option ' + (o.id === opening.id ? 'active' : '')}
              aria-pressed={o.id === opening.id}
              onClick={() => {
                setOpeningId(o.id);
                setLineId(o.lines[0].id);
              }}
            >
              <span>
                {tr(o.name, o.en)}
                <small>
                  {o.lines.filter((l) => learned.has(openingProgressId(l, color))).length} /{' '}
                  {o.lines.length} {tr('Varianten geübt', 'variations practised')}
                </small>
              </span>
              <BookOpen size={17} />
            </button>
          ))}
        </aside>
        <div className="opening-main">
          <section
            className="panel opening-settings"
            aria-label={tr('Übung einstellen', 'Exercise settings')}
          >
            <label>
              {tr('Variante', 'Variation')}
              <select value={line.id} onChange={(e) => setLineId(e.target.value)}>
                {opening.lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {tr(l.name, l.en)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tr('Deine Farbe', 'Your colour')}
              <select value={color} onChange={(e) => setColor(e.target.value as Color)}>
                <option value="w">{tr('Weiß', 'White')}</option>
                <option value="b">{tr('Schwarz', 'Black')}</option>
              </select>
            </label>
            <label>
              {tr('Botstärke', 'Bot strength')}
              <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
                {BOTS.map((b) => (
                  <option key={b.level} value={b.level}>
                    {b.level} · {b.name}
                  </option>
                ))}
              </select>
            </label>
          </section>
          {ready && (
            <OpeningBoard
              key={`${line.id}:${color}:${level}`}
              opening={opening}
              line={line}
              color={color}
              level={level}
            />
          )}
        </div>
      </div>
    </>
  );
}

function OpeningBoard({
  opening,
  line,
  color,
  level,
}: {
  opening: Opening;
  line: OpeningLine;
  color: Color;
  level: number;
}) {
  const tr = useT();
  const { put, records, settings } = useStore();
  const target = useMemo(() => compileOpening(line), [line]);
  const [moves, setMoves] = useState<string[]>([]);
  const [mode, setMode] = useState<'line' | 'bot'>('line');
  const [round, setRound] = useState(0);
  const [hint, setHint] = useState(false);
  const [hints, setHints] = useState(0);
  const [errors, setErrors] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const savedRound = useRef(-1);
  const inputLock = useRef(false);
  const chess = useMemo(() => restore({ initialFen: DEFAULT_POSITION, moves }), [moves]);
  const lineDone = mode === 'line' && moves.length === target.moves.length;
  const ending = mode === 'bot' ? automaticResult(chess) : null;
  const drawClaim = mode === 'bot' ? claimReason(chess) : null;
  const stopped = Boolean(ending || drawClaim || moves.length >= 500);
  const waiting = !lineDone && !stopped && chess.turn() !== color;
  const expected = !lineDone && mode === 'line' ? target.moves[moves.length] : undefined;
  const history = chess.history();
  const nextSan = mode === 'line' ? line.moves[moves.length] : undefined;

  useEffect(() => {
    inputLock.current = false;
  }, [moves]);
  useEffect(() => {
    if (!waiting || error) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        const reply =
          mode === 'line'
            ? Promise.resolve(expected!)
            : botMove({ initialFen: DEFAULT_POSITION, moves }, level, controller.signal);
        reply
          .then((move) => {
            if (controller.signal.aborted) return;
            // Validate the returned move before installing a new board state.
            const check = restore({ initialFen: DEFAULT_POSITION, moves });
            playUci(check, move);
            setMoves((current) => (current === moves ? [...current, move] : current));
          })
          .catch((e) => {
            if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
          });
      },
      mode === 'line' && settings.motion ? 550 : 100,
    );
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [waiting, error, mode, expected, moves, level, settings.motion, round]);

  useEffect(() => {
    if (!lineDone || error || savedRound.current === round) return;
    savedRound.current = round;
    const id = openingProgressId(line, color);
    const old = records.find(
      (r) => r.kind === 'lesson' && (r.value as LessonResult).lessonId === id,
    )?.value as OpeningProgress | undefined;
    const assisted = hints > 0 || errors > 0;
    if (old?.completed && (!old.assisted || assisted)) return;
    void put('lesson:' + id, 'lesson', {
      lessonId: id,
      completed: true,
      assisted,
      at: Date.now(),
    }).catch(() => {
      savedRound.current = -1;
      setError(
        tr('Der Fortschritt konnte nicht gespeichert werden.', 'Your progress could not be saved.'),
      );
    });
  }, [lineDone, round, line, color, records, put, hints, errors, tr, error]);

  const start = (next: 'line' | 'bot') => {
    setMode(next);
    setMoves(next === 'line' ? [] : [...target.moves]);
    setHint(false);
    setHints(0);
    setErrors(0);
    setFeedback('');
    setError('');
    setRound((n) => n + 1);
    inputLock.current = false;
  };
  const move = (uci: string) => {
    if (waiting || lineDone || stopped || error || inputLock.current) return;
    const c = restore({ initialFen: DEFAULT_POSITION, moves });
    try {
      playUci(c, uci);
    } catch {
      return;
    }
    if (mode === 'line' && !matchesOpeningMove(line, moves, uci)) {
      setErrors((n) => n + 1);
      setFeedback(
        tr(
          'Legal gespielt, aber nicht die gewählte Variante. Versuche es noch einmal oder nutze den Hinweis.',
          'A legal move, but outside the chosen variation. Try again or use a hint.',
        ),
      );
      return;
    }
    inputLock.current = true;
    setHint(false);
    setFeedback(
      mode === 'line'
        ? tr('Richtig. Die Zugfolge stimmt.', 'Correct. The move order matches.')
        : '',
    );
    setMoves([...moves, uci]);
  };
  const undo = () => {
    setRound((n) => n + 1);
    setError('');
    setHint(false);
    setFeedback('');
    setMoves(undoOpeningTurn(moves, mode === 'bot' ? target.moves.length : 0, color));
    if (mode === 'line') setHints((n) => n + 1);
  };
  return (
    <>
      <div className="opening-mode" role="group" aria-label={tr('Trainingsmodus', 'Training mode')}>
        <button
          className={mode === 'line' ? 'button primary' : 'button secondary'}
          aria-pressed={mode === 'line'}
          onClick={() => start('line')}
        >
          <BookOpen size={18} />
          {tr('Zugfolge üben', 'Practise move order')}
        </button>
        <button
          className={mode === 'bot' ? 'button primary' : 'button secondary'}
          aria-pressed={mode === 'bot'}
          onClick={() => start('bot')}
        >
          <Swords size={18} />
          {tr('Stellung gegen Bot spielen', 'Play position against bot')}
        </button>
      </div>
      <div className="opening-play">
        <div className="opening-board-column">
          <div className="opening-board-label">
            <strong>
              {mode === 'line'
                ? tr('Variantenpartner', 'Variation partner')
                : `${BOTS[level - 1].name} · ${tr('Stufe', 'Level')} ${level}`}
            </strong>
            <span>
              {color === 'w'
                ? tr('Du spielst Weiß', 'You play White')
                : tr('Du spielst Schwarz', 'You play Black')}
            </span>
          </div>
          <Chessboard
            fen={chess.fen()}
            orientation={color}
            onMove={move}
            disabled={waiting || lineDone || stopped || !!error}
            lastMove={moves.at(-1)}
            arrow={hint ? expected : undefined}
          />
          <div className="opening-board-actions">
            <button
              className="button secondary"
              disabled={moves.length <= (mode === 'bot' ? target.moves.length : 0)}
              onClick={undo}
            >
              <Undo2 size={17} />
              {tr('Zurücknehmen', 'Take back')}
            </button>
            <button className="button secondary" onClick={() => start(mode)}>
              <RotateCcw size={17} />
              {tr('Neu starten', 'Restart')}
            </button>
          </div>
        </div>
        <section className="panel opening-coach">
          <span className="eyebrow">{tr(opening.name, opening.en)}</span>
          <h2>{tr(line.name, line.en)}</h2>
          <p>{tr(opening.idea, opening.ideaEn)}</p>
          <div className="opening-status" role="status" aria-live="polite">
            {lineDone ? (
              <>
                <Check size={22} />
                <strong>{tr('Variante geschafft!', 'Variation complete!')}</strong>
                <span>
                  {hints === 0 && errors === 0
                    ? tr('Ohne Hilfe gelöst.', 'Completed without help.')
                    : tr('Wiederhole sie später ohne Hilfe.', 'Try it again later without help.')}
                </span>
              </>
            ) : stopped ? (
              <>
                <strong>
                  {ending
                    ? `${ending.result} · ${tr(ending.reason)}`
                    : drawClaim
                      ? tr('Remis · Remisregel erreicht', 'Draw · draw rule reached')
                      : tr('Trainingslimit erreicht', 'Training limit reached')}
                </strong>
                <span>
                  {tr(
                    'Du kannst die Stellung erneut spielen.',
                    'You can play this position again.',
                  )}
                </span>
              </>
            ) : (
              <>
                <strong>
                  {waiting
                    ? mode === 'line'
                      ? tr('Dein Partner antwortet …', 'Your partner is replying …')
                      : tr('Der Bot denkt …', 'The bot is thinking …')
                    : tr('Du bist am Zug.', 'Your turn.')}
                </strong>
                <span>
                  {mode === 'line'
                    ? tr(
                        'Spiele den nächsten Zug der gewählten Variante.',
                        'Play the next move of the chosen variation.',
                      )
                    : tr(
                        'Freies Spiel. Der Bot berechnet seine Antworten.',
                        'Free play. The bot calculates its replies.',
                      )}
                </span>
              </>
            )}
          </div>
          {mode === 'line' && (
            <>
              <div className="opening-count">
                <span>{tr('Zugfolge', 'Move order')}</span>
                <strong>
                  {moves.length} / {target.moves.length}
                </strong>
              </div>
              <progress
                max={target.moves.length}
                value={moves.length}
                aria-label={tr('Fortschritt der Variante', 'Variation progress')}
              />
              <p className="opening-meta">
                {errors} {tr('Abweichungen', 'deviations')} · {hints} {tr('Hilfen', 'aids')}
              </p>
              {!lineDone && (
                <button
                  className="button secondary full"
                  disabled={waiting || hint}
                  onClick={() => {
                    setHint(true);
                    setHints((n) => n + 1);
                  }}
                >
                  <Lightbulb size={17} />
                  {tr('Zughinweis', 'Move hint')}
                </button>
              )}
              {hint && !waiting && (
                <p className="opening-hint">
                  {tr('Gesuchter Zug', 'Expected move')}: <strong>{nextSan}</strong>
                </p>
              )}
              {feedback && !lineDone && <p role="status">{feedback}</p>}
              {lineDone && (
                <button className="button primary full" onClick={() => start('bot')}>
                  <Swords size={18} />
                  {tr('Jetzt gegen den Bot weiterspielen', 'Continue against the bot')}
                </button>
              )}
            </>
          )}
          <h3>{tr('Gespielte Züge', 'Played moves')}</h3>
          <ol className="opening-history" aria-label={tr('Gespielte Züge', 'Played moves')}>
            {Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => (
              <li key={i}>
                <span>{i + 1}.</span>
                <strong>{history[i * 2]}</strong>
                <strong>{history[i * 2 + 1] || '…'}</strong>
              </li>
            ))}
          </ol>
          {!history.length && (
            <p>
              {tr(
                'Die Partie beginnt in der Grundstellung.',
                'The game begins in the starting position.',
              )}
            </p>
          )}
          {mode === 'bot' && (
            <p className="opening-meta">
              {tr(
                'Die gewählte Zugfolge ist bereits auf dem Brett. Dieses freie Training vergibt keine Ranglisten-Elo.',
                'The chosen move order is already on the board. This free practice does not award leaderboard Elo.',
              )}
            </p>
          )}
          {error && (
            <>
              <ErrorText>{tr(error)}</ErrorText>
              <button className="button secondary full" onClick={() => setError('')}>
                {tr('Erneut versuchen', 'Try again')}
              </button>
            </>
          )}
        </section>
      </div>
    </>
  );
}
