'use client';
import { useT, useLocale } from '@/lib/i18n';
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
  Play,
  Pause,
  Star,
  Save,
  Globe2,
} from 'lucide-react';
import type { Color } from 'chess.js';
import { ANALYSIS_BUDGETS } from '@/lib/bots';
import { DEFAULT_POSITION, importNotation, notation, restore, sanOf } from '@/lib/chess';
import { evaluateMove, getEngine } from '@/lib/engine';
import { scoreText } from '@/lib/metrics';
import type {
  AnalysisRecord,
  GameRecord,
  MoveQuality,
  Position,
  SearchResult,
  ChessComSource,
} from '@/lib/types';
import { download } from '@/lib/storage';
import { useStore } from './Provider';
import { Empty, ErrorText, Heading, Loading, QualityCard } from './Common';
import Chessboard from './Chessboard';
import ChessComImport from './ChessComImport';
import AnalysisLibrary from './AnalysisLibrary';
import type { ChessComGame } from '@/lib/chesscom';
interface Model extends Position {
  id: string;
  name: string;
  source?: ChessComSource;
}
export default function Analysis() {
  const locale = useLocale();
  const tr = useT();
  const { records, ready, put, settings } = useStore();
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
    [importOpen, setImportOpen] = useState(false),
    [autoplay, setAutoplay] = useState(false),
    [speed, setSpeed] = useState(1200),
    [note, setNote] = useState(''),
    [sourceOpen, setSourceOpen] = useState(true),
    [noteSaved, setNoteSaved] = useState(false);
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
      setAutoplay(false);
      setSourceOpen(false);
      setNoteSaved(false);
      setModel(m);
      setCursor(0);
      setVariation([]);
      setPositionEval(null);
      setError('');
      setBudget(selectedBudget);
      const old = records.find((r) => r.id === `analysis:${m.id}:${selectedBudget}`)?.value as
        | AnalysisRecord
        | undefined;
      const matches = old?.initialFen === m.initialFen && old.moves.join(' ') === m.moves.join(' ');
      setResults(matches ? old.results : []);
      setNote(matches ? old.note || '' : '');
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
        {
          id: a.gameId,
          name: a.title || 'Gespeicherte Analyse',
          source: a.source,
          initialFen: a.initialFen,
          moves: a.moves,
        },
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
      setAutoplay(false);
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
  useEffect(() => {
    if (!model) return;
    const frame = requestAnimationFrame(() =>
      root.current?.scrollIntoView({
        behavior: settings.motion ? 'smooth' : 'auto',
        block: 'start',
      }),
    );
    return () => cancelAnimationFrame(frame);
  }, [model, settings.motion]);
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
  const run = async (target: Model | null = model, selectedBudget = budget) => {
    if (!target) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const token = selection.current;
    setError('');
    setBusy(true);
    try {
      if (!target.moves.length) {
        const r = await getEngine().search(position, {
          nodes: selectedBudget,
          skill: 20,
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setPositionEval(r);
        return;
      }
      const saved = records.find((r) => r.id === `analysis:${target.id}:${selectedBudget}`)
        ?.value as AnalysisRecord | undefined;
      const matches =
        saved?.initialFen === target.initialFen && saved.moves.join(' ') === target.moves.join(' ');
      const output = [...(matches ? saved.results : [])];
      const startingColor = restore({ initialFen: target.initialFen, moves: [] }).turn();
      setResults(output);
      for (let ply = output.length; ply < target.moves.length; ply++) {
        if (controller.signal.aborted) break;
        const r = await evaluateMove(
          { initialFen: target.initialFen, moves: target.moves.slice(0, ply) },
          target.moves[ply],
          selectedBudget,
          controller.signal,
        );
        if (controller.signal.aborted || token !== selection.current) break;
        output.push(r);
        setResults([...output]);
        const record: AnalysisRecord = {
          ...(matches ? saved : {}),
          title: target.name,
          source: target.source,
          gameId: target.id,
          initialFen: target.initialFen,
          moves: target.moves,
          budget: selectedBudget,
          results: [...output],
          complete: output.length === target.moves.length,
          completedAt:
            output.length === target.moves.length ? saved?.completedAt || Date.now() : undefined,
          updatedAt: Date.now(),
        };
        await put(`analysis:${target.id}:${selectedBudget}`, 'analysis', record);
        const mistakeId = `mistake:${target.id}:${r.ply}`;
        const moveColor = r.ply % 2 === 0 ? startingColor : startingColor === 'w' ? 'b' : 'w';
        if (
          r.quality < 80 &&
          (!target.source || moveColor === target.source.color) &&
          !records.some((item) => item.id === mistakeId)
        ) {
          await put(mistakeId, 'mistake', {
            initialFen: target.initialFen,
            moves: target.moves.slice(0, r.ply),
            answer: r.bestMove,
            gameId: target.id,
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
  const importChessCom = async (game: ChessComGame) => {
    if (!ready) throw new Error('Der lokale Speicher wird noch geöffnet. Bitte kurz warten.');
    const parsed = importNotation(game.pgn);
    if (!parsed.moves.length) throw new Error('Diese Partie enthält keine analysierbaren Züge.');
    const previous =
      savedAnalyses
        .map((r) => r.value as AnalysisRecord)
        .find(
          (a) =>
            a.gameId === game.id &&
            a.initialFen === parsed.initialFen &&
            a.moves.join(' ') === parsed.moves.join(' ') &&
            a.complete,
        ) ||
      savedAnalyses
        .map((r) => r.value as AnalysisRecord)
        .find(
          (a) =>
            a.gameId === game.id &&
            a.budget === budget &&
            a.initialFen === parsed.initialFen &&
            a.moves.join(' ') === parsed.moves.join(' '),
        );
    const selectedBudget = previous?.budget || budget;
    const target: Model = {
      ...parsed,
      id: game.id,
      name: game.source.white + ' vs. ' + game.source.black,
      source: game.source,
    };
    const record: AnalysisRecord = {
      ...previous,
      gameId: game.id,
      ...parsed,
      title: target.name,
      source: target.source,
      budget: selectedBudget,
      results: previous?.results || [],
      complete: previous?.complete || false,
      updatedAt: Date.now(),
    };
    await put('analysis:' + game.id + ':' + selectedBudget, 'analysis', record);
    load(target, selectedBudget);
    setOrientation(game.source.color);
    if (!record.complete) void run(target, selectedBudget);
  };
  const openSaved = (a: AnalysisRecord) => {
    load(
      {
        id: a.gameId,
        name: a.title || 'Gespeicherte Analyse',
        initialFen: a.initialFen,
        moves: a.moves,
        source: a.source,
      },
      a.budget,
    );
    if (a.source) setOrientation(a.source.color);
  };
  useEffect(() => {
    if (!autoplay || !model) return;
    if (cursor >= model.moves.length) {
      setAutoplay(false);
      return;
    }
    const timer = setTimeout(() => {
      setCursor(cursor + 1);
      setVariation([]);
      setPositionEval(null);
    }, speed);
    return () => clearTimeout(timer);
  }, [autoplay, cursor, model, speed]);
  const saveMetadata = async (favorite?: boolean) => {
    if (!model || busy) return;
    const id = 'analysis:' + model.id + ':' + budget;
    const previous = records.find((r) => r.id === id)?.value as AnalysisRecord | undefined;
    try {
      await put(id, 'analysis', {
        ...previous,
        gameId: model.id,
        initialFen: model.initialFen,
        moves: model.moves,
        title: model.name,
        source: model.source,
        budget,
        results,
        complete: Boolean(model.moves.length && results.length === model.moves.length),
        note,
        favorite: favorite ?? previous?.favorite ?? false,
        updatedAt: Date.now(),
      } satisfies AnalysisRecord);
      setNoteSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Notiz konnte nicht gespeichert werden.');
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
      setNote(old?.note || '');
      setNoteSaved(false);
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
        god={tr('APOLLON \u00B7 PARTIEANALYSE')}
        title={tr('Verstehe, was m\u00F6glich war.')}
        description={tr(
          'Deine Partien. Echte Berechnung. Ein klarer Plan f\u00FCr den n\u00E4chsten Zug.',
        )}
      >
        <button className="button secondary" onClick={() => setSourceOpen((v) => !v)}>
          <Globe2 size={16} />
          {tr(' Chess.com-Partien')}
        </button>
        <button className="button secondary" onClick={() => setImportOpen(!importOpen)}>
          <Upload size={16} />
          {tr('PGN oder FEN importieren')}
        </button>
      </Heading>
      {sourceOpen && (
        <ChessComImport onSelect={importChessCom} analyzing={busy} activeId={model?.id} />
      )}
      {importOpen && (
        <section className="panel import-panel">
          <div>
            <h2>{tr('Deine Partie auf dem Brett.')}</h2>
            <p>
              {tr(
                'F\u00FCge eine PGN oder einzelne FEN-Stellung ein. Maximal 200 KB und 500 Halbz\u00FCge.',
              )}
            </p>
            <label className="field">
              {tr('Notation')}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={tr(
                  '1. e4 e5 2. Sf3 \u2026\n(PGN verwendet englische Figurennamen: Nf3)',
                )}
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
                {tr('Auf dem Brett \u00F6ffnen ')}
                <ArrowRight size={17} />
              </button>
              <label className="button secondary file-button">
                <Upload size={16} />
                {tr('PGN-Datei')}
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
            <span className="eyebrow">{tr('DEINE GESPEICHERTEN PARTIEN')}</span>
            {games.length ? (
              games.slice(0, 8).map((g) => (
                <button
                  className="saved-game"
                  key={g.id}
                  onClick={() => load({ ...g, name: 'Arena · Stufe ' + g.level })}
                >
                  <span>
                    {new Date(g.createdAt).toLocaleDateString(locale)}
                    {tr(' \u00B7 Bot ')}
                    {g.level}
                    <small>
                      {g.moves.length}
                      {tr(' Halbz\u00FCge \u00B7 ')}
                      {g.result || 'Laufende Partie'}
                    </small>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))
            ) : (
              <p>
                {tr(
                  'Noch keine gespeicherten Partien. Spiele eine Botpartie oder importiere deine eigene.',
                )}
              </p>
            )}
            <button
              className="text-button"
              onClick={() =>
                importText('1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7 Kxf7')
              }
            >
              {tr('Legale Beispielpartie laden')}
            </button>
            {savedAnalyses.length > 0 && (
              <>
                <span className="eyebrow">{tr('GESPEICHERTE ANALYSEN')}</span>
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
                            name: a.title || 'Gespeicherte Analyse',
                            source: a.source,
                            initialFen: a.initialFen,
                            moves: a.moves,
                          },
                          a.budget,
                        )
                      }
                    >
                      <span>
                        {new Date(a.updatedAt).toLocaleDateString(locale)}
                        <small>
                          {a.results.length} / {a.moves.length}
                          {tr(' Halbz\u00FCge \u00B7')} {a.budget.toLocaleString(locale)}
                          {tr(' Knoten')}
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
      {error && <ErrorText>{tr(error)}</ErrorText>}
      {model ? (
        <div ref={root} className={'analysis-workspace ' + (fullscreen ? 'is-fullscreen' : '')}>
          <div className="analysis-toolbar">
            <div>
              <span className="eyebrow">{model.name}</span>
              <small>
                {variation.length
                  ? tr('Freie Variante')
                  : `${cursor} / ${model.moves.length} Halbzüge`}
              </small>
            </div>
            <div className="button-row">
              <label className="sr-only" htmlFor="analysis-intensity">
                {tr('Analyseintensit\u00E4t')}
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
                aria-label={fullscreen ? tr('Vollbild verlassen') : tr('Vollbild \u00F6ffnen')}
              >
                {fullscreen ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
              </button>
            </div>
          </div>
          {model.source && (
            <div className="analysis-player-strip">
              <div className="player-monogram">{model.source.username[0].toUpperCase()}</div>
              <div>
                <span className="eyebrow">{tr('DEINE CHESS.COM-PARTIE')}</span>
                <strong>{model.source.username}</strong>
                <small>
                  {tr('Du spielst ')}
                  {model.source.color === 'w' ? tr('Wei\u00DF') : tr('Schwarz')} ·{' '}
                  {model.source.timeClass} ·{' '}
                  {new Date(model.source.endedAt).toLocaleDateString(locale)}
                </small>
              </div>
              <div className="player-quality">
                <small>{tr('Deine Zugqualit\u00E4t')}</small>
                <strong>
                  {(() => {
                    const own = results.filter((r) => colorFor(r.ply) === model.source!.color);
                    return own.length
                      ? (own.reduce((n, r) => n + r.quality, 0) / own.length).toFixed(1) + ' %'
                      : '–';
                  })()}
                </strong>
                <small>{tr('OLYMPION \u00B7 berechnete Z\u00FCge')}</small>
              </div>
            </div>
          )}
          <div className="play-layout analysis-layout">
            <div className="board-column">
              <div className="evaluation-board">
                <div
                  className="evaluation-bar"
                  aria-label={tr('Bewertungsleiste aus Wei\u00DFperspektive')}
                >
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
                    setAutoplay(false);
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
                  aria-label={tr('Zur Anfangsstellung')}
                  onClick={() => navigate(0)}
                  disabled={cursor === 0 && !variation.length}
                >
                  <ChevronsLeft size={21} />
                </button>
                <button
                  className="icon-button"
                  aria-label={tr('Einen Halbzug zur\u00FCck')}
                  onClick={() => navigate(cursor - 1)}
                  disabled={cursor === 0 && !variation.length}
                >
                  <ChevronLeft size={23} />
                </button>
                <button
                  className="icon-button playback-button"
                  aria-label={
                    autoplay ? tr('Wiedergabe pausieren') : tr('Partie automatisch abspielen')
                  }
                  disabled={!model.moves.length}
                  aria-pressed={autoplay}
                  onClick={() => {
                    if (!autoplay && cursor >= model.moves.length) navigate(0);
                    setAutoplay((v) => !v);
                  }}
                >
                  {autoplay ? <Pause size={19} /> : <Play size={19} />}
                </button>
                <span>
                  {cursor} / {model.moves.length}
                </span>
                <button
                  className="icon-button"
                  aria-label={tr('Einen Halbzug vor')}
                  onClick={() => navigate(cursor + 1)}
                  disabled={cursor === model.moves.length && !variation.length}
                >
                  <ChevronRight size={23} />
                </button>
                <button
                  className="icon-button"
                  aria-label={tr('Zur Schlussstellung')}
                  onClick={() => navigate(model.moves.length)}
                  disabled={cursor === model.moves.length && !variation.length}
                >
                  <ChevronsRight size={21} />
                </button>
                <label className="playback-speed">
                  <span className="sr-only">{tr('Wiedergabegeschwindigkeit')}</span>
                  <select
                    aria-label={tr('Wiedergabegeschwindigkeit')}
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                  >
                    <option value={2000}>0,5×</option>
                    <option value={1200}>1×</option>
                    <option value={700}>2×</option>
                  </select>
                </label>
                <div className="nav-divider" />
                <button
                  className="icon-button"
                  aria-label={tr('Brett drehen')}
                  onClick={() => setOrientation((o) => (o === 'w' ? 'b' : 'w'))}
                >
                  <FlipVertical2 size={18} />
                </button>
              </div>
              {variation.length > 0 && (
                <div className="variation-note">
                  <span>
                    {tr('Variante:')}{' '}
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
                    {tr('Zur Hauptpartie')}
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
                <span>{tr('Bewertung immer aus Sicht von Wei\u00DF')}</span>
                <span>{tr('\u2190 \u2192 f\u00FCr Zugnavigation')}</span>
              </div>
              {!model.moves.length && (
                <p className="small-text">
                  {tr(
                    'FEN-Stellung: Fr\u00FChere Z\u00FCge sind unbekannt. Wiederholungsanspr\u00FCche k\u00F6nnen daraus nicht rekonstruiert werden.',
                  )}
                </p>
              )}
            </div>
            <aside className="play-panel">
              <section className="panel">
                <div className="panel-top">
                  <h2>{tr('Computeranalyse')}</h2>
                  <span className="tag">{tr('STOCKFISH 19')}</span>
                </div>
                <div className="analysis-coverage">
                  <strong>
                    {results.length}{' '}
                    <span>
                      / {model.moves.length}
                      {tr(' Halbz\u00FCge')}
                    </span>
                  </strong>
                  <small>
                    {budget.toLocaleString(locale)}
                    {tr(' Knoten pro Suche \u00B7')}{' '}
                    {results.length === model.moves.length && model.moves.length
                      ? tr('vollst\u00E4ndig')
                      : tr('Teilabdeckung')}
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
                      {tr('Analyse abbrechen')}
                    </>
                  ) : (
                    <>
                      <Focus size={17} />
                      {!model.moves.length
                        ? tr('Stellung analysieren')
                        : results.length === model.moves.length
                          ? tr('Analyse abgeschlossen')
                          : results.length
                            ? tr('Analyse fortsetzen')
                            : tr('Partie analysieren')}
                    </>
                  )}
                </button>
                <button
                  className="text-button"
                  disabled={busy || Boolean(automaticTerminal(chess))}
                  onClick={() => void currentAnalysis()}
                >
                  {tr('Aktuelle Stellung berechnen')}
                </button>
                {busy && <Loading text={tr('Analyse l\u00E4uft \u2026')} />}
                {currentScore && (
                  <div className="position-result">
                    <strong>{scoreText(currentScore, true, chess.turn())}</strong>
                    <p>
                      {tr('Bestzug: ')}
                      {sanOf(position, positionEval!.bestMove)}
                    </p>
                    <small>
                      {tr('Tiefe ')}
                      {positionEval!.lines[0].depth}
                    </small>
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
                  {tr('Bestzugpfeil in aktueller Stellung')}
                </label>
              </section>
              {results.length > 0 && (
                <section className="panel color-summaries">
                  {(['w', 'b'] as Color[]).map((color) => {
                    const rs = results.filter((r) => colorFor(r.ply) === color);
                    return (
                      <div key={color}>
                        <span>{color === 'w' ? tr('Wei\u00DF') : tr('Schwarz')}</span>
                        <strong>
                          {rs.length
                            ? (rs.reduce((s, r) => s + r.quality, 0) / rs.length).toFixed(1) + ' %'
                            : '–'}
                        </strong>
                        <small>
                          {rs.length}
                          {tr(' analysierte Z\u00FCge')}
                        </small>
                      </div>
                    );
                  })}
                  <p>
                    {tr(
                      'Arithmetischer Mittelwert der OLYMPION-Zugqualit\u00E4t der jeweils analysierten Z\u00FCge.',
                    )}
                  </p>
                </section>
              )}
              <section className="panel analysis-notes">
                <div className="panel-top">
                  <h2>{tr('Dein Lehrbuch')}</h2>
                  <button
                    className="icon-button"
                    aria-label={tr('Analyse als Favorit markieren')}
                    disabled={busy}
                    aria-pressed={Boolean(
                      (
                        records.find((r) => r.id === 'analysis:' + model.id + ':' + budget)
                          ?.value as AnalysisRecord | undefined
                      )?.favorite,
                    )}
                    onClick={() =>
                      void saveMetadata(
                        !(
                          records.find((r) => r.id === 'analysis:' + model.id + ':' + budget)
                            ?.value as AnalysisRecord | undefined
                        )?.favorite,
                      )
                    }
                  >
                    <Star
                      size={18}
                      fill={
                        (
                          records.find((r) => r.id === 'analysis:' + model.id + ':' + budget)
                            ?.value as AnalysisRecord | undefined
                        )?.favorite
                          ? 'currentColor'
                          : 'none'
                      }
                    />
                  </button>
                </div>
                <label className="field">
                  {tr('Deine Erkenntnis')}
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={note}
                    disabled={busy}
                    onChange={(e) => {
                      setNote(e.target.value);
                      setNoteSaved(false);
                    }}
                    placeholder={tr(
                      'Was m\u00F6chtest du in der n\u00E4chsten Partie besser machen?',
                    )}
                  />
                </label>
                <button className="text-button" disabled={busy} onClick={() => void saveMetadata()}>
                  <Save size={15} /> {noteSaved ? tr('Gespeichert') : tr('Notiz speichern')}
                </button>
                <small>{tr('Favoriten und Notizen bleiben in deinem Analyse-Archiv.')}</small>
              </section>
              <section className="panel move-panel">
                <div className="panel-top">
                  <h2>{tr('Zugfolge')}</h2>
                  <button
                    className="icon-button"
                    aria-label={tr('PGN der Hauptpartie exportieren')}
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
                    {tr('Diesen Moment \u00FCben ')}
                    <ArrowRight size={16} />
                  </button>
                </section>
              )}
              {results.some((r) => r.quality < 80) && (
                <section className="panel">
                  <h2>{tr('Wendepunkte')}</h2>
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
                          {r.san} · {tr(r.label)}
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
        <Empty title={tr('Gib deiner Partie eine zweite Perspektive.')}>
          {tr(
            'Importiere eine PGN, eine FEN oder \u00F6ffne eine gespeicherte Partie. Bewertungszahlen erscheinen erst nach echter Engineberechnung.',
          )}
        </Empty>
      )}
      <AnalysisLibrary busy={busy} onOpen={openSaved} />
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
  const tr = useT();
  if (!results.length)
    return (
      <div className="eval-graph empty-graph">
        {tr('Hier entsteht nach der Analyse dein Bewertungsverlauf.')}
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
      <svg viewBox="0 0 600 120" aria-label={tr('Bewertungsverlauf aus Wei\u00DFperspektive')}>
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
