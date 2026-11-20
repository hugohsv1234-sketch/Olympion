import { Chess } from 'chess.js';
import type { EngineScore, MoveQuality, Position } from './types';
import { restore, playUci } from './chess';
import { expectation } from './metrics';

export const REVIEW_VERSION = 2;
export const MOVE_GRADES = {
  brilliant: { label: 'Brillant', symbol: '!!' },
  great: { label: 'Großartig', symbol: '!' },
  best: { label: 'Bester Zug', symbol: '★' },
  excellent: { label: 'Exzellent', symbol: '✓' },
  good: { label: 'Gut', symbol: '·' },
  inaccuracy: { label: 'Ungenauigkeit', symbol: '?!' },
  mistake: { label: 'Fehler', symbol: '?' },
  blunder: { label: 'Patzer', symbol: '??' },
  missed: { label: 'Verpasste Möglichkeit', symbol: '↗' },
  forced: { label: 'Erzwungener Zug', symbol: '□' },
} as const;
export type MoveGrade = keyof typeof MOVE_GRADES;
export function moveGrade(result: MoveQuality): MoveGrade {
  if (result.grade && Object.hasOwn(MOVE_GRADES, result.grade)) return result.grade;
  const legacy: Record<string, MoveGrade> = {
    'Sehr gut': 'excellent',
    'Guter Zug': 'good',
    'Grober Fehler': 'blunder',
    'Matt verpasst': 'missed',
    'Matt zugelassen': 'blunder',
  };
  return (
    (Object.keys(MOVE_GRADES) as MoveGrade[]).find(
      (key) => MOVE_GRADES[key].label === result.label,
    ) ||
    legacy[result.label] ||
    'good'
  );
}
const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
function material(game: Chess, color: 'w' | 'b') {
  return game
    .board()
    .flat()
    .reduce((sum, p) => sum + (p ? values[p.type] * (p.color === color ? 1 : -1) : 0), 0);
}
// Require a legal acceptance of the offered piece and a real net material investment.
export function offersSacrifice(position: Position, move: string, pv: string[]) {
  const game = restore(position);
  const color = game.turn();
  const initial = material(game, color);
  const played = playUci(game, move);
  if (values[played.piece] < 3 || played.promotion || game.isCheckmate()) return false;
  const captures = game
    .moves({ verbose: true })
    .filter((reply) => reply.to === played.to && reply.captured === played.piece);
  if (!captures.length) return false;
  return captures.some((capture) => {
    const line = new Chess(game.fen());
    line.move(capture);
    // Account for the immediate recapture so ordinary trades are not sacrifices.
    if (
      pv[0] === move &&
      pv[1] === capture.from + capture.to + (capture.promotion || '') &&
      pv[2]
    ) {
      try {
        playUci(line, pv[2]);
      } catch {
        return false;
      }
    } else {
      const recaptures = line
        .moves({ verbose: true })
        .filter((reply) => reply.to === capture.to && reply.captured);
      if (
        recaptures.some((reply) => {
          const recaptured = new Chess(line.fen());
          recaptured.move(reply);
          return material(recaptured, color) > initial - 2;
        })
      )
        return false;
    }
    return material(line, color) <= initial - 2;
  });
}
export function classifyMove(context: {
  best: EngineScore;
  played: EngineScore;
  second?: EngineScore;
  same: boolean;
  forced: boolean;
  sacrifice: boolean;
  reliable: boolean;
}): MoveGrade {
  const { best, played, second, same, forced, sacrifice, reliable } = context;
  const loss = Math.max(0, expectation(best) - expectation(played));
  if (forced) return 'forced';
  if (played.mate !== undefined && played.mate < 0 && (best.mate === undefined || best.mate > 0))
    return 'blunder';
  if (
    (best.mate !== undefined && best.mate > 0 && (played.mate === undefined || played.mate < 0)) ||
    (expectation(best) >= 0.8 && expectation(played) < 0.65 && loss >= 0.15)
  )
    return 'missed';
  if (reliable && loss <= 0.02 && expectation(played) >= 0.45 && sacrifice) return 'brilliant';
  if (
    reliable &&
    same &&
    second &&
    expectation(played) >= 0.45 &&
    expectation(second) < 0.65 &&
    expectation(best) - expectation(second) >= 0.18
  )
    return 'great';
  if (same) return 'best';
  if (loss <= 0.02) return 'excellent';
  if (loss <= 0.08) return 'good';
  if (loss <= 0.2) return 'inaccuracy';
  if (loss <= 0.4) return 'mistake';
  return 'blunder';
}
