import { restore, playUci } from './chess';
const isObject = (x: unknown): x is Record<string, unknown> =>
  Boolean(x) && typeof x === 'object' && !Array.isArray(x);
const number = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
const text = (x: unknown, max = 200) => typeof x === 'string' && x.length <= max;
const moves = (x: unknown): x is string[] =>
  Array.isArray(x) &&
  x.length <= 500 &&
  x.every((m) => typeof m === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m));
function position(x: Record<string, unknown>) {
  if (!text(x.initialFen, 150) || !moves(x.moves)) return false;
  try {
    restore({ initialFen: x.initialFen as string, moves: x.moves });
    return true;
  } catch {
    return false;
  }
}
function score(x: unknown) {
  return (
    isObject(x) &&
    ((x.cp === undefined && x.mate !== undefined) || number(x.cp, -100000, 100000)) &&
    (x.mate === undefined || number(x.mate, -1000, 1000)) &&
    (x.wdl === undefined ||
      (Array.isArray(x.wdl) && x.wdl.length === 3 && x.wdl.every((v) => number(v, 0, 1000))))
  );
}
function quality(x: unknown) {
  if (!isObject(x)) return false;
  return (
    number(x.ply, 0, 500) &&
    number(x.quality, 0, 100) &&
    text(x.move, 5) &&
    text(x.san, 30) &&
    text(x.bestMove, 5) &&
    text(x.bestSan, 30) &&
    text(x.label, 100) &&
    text(x.explanation, 3000) &&
    score(x.before) &&
    score(x.played) &&
    number(x.depth, 0, 1000) &&
    number(x.budget, 1, 5000000) &&
    ['WDL', 'Näherung'].includes(x.method as string) &&
    ['normal', 'gering'].includes(x.confidence as string) &&
    text(x.engine, 200) &&
    moves(x.pv) &&
    (x.whiteCp === null || number(x.whiteCp, -100000, 100000)) &&
    (x.whiteMate === null || number(x.whiteMate, -1000, 1000))
  );
}
export function validPayload(kind: string, input: unknown) {
  if (!isObject(input)) return false;
  const p = input;
  if (kind === 'settings')
    return (
      text(p.name, 60) &&
      [10, 20, 30].includes(p.goal as number) &&
      ['sound', 'motion', 'coordinates', 'contrast'].every((k) => typeof p[k] === 'boolean')
    );
  if (kind === 'attempt')
    return (
      text(p.puzzleId, 180) &&
      number(p.rating, 0, 4000) &&
      Array.isArray(p.themes) &&
      p.themes.length < 80 &&
      p.themes.every((t) => text(t, 50)) &&
      typeof p.success === 'boolean' &&
      number(p.hints, 0, 3) &&
      number(p.errors, 0, 100000) &&
      number(p.seconds, 0, 31536000) &&
      number(p.at) &&
      ['adaptive', 'daily', 'series', 'review', 'time'].includes(p.mode as string)
    );
  if (kind === 'game')
    return (
      position(p) &&
      text(p.id, 100) &&
      number(p.level, 1, 20) &&
      ['w', 'b'].includes(p.color as string) &&
      ['Ohne Uhr', '3+2', '5+0', '10+0', '15+10'].includes(p.clock as string) &&
      isObject(p.remaining) &&
      number(p.remaining.w, 0, 86400000) &&
      number(p.remaining.b, 0, 86400000) &&
      number(p.increment, 0, 10000) &&
      (p.turnStarted === null || number(p.turnStarted)) &&
      typeof p.paused === 'boolean' &&
      typeof p.live === 'boolean' &&
      number(p.assists, 0, 100000) &&
      number(p.createdAt) &&
      number(p.updatedAt) &&
      [null, '1-0', '0-1', '½-½', '*'].includes(p.result as string | null)
    );
  if (kind === 'analysis')
    return (
      position(p) &&
      text(p.gameId, 100) &&
      number(p.budget, 1000, 5000000) &&
      Array.isArray(p.results) &&
      p.results.length < 501 &&
      p.results.every(quality) &&
      typeof p.complete === 'boolean' &&
      number(p.updatedAt)
    );
  if (kind === 'lesson')
    return text(p.lessonId, 100) && typeof p.completed === 'boolean' && number(p.at);
  if (kind === 'session') return number(p.seconds, 0, 86400) && number(p.at) && text(p.section, 40);
  if (kind === 'mistake') {
    if (
      !position(p) ||
      typeof p.answer !== 'string' ||
      !text(p.gameId, 100) ||
      !number(p.ply, 0, 500) ||
      !text(p.san, 30) ||
      (p.done !== undefined && typeof p.done !== 'boolean')
    )
      return false;
    try {
      const c = restore({ initialFen: p.initialFen as string, moves: p.moves as string[] });
      playUci(c, p.answer);
      return true;
    } catch {
      return false;
    }
  }
  if (kind === 'review') return quality(p);
  return false;
}
