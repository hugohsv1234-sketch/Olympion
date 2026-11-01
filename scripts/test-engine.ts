import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { UciEngine, evaluateMove } from '../src/lib/engine';
import { BOTS, pickCandidate } from '../src/lib/bots';
import { restore, playUci, DEFAULT_POSITION } from '../src/lib/chess';
let onSearchInfo: (() => void) | undefined;
function factory() {
  const child = spawn(
    process.execPath,
    ['node_modules/stockfish/bin/stockfish-19-lite-single.js'],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const worker = {
    onmessage: null as null | ((e: { data: string }) => void),
    onerror: null as null | ((e: unknown) => void),
    postMessage: (s: string) => {
      if (process.env.DEBUG_ENGINE) console.log('SEND', s);
      child.stdin.write(s + '\n');
    },
    terminate: () => {
      child.kill();
    },
  };
  let buffer = '';
  child.stdout.on('data', (d) => {
    buffer += d;
    const lines = buffer.split('\n');
    buffer = lines.pop()!;
    for (const s of lines) {
      if (process.env.DEBUG_ENGINE && /uciok|readyok|bestmove/.test(s)) console.log('RECV', s);
      worker.onmessage?.({ data: s.trim() });
      if (/^info depth \d+/.test(s.trim())) onSearchInfo?.();
    }
  });
  child.on('error', (e) => worker.onerror?.(e));
  return worker;
}
const engine = new UciEngine(factory);
const start = Date.now();
const positions = [
  { initialFen: '7k/6rq/5K2/8/4B3/8/7Q/R7 w - - 1 2', moves: [] },
  { initialFen: '7k/8/4Q1K1/8/8/8/8/8 w - - 0 1', moves: [] },
  { initialFen: DEFAULT_POSITION, moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6'] },
];
const report: { level: number; skill: number; nodes: number; moves: string[]; depths: number[] }[] =
  [];
try {
  await engine.init();
  console.log('Engine initialisiert:', engine.version);
  assert(engine.options.has('Skill Level'));
  assert(engine.options.has('UCI_ShowWDL'));
  assert.equal(
    new Set(BOTS.map((b) => JSON.stringify([b.skill, b.nodes, b.multiPV, b.errorRate]))).size,
    20,
  );
  for (const b of BOTS) {
    const moves: string[] = [],
      depths: number[] = [];
    for (const p of positions) {
      const r = await engine.search(p, { nodes: b.nodes, skill: b.skill, multiPV: b.multiPV });
      const move = pickCandidate(
        b.level,
        r.lines.map((l) => l.move),
        restore(p).fen(),
      );
      const g = restore(p);
      assert.doesNotThrow(() => playUci(g, move));
      assert(r.lines[0].score.wdl);
      moves.push(move);
      depths.push(r.lines[0].depth);
    }
    report.push({ level: b.level, skill: b.skill, nodes: b.nodes, moves, depths });
    console.log('Stufe', b.level, 'legal auf 3 Vergleichsstellungen; Knoten', b.nodes);
  }
  const overload = await engine.search(positions[0], { nodes: 400000, skill: 20 });
  assert(
    ['h2h7', 'a1a8'].includes(overload.bestMove),
    'Einer der beiden validierten Matt-in-zwei-Wege muss gefunden werden.',
  );
  const best = await evaluateMove(positions[0], 'h2h7', 40000, undefined, engine);
  assert(best.quality >= 98);
  assert.equal(best.method, 'WDL');
  const blunder = await evaluateMove(positions[1], 'e6f7', 40000, undefined, engine);
  assert.equal(blunder.label, 'Matt verpasst');
  // Abort after real search output, not a timer: a forced mate can finish before
  // a timer fires on a fast runner. Queue the next position before cancellation
  // settles to exercise the scheduler with the real engine process.
  const abort = new AbortController();
  onSearchInfo = () => {
    onSearchInfo = undefined;
    abort.abort();
  };
  const stale = engine.search(positions[2], { nodes: 50000000, signal: abort.signal });
  const cancelled = assert.rejects(stale, (e) => e instanceof Error && e.name === 'AbortError');
  const queued = engine.search(positions[1], { nodes: 10000, skill: 20 });
  await cancelled;
  const fresh = await queued;
  const final = new Chess(positions[1].initialFen);
  playUci(final, fresh.bestMove);
  assert(final.isCheckmate());
  await mkdir('docs', { recursive: true });
  await writeFile(
    'docs/engine-test-results.json',
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        engine: engine.version,
        durationMs: Date.now() - start,
        positions,
        options: [...engine.options.values()],
        levels: report,
        overloadBest: overload.bestMove,
        qualityExample: best,
        missedMate: blunder.label,
        abortThenNewPosition: 'passed',
      },
      null,
      2,
    ),
  );
  console.log(
    'BESTANDEN: 20 Stufen × 3 Stellungen, WDL-Analyse, Überlastung, Mattfall und Abbruch/Reihenfolge.',
  );
} finally {
  engine.destroy();
}
