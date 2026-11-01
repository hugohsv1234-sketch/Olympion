import { describe, it, expect } from 'vitest';
import { Chess, DEFAULT_POSITION } from 'chess.js';
import {
  automaticResult,
  claimReason,
  intendedClaims,
  repetitions,
  playUci,
  restore,
  importNotation,
  getRemaining,
  timeoutResult,
} from '../src/lib/chess';
import type { GameRecord } from '../src/lib/types';
describe('Regeln und Zuggeschichte', () => {
  it('validiert auch die anfängliche FEN einer PGN mit SetUp-Header', () => {
    expect(() =>
      importNotation('[SetUp "1"]\n[FEN "7k/8/6KQ/8/8/8/8/8 w - - 0 1"]\n\n1. Qh7#'),
    ).toThrow();
  });
  it('weist syntaktisch gültige, aber unmögliche FEN-Stellungen zurück', () => {
    expect(() => restore({ initialFen: '7k/8/6KQ/8/8/8/8/8 w - - 0 1', moves: [] })).toThrow(
      'nicht am Zug',
    );
    expect(() => importNotation('7k/8/6KQ/8/8/8/8/8 w - - 0 1')).toThrow();
  });
  it('prüft illegale Züge und beide Rochaden', () => {
    expect(() => playUci(new Chess(), 'e2e5')).toThrow();
    for (const move of ['e1g1', 'e1c1']) {
      const c = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
      playUci(c, move);
      expect(c.get(move.slice(2, 4) as 'g1')?.type).toBe('k');
    }
  });
  it('verbietet Rochade durch angegriffene Felder', () => {
    const c = new Chess('r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1');
    expect(() => playUci(c, 'e1g1')).toThrow();
  });
  it('behandelt en passant korrekt', () => {
    const c = restore({ initialFen: DEFAULT_POSITION, moves: ['e2e4', 'a7a6', 'e4e5', 'd7d5'] });
    playUci(c, 'e5d6');
    expect(c.get('d5')).toBeUndefined();
    expect(c.get('d6')?.type).toBe('p');
  });
  it.each(['q', 'r', 'b', 'n'])('ermöglicht Umwandlung in %s', (p) => {
    const c = new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1');
    playUci(c, 'a7a8' + p);
    expect(c.get('a8')?.type).toBe(p);
  });
  it('unterscheidet Matt, Patt und Materialremis', () => {
    expect(automaticResult(new Chess('7k/6Q1/5K2/8/8/8/8/8 b - - 0 1'))?.reason).toBe('Schachmatt');
    expect(automaticResult(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'))?.reason).toBe('Patt');
    expect(automaticResult(new Chess('7k/8/6K1/8/8/8/8/8 w - - 0 1'))?.reason).toBe(
      'Unzureichendes Material',
    );
  });
  it('trennt beanspruchbare von automatischen Wiederholungen', () => {
    const c = new Chess();
    const cycle = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
    for (let i = 0; i < 2; i++) cycle.forEach((m) => playUci(c, m));
    expect(repetitions(c)).toBe(3);
    expect(claimReason(c)).toBeTruthy();
    expect(automaticResult(c)).toBeNull();
    const copy = restore({
      initialFen: DEFAULT_POSITION,
      moves: c.history({ verbose: true }).map((m) => m.from + m.to),
    });
    expect(repetitions(copy)).toBe(3);
    for (let i = 0; i < 2; i++) cycle.forEach((m) => playUci(c, m));
    expect(automaticResult(c)?.reason).toBe('Fünffache Stellungswiederholung');
  });
  it('trennt 50 von 75 Zügen und erkennt angekündigte Ansprüche', () => {
    expect(claimReason(new Chess('7k/8/6K1/8/8/8/8/R7 w - - 100 70'))).toBe('50-Züge-Regel');
    expect(automaticResult(new Chess('7k/8/6K1/8/8/8/8/R7 w - - 100 70'))).toBeNull();
    expect(automaticResult(new Chess('7k/8/6K1/8/8/8/8/R7 w - - 150 90'))?.reason).toBe(
      '75-Züge-Regel',
    );
    const c = new Chess('7k/8/6K1/8/8/8/8/R7 w - - 99 70');
    const before = c.fen();
    expect(intendedClaims(c).length).toBeGreaterThan(0);
    expect(c.fen()).toBe(before);
  });
  it('validiert PGN/FEN und lehnt beschädigte Notation ab', () => {
    const p = importNotation('1. e4 e5 2. Nf3 Nc6');
    expect(p.moves).toEqual(['e2e4', 'e7e5', 'g1f3', 'b8c6']);
    expect(importNotation(restore(p).pgn())).toEqual(p);
    expect(importNotation(DEFAULT_POSITION).moves).toEqual([]);
    expect(() => importNotation('1. e9')).toThrow();
    expect(() => importNotation('x'.repeat(200001))).toThrow();
  });
  it('berechnet Uhrzeiten über Zeitstempel statt Ticks', () => {
    const g = {
      initialFen: DEFAULT_POSITION,
      moves: [],
      remaining: { w: 10000, b: 10000 },
      turnStarted: 1000,
      paused: false,
      result: null,
    } as unknown as GameRecord;
    expect(getRemaining(g, 3500)).toEqual({ w: 7500, b: 10000 });
    expect(getRemaining({ ...g, paused: true }, 3500)).toEqual(g.remaining);
    expect(getRemaining({ ...g, moves: ['e2e4'] }, 3500)).toEqual({ w: 10000, b: 7500 });
  });
  it('gibt bei Zeitüberschreitung gegen einen nackten König remis', () => {
    expect(timeoutResult(new Chess('7k/8/6K1/8/8/8/8/R7 w - - 0 1'), 'w').result).toBe('½-½');
  });
});
