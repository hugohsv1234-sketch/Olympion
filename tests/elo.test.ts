import { describe, it, expect } from 'vitest';
import { botReward, lifetimeScore } from '../src/lib/elo';
import { possiblePremove, legalQueuedMove } from '../src/lib/premove';
import { DEFAULT_POSITION } from '../src/lib/chess';
import { Chess } from 'chess.js';
import type { RecordItem } from '../src/lib/types';
import { DEFAULT_SETTINGS } from '../src/lib/types';
import { validPayload } from '../src/lib/validation';
const row = (kind: RecordItem['kind'], id: string, value: unknown): RecordItem => ({
  id,
  kind,
  value,
  updatedAt: 1,
  pending: true,
  deviceId: '00000000-0000-4000-8000-000000000001',
});
describe('All-Time-Elo', () => {
  it('vergibt genau 3 bis 20 Punkte über alle 20 Botstufen', () => {
    const rewards = Array.from({ length: 20 }, (_, i) => botReward(i + 1));
    expect(rewards[0]).toBe(3);
    expect(rewards[19]).toBe(20);
    expect(
      rewards.every(
        (n, i) => Number.isInteger(n) && n >= 3 && n <= 20 && (i === 0 || n >= rewards[i - 1]),
      ),
    ).toBe(true);
    for (const level of [0, 21, 1.2, NaN]) expect(() => botReward(level)).toThrow();
  });
  it('zählt Puzzle einmal, beide Spielfarben, keine Niederlagen oder Fehlerübungen', () => {
    const records = [
      row('attempt', 'a', { puzzleId: 'one', success: true, mode: 'adaptive' }),
      row('attempt', 'b', { puzzleId: 'one', success: true, mode: 'daily' }),
      row('attempt', 'c', { puzzleId: 'two', success: false, mode: 'adaptive' }),
      row('attempt', 'd', { puzzleId: 'review', success: true, mode: 'review' }),
      row('game', 'g1', { id: 'g1', result: '1-0', color: 'w', level: 1 }),
      row('game', 'duplicate', { id: 'g1', result: '1-0', color: 'w', level: 1 }),
      row('game', 'g2', { id: 'g2', result: '0-1', color: 'b', level: 20 }),
      row('game', 'loss', { id: 'loss', result: '0-1', color: 'w', level: 20 }),
      row('game', 'draw', { id: 'draw', result: '½-½', color: 'w', level: 20 }),
    ];
    expect(lifetimeScore(records)).toEqual({ elo: 24, puzzles: 1, wins: 2 });
  });
});
describe('Premoves', () => {
  it('erlaubt eigene Bauern und Springer, aber keine gegnerischen Figuren oder Sprünge', () => {
    expect(possiblePremove(DEFAULT_POSITION, 'g1f3', 'w')).toBe(true);
    expect(possiblePremove(DEFAULT_POSITION, 'e2e4', 'w')).toBe(true);
    expect(possiblePremove(DEFAULT_POSITION, 'e2d3', 'w')).toBe(true);
    expect(possiblePremove(DEFAULT_POSITION, 'g8f6', 'w')).toBe(false);
    expect(possiblePremove(DEFAULT_POSITION, 'a1a4', 'w')).toBe(false);
    expect(possiblePremove(DEFAULT_POSITION, 'e2e5', 'w')).toBe(false);
    expect(possiblePremove(DEFAULT_POSITION, 'g1e2', 'w')).toBe(false);
  });
  it('prüft nach dem gegnerischen Zug neu und verwirft ungültige Premoves', () => {
    const c = new Chess();
    c.move('e4');
    expect(legalQueuedMove(c.fen(), 'g1f3', 'w')).toBe(false);
    c.move('e5');
    expect(legalQueuedMove(c.fen(), 'g1f3', 'w')).toBe(true);
    expect(legalQueuedMove(c.fen(), 'e4e5', 'w')).toBe(false);
    expect(legalQueuedMove(c.fen(), 'e1e3', 'w')).toBe(false);
  });
  it('verlangt bei einer vorgemerkten Umwandlung die gewählte Figur', () => {
    const fen = '7k/P7/8/8/8/8/8/K7 b - - 0 1';
    expect(possiblePremove(fen, 'a7a8q', 'w')).toBe(true);
    expect(possiblePremove(fen, 'a7a8', 'w')).toBe(false);
    expect(possiblePremove(fen, 'a7a6q', 'w')).toBe(false);
  });
});
it('prüft neue Einstellungen und erhält alte Backups', () => {
  expect(
    validPayload('settings', {
      name: 'Gast',
      goal: 20,
      sound: false,
      motion: true,
      coordinates: true,
      contrast: false,
    }),
  ).toBe(true);
  expect(
    validPayload('settings', {
      ...DEFAULT_SETTINGS,
      theme: 'light',
      language: 'en',
      avatar: 'data:image/webp;base64,UklGRg==',
    }),
  ).toBe(true);
  for (const extra of [
    { theme: 'invalid' },
    { language: 'javascript' },
    { premoves: 'yes' },
    { liveAnalysis: 2 },
    { avatar: 'data:image/svg+xml,<svg/>' },
  ])
    expect(validPayload('settings', { ...DEFAULT_SETTINGS, ...extra })).toBe(false);
});
