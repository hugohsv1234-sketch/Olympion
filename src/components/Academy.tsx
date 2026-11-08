'use client';
import { useT } from '@/lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, GraduationCap, Lightbulb, Play, RotateCcw } from 'lucide-react';
import { Chess } from 'chess.js';
import { DEFAULT_POSITION, notation, playUci, restore } from '@/lib/chess';
import { loadPuzzle, preparePuzzle, puzzleIndex, acceptPuzzleMove } from '@/lib/puzzles';
import type { LessonResult, Puzzle } from '@/lib/types';
import { useStore } from './Provider';
import { ErrorText, Heading, Loading, Portrait } from './Common';
import Chessboard from './Chessboard';
import { LESSONS, type Lesson } from '@/lib/lessons';
export default function Academy() {
  const tr = useT();
  const { records, put, ready } = useStore();
  const [selected, setSelected] = useState<Lesson>(LESSONS[0]),
    [fen, setFen] = useState(DEFAULT_POSITION),
    [puzzle, setPuzzle] = useState<Puzzle | null>(null),
    [step, setStep] = useState(1),
    [done, setDone] = useState(false),
    [hint, setHint] = useState(false),
    [loading, setLoading] = useState(false),
    [feedback, setFeedback] = useState(''),
    [error, setError] = useState('');
  const job = useRef(0),
    initial = useRef(DEFAULT_POSITION),
    answers = useRef<string[]>([]);
  const completed = new Set(
    records
      .filter((r) => r.kind === 'lesson' && (r.value as LessonResult).completed)
      .map((r) => (r.value as LessonResult).lessonId),
  );
  const start = async (l: Lesson) => {
    const token = ++job.current;
    setSelected(l);
    setLoading(true);
    setDone(false);
    setHint(false);
    setFeedback('');
    setError('');
    try {
      if (l.position) {
        const c = restore({ initialFen: l.position.fen, moves: l.position.moves });
        setPuzzle(null);
        initial.current = c.fen();
        answers.current = l.position.answers;
        setFen(c.fen());
        setStep(0);
      } else {
        const idx = await puzzleIndex();
        const meta = idx.puzzles
          .filter((p) => p.themes.includes(l.theme!))
          .sort((a, b) => a.rating - b.rating)[0];
        if (!meta) throw new Error('Die passende Übung konnte nicht gefunden werden.');
        const p = await loadPuzzle(meta);
        if (token !== job.current) return;
        const g = preparePuzzle(p);
        initial.current = g.fen();
        answers.current = p.moves.slice(1);
        setPuzzle(p);
        setFen(g.fen());
        setStep(1);
      }
    } catch (e) {
      if (token === job.current) setError((e as Error).message);
    } finally {
      if (token === job.current) setLoading(false);
    }
  };
  useEffect(() => {
    const sequence = job;
    if (ready) void start(LESSONS[0]);
    return () => {
      sequence.current++;
    };
  }, [ready]);
  const move = (m: string) => {
    if (done || loading) return;
    const c = new Chess(fen);
    const correct = puzzle ? acceptPuzzleMove(puzzle, step, m, c) : answers.current.includes(m);
    if (!correct) {
      setFeedback('Prüfe den Zug noch einmal und beziehe die gegnerische Antwort ein.');
      return;
    }
    const alternative =
      step === 1 ? puzzle?.alternatives?.find((line) => line[0] === m) : undefined;
    const moves = alternative ? [puzzle!.moves[0], ...alternative] : puzzle?.moves || [];
    if (alternative) setPuzzle({ ...puzzle!, moves });
    playUci(c, m);
    let next = step + 1;
    if (puzzle && next < moves.length) {
      playUci(c, moves[next]);
      next++;
    }
    setFen(c.fen());
    setStep(next);
    if (!puzzle || next >= moves.length || c.isCheckmate()) {
      setDone(true);
      setFeedback(
        hint
          ? 'Lektion mit Hinweis abgeschlossen. Wiederhole die Idee später ohne Hilfe.'
          : 'Lernziel erreicht. Du hast die Idee auf dem Brett angewendet.',
      );
      void put('lesson:' + selected.id, 'lesson', {
        lessonId: selected.id,
        completed: true,
        assisted: hint,
        at: Date.now(),
      }).catch(() => undefined);
    } else setFeedback('Richtig. Wie geht die Kombination weiter?');
  };
  return (
    <>
      <Heading
        god={tr('ATHENE \u00B7 DIE AKADEMIE')}
        title={tr('Aus Wissen wird K\u00F6nnen.')}
        description={tr('Kurze Lektionen. Echte Brett\u00FCbungen. Ein klarer Lernweg.')}
      />
      <div className="academy-layout">
        <aside className="lesson-nav">
          <div className="lesson-progress">
            <GraduationCap size={22} />
            <span>
              <strong>
                {completed.size} / {LESSONS.length}
              </strong>
              <small>{tr('Lektionen abgeschlossen')}</small>
            </span>
          </div>
          {[...new Set(LESSONS.map((l) => l.group))].map((group) => (
            <div key={group}>
              <span className="eyebrow">{tr(group)}</span>
              {LESSONS.filter((l) => l.group === group).map((l, i) => (
                <button
                  className={'lesson-item ' + (selected.id === l.id ? 'active' : '')}
                  key={l.id}
                  onClick={() => void start(l)}
                >
                  <span>
                    {completed.has(l.id) ? <Check size={16} /> : String(i + 1).padStart(2, '0')}
                  </span>
                  <span>
                    {tr(l.title)}
                    <small>
                      {l.minutes}
                      {tr(' Minuten')}
                    </small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          ))}
        </aside>
        <div>
          <div className="lesson-intro">
            <Portrait
              level={
                selected.group.includes('Hades') ? 17 : selected.group.includes('Chronos') ? 10 : 19
              }
            />
            <div>
              <span className="eyebrow">{tr(selected.group)}</span>
              <h2>{tr(selected.title)}</h2>
              <p>{tr(selected.text)}</p>
            </div>
          </div>
          <div className="lesson-exercise">
            <div className="lesson-board">
              {loading ? (
                <Loading text={tr('Brett\u00FCbung wird vorbereitet \u2026')} />
              ) : (
                <Chessboard
                  fen={fen}
                  onMove={move}
                  orientation={new Chess(initial.current).turn()}
                  disabled={done}
                  arrow={hint ? (puzzle ? puzzle.moves[step] : answers.current[0]) : undefined}
                />
              )}
            </div>
            <section className="panel lesson-task">
              <span className="eyebrow">{tr('DEINE AUFGABE')}</span>
              <h3>{tr(selected.goal)}</h3>
              <p>{tr('Setze deine Idee direkt auf dem Brett um.')}</p>
              {feedback && (
                <div className="puzzle-feedback" role="status">
                  {done && <Check size={18} />}
                  <p>{tr(feedback)}</p>
                </div>
              )}
              {error && <ErrorText>{tr(error)}</ErrorText>}
              <button
                className="button secondary full"
                disabled={done || loading}
                onClick={() => setHint(true)}
              >
                <Lightbulb size={16} />
                {tr('Einen Zughinweis anzeigen')}
              </button>
              {hint && (
                <p className="solution-notation">
                  {notation({ initialFen: fen, moves: [] }, [
                    puzzle ? puzzle.moves[step] : answers.current[0],
                  ])}
                </p>
              )}
              {done && (
                <button
                  className="button primary full"
                  onClick={() =>
                    void start(
                      LESSONS[
                        (LESSONS.findIndex((l) => l.id === selected.id) + 1) % LESSONS.length
                      ],
                    )
                  }
                >
                  {tr('N\u00E4chste Lektion ')}
                  <Play size={16} />
                </button>
              )}
              <button className="text-button" onClick={() => void start(selected)}>
                <RotateCcw size={15} />
                {tr('\u00DCbung wiederholen')}
              </button>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
