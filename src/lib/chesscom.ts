import type { ChessComSource } from './types';

export interface ArchiveMonth {
  key: string;
  year: number;
  month: number;
}
export interface ChessComAccount {
  username: string;
  ratings: { label: string; rating: number }[];
  archives: ArchiveMonth[];
}
export interface ChessComGame {
  id: string;
  pgn: string;
  source: ChessComSource;
}
export class ChessComError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
    this.name = 'ChessComError';
  }
}
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const rating = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 5000
    ? Math.round(value)
    : undefined;
export function normalizeUsername(input: string) {
  const name = input.trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9_-]{2,50}$/.test(name))
    throw new ChessComError('Gib deinen Chess.com-Namen ein, ohne Leerzeichen oder Profil-Link.');
  return name;
}
export function parseArchives(data: unknown, username: string): ArchiveMonth[] {
  if (!object(data) || !Array.isArray(data.archives))
    throw new ChessComError('Chess.com hat kein gültiges Partienarchiv zurückgegeben.');
  const name = normalizeUsername(username);
  const months = new Map<string, ArchiveMonth>();
  for (const item of data.archives) {
    if (typeof item !== 'string') continue;
    try {
      const url = new URL(item);
      const match = url.pathname.match(/^\/pub\/player\/([^/]+)\/games\/(\d{4})\/(\d{2})$/);
      if (
        url.origin !== 'https://api.chess.com' ||
        !match ||
        decodeURIComponent(match[1]).toLowerCase() !== name
      )
        continue;
      const year = Number(match[2]),
        month = Number(match[3]);
      if (year < 2000 || month < 1 || month > 12) continue;
      const key = match[2] + '-' + match[3];
      months.set(key, { key, year, month });
    } catch {
      /* Ignore malformed archive entries. */
    }
  }
  return [...months.values()].sort((a, b) => b.key.localeCompare(a.key));
}
export function normalizeGames(data: unknown, username: string): ChessComGame[] {
  if (!object(data) || !Array.isArray(data.games))
    throw new ChessComError('Chess.com hat keine gültige Partienliste zurückgegeben.');
  const name = normalizeUsername(username);
  const games = new Map<string, ChessComGame>();
  for (const raw of data.games.slice(0, 10000)) {
    if (
      !object(raw) ||
      raw.rules !== 'chess' ||
      typeof raw.pgn !== 'string' ||
      raw.pgn.length < 10 ||
      raw.pgn.length > 200000 ||
      typeof raw.end_time !== 'number' ||
      !Number.isFinite(raw.end_time) ||
      raw.end_time <= 0 ||
      raw.end_time > 4102444800 ||
      !object(raw.white) ||
      !object(raw.black) ||
      typeof raw.white.username !== 'string' ||
      typeof raw.black.username !== 'string' ||
      raw.white.username.length > 50 ||
      raw.black.username.length > 50 ||
      typeof raw.url !== 'string'
    )
      continue;
    const color =
      raw.white.username.toLowerCase() === name
        ? 'w'
        : raw.black.username.toLowerCase() === name
          ? 'b'
          : null;
    if (!color) continue;
    let match: RegExpMatchArray | null;
    try {
      const url = new URL(raw.url);
      match = url.pathname.match(/^\/game\/(live|daily)\/(\d{1,24})\/?$/);
      if (url.origin !== 'https://www.chess.com' || !match) continue;
    } catch {
      continue;
    }
    const own = color === 'w' ? raw.white : raw.black;
    const opponent = color === 'w' ? raw.black : raw.white;
    const result = own.result === 'win' ? 'win' : opponent.result === 'win' ? 'loss' : 'draw';
    const decisive = new Set([
      'win',
      'checkmated',
      'resigned',
      'timeout',
      'abandoned',
      'lose',
      'bughousepartnerlose',
    ]);
    const draws = new Set([
      'agreed',
      'repetition',
      'stalemate',
      'insufficient',
      '50move',
      'timevsinsufficient',
    ]);
    if (typeof own.result !== 'string' || (!decisive.has(own.result) && !draws.has(own.result)))
      continue;
    const id = 'chesscom-' + match[1] + '-' + match[2];
    games.set(id, {
      id,
      pgn: raw.pgn,
      source: {
        provider: 'chess.com',
        username: name,
        color,
        white: raw.white.username,
        black: raw.black.username,
        whiteRating: rating(raw.white.rating),
        blackRating: rating(raw.black.rating),
        result,
        timeClass: typeof raw.time_class === 'string' ? raw.time_class.slice(0, 25) : 'live',
        timeControl: typeof raw.time_control === 'string' ? raw.time_control.slice(0, 50) : '',
        endedAt: raw.end_time * 1000,
        url: 'https://www.chess.com/game/' + match[1] + '/' + match[2],
      },
    });
  }
  return [...games.values()].sort((a, b) => b.source.endedAt - a.source.endedAt);
}
export function formatTimeControl(control: string) {
  const match = control.match(/^(\d+)(?:\+(\d+))?$/);
  if (!match) {
    const daily = control.match(/^1\/(\d+)$/);
    if (!daily) return control || 'Ohne Angabe';
    const days = Number(daily[1]) / 86400;
    return days.toLocaleString('de-DE') + (days === 1 ? ' Tag / Zug' : ' Tage / Zug');
  }
  return Number(match[1]) / 60 + '+' + (match[2] || '0');
}
export function createChessComClient(fetcher: typeof fetch = fetch) {
  let tail: Promise<unknown> = Promise.resolve();
  const cache = new Map<string, { data: unknown; until: number }>();
  function request(path: string, signal?: AbortSignal): Promise<unknown> {
    const run = async () => {
      if (signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
      const hit = cache.get(path);
      if (hit && hit.until > Date.now()) return hit.data;
      const controller = new AbortController();
      let timedOut = false;
      const cancel = () => controller.abort();
      signal?.addEventListener('abort', cancel, { once: true });
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 18000);
      try {
        if (signal?.aborted) controller.abort();
        const response = await fetcher('https://api.chess.com/pub/player/' + path, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        if (response.status === 404 || response.status === 410)
          throw new ChessComError(
            'Dieser Chess.com-Name oder das gewählte Archiv wurde nicht gefunden.',
            response.status,
          );
        if (response.status === 429)
          throw new ChessComError(
            'Chess.com begrenzt gerade die Anfragen. Warte bitte einen Moment und versuche es erneut.',
            429,
          );
        if (!response.ok)
          throw new ChessComError(
            'Chess.com ist gerade nicht erreichbar. Bitte versuche es später erneut.',
            response.status,
          );
        const data: unknown = await response.json();
        if (cache.size >= 8) cache.delete(cache.keys().next().value!);
        cache.set(path, { data, until: Date.now() + 300000 });
        return data;
      } catch (error) {
        if (signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
        if (timedOut)
          throw new ChessComError('Chess.com antwortet zu langsam. Bitte versuche es erneut.');
        if (error instanceof ChessComError) throw error;
        throw new ChessComError(
          'Keine Verbindung zu Chess.com. Prüfe deine Internetverbindung und versuche es erneut.',
        );
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
      }
    };
    const job = tail.then(run, run);
    tail = job.catch(() => undefined);
    return job;
  }
  return {
    async account(input: string, signal?: AbortSignal): Promise<ChessComAccount> {
      const name = normalizeUsername(input);
      const profile = await request(name, signal);
      if (
        !object(profile) ||
        typeof profile.username !== 'string' ||
        !/^[A-Za-z0-9_-]{2,50}$/.test(profile.username)
      )
        throw new ChessComError('Chess.com hat kein gültiges Profil zurückgegeben.');
      const resolvedName = normalizeUsername(profile.username);
      let stats: unknown = {};
      try {
        stats = await request(resolvedName + '/stats', signal);
      } catch (error) {
        if (!(error instanceof ChessComError) || error.status !== 404) throw error;
      }
      const archives = parseArchives(
        await request(resolvedName + '/games/archives', signal),
        resolvedName,
      );
      const ratings: ChessComAccount['ratings'] = [];
      for (const [key, label] of [
        ['chess_rapid', 'Rapid'],
        ['chess_blitz', 'Blitz'],
        ['chess_bullet', 'Bullet'],
      ]) {
        const stat = object(stats) ? stats[key] : undefined;
        const last = object(stat) ? stat.last : undefined;
        const value = object(last) ? rating(last.rating) : undefined;
        if (value !== undefined) ratings.push({ label, rating: value });
      }
      return { username: profile.username.slice(0, 50), ratings, archives };
    },
    async games(input: string, month: ArchiveMonth, signal?: AbortSignal) {
      const name = normalizeUsername(input);
      if (
        !Number.isInteger(month.year) ||
        month.year < 2000 ||
        month.year > 9999 ||
        !Number.isInteger(month.month) ||
        month.month < 1 ||
        month.month > 12
      )
        throw new ChessComError('Bitte einen gültigen Monat auswählen.');
      return normalizeGames(
        await request(
          name + '/games/' + month.year + '/' + String(month.month).padStart(2, '0'),
          signal,
        ),
        name,
      );
    },
  };
}
export const chessCom = createChessComClient();
