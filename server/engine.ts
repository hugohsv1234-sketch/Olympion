import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { UciEngine } from '../src/lib/engine';
import { BOTS, pickCandidate } from '../src/lib/bots';
import { restore } from '../src/lib/chess';
import type { Position } from '../src/lib/types';
export function nodeEngineFactory() {
  const child = spawn(
    process.execPath,
    [join(process.cwd(), 'node_modules/stockfish/bin/stockfish-19-lite-single.js')],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const worker = {
    onmessage: null as null | ((e: { data: string }) => void),
    onerror: null as null | ((e: unknown) => void),
    postMessage: (s: string) => {
      child.stdin.write(s + '\n');
    },
    terminate: () => {
      child.kill();
    },
  };
  let buffer = '';
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop()!;
    for (const data of lines) worker.onmessage?.({ data: data.trim() });
  });
  child.on('error', (e) => worker.onerror?.(e));
  child.on('exit', (code) => {
    if (code && code !== 0) worker.onerror?.(new Error('Engine-Prozess beendet'));
  });
  child.stdin.on('error', (e) => worker.onerror?.(e));
  return worker;
}
export async function serverBotMove(position: Position, level: number) {
  const config = BOTS[level - 1];
  if (!config) throw new Error('Ungültige Botstufe');
  const engine = new UciEngine(nodeEngineFactory);
  try {
    const result = await engine.search(position, {
      nodes: config.nodes,
      skill: config.skill,
      multiPV: config.multiPV,
      signal: AbortSignal.timeout(20000),
    });
    return (
      pickCandidate(
        level,
        result.lines.map((l) => l.move),
        restore(position).fen(),
      ) || result.bestMove
    );
  } finally {
    engine.destroy();
  }
}
