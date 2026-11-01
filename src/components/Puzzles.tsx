'use client';
import { uuid } from '@/lib/id';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Lightbulb,
  Shuffle,
  ArrowRight,
  Flag,
  Eye,
} from 'lucide-react';
import { useStore } from './Provider';
import { useStats } from './Overview';
import { Empty, ErrorText, Heading, Loading, Portrait } from './Common';
import Chessboard from './Chessboard';
import {
  acceptPuzzleMove,
  attemptsFrom,
  duePuzzles,
  loadPuzzle,
  localDay,
  preparePuzzle,
  puzzleIndex,
  THEMES,
} from '@/lib/puzzles';
import { notation, playUci, restore, sanOf } from '@/lib/chess';
import type { Attempt, Mistake, Puzzle as PuzzleData } from '@/lib/types';
const explanations: Record<string, string> = {
  fork: 'Bei einem Doppelangriff bedroht ein Zug mehrere Ziele. Prüfe auch, ob dein Gegner eine stärkere Drohung hat.',
  pin: 'Eine gefesselte Figur kann ihr Feld nicht verlassen, ohne ein wertvolleres Ziel freizugeben.',
  skewer: 'Beim Spieß muss die vordere Figur weichen. Dahinter wird eine zweite Figur angreifbar.',
  discoveredAttack: 'Eine Figur zieht aus einer Linie und öffnet den Angriff einer anderen Figur.',
  deflection: 'Lenke einen Verteidiger von seiner entscheidenden Aufgabe ab.',
  attraction: 'Zwinge eine gegnerische Figur auf ein ungünstiges Feld.',
  overloading:
    'Der Turm g7 deckt die Dame und schützt die Grundreihe. Nach Dxh7+ muss er mit …Txh7 zurückschlagen. Dann setzt Ta8# matt.',
  backRankMate: 'Ein eingesperrter König kann auf seiner Grundreihe mattgesetzt werden.',
  mateIn1:
    'Prüfe jeden Schachzug: Hat der König ein Fluchtfeld, kann er schlagen oder kann ein Verteidiger dazwischenziehen?',
  mateIn2: 'Berechne Schachzüge und alle legalen Antworten bis zum Matt.',
  mateIn3: 'Betrachte forcierte Züge und prüfe die vollständige Zugfolge.',
  promotion:
    'Ein Bauer auf der letzten Reihe wird umgewandelt. Manchmal ist eine andere Figur als die Dame nötig.',
};
type Mode = 'adaptive' | 'daily' | 'series' | 'review' | 'time';
export default function Puzzles() {
  const { records, ready, put } = useStore();
  const stats = useStats();
  const [mode, setMode] = useState<Mode>('adaptive'),
    [theme, setTheme] = useState(''),
    [range, setRange] = useState('all');
  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null),
    [fen, setFen] = useState(''),
    [step, setStep] = useState(1),
    [hints, setHints] = useState(0),
    [errors, setErrors] = useState(0),
    [done, setDone] = useState(false),
    [success, setSuccess] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [solutionView, setSolutionView] = useState<number | null>(null),
    [timeEnd, setTimeEnd] = useState<number | null>(null),
    [now, setNow] = useState(() => Date.now()),
    [timeScore, setTimeScore] = useState(0),
    [finishedSeconds, setFinishedSeconds] = useState(0),
    [mistake, setMistake] = useState<Mistake | null>(null);
  const initialized = useRef(false),
    job = useRef(0),
    attempt = useRef({ id: '', at: 0, start: 0, hints: 0, errors: 0 }),
    solutionStart = useRef(''),
    solutionMoves = useRef<string[]>([]),
    baseStep = useRef(1);
  const attempts = attemptsFrom(records);
  const choose = useCallback(
    async (overrides?: { mode?: Mode; theme?: string; range?: string }) => {
      const selectedMode = overrides?.mode || mode,
        selectedTheme = overrides?.theme ?? theme,
        selectedRange = overrides?.range ?? range;
      const token = ++job.current;
      setLoading(true);
      setError('');
      setMessage('');
      setMistake(null);
      setDone(false);
      setSolutionView(null);
      try {
        const index = await puzzleIndex();
        let choices = index.puzzles;
        const seen = new Set(attempts.map((a) => a.puzzleId));
        if (selectedMode === 'daily') {
          const hash = [...localDay()].reduce((a, c) => a * 31 + c.charCodeAt(0), 0) >>> 0;
          choices = [choices[hash % choices.length]];
        } else if (selectedMode === 'review') {
          const due = new Set(duePuzzles(attempts).map((p) => p.id));
          choices = choices.filter((p) => due.has(p.id));
        } else {
          if (selectedTheme) choices = choices.filter((p) => p.themes.includes(selectedTheme));
          if (selectedRange !== 'all') {
            const [min, max] = selectedRange.split('-').map(Number);
            choices = choices.filter((p) => p.rating >= min && p.rating <= max);
          }
          const unknown = choices.filter((p) => !seen.has(p.id));
          if (unknown.length) choices = unknown;
          choices = [...choices].sort(
            (a, b) => Math.abs(a.rating - stats.rating) - Math.abs(b.rating - stats.rating),
          );
        }
        if (!choices.length)
          throw new Error(
            selectedMode === 'review'
              ? 'Aktuell sind keine Wiederholungen fällig. Nach Fehlern planen wir die erste Wiederholung in zehn Minuten.'
              : 'Keine Aufgaben für diese Filter. Bitte wähle einen größeren Bereich.',
          );
        const pick =
          choices[
            selectedMode === 'daily' ? 0 : Math.floor(Math.random() * Math.min(choices.length, 20))
          ];
        const p = await loadPuzzle(pick);
        if (token !== job.current) return;
        const g = preparePuzzle(p);
        solutionStart.current = g.fen();
        solutionMoves.current = p.moves.slice(1);
        baseStep.current = 1;
        attempt.current = { id: uuid(), at: Date.now(), start: Date.now(), hints: 0, errors: 0 };
        setPuzzle(p);
        setFen(g.fen());
        setStep(1);
        setHints(0);
        setErrors(0);
        setSuccess(false);
      } catch (e) {
        if (token === job.current) {
          setError(e instanceof Error ? e.message : String(e));
          setPuzzle(null);
        }
      } finally {
        if (token === job.current) setLoading(false);
      }
    },
    [mode, theme, range, attempts, stats.rating],
  );
  useEffect(() => {
    if (!ready || initialized.current) return;
    initialized.current = true;
    const params = new URLSearchParams(location.search);
    const m = params.get('mode') as Mode | null;
    const t = params.get('theme') || '';
    const custom = params.get('mistake');
    if (custom) {
      const record = records.find((r) => r.id === custom && r.kind === 'mistake')?.value as
        | Mistake
        | undefined;
      if (record) {
        const g = restore(record);
        solutionStart.current = g.fen();
        solutionMoves.current = [record.answer];
        baseStep.current = 0;
        attempt.current = { id: uuid(), at: Date.now(), start: Date.now(), hints: 0, errors: 0 };
        setMistake(record);
        setPuzzle({
          id: custom,
          fen: g.fen(),
          moves: [record.answer],
          rating: 0,
          themes: [],
          url: '',
        });
        setFen(g.fen());
        setStep(0);
        return;
      }
    }
    const selected =
      m && ['adaptive', 'daily', 'series', 'review', 'time'].includes(m) ? m : 'adaptive';
    setMode(selected);
    setTheme(t);
    if (selected === 'time') setTimeEnd(Date.now() + 180000);
    void choose({ mode: selected, theme: t });
  }, [ready, records, choose]);
  useEffect(() => {
    const sequence = job;
    return () => {
      sequence.current++;
    };
  }, []);
  const persist = useCallback(
    async (solved: boolean, h = attempt.current.hints, e = attempt.current.errors) => {
      if (!puzzle) return;
      const a: Attempt = {
        puzzleId: puzzle.id,
        rating: puzzle.rating,
        themes: puzzle.themes,
        success: solved,
        hints: h,
        errors: e,
        seconds: Math.max(1, Math.round((Date.now() - attempt.current.start) / 1000)),
        at: attempt.current.at,
        mode: mistake ? 'review' : mode,
      };
      try {
        await put('attempt:' + attempt.current.id, 'attempt', a);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [puzzle, put, mistake, mode],
  );
  useEffect(() => {
    if (!timeEnd) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [timeEnd]);
  useEffect(() => {
    if (timeEnd && now >= timeEnd && !done) {
      setDone(true);
      setSuccess(false);
      setMessage(
        `Zeittraining beendet. ${timeScore} Aufgaben gelöst. Die Uhr läuft auch bei einem App-Wechsel weiter.`,
      );
      void persist(false);
    }
  }, [timeEnd, now, done, timeScore, persist]);
  const onMove = (move: string) => {
    if (!puzzle || done || loading || solutionView !== null || (timeEnd && Date.now() >= timeEnd))
      return;
    const g = new Chess(fen);
    if (!acceptPuzzleMove(puzzle, step, move, g)) {
      attempt.current.errors++;
      setErrors(attempt.current.errors);
      setMessage('Dieser Zug löst die Aufgabe nicht. Prüfe die gegnerische Antwort.');
      void persist(false);
      return;
    }
    const alternative =
      step === 1 ? puzzle.alternatives?.find((line) => line[0] === move) : undefined;
    const moves = alternative ? [puzzle.moves[0], ...alternative] : puzzle.moves;
    if (alternative) {
      setPuzzle({ ...puzzle, moves });
      solutionMoves.current = alternative;
    }
    playUci(g, move);
    let next = step + 1;
    if (next < moves.length) {
      playUci(g, moves[next]);
      next++;
    }
    setFen(g.fen());
    setStep(next);
    setMessage('Richtig. Berechne den nächsten Zug.');
    const completed = next >= moves.length || g.isCheckmate();
    void persist(completed);
    if (completed) {
      setDone(true);
      setFinishedSeconds(Math.max(1, Math.round((Date.now() - attempt.current.start) / 1000)));
      setSuccess(true);
      setMessage(
        attempt.current.hints
          ? 'Mit Hilfe gelöst. Spiele die Idee noch einmal durch.'
          : attempt.current.errors
            ? 'Gelöst nach Korrektur. Wiederholung ist geplant.'
            : 'Selbstständig gelöst. Gut gesehen.',
      );
      if (mode === 'time') setTimeScore((x) => x + 1);
      if (mistake)
        void put(puzzle.id, 'mistake', {
          ...mistake,
          done: attempt.current.hints === 0 && attempt.current.errors === 0,
        }).catch(() => undefined);
    }
  };
  const hint = () => {
    if (done || !puzzle) return;
    attempt.current.hints = Math.min(3, attempt.current.hints + 1);
    setHints(attempt.current.hints);
    void persist(false);
  };
  const reveal = () => {
    if (!puzzle) return;
    setDone(true);
    setFinishedSeconds(Math.max(1, Math.round((Date.now() - attempt.current.start) / 1000)));
    setSuccess(false);
    attempt.current.hints = 3;
    setHints(3);
    setSolutionView(0);
    setMessage('Lösung geöffnet. Diese Aufgabe zählt als mit Hilfe bearbeitet.');
    void persist(false, 3);
  };
  let displayedFen = fen;
  if (solutionView !== null && puzzle) {
    const g = new Chess(solutionStart.current);
    for (const m of solutionMoves.current.slice(0, solutionView)) playUci(g, m);
    displayedFen = g.fen();
  }
  const currentMove = puzzle?.moves[step],
    remaining = timeEnd ? Math.max(0, Math.ceil((timeEnd - now) / 1000)) : null;
  const showArrow = hints === 3 && !done ? currentMove : undefined;
  const hintText =
    hints === 1
      ? explanations[puzzle?.themes.find((t) => explanations[t]) || ''] ||
        'Suche zuerst nach Schachgeboten, Schlagzügen und direkten Drohungen.'
      : hints === 2
        ? `Betrachte die Figur auf ${currentMove?.slice(0, 2)}.`
        : hints === 3 && currentMove
          ? `Der nächste Zug ist ${sanOf({ initialFen: fen, moves: [] }, currentMove)}.`
          : '';
  const startMode = (m: Mode, startedAt: number) => {
    setMode(m);
    setTimeEnd(m === 'time' ? startedAt + 180000 : null);
    setNow(startedAt);
    setTimeScore(0);
    void choose({ mode: m });
  };
  return (
    <>
      <Heading
        god={mode === 'time' ? 'CHRONOS · ZEITTRAINING' : 'ATHENE · TAKTIK & PUZZLES'}
        title="Sieh den entscheidenden Zug."
        description="Echte Stellungen. Klare Ideen. Dein tägliches Training."
      >
        <span className="rating-pill">
          {stats.rating}
          <small>PUZZLE-RATING</small>
        </span>
      </Heading>
      <div className="tabs" role="tablist" aria-label="Puzzlemodus">
        {(
          [
            ['adaptive', 'Adaptiv'],
            ['daily', 'Tagesaufgabe'],
            ['series', 'Freie Serie'],
            ['review', 'Wiederholen'],
            ['time', 'Zeittraining'],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            role="tab"
            aria-selected={mode === m}
            className={mode === m ? 'active' : ''}
            key={m}
            onClick={() => startMode(m, Date.now())}
          >
            {label}
            {m === 'review' && stats.due.length > 0 && <span>{stats.due.length}</span>}
          </button>
        ))}
      </div>
      <div className="play-layout puzzle-layout">
        <div className="board-column">
          <div className="player-bar">
            <Portrait level={mode === 'time' ? 10 : 19} />
            <div>
              <strong>
                {mode === 'time' ? 'Chronos fordert dich heraus' : 'Athenes Taktiktraining'}
              </strong>
              <span>
                {puzzle
                  ? `${new Chess(solutionStart.current || puzzle.fen).turn() === 'w' ? 'Weiß' : 'Schwarz'} am Zug`
                  : 'Wähle deine Aufgabe'}
              </span>
            </div>
            {remaining !== null && (
              <div className="clock">
                {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
              </div>
            )}
          </div>
          {loading ? (
            <div className="board-loading">
              <Loading text="Die nächste Aufgabe wird vorbereitet …" />
            </div>
          ) : puzzle && displayedFen ? (
            <Chessboard
              fen={displayedFen}
              orientation={new Chess(solutionStart.current || puzzle.fen).turn()}
              onMove={onMove}
              disabled={done || solutionView !== null}
              lastMove={step > baseStep.current ? puzzle.moves[step - 1] : puzzle.moves[0]}
              arrow={showArrow}
            />
          ) : (
            <div className="board-loading">
              <Empty title="Bereit für deinen nächsten Zug?">
                Wähle einen Trainingsmodus oder passe die Filter an.
              </Empty>
            </div>
          )}
          <div className="board-caption">
            <span>
              {puzzle
                ? `Aufgabe ${puzzle.id} · ${mistake ? 'Eigene Fehlerstellung' : puzzle.rating + ' Punkte'}`
                : '1.000 Lichess-Puzzles + eine eigene Lehrstellung'}
            </span>
            <span>Tippen oder ziehen</span>
          </div>
          {message && (
            <div className={'puzzle-feedback ' + (success ? 'success' : '')} role="status">
              {success ? <Check size={20} /> : <TargetIcon />}
              <p>{message}</p>
            </div>
          )}
          {error && <ErrorText>{error}</ErrorText>}
        </div>
        <aside className="play-panel">
          <section className="panel">
            <div className="panel-top">
              <h2>Dein Fokus</h2>
              <Shuffle size={18} />
            </div>
            {puzzle?.id === 'olympion-overload-1' && (
              <p className="small-text">
                Lehrstellung: Finde Matt in zwei Zügen. Der Turm g7 hat zwei Verteidigungsaufgaben.
              </p>
            )}
            <label className="field">
              Taktisches Motiv
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                disabled={mode === 'daily' || mode === 'review'}
              >
                <option value="">Alle Motive</option>
                {Object.entries(THEMES).map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Schwierigkeit
              <select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                disabled={mode === 'daily' || mode === 'review'}
              >
                <option value="all">Passend zu meinem Rating</option>
                <option value="400-1000">Einstieg · 400–1.000</option>
                <option value="1000-1600">Aufbau · 1.000–1.600</option>
                <option value="1600-2200">Fortgeschritten · 1.600–2.200</option>
                <option value="2200-3000">Anspruchsvoll · 2.200–3.000</option>
              </select>
            </label>
            <button
              className="button secondary full"
              onClick={() => void choose()}
              disabled={loading}
            >
              Aufgabe auswählen <ArrowRight size={16} />
            </button>
            {mode === 'time' && (
              <p className="small-text">
                Drei Minuten. Die Uhr läuft durch. Gelöste Aufgaben zählen einen Punkt; Hinweise
                werden gespeichert. Bereits bekannte Aufgaben erzeugen kein weiteres Rating.
              </p>
            )}
          </section>
          <section className="panel hint-panel">
            <div className="panel-top">
              <h2>Ein kleiner Impuls?</h2>
              <Lightbulb size={19} />
            </div>
            <p>Erst selbst rechnen. Dann Schritt für Schritt Unterstützung holen.</p>
            {hints > 0 && (
              <div className="hint-text" role="status">
                {hintText}
              </div>
            )}
            <div className="hint-steps">
              <span className={hints >= 1 ? 'active' : ''}>1 · Idee</span>
              <span className={hints >= 2 ? 'active' : ''}>2 · Figur</span>
              <span className={hints >= 3 ? 'active' : ''}>3 · Zug</span>
            </div>
            <button
              className="button secondary full"
              onClick={hint}
              disabled={!puzzle || done || hints >= 3}
            >
              <Lightbulb size={16} />
              Hinweis {Math.min(3, hints + 1)} anzeigen
            </button>
            <button className="text-button" onClick={reveal} disabled={!puzzle || done}>
              <Eye size={15} />
              Lösung ansehen
            </button>
          </section>
          {done && puzzle && (
            <section className="panel">
              <h2>{success ? 'Die Idee hinter dem Zug' : 'Die Lösung verstehen'}</h2>
              <p>
                {explanations[puzzle.themes.find((t) => explanations[t]) || ''] ||
                  'Berechne die gegnerischen Antworten. Die folgende Zugfolge zeigt die taktische Idee.'}
              </p>
              <p className="solution-notation">
                {notation({ initialFen: solutionStart.current, moves: [] }, solutionMoves.current)}
              </p>
              <div className="button-row">
                <button
                  className="icon-button"
                  aria-label="Lösung zurück"
                  disabled={solutionView === 0}
                  onClick={() =>
                    setSolutionView(Math.max(0, (solutionView ?? solutionMoves.current.length) - 1))
                  }
                >
                  <ChevronLeft size={19} />
                </button>
                <span>
                  {solutionView ?? solutionMoves.current.length} / {solutionMoves.current.length}
                </span>
                <button
                  className="icon-button"
                  aria-label="Lösung vor"
                  disabled={
                    (solutionView ?? solutionMoves.current.length) === solutionMoves.current.length
                  }
                  onClick={() =>
                    setSolutionView(Math.min(solutionMoves.current.length, (solutionView ?? 0) + 1))
                  }
                >
                  <ChevronRight size={19} />
                </button>
              </div>
              <p className="small-text">
                {hints} Hinweise · {errors} Fehler · {finishedSeconds} Sekunden
              </p>
              <button
                className="button primary full"
                disabled={mode === 'time' && remaining === 0}
                onClick={() => void choose()}
              >
                Nächste Aufgabe <ArrowRight size={17} />
              </button>
              {puzzle.id.startsWith('olympion-') ? (
                <small>Eigene OLYMPION-Lehrstellung</small>
              ) : (
                puzzle.url && (
                  <a className="source-link" target="_blank" rel="noreferrer" href={puzzle.url}>
                    Ursprungspartie auf Lichess
                  </a>
                )
              )}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
function TargetIcon() {
  return <Flag size={18} />;
}
