import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { acceptPuzzleMove, preparePuzzle, ratingHistory, duePuzzles } from '../src/lib/puzzles';
import { LESSONS } from '../src/lib/lessons';
import { restore, playUci } from '../src/lib/chess';
import type { Attempt, Puzzle } from '../src/lib/types';
const base: Attempt = {
  puzzleId: 'test',
  rating: 1200,
  themes: ['fork'],
  success: true,
  hints: 0,
  errors: 0,
  seconds: 20,
  at: 1000,
  mode: 'adaptive',
};
describe('Aufgabentraining', () => {
  it('akzeptiert beide überprüften Matt-in-zwei-Wege der Überlastungsübung', () => {
    const p: Puzzle = {
      id: 'own',
      fen: '7k/6r1/5K2/7q/4B3/8/7Q/R7 b - - 0 1',
      moves: ['h5h7', 'h2h7', 'g7h7', 'a1a8'],
      alternatives: [['a1a8', 'g7g8', 'h2h7']],
      rating: 1400,
      themes: ['overloading', 'mateIn2'],
      url: '',
    };
    const c = preparePuzzle(p);
    expect(acceptPuzzleMove(p, 1, 'a1a8', c)).toBe(true);
    for (const line of [p.moves.slice(1), ...p.alternatives!]) {
      const g = preparePuzzle(p);
      line.forEach((m) => playUci(g, m));
      expect(g.isCheckmate()).toBe(true);
    }
  });
  it('spielt den vorbereitenden Gegnerzug vor der Aufgabe', () => {
    const idx = JSON.parse(readFileSync('public/puzzles/index.json', 'utf8'));
    const pack = JSON.parse(
      readFileSync('public/puzzles/' + idx.puzzles[0].pack, 'utf8'),
    ) as Puzzle[];
    const p = pack[0],
      c = new Chess(p.fen);
    playUci(c, p.moves[0]);
    expect(preparePuzzle(p).fen()).toBe(c.fen());
    expect(acceptPuzzleMove(p, 1, p.moves[1], c)).toBe(true);
  });
  it('akzeptiert alternative Matt-in-eins-Züge', () => {
    const p = { themes: ['mateIn1'], moves: ['', 'e6e8'] } as Puzzle;
    const c = new Chess('7k/8/4Q1K1/8/8/8/8/8 w - - 0 1');
    expect(acceptPuzzleMove(p, 1, 'e6e8', c)).toBe(true);
    expect(acceptPuzzleMove(p, 1, 'e6c8', c)).toBe(true);
    expect(acceptPuzzleMove(p, 1, 'e6f7', c)).toBe(false);
  });
  it('verhindert Ratingfarmen mit bekannten Aufgaben und Hinweisen', () => {
    expect(ratingHistory([base])).toEqual([{ at: 1000, rating: 1212, puzzleId: 'test' }]);
    expect(ratingHistory([base, { ...base, at: 2000 }])).toHaveLength(1);
    expect(ratingHistory([{ ...base, hints: 1 }])[0].rating).toBe(1188);
    expect(ratingHistory([{ ...base, errors: 1 }])[0].rating).toBe(1188);
    expect(ratingHistory([{ ...base, mode: 'review' }])).toEqual([]);
  });
  it('plant Wiederholung und erhöht deren Abstand nach Erfolg', () => {
    const failed = { ...base, success: false };
    expect(duePuzzles([failed], 1000 + 599999)).toHaveLength(0);
    expect(duePuzzles([failed], 1000 + 600001)).toHaveLength(1);
    const success = { ...base, at: 700000, mode: 'review' };
    expect(duePuzzles([failed, success], 700000 + 86400001)[0].stage).toBe(1);
  });
  it('prüft eigene Lektionen und sichert alle benötigten Motive', () => {
    const idx = JSON.parse(readFileSync('public/puzzles/index.json', 'utf8'));
    for (const l of LESSONS) {
      if (l.position) {
        for (const m of l.position.answers) {
          const c = restore({ initialFen: l.position.fen, moves: l.position.moves });
          expect(() => playUci(c, m), l.id).not.toThrow();
        }
      } else
        expect(
          idx.puzzles.some((p: { themes: string[] }) => p.themes.includes(l.theme!)),
          l.id,
        ).toBe(true);
    }
  });
});
