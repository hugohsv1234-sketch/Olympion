'use client';
import { uuid } from '@/lib/id';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  FlipVertical2,
  Focus,
  Maximize2,
  Minimize2,
  Square,
  Upload,
} from 'lucide-react';
import type { Color } from 'chess.js';
import { ANALYSIS_BUDGETS } from '@/lib/bots';
import { DEFAULT_POSITION, importNotation, notation, restore, sanOf } from '@/lib/chess';
import { evaluateMove, getEngine } from '@/lib/engine';
import { scoreText } from '@/lib/metrics';
import type { AnalysisRecord, GameRecord, MoveQuality, Position, SearchResult } from '@/lib/types';
import { download } from '@/lib/storage';
import { useStore } from './Provider';
import { Empty, ErrorText, Heading, Loading, QualityCard } from './Common';
import Chessboard from './Chessboard';
interface Model extends Position {
  id: string;
  name: string;
}
export default function Analysis() {
  const { records, ready, put } = useStore();
  const router = useRouter();
  const [model, setModel] = useState<Model | null>(null),
    [input, setInput] = useState(''),
    [error, setError] = useState(''),
    [cursor, setCursor] = useState(0),
    [budget, setBudget] = useState<number>(120000),
    [results, setResults] = useState<MoveQuality[]>([]),
    [busy, setBusy] = useState(false),
    [orientation, setOrientation] = useState<Color>('w'),
    [fullscreen, setFullscreen] = useState(false),
    [arrows, setArrows] = useState(true),
    [variation, setVariation] = useState<string[]>([]),
    [positionEval, setPositionEval] = useState<SearchResult | null>(null),
    [importOpen, setImportOpen] = useState(true);
  const abort = useRef<AbortController | null>(null),
    root = useRef<HTMLDivElement>(null),
    initialized = useRef(false),
    selection = useRef(0);
  const games = records
    .filter((r) => r.kind === 'game')
    .map((r) => r.value as GameRecord)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const savedAnalyses = records
    .filter((r) => r.kind === 'analysis')
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const load = useCallback(
    (m: Model, selectedBudget = budget) => {
      abort.current?.abort();
      selection.current++;
      setBusy(false);
      setModel(m);
      setCursor(0);
      setVariation([]);
      setPositionEval(null);
      setError('');
      setBudget(selectedBudget);
      const old = records.find((r) => r.id === `analysis:${m.id}:${selectedBudget}`)?.value as
        | AnalysisRecord
        | undefined;
      setResults(old?.results || []);
      setImportOpen(false);
    },
    [records, budget],
  );
  useEffect(() => {
    if (!ready || initialized.current) return;
    initialized.current = true;
    const id = new URLSearchParams(location.search).get('game');
    if (id) {
      const g = games.find((g) => g.id === id);
      if (g) load({ ...g, name: 'Arena · Stufe ' + g.level });
    }
    const analysisId = new URLSearchParams(location.search).get('analysis');
    const a = records.find((r) => r.id === analysisId && r.kind === 'analysis')?.value as
      | AnalysisRecord
      | undefined;
    if (a)
      load(
        { id: a.gameId, name: 'Gespeicherte Analyse', initialFen: a.initialFen, moves: a.moves },
        a.budget,
      );
  }, [ready, games, load, records]);
  useEffect(
    () => () => {
      abort.current?.abort();
    },
    [],
  );
  useEffect(() => {
    const event = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener('fullscreenchange', event);
    return () => document.removeEventListener('fullscreenchange', event);
  }, []);
  const navigate = useCallback(
    (n: number) => {
      setCursor(Math.max(0, Math.min(model?.moves.length || 0, n)));
      setVariation([]);
      setPositionEval(null);
    },
    [model],
  );
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]')) return;
      const next: Record<string, number> = {
        ArrowLeft: cursor - 1,
        ArrowRight: cursor + 1,
        Home: 0,
        End: model?.moves.length || 0,
      };
      if (e.key in next) {
        e.preventDefault();
        navigate(next[e.key]);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [cursor, model, navigate]);
  const position = useMemo(
    () => ({
      initialFen: model?.initialFen || DEFAULT_POSITION,
      moves: [...(model?.moves.slice(0, cursor) || []), ...variation],
    }),
    [model, cursor, variation],
  );
  const currentPositionKey = useRef('');
  currentPositionKey.current = JSON.stringify(position);
  const chess = useMemo(() => restore(position), [position]);
  const history = useMemo(() => (model ? restore(model).history({ verbose: true }) : []), [model]);
  const selected = cursor > 0 ? results.find((r) => r.ply === cursor - 1) : undefined;
  const currentResult = !variation.length ? results.find((r) => r.ply === cursor) : undefined;
  const importText = (text: string) => {
    try {
      const p = importNotation(text);
      load({ ...p, id: uuid(), name: p.moves.length ? 'Importierte Partie' : 'FEN-Stellung' });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const run = async () => {
    if (!model) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const token = selection.current;
    setError('');
    setBusy(true);
    try {
      if (!model.moves.length) {
        const r = await getEngine().search(position, {
          nodes: budget,
          skill: 20,
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setPositionEval(r);
        return;
      }
      const saved = records.find((r) => r.id === `analysis:${model.id}:${budget}`)?.value as
        | AnalysisRecord
        | undefined;
      const output = [...(saved?.results || [])];
      setResults(output);
      for (let ply = output.length; ply < model.moves.length; ply++) {
        if (controller.signal.aborted) break;
        const r = await evaluateMove(
          { initialFen: model.initialFen, moves: model.moves.slice(0, ply) },
          model.moves[ply],
          budget,
          controller.signal,
        );
        if (controller.signal.aborted || token !== selection.current) break;
        output.push(r);
        setResults([...output]);
        const record: AnalysisRecord = {
          gameId: model.id,
          initialFen: model.initialFen,
          moves: model.moves,
          budget,
          results: [...output],
          complete: output.length === model.moves.length,
          updatedAt: Date.now(),
        };
        await put(`analysis:${model.id}:${budget}`, 'analysis', record);
        const mistakeId = `mistake:${model.id}:${r.ply}`;
        if (r.quality < 80 && !records.some((item) => item.id === mistakeId)) {
          await put(mistakeId, 'mistake', {
            initialFen: model.initialFen,
            moves: model.moves.slice(0, r.ply),
            answer: r.bestMove,
            gameId: model.id,
            ply: r.ply,
            san: r.san,
          });
        }
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (abort.current === controller) setBusy(false);
    }
  };
  const currentAnalysis = async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError('');
    const key = JSON.stringify(position);
    try {
      const r = await getEngine().search(position, {
        nodes: budget,
        skill: 20,
        signal: controller.signal,
      });
      if (!controller.signal.aborted && currentPositionKey.current === key) setPositionEval(r);
    } catch (e) {
      if (!controller.signal.aborted) setError(String((e as Error).message));
    } finally {
      if (abort.current === controller) setBusy(false);
    }
  };
  const intensity = (n: number) => {
    abort.current?.abort();
    setBusy(false);
    setBudget(n);
    setPositionEval(null);
    if (model) {
      const old = records.find((r) => r.id === `analysis:${model.id}:${n}`)?.value as
        | AnalysisRecord
        | undefined;
      setResults(old?.results || []);
    }
  };
  const full = async () => {
    if (fullscreen) {
      if (document.fullscreenElement) await document.exitFullscreen();
      setFullscreen(false);
    } else {
      setFullscreen(true);
      if (root.current?.requestFullscreen) {
        try {
          await root.current.requestFullscreen();
        } catch {
          /* CSS fullscreen is the fallback on iOS. */
        }
      }
    }
  };
  const practice = async () => {
    if (!model || !selected) return;
    const id = `mistake:${model.id}:${selected.ply}`;
    try {
      await put(id, 'mistake', {
        initialFen: model.initialFen,
        moves: model.moves.slice(0, selected.ply),
        answer: selected.bestMove,
        gameId: model.id,
        ply: selected.ply,
        san: selected.san,
      });
      router.push('/puzzles?mistake=' + encodeURIComponent(id));
    } catch (e) {
      setError(String((e as Error).message));
    }
  };
  const currentScore = positionEval?.lines[0]?.score;
  const whiteCp =
    currentScore?.cp !== undefined
      ? currentScore.cp * (chess.turn() === 'w' ? 1 : -1)
      : selected?.whiteCp;
  const whiteMate =
    currentScore?.mate !== undefined
      ? currentScore.mate * (chess.turn() === 'w' ? 1 : -1)
      : selected?.whiteMate;
  const bar =
    whiteMate !== undefined && whiteMate !== null
      ? whiteMate > 0
        ? 100
        : 0
      : whiteCp === undefined || whiteCp === null
        ? 50
        : 100 / (1 + Math.exp(-whiteCp / 250));
  const bestArrow = arrows ? positionEval?.bestMove || currentResult?.bestMove : undefined;
  const initialTurn = restore({
    initialFen: model?.initialFen || DEFAULT_POSITION,
    moves: [],
  }).turn();
  const colorFor = (ply: number) => (ply % 2 === 0 ? initialTurn : initialTurn === 'w' ? 'b' : 'w');
  return (
    <>
      <Heading
        god="APOLLON · PARTIEANALYSE"
        title="Verstehe, was möglich war."
        description="Jeder Fehler ist eine Stellung, aus der du lernen kannst."
      >
        <button className="button secondary" onClick={() => setImportOpen(!importOpen)}>
          <Upload size={16} />
          PGN oder FEN importieren
        </button>
      </Heading>
      {importOpen && (
        <section className="panel import-panel">
          <div>
            <h2>Deine Partie auf dem Brett.</h2>
            <p>Füge eine PGN oder einzelne FEN-Stellung ein. Maximal 200 KB und 500 Halbzüge.</p>
            <label className="field">
              Notation
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={'1. e4 e5 2. Sf3 …\n(PGN verwendet englische Figurennamen: Nf3)'}
                rows={4}
                maxLength={200000}
              />
            </label>
            <div className="button-row">
              <button
                className="button primary"
                onClick={() => importText(input)}
                disabled={!input.trim()}
              >
                Auf dem Brett öffnen <ArrowRight size={17} />
              </button>
              <label className="button secondary file-button">
                <Upload size={16} />
                PGN-Datei
                <input
                  type="file"
                  accept=".pgn,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 200000) {
                      setError('Datei zu groß. Maximal 200 KB.');
                      return;
                    }
                    void file
                      .text()
                      .then(importText)
                      .catch(() => setError('Datei konnte nicht gelesen werden.'));
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
          <div className="saved-games">
            <span className="eyebrow">DEINE GESPEICHERTEN PARTIEN</span>
            {games.length ? (
              games.slice(0, 8).map((g) => (
                <button
                  className="saved-game"
                  key={g.id}
                  onClick={() => load({ ...g, name: 'Arena · Stufe ' + g.level })}
                >
                  <span>
                    {new Date(g.createdAt).toLocaleDateString('de-DE')} · Bot {g.level}
                    <small>
                      {g.moves.length} Halbzüge · {g.result || 'Laufende Partie'}
                    </small>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))
            ) : (
              <p>
                Noch keine gespeicherten Partien. Spiele eine Botpartie oder importiere deine
                eigene.
              </p>
            )}
            <button
              className="text-button"
              onClick={() =>
                importText('1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7 Kxf7')
              }
            >
              Legale Beispielpartie laden
            </button>
            {savedAnalyses.length > 0 && (
              <>
                <span className="eyebrow">GESPEICHERTE ANALYSEN</span>
                {savedAnalyses.slice(0, 5).map((item) => {
                  const a = item.value as AnalysisRecord;
                  return (
                    <button
                      className="saved-game"
                      key={item.id}
                      onClick={() =>
                        load(
                          {
                            id: a.gameId,
                            name: 'Gespeicherte Analyse',
                            initialFen: a.initialFen,
                            moves: a.moves,
                          },
                          a.budget,
                        )
                      }
                    >
                      <span>
                        {new Date(a.updatedAt).toLocaleDateString('de-DE')}
                        <small>
                          {a.results.length} / {a.moves.length} Halbzüge ·{' '}
                          {a.budget.toLocaleString('de-DE')} Knoten
                        </small>
                      </span>
                      <ArrowRight size={16} />
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </section>
      )}
      {error && <ErrorText>{error}</ErrorText>}
      {model ? (
        <div ref={root} className={'analysis-workspace ' + (fullscreen ? 'is-fullscreen' : '')}>
          <div className="analysis-toolbar">
            <div>
              <span className="eyebrow">{model.name}</span>
              <small>
                {variation.length ? 'Freie Variante' : `${cursor} / ${model.moves.length} Halbzüge`}
              </small>
            </div>
            <div className="button-row">
              <label className="sr-only" htmlFor="analysis-intensity">
                Analyseintensität
              </label>
              <select
                id="analysis-intensity"
                value={budget}
                onChange={(e) => intensity(Number(e.target.value))}
              >
                {Object.entries(ANALYSIS_BUDGETS).map(([name, n]) => (
                  <option value={n} key={name}>
                    {name}
                  </option>
                ))}
              </select>
              <button
                className="icon-button"
                onClick={() => void full()}
                aria-label={fullscreen ? 'Vollbild verlassen' : 'Vollbild öffnen'}
              >
                {fullscreen ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
              </button>
            </div>
          </div>
          <div className="play-layout analysis-layout">
            <div className="board-column">
              <div className="evaluation-board">
                <div className="evaluation-bar" aria-label="Bewertungsleiste aus Weißperspektive">
                  <span className="eval-black" />
                  <span className="eval-white" style={{ height: bar + '%' }} />
                  <small>
                    {whiteMate !== undefined && whiteMate !== null
                      ? 'M' + Math.abs(whiteMate)
                      : whiteCp !== null && whiteCp !== undefined
                        ? (whiteCp / 100).toFixed(1)
                        : '–'}
                  </small>
                </div>
                <Chessboard
                  fen={chess.fen()}
                  orientation={orientation}
                  onMove={(m) => {
                    setVariation((xs) => [...xs, m]);
                    setPositionEval(null);
                  }}
                  lastMove={position.moves.at(-1)}
                  arrow={bestArrow}
                />
              </div>
              <div className="analysis-nav">
                <button
                  className="icon-button"
                  aria-label="Zur Anfangsstellung"
                  onClick={() => navigate(0)}
                  disabled={cursor === 0 && !variation.length}
                >
                  <ChevronsLeft size={21} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Einen Halbzug zurück"
                  onClick={() => navigate(cursor - 1)}
                  disabled={cursor === 0 && !variation.length}
                >
                  <ChevronLeft size={23} />
                </button>
                <span>
                  {cursor} / {model.moves.length}
                </span>
                <button
                  className="icon-button"
                  aria-label="Einen Halbzug vor"
                  onClick={() => navigate(cursor + 1)}
                  disabled={cursor === model.moves.length && !variation.length}
                >
                  <ChevronRight size={23} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Zur Schlussstellung"
                  onClick={() => navigate(model.moves.length)}
                  disabled={cursor === model.moves.length && !variation.length}
                >
                  <ChevronsRight size={21} />
                </button>
                <div className="nav-divider" />
                <button
                  className="icon-button"
                  aria-label="Brett drehen"
                  onClick={() => setOrientation((o) => (o === 'w' ? 'b' : 'w'))}
                >
                  <FlipVertical2 size={18} />
                </button>
              </div>
              {variation.length > 0 && (
                <div className="variation-note">
                  <span>
                    Variante:{' '}
                    {notation(
                      { initialFen: model.initialFen, moves: model.moves.slice(0, cursor) },
                      variation,
                    )}
                  </span>
                  <button
                    className="text-button"
                    onClick={() => {
                      setVariation([]);
                      setPositionEval(null);
                    }}
                  >
                    Zur Hauptpartie
                  </button>
                </div>
              )}
              <EvaluationGraph
                results={results}
                total={model.moves.length}
                cursor={cursor}
                onSelect={navigate}
              />
              <div className="board-caption">
                <span>Bewertung immer aus Sicht von Weiß</span>
                <span>← → für Zugnavigation</span>
              </div>
              {!model.moves.length && (
                <p className="small-text">
                  FEN-Stellung: Frühere Züge sind unbekannt. Wiederholungsansprüche können daraus
                  nicht rekonstruiert werden.
                </p>
              )}
            </div>
            <aside className="play-panel">
              <section className="panel">
                <div className="panel-top">
                  <h2>Computeranalyse</h2>
                  <span className="tag">STOCKFISH 19</span>
                </div>
                <div className="analysis-coverage">
                  <strong>
                    {results.length} <span>/ {model.moves.length} Halbzüge</span>
                  </strong>
                  <small>
                    {budget.toLocaleString('de-DE')} Knoten pro Suche ·{' '}
                    {results.length === model.moves.length && model.moves.length
                      ? 'vollständig'
                      : 'Teilabdeckung'}
                  </small>
                </div>
                <div className="progress-track">
                  <span
                    style={{
                      width:
                        (model.moves.length ? (results.length / model.moves.length) * 100 : 0) +
                        '%',
                    }}
                  />
                </div>
                <button
                  className={'button ' + (busy ? 'secondary' : 'primary') + ' full'}
                  disabled={
                    !busy && model.moves.length > 0 && results.length === model.moves.length
                  }
                  onClick={() => {
                    if (busy) {
                      abort.current?.abort();
                      setBusy(false);
                    } else void run();
                  }}
                >
                  {busy ? (
                    <>
                      <Square size={14} />
                      Analyse abbrechen
                    </>
                  ) : (
                    <>
                      <Focus size={17} />
                      {!model.moves.length
                        ? 'Stellung analysieren'
                        : results.length === model.moves.length
                          ? 'Analyse abgeschlossen'
                          : results.length
                            ? 'Analyse fortsetzen'
                            : 'Partie analysieren'}
                    </>
                  )}
                </button>
                <button
                  className="text-button"
                  disabled={busy || Boolean(automaticTerminal(chess))}
                  onClick={() => void currentAnalysis()}
                >
                  Aktuelle Stellung berechnen
                </button>
                {busy && <Loading text="Analyse läuft …" />}
                {currentScore && (
                  <div className="position-result">
                    <strong>{scoreText(currentScore, true, chess.turn())}</strong>
                    <p>Bestzug: {sanOf(position, positionEval!.bestMove)}</p>
                    <small>Tiefe {positionEval!.lines[0].depth}</small>
                    <p className="variation-notation">
                      {notation(position, positionEval!.lines[0].pv.slice(0, 8))}
                    </p>
                  </div>
                )}
                <label className="checkbox-line">
                  <input
                    type="checkbox"
                    checked={arrows}
                    onChange={(e) => setArrows(e.target.checked)}
                  />
                  Bestzugpfeil in aktueller Stellung
                </label>
              </section>
              {results.length > 0 && (
                <section className="panel color-summaries">
                  {(['w', 'b'] as Color[]).map((color) => {
                    const rs = results.filter((r) => colorFor(r.ply) === color);
                    return (
                      <div key={color}>
                        <span>{color === 'w' ? 'Weiß' : 'Schwarz'}</span>
                        <strong>
                          {rs.length
                            ? (rs.reduce((s, r) => s + r.quality, 0) / rs.length).toFixed(1) + ' %'
                            : '–'}
                        </strong>
                        <small>{rs.length} analysierte Züge</small>
                      </div>
                    );
                  })}
                  <p>
                    Arithmetischer Mittelwert der OLYMPION-Zugqualität der jeweils analysierten
                    Züge.
                  </p>
                </section>
              )}
              <section className="panel move-panel">
                <div className="panel-top">
                  <h2>Zugfolge</h2>
                  <button
                    className="icon-button"
                    aria-label="PGN der Hauptpartie exportieren"
                    onClick={() =>
                      download(
                        'olympion-analyse.pgn',
                        restore(model).pgn(),
                        'application/x-chess-pgn',
                      )
                    }
                  >
                    <Download size={17} />
                  </button>
                </div>
                <div className="move-list interactive">
                  {history.map((m, i) => {
                    const r = results.find((r) => r.ply === i);
                    return (
                      <button
                        className={
                          'move ' + (cursor === i + 1 && !variation.length ? 'current' : '')
                        }
                        key={i}
                        onClick={() => navigate(i + 1)}
                        aria-label={`${m.san}${r ? ', ' + r.label + ', ' + Math.round(r.quality) + ' Prozent' : ''}`}
                      >
                        <small>
                          {m.color === 'w'
                            ? Math.floor((i + (initialTurn === 'b' ? 1 : 0)) / 2) + 1 + '.'
                            : ''}
                        </small>
                        {m.san}
                        {r && (
                          <span className={'move-mark ' + (r.quality < 80 ? 'weak' : '')}>
                            {r.quality < 80 ? '?' : r.quality >= 98 ? '·' : '○'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
              {selected && !variation.length && (
                <section className="panel">
                  <QualityCard result={selected} />
                  <button className="button secondary full" onClick={() => void practice()}>
                    Diesen Moment üben <ArrowRight size={16} />
                  </button>
                </section>
              )}
              {results.some((r) => r.quality < 80) && (
                <section className="panel">
                  <h2>Wendepunkte</h2>
                  {results
                    .filter((r) => r.quality < 80)
                    .sort((a, b) => a.quality - b.quality)
                    .slice(0, 5)
                    .map((r) => (
                      <button
                        className="turning-point"
                        key={r.ply}
                        onClick={() => navigate(r.ply + 1)}
                      >
                        <span>
                          {r.san} · {r.label}
                        </span>
                        <strong>{Math.round(r.quality)} %</strong>
                      </button>
                    ))}
                </section>
              )}
            </aside>
          </div>
        </div>
      ) : (
        <Empty title="Gib deiner Partie eine zweite Perspektive.">
          Importiere eine PGN, eine FEN oder öffne eine gespeicherte Partie. Bewertungszahlen
          erscheinen erst nach echter Engineberechnung.
        </Empty>
      )}
    </>
  );
}
function automaticTerminal(chess: ReturnType<typeof restore>) {
  return chess.isCheckmate() || chess.isStalemate() || chess.isInsufficientMaterial();
}
function EvaluationGraph({
  results,
  total,
  cursor,
  onSelect,
}: {
  results: MoveQuality[];
  total: number;
  cursor: number;
  onSelect: (i: number) => void;
}) {
  if (!results.length)
    return (
      <div className="eval-graph empty-graph">
        Hier entsteht nach der Analyse dein Bewertungsverlauf.
      </div>
    );
  const y = (r: MoveQuality) =>
    r.whiteMate !== null
      ? r.whiteMate > 0
        ? 8
        : 112
      : 60 - (Math.max(-600, Math.min(600, r.whiteCp || 0)) / 600) * 50;
  const path = results
    .map((r, i) => `${i ? 'L' : 'M'}${((r.ply + 1) / Math.max(1, total)) * 600} ${y(r)}`)
    .join(' ');
  return (
    <div className="eval-graph">
      <svg viewBox="0 0 600 120" aria-label="Bewertungsverlauf aus Weißperspektive">
        <path d="M0 60H600" stroke="#515154" strokeDasharray="3 4" />
        <path d={path} fill="none" stroke="#e4e4e1" strokeWidth="1.5" />
        <path
          d={`M${(cursor / Math.max(1, total)) * 600} 0v120`}
          stroke="#96969a"
          strokeWidth="1"
        />
        {results.map((r) => (
          <circle
            key={r.ply}
            cx={((r.ply + 1) / Math.max(1, total)) * 600}
            cy={y(r)}
            r={r.quality < 80 ? 3 : 1.5}
            fill="#eee"
          />
        ))}
      </svg>
      <div className="graph-hit-targets">
        {results.map((r) => (
          <button
            key={r.ply}
            onClick={() => onSelect(r.ply + 1)}
            style={{
              left: ((r.ply + 0.5) / Math.max(1, total)) * 100 + '%',
              width: Math.max(1, 100 / Math.max(1, total)) + '%',
            }}
            aria-label={`Nach ${r.san}: ${r.whiteMate !== null ? 'Matt ' + r.whiteMate : ((r.whiteCp || 0) / 100).toFixed(2)}`}
            title={`Nach ${r.san}: ${r.label}`}
          />
        ))}
      </div>
    </div>
  );
}
