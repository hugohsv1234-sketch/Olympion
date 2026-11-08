import type { Attempt, GameRecord, RecordItem } from './types';
export function botReward(level: number) {
  if (!Number.isInteger(level) || level < 1 || level > 20) throw new Error('Ungültige Botstufe.');
  return Math.round(3 + ((level - 1) * 17) / 19);
}
export function wonGame(game: GameRecord) {
  return game.result === (game.color === 'w' ? '1-0' : '0-1');
}
export function lifetimeScore(records: RecordItem[]) {
  const puzzles = new Set<string>(),
    games = new Map<string, number>();
  for (const record of records) {
    if (record.kind === 'attempt') {
      const attempt = record.value as Attempt;
      if (attempt.success && attempt.mode !== 'review') puzzles.add(attempt.puzzleId);
    } else if (record.kind === 'game') {
      const game = record.value as GameRecord;
      if (wonGame(game) && Number.isInteger(game.level) && game.level >= 1 && game.level <= 20)
        games.set(game.id, botReward(game.level));
    }
  }
  return {
    elo: puzzles.size + [...games.values()].reduce((a, b) => a + b, 0),
    puzzles: puzzles.size,
    wins: games.size,
  };
}
