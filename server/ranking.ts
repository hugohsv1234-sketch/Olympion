import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Chess } from 'chess.js';
import { serverBotMove } from './engine.js';
import { DEFAULT_POSITION, playUci, automaticResult } from '../src/lib/chess.js';
import type { Puzzle } from '../src/lib/types';
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
const object = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === 'object' && !Array.isArray(x);
const moves = (x: unknown): x is string[] =>
  Array.isArray(x) &&
  x.length <= 500 &&
  x.every((m) => typeof m === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m));
export function verifySubmittedMoves(saved: string[], submitted: string[], color: 'w' | 'b') {
  if (!moves(saved) || !moves(submitted)) throw new Error('Ungültige Zugfolge.');
  const game = new Chess(DEFAULT_POSITION);
  for (const move of saved) playUci(game, move);
  if (
    submitted.length < saved.length ||
    submitted.slice(0, saved.length).some((m, i) => m !== saved[i])
  )
    throw new Error('Die gespeicherte Partie stimmt nicht überein.');
  const delta = submitted.length - saved.length;
  if (
    delta > 1 ||
    (delta === 1 && game.turn() !== color) ||
    (delta === 0 && game.turn() === color && !automaticResult(game))
  )
    throw new Error('Ungültiger Spielzug.');
  if (delta === 1) {
    if (automaticResult(game)) throw new Error('Die Partie ist bereits beendet.');
    playUci(game, submitted.at(-1)!);
  }
  return game;
}
let puzzleData: Promise<Map<string, Puzzle>> | undefined;
async function puzzles() {
  return (puzzleData ??= (async () => {
    const root = join(process.cwd(), 'public/puzzles');
    const index = JSON.parse(await readFile(join(root, 'index.json'), 'utf8')) as {
      puzzles: { pack: string }[];
    };
    const result = new Map<string, Puzzle>();
    for (const pack of new Set(index.puzzles.map((p) => p.pack))) {
      if (!/^pack-[A-Za-z0-9_-]+\.json$/.test(pack)) throw new Error('Ungültiges Puzzlepaket');
      const raw = JSON.parse(await readFile(join(root, pack), 'utf8'));
      const list = Array.isArray(raw) ? raw : raw.puzzles;
      for (const puzzle of list) result.set(puzzle.id, puzzle);
    }
    return result;
  })());
}
export function verifyPuzzleSolution(puzzle: Puzzle, solution: string[]) {
  if (!moves(solution)) return false;
  const accepted = [
    puzzle.moves,
    ...(puzzle.alternatives || []).map((line) => [puzzle.moves[0], ...line]),
  ];
  return accepted.some(
    (line) => line.length === solution.length && line.every((m, i) => m === solution[i]),
  );
}
export async function handleRanking(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const rankingKey = process.env.OLYMPION_RANKING_KEY;
  if (request.method === 'GET') return json({ configured: Boolean(url && key && rankingKey) });
  if (request.method !== 'POST') return json({ error: 'Methode nicht erlaubt.' }, 405);
  if (!url || !key || !rankingKey)
    return json(
      {
        error:
          'Online-Konten und Rangliste werden noch eingerichtet. Dein Gasttraining funktioniert bereits.',
      },
      503,
    );
  const token = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
  if (!token || token.length > 10000) return json({ error: 'Bitte melde dich an.' }, 401);
  try {
    const c = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        headers: { Authorization: 'Bearer ' + token, 'X-Olympion-Ranking-Key': rankingKey },
      },
    });
    const { data: auth, error: authError } = await c.auth.getUser(token);
    if (authError || !auth.user)
      return json({ error: 'Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.' }, 401);
    if (!auth.user.email_confirmed_at)
      return json({ error: 'Bitte bestätige zuerst deine E-Mail-Adresse.' }, 403);
    const text = await request.text();
    if (text.length > 16000) return json({ error: 'Die Anfrage ist zu groß.' }, 413);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: 'Ungültige Anfrage.' }, 400);
    }
    if (!object(body)) return json({ error: 'Ungültige Anfrage.' }, 400);
    const player = auth.user.id;
    if (body.action === 'puzzle') {
      if (typeof body.puzzleId !== 'string' || !moves(body.solution))
        return json({ error: 'Ungültige Puzzlelösung.' }, 400);
      const puzzle = (await puzzles()).get(body.puzzleId);
      if (!puzzle || !verifyPuzzleSolution(puzzle, body.solution))
        return json({ error: 'Diese Lösung konnte nicht bestätigt werden.' }, 422);
      const { data, error } = await c.rpc('ranked_write', {
        action: 'puzzle',
        payload: { puzzle_id: body.puzzleId },
      });
      if (error) throw error;
      return json({ earned: Number(data) });
    }
    if (body.action === 'start') {
      if (
        typeof body.level !== 'number' ||
        !Number.isInteger(body.level) ||
        body.level < 1 ||
        body.level > 20 ||
        !['w', 'b'].includes(String(body.color))
      )
        return json({ error: 'Ungültiger Gegner.' }, 400);
      const { data, error } = await c.rpc('ranked_write', {
        action: 'start',
        payload: { level: body.level, color: body.color },
      });
      if (error) throw error;
      return json({ id: data });
    }
    if (
      !['move', 'finish'].includes(String(body.action)) ||
      typeof body.gameId !== 'string' ||
      !/^[0-9a-f-]{36}$/.test(body.gameId) ||
      !moves(body.moves)
    )
      return json({ error: 'Ungültige Partie.' }, 400);
    const { data: saved, error: loadError } = await c
      .from('ranked_games')
      .select('*')
      .eq('id', body.gameId)
      .eq('user_id', player)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!saved) return json({ error: 'Die Partie wurde nicht gefunden.' }, 404);
    const existing = saved.moves as string[];
    // A cancelled HTTP response can be retried after the server committed the bot move.
    if (
      body.action === 'move' &&
      existing.length === body.moves.length + 1 &&
      body.moves.every((m, i) => m === existing[i])
    )
      return json({ move: existing.at(-1), earned: 0 });
    if (saved.result !== null) {
      if (
        body.action === 'finish' &&
        existing.length === body.moves.length &&
        existing.every((m, i) => m === (body.moves as string[])[i])
      )
        return json({ earned: 0 });
      return json({ error: 'Diese Partie ist bereits beendet.' }, 409);
    }
    let game: Chess;
    try {
      game = verifySubmittedMoves(existing, body.moves, saved.color);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : 'Ungültige Partie.' }, 422);
    }
    const next = [...body.moves];
    let bot: string | undefined;
    if (body.action === 'move') {
      if (automaticResult(game) || game.turn() === saved.color)
        return json({ error: 'Der Bot ist nicht am Zug.' }, 422);
      bot = await serverBotMove({ initialFen: DEFAULT_POSITION, moves: next }, saved.level);
      playUci(game, bot);
      next.push(bot);
    } else if (!automaticResult(game))
      return json({ error: 'Die Partie ist noch nicht beendet.' }, 422);
    const result = automaticResult(game)?.result || null;
    const { data: earned, error } = await c.rpc('ranked_write', {
      action: 'commit',
      payload: { game_id: saved.id, expected_ply: existing.length, moves: next, result },
    });
    if (error) throw error;
    return json({ move: bot, earned: Number(earned) });
  } catch (error) {
    console.error('OLYMPION ranking request failed', {
      message:
        error instanceof Error
          ? error.message
          : object(error)
            ? String(error.code || 'database_error')
            : 'unknown',
    });
    return json(
      { error: 'Die Online-Anfrage konnte nicht abgeschlossen werden. Bitte versuche es erneut.' },
      503,
    );
  }
}
