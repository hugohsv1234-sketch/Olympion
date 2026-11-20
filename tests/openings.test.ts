import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import {
  OPENINGS,
  compileOpening,
  matchesOpeningMove,
  openingProgressId,
  undoOpeningTurn,
} from '../src/lib/openings';
import { playUci } from '../src/lib/chess';

describe('opening training', () => {
  it('contains unique, legal lines with practice moves for both colours', () => {
    const ids = new Set<string>();
    for (const opening of OPENINGS)
      for (const line of opening.lines) {
        expect(ids.has(line.id)).toBe(false);
        ids.add(line.id);
        const compiled = compileOpening(line),
          game = new Chess();
        expect(compiled.moves.length).toBeGreaterThanOrEqual(10);
        compiled.moves.forEach((move, i) => {
          expect(matchesOpeningMove(line, compiled.moves.slice(0, i), move)).toBe(true);
          playUci(game, move);
        });
        expect(game.fen()).toBe(compiled.fen);
        expect(game.isGameOver()).toBe(false);
        expect(matchesOpeningMove(line, compiled.moves, 'a2a3')).toBe(false);
      }
    expect(ids.size).toBe(16);
  });
  it('rejects a legal off-line move without calling it an illegal chess move', () => {
    const line = OPENINGS[0].lines[0];
    expect(new Chess().move('d4')).toBeTruthy();
    expect(matchesOpeningMove(line, [], 'd2d4')).toBe(false);
    expect(matchesOpeningMove(line, ['d2d4'], 'e7e5')).toBe(false);
  });
  it('takes back to the player turn and never removes the chosen starting line', () => {
    const moves = compileOpening(OPENINGS[0].lines[0]).moves;
    expect(undoOpeningTurn(moves, 0, 'w')).toEqual(moves.slice(0, -2));
    expect(undoOpeningTurn(moves.slice(0, 11), 0, 'w')).toEqual(moves.slice(0, 10));
    expect(undoOpeningTurn(moves, 0, 'b')).toEqual(moves.slice(0, -1));
    expect(undoOpeningTurn(moves, moves.length, 'b')).toEqual(moves);
  });
  it('keeps white and black progress separate', () => {
    expect(openingProgressId(OPENINGS[0].lines[0], 'w')).not.toBe(
      openingProgressId(OPENINGS[0].lines[0], 'b'),
    );
  });
});
