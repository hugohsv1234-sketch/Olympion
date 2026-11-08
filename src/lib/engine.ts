import type { EngineLine, EngineScore, MoveQuality, Position, SearchResult } from './types';
import { restore, sanOf, notation, playUci } from './chess';
import { BOTS, pickCandidate } from './bots';
import { expectation, qualityMetric, qualityLabel } from './metrics';
export interface SearchOptions {
  nodes: number;
  skill?: number;
  multiPV?: number;
  searchMoves?: string[];
  signal?: AbortSignal;
}
type WorkerLike = {
  postMessage: (s: string) => void;
  terminate: () => void;
  onmessage: ((e: { data: string }) => void) | null;
  onerror: ((e: unknown) => void) | null;
};
export interface UciOption {
  name: string;
  type: string;
  min?: number;
  max?: number;
}
export function parseOption(s: string): UciOption | null {
  const m = s.match(/^option name (.+?) type (\w+)(.*)$/);
  if (!m) return null;
  return {
    name: m[1],
    type: m[2],
    min: m[3].match(/ min (-?\d+)/) ? Number(m[3].match(/ min (-?\d+)/)![1]) : undefined,
    max: m[3].match(/ max (-?\d+)/) ? Number(m[3].match(/ max (-?\d+)/)![1]) : undefined,
  };
}
export function parseInfo(s: string): EngineLine | null {
  if (!s.startsWith('info ') || !s.includes(' pv ')) return null;
  const score: EngineScore = {};
  const cp = s.match(/ score cp (-?\d+)/),
    mate = s.match(/ score mate (-?\d+)/),
    wdl = s.match(/ wdl (\d+) (\d+) (\d+)/);
  if (cp) score.cp = Number(cp[1]);
  if (mate) score.mate = Number(mate[1]);
  if (wdl) score.wdl = [Number(wdl[1]), Number(wdl[2]), Number(wdl[3])];
  if (s.includes('lowerbound') || s.includes('upperbound')) score.bound = true;
  const pv = s.split(' pv ')[1].trim().split(/\s+/);
  return {
    move: pv[0],
    pv,
    score,
    depth: Number(s.match(/ depth (\d+)/)?.[1] || 0),
    nodes: Number(s.match(/ nodes (\d+)/)?.[1] || 0),
    rank: Number(s.match(/ multipv (\d+)/)?.[1] || 1),
  };
}
export class UciEngine {
  private worker: WorkerLike | null = null;
  private ready: Promise<void> | null = null;
  private tail: Promise<unknown> = Promise.resolve();
  private listeners = new Set<(s: string) => void>();
  readonly options = new Map<string, UciOption>();
  version = 'Stockfish 19 lite-single';
  constructor(
    private factory: () => WorkerLike = () =>
      new Worker('/engine/stockfish-19-lite-single.js') as unknown as WorkerLike,
  ) {}
  private send(s: string) {
    if (!this.worker) throw new Error('Engine nicht gestartet.');
    this.worker.postMessage(s);
  }
  private option(name: string, value: string | number | boolean) {
    const o = this.options.get(name);
    if (!o) return;
    if (typeof value === 'number')
      value = Math.max(o.min ?? -Infinity, Math.min(o.max ?? Infinity, value));
    this.send(`setoption name ${name}${o.type === 'button' ? '' : ' value ' + String(value)}`);
  }
  private waitFor(test: (s: string) => boolean, timeout = 20000) {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(listener);
        reject(new Error('Stockfish antwortet nicht. Bitte Engine erneut laden.'));
      }, timeout);
      const listener = (s: string) => {
        if (s === '__error__') {
          clearTimeout(timer);
          this.listeners.delete(listener);
          reject(new Error('Stockfish konnte nicht gestartet werden.'));
          return;
        }
        if (test(s)) {
          clearTimeout(timer);
          this.listeners.delete(listener);
          resolve();
        }
      };
      this.listeners.add(listener);
    });
  }
  async init() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      this.worker = this.factory();
      this.worker.onmessage = (e) => {
        for (const line of String(e.data).split('\n')) {
          const op = parseOption(line);
          if (op) this.options.set(op.name, op);
          if (line.startsWith('id name ')) this.version = line.slice(8);
          this.listeners.forEach((f) => f(line));
        }
      };
      this.worker.onerror = () => {
        this.listeners.forEach((f) => f('__error__'));
        this.destroy();
      };
      const uci = this.waitFor((s) => s === 'uciok');
      this.send('uci');
      await uci;
      this.option('Hash', 32);
      this.option('Threads', 1);
      this.option('UCI_ShowWDL', true);
      const r = this.waitFor((s) => s === 'readyok');
      this.send('isready');
      await r;
    })();
    try {
      await this.ready;
    } catch (e) {
      this.destroy();
      throw e;
    }
  }
  search(position: Position, config: SearchOptions): Promise<SearchResult> {
    const run = async () => {
      if (config.signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
      // chess.js validates FEN syntax; restore also rejects an inactive king
      // already in check. Such impossible inputs can stall some engine builds.
      const validated = restore(position);
      if (config.searchMoves)
        for (const move of config.searchMoves) {
          const c = restore(position);
          playUci(c, move);
        }
      if (!validated.moves().length) throw new Error('Diese Stellung hat keine legalen Züge.');
      await this.init();
      if (config.signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
      this.option('UCI_LimitStrength', false);
      this.option('Skill Level', config.skill ?? 20);
      this.option('MultiPV', config.multiPV ?? 1);
      this.option('Clear Hash', 0);
      const p = this.waitFor((s) => s === 'readyok');
      this.send('isready');
      await p;
      return new Promise<SearchResult>((resolve, reject) => {
        const lines = new Map<number, EngineLine>();
        let aborted = false;
        let stopTimer: ReturnType<typeof setTimeout> | undefined;
        const cleanup = () => {
          clearTimeout(timer);
          if (stopTimer) clearTimeout(stopTimer);
          this.listeners.delete(listener);
          config.signal?.removeEventListener('abort', abort);
        };
        const abort = () => {
          aborted = true;
          this.send('stop');
          stopTimer = setTimeout(() => {
            cleanup();
            this.destroy();
            reject(new DOMException('Abgebrochen', 'AbortError'));
          }, 2500);
        };
        const timer = setTimeout(() => {
          cleanup();
          this.destroy();
          reject(new Error('Engine-Zeitlimit erreicht. Reduziere die Analyseintensität.'));
        }, 90000);
        const listener = (s: string) => {
          if (s === '__error__') {
            cleanup();
            reject(
              new Error(
                'Engine konnte nicht geladen werden. Download und Browserunterstützung prüfen.',
              ),
            );
            return;
          }
          const line = parseInfo(s);
          if (line && (!line.score.bound || !lines.has(line.rank))) lines.set(line.rank, line);
          if (s.startsWith('bestmove ')) {
            cleanup();
            if (aborted) {
              reject(new DOMException('Abgebrochen', 'AbortError'));
              return;
            }
            const bestMove = s.split(' ')[1];
            if (!bestMove || bestMove === '(none)' || bestMove === '0000') {
              reject(new Error('Kein legaler Enginezug verfügbar.'));
              return;
            }
            const result = [...lines.values()].sort((a, b) => a.rank - b.rank);
            if (!result.length) {
              reject(new Error('Die Engine lieferte keine Bewertung.'));
              return;
            }
            resolve({ bestMove, lines: result, engine: this.version, budget: config.nodes });
          }
        };
        this.listeners.add(listener);
        config.signal?.addEventListener('abort', abort, { once: true });
        this.send(
          `position fen ${position.initialFen}${position.moves.length ? ' moves ' + position.moves.join(' ') : ''}`,
        );
        this.send(
          `go nodes ${config.nodes} movetime ${Math.min(20000, Math.max(1000, Math.ceil(config.nodes / 60)))}${config.searchMoves?.length ? ' searchmoves ' + config.searchMoves.join(' ') : ''}`,
        );
        if (config.signal?.aborted) abort();
      });
    };
    const promise = this.tail.then(run, run);
    this.tail = promise.catch(() => undefined);
    return promise;
  }
  destroy() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    this.options.clear();
  }
}
let singleton: UciEngine | undefined;
export function getEngine() {
  return (singleton ??= new UciEngine());
}
export async function botMove(position: Position, level: number, signal?: AbortSignal) {
  const b = BOTS[level - 1];
  if (!b) throw new Error('Ungültige Botstufe.');
  const r = await getEngine().search(position, {
    nodes: b.nodes,
    skill: b.skill,
    multiPV: b.multiPV,
    signal,
  });
  const candidates = r.lines.map((l) => l.move);
  return pickCandidate(level, candidates, restore(position).fen()) || r.bestMove;
}
const cache = new Map<string, MoveQuality>();
export async function evaluateMove(
  position: Position,
  move: string,
  budget = 120000,
  signal?: AbortSignal,
  engineInstance?: UciEngine,
): Promise<MoveQuality> {
  const key = JSON.stringify(['19.0.1', position, budget, move]);
  const hit = cache.get(key);
  if (hit) return hit;
  const g = restore(position);
  const forced = g.moves().length === 1;
  const engine = engineInstance || getEngine();
  let nodes = budget;
  let best = await engine.search(position, { nodes, skill: 20, multiPV: 1, signal });
  let played =
    best.bestMove === move
      ? best
      : await engine.search(position, {
          nodes,
          skill: 20,
          multiPV: 1,
          searchMoves: [move],
          signal,
        });
  if (expectation(played.lines[0].score) - expectation(best.lines[0].score) > 0.04) {
    nodes *= 3;
    best = await engine.search(position, { nodes, skill: 20, multiPV: 1, signal });
    played =
      best.bestMove === move
        ? best
        : await engine.search(position, {
            nodes,
            skill: 20,
            multiPV: 1,
            searchMoves: [move],
            signal,
          });
  }
  const b = best.lines[0],
    p = played.lines[0];
  const quality = qualityMetric(b.score, p.score);
  const san = sanOf(position, move),
    bestSan = sanOf(position, best.bestMove);
  const label = qualityLabel(b.score, p.score, quality, best.bestMove === move, forced);
  const loss =
    b.score.cp !== undefined && p.score.cp !== undefined
      ? Math.max(0, b.score.cp - p.score.cp)
      : null;
  const view = g.turn() === 'w' ? 1 : -1;
  const m = g.moves({ verbose: true }).find((m) => m.from + m.to + (m.promotion || '') === move);
  let explanation = forced
    ? 'Es gab nur einen legalen Zug.'
    : best.bestMove === move
      ? 'Dein Zug entspricht dem besten Zug dieser Suche.'
      : `Die Engine bevorzugt ${bestSan}. Variante: ${notation(position, b.pv.slice(0, 6))}.`;
  if (m?.captured) explanation += ` ${san} schlägt eine Figur.`;
  if (p.score.mate !== undefined)
    explanation += ` Bei bestem Gegenspiel: ${p.score.mate > 0 ? 'Matt für dich' : 'Matt gegen dich'} in ${Math.abs(p.score.mate)}.`;
  const result: MoveQuality = {
    ply: position.moves.length,
    move,
    san,
    bestMove: best.bestMove,
    bestSan,
    quality,
    label,
    explanation,
    before: b.score,
    played: p.score,
    cpLoss: loss,
    method: b.score.wdl && p.score.wdl ? 'WDL' : 'Näherung',
    depth: Math.min(b.depth, p.depth),
    confidence:
      expectation(p.score) > expectation(b.score) + 0.015 ||
      Math.abs(b.depth - p.depth) > 4 ||
      b.score.bound ||
      p.score.bound
        ? 'gering'
        : 'normal',
    budget,
    engine: best.engine,
    pv: p.pv,
    whiteCp: p.score.cp !== undefined ? p.score.cp * view : null,
    whiteMate: p.score.mate !== undefined ? p.score.mate * view : null,
  };
  cache.set(key, result);
  if (cache.size > 200) cache.delete(cache.keys().next().value!);
  return result;
}
