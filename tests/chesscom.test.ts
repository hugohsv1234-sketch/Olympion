import { describe, expect, it, vi } from 'vitest';
import {
  createChessComClient,
  normalizeGames,
  normalizeUsername,
  parseArchives,
  formatTimeControl,
} from '../src/lib/chesscom';
import { validPayload } from '../src/lib/validation';
import { importNotation } from '../src/lib/chess';
const game = {
  url: 'https://www.chess.com/game/live/123456',
  pgn: '[White "Tester"]\n[Black "Opponent"]\n[Result "1-0"]\n\n1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0',
  end_time: 1735689600,
  rules: 'chess',
  time_class: 'blitz',
  time_control: '180+2',
  white: { username: 'Tester', rating: 1420, result: 'win' },
  black: { username: 'Opponent', rating: 1400, result: 'checkmated' },
};
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
describe('Chess.com import', () => {
  it('normalizes a name and rejects paths or markup before any request', () => {
    expect(normalizeUsername(' @TeStEr ')).toBe('tester');
    for (const input of [
      '',
      '../profile',
      'https://chess.com/member/tester',
      '<script>',
      'my name',
    ])
      expect(() => normalizeUsername(input)).toThrow();
  });
  it('accepts only archives belonging to the requested player and trusted API origin', () => {
    expect(
      parseArchives(
        {
          archives: [
            'https://api.chess.com/pub/player/tester/games/2025/01',
            'https://api.chess.com/pub/player/TESTER/games/2025/02',
            'https://api.chess.com/pub/player/tester/games/2025/02',
            'https://evil.example/pub/player/tester/games/2025/03',
            'https://api.chess.com/pub/player/other/games/2025/03',
            'https://api.chess.com/pub/player/tester/games/2025/13',
          ],
        },
        'tester',
      ).map((x) => x.key),
    ).toEqual(['2025-02', '2025-01']);
  });
  it('keeps finished standard games, removes duplicates and derives the player side', () => {
    const games = normalizeGames(
      {
        games: [
          game,
          game,
          { ...game, rules: 'chess960' },
          { ...game, end_time: undefined },
          { ...game, url: 'javascript:alert(1)' },
          { ...game, end_time: 1e30 },
          { ...game, url: 'https://evil.example/game/live/456' },
        ],
      },
      'tester',
    );
    expect(games).toHaveLength(1);
    expect(games[0].id).toBe('chesscom-live-123456');
    expect(games[0].source).toMatchObject({ color: 'w', result: 'win', whiteRating: 1420 });
    expect(normalizeGames({ games: [game] }, 'opponent')[0].source).toMatchObject({
      color: 'b',
      result: 'loss',
    });
    expect(normalizeGames({ games: [game] }, 'unrelated')).toEqual([]);
    expect(importNotation(games[0].pgn).moves).toHaveLength(7);
  });
  it('recognizes draws and formats live and daily time controls', () => {
    const draw = {
      ...game,
      white: { ...game.white, result: 'agreed' },
      black: { ...game.black, result: 'agreed' },
    };
    expect(normalizeGames({ games: [draw] }, 'tester')[0].source.result).toBe('draw');
    expect(formatTimeControl('180+2')).toBe('3+2');
    expect(formatTimeControl('600')).toBe('10+0');
    expect(formatTimeControl('1/86400')).toBe('1 Tag / Zug');
  });
  it('loads profile, stats and archives in series and caches repeated requests', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/stats')) return response({ chess_rapid: { last: { rating: 1755 } } });
      if (url.endsWith('/games/archives'))
        return response({ archives: ['https://api.chess.com/pub/player/tester/games/2025/01'] });
      return response({ username: 'Tester' });
    });
    const client = createChessComClient(fetcher);
    const profile = await client.account('Tester');
    expect(profile.ratings).toEqual([{ label: 'Rapid', rating: 1755 }]);
    await client.account('TESTER');
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls.map((c) => String(c[0]))).toEqual([
      'https://api.chess.com/pub/player/tester',
      'https://api.chess.com/pub/player/tester/stats',
      'https://api.chess.com/pub/player/tester/games/archives',
    ]);
  });
  it('serializes even concurrent callers to avoid API throttling', async () => {
    let active = 0,
      maximum = 0;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active--;
      const url = String(input);
      if (url.endsWith('/games/archives')) return response({ archives: [] });
      if (url.endsWith('/stats')) return response({});
      return response({ username: url.split('/').at(-1) });
    });
    const client = createChessComClient(fetcher);
    await Promise.all([client.account('tester'), client.account('another')]);
    expect(maximum).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(6);
  });
  it('reports unavailable players and rate limits without automatic retry', async () => {
    for (const status of [404, 429, 503]) {
      const fetcher = vi.fn(async () => response({}, status));
      await expect(createChessComClient(fetcher).account('tester')).rejects.toMatchObject({
        status,
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it('does not fetch cancelled requests or invalid month input', async () => {
    const fetcher = vi.fn(async () => response({}));
    const client = createChessComClient(fetcher);
    const abort = new AbortController();
    abort.abort();
    await expect(client.account('tester', abort.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    await expect(client.games('tester', { key: 'bad', year: 2025, month: 13 })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('preserves imported analysis metadata in valid backups and rejects unsafe source URLs', () => {
    const source = normalizeGames({ games: [game] }, 'tester')[0].source;
    const analysis = {
      gameId: 'chesscom-live-123456',
      ...importNotation(game.pgn),
      budget: 40000,
      results: [],
      complete: false,
      updatedAt: Date.now(),
      title: 'Tester vs. Opponent',
      source,
      note: 'Erst die gegnerische Drohung prüfen.',
      favorite: true,
    };
    expect(validPayload('analysis', analysis)).toBe(true);
    expect(validPayload('analysis', { ...analysis, note: 'x'.repeat(1001) })).toBe(false);
    expect(
      validPayload('analysis', { ...analysis, source: { ...source, url: 'javascript:alert(1)' } }),
    ).toBe(false);
    expect(
      validPayload('analysis', {
        ...analysis,
        source: undefined,
        note: undefined,
        favorite: undefined,
      }),
    ).toBe(true);
  });
});
