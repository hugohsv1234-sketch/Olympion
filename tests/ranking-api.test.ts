import { describe, it, expect } from 'vitest';
import { verifyPuzzleSolution, verifySubmittedMoves, handleRanking } from '../server/ranking';
import { serverBotMove } from '../server/engine';
import { DEFAULT_POSITION, playUci } from '../src/lib/chess';
import { Chess } from 'chess.js';
import type { Puzzle } from '../src/lib/types';
describe('verifizierte Ranglistenpartien', () => {
  it('akzeptiert nur den gespeicherten Verlauf plus genau einen legalen Spielerzug', () => {
    expect(verifySubmittedMoves([], ['e2e4'], 'w').turn()).toBe('b');
    expect(verifySubmittedMoves([], [], 'b').turn()).toBe('w');
    for (const submitted of [['e2e5'], ['e2e4', 'e7e5'], ['g8f6']])
      expect(() => verifySubmittedMoves([], submitted, 'w')).toThrow();
    expect(() => verifySubmittedMoves(['e2e4', 'e7e5'], ['d2d4', 'e7e5', 'g1f3'], 'w')).toThrow();
    expect(() => verifySubmittedMoves(['e2e4'], ['e2e4', 'e7e5'], 'w')).toThrow();
    expect(() => verifySubmittedMoves([], [], 'w')).toThrow();
  });
  it('erkennt echtes Matt und verbietet zusätzliche Züge danach', () => {
    const line = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];
    expect(verifySubmittedMoves(line.slice(0, 3), line, 'b').isCheckmate()).toBe(true);
    expect(() => verifySubmittedMoves(line, [...line, 'a2a3'], 'w')).toThrow();
  });
  it('wertet nur vollständige Lösungen oder explizite Alternativen', () => {
    const puzzle: Puzzle = {
      id: 'test',
      fen: DEFAULT_POSITION,
      moves: ['e2e4', 'e7e5', 'g1f3'],
      alternatives: [['c7c5', 'g1f3']],
      themes: [],
      rating: 1000,
      url: '',
    };
    expect(verifyPuzzleSolution(puzzle, puzzle.moves)).toBe(true);
    expect(verifyPuzzleSolution(puzzle, ['e2e4', 'c7c5', 'g1f3'])).toBe(true);
    expect(verifyPuzzleSolution(puzzle, ['e2e4', 'e7e5'])).toBe(false);
    expect(verifyPuzzleSolution(puzzle, ['e2e4', 'e7e5', 'g1h3'])).toBe(false);
  });
  it('bleibt ohne Konfiguration ehrlich und gibt keine Tokens aus', async () => {
    const response = await handleRanking(new Request('https://olympion.test/api/ranking'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ configured: false });
    const unavailable = await handleRanking(
      new Request('https://olympion.test/api/ranking', { method: 'POST', body: '{}' }),
    );
    expect(unavailable.status).toBe(503);
  });
  it('liefert über dieselbe echte Stockfish-Konfiguration legale Serverzüge', async () => {
    for (const level of [1, 10, 20]) {
      const move = await serverBotMove({ initialFen: DEFAULT_POSITION, moves: ['e2e4'] }, level);
      const c = new Chess();
      c.move('e4');
      expect(() => playUci(c, move)).not.toThrow();
    }
  }, 45000);
});
