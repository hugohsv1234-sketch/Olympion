import { Chess } from 'chess.js';
import { playUci } from './chess';
import type { Attempt, Puzzle, RecordItem } from './types';
export const THEMES: Record<string, string> = {
  fork: 'Gabel / Doppelangriff',
  pin: 'Fesselung',
  skewer: 'Spieß',
  discoveredAttack: 'Abzugsangriff',
  doubleCheck: 'Doppelschach',
  deflection: 'Ablenkung',
  attraction: 'Hinlenkung',
  overloading: 'Überlastung',
  backRankMate: 'Grundreihenmatt',
  mateIn1: 'Matt in einem',
  mateIn2: 'Matt in zwei',
  mateIn3: 'Matt in drei',
  promotion: 'Bauernumwandlung',
  endgame: 'Endspiel',
  rookEndgame: 'Turmendspiel',
  pawnEndgame: 'Bauernendspiel',
};
export interface PuzzleMeta {
  id: string;
  rating: number;
  themes: string[];
  pack: string;
}
export interface PuzzleIndex {
  count: number;
  source: string;
  importedAt: string;
  sourceLastModified: string;
  puzzles: PuzzleMeta[];
}
let indexPromise: Promise<PuzzleIndex> | undefined;
const packs = new Map<string, Promise<Puzzle[]>>();
export async function puzzleIndex(): Promise<PuzzleIndex> {
  return (indexPromise ??= fetch('/puzzles/index.json')
    .then((r) => {
      if (!r.ok) {
        indexPromise = undefined;
        throw new Error('Puzzleübersicht konnte nicht geladen werden.');
      }
      return r.json() as Promise<PuzzleIndex>;
    })
    .catch((e) => {
      indexPromise = undefined;
      throw e;
    }));
}
export async function loadPuzzle(meta: PuzzleMeta) {
  let p = packs.get(meta.pack);
  if (!p) {
    p = fetch('/puzzles/' + meta.pack)
      .then((r) => {
        if (!r.ok)
          throw new Error('Puzzlepaket fehlt. Bitte online laden oder in Profil herunterladen.');
        return r.json() as Promise<Puzzle[]>;
      })
      .catch((e) => {
        packs.delete(meta.pack);
        throw e;
      });
    packs.set(meta.pack, p);
  }
  const puzzle = (await p).find((p) => p.id === meta.id);
  if (!puzzle) throw new Error('Aufgabe nicht im Paket gefunden.');
  return puzzle;
}
export function preparePuzzle(p: Puzzle) {
  const g = new Chess(p.fen);
  playUci(g, p.moves[0]);
  return g;
}
export function acceptPuzzleMove(p: Puzzle, index: number, move: string, current: Chess) {
  if (move === p.moves[index]) return true;
  if (index === 1 && p.alternatives?.some((line) => line[0] === move)) return true;
  if (p.themes.includes('mateIn1')) {
    try {
      const g = new Chess(current.fen());
      playUci(g, move);
      return g.isCheckmate();
    } catch {
      return false;
    }
  }
  return false;
}
export function ratingHistory(attempts: Attempt[]) {
  const known = new Set<string>();
  let rating = 1200;
  return [...attempts]
    .sort((a, b) => a.at - b.at || a.puzzleId.localeCompare(b.puzzleId))
    .flatMap((a) => {
      if (known.has(a.puzzleId) || a.mode === 'review') return [];
      known.add(a.puzzleId);
      const expected = 1 / (1 + Math.pow(10, (a.rating - rating) / 400));
      rating = Math.round(
        rating + 24 * ((a.success && a.hints === 0 && a.errors === 0 ? 1 : 0) - expected),
      );
      return [{ at: a.at, rating, puzzleId: a.puzzleId }];
    });
}
export function duePuzzles(attempts: Attempt[], now = Date.now()) {
  const byId = new Map<string, Attempt[]>();
  for (const a of [...attempts].sort((a, b) => a.at - b.at)) {
    const xs = byId.get(a.puzzleId) || [];
    xs.push(a);
    byId.set(a.puzzleId, xs);
  }
  const out: { id: string; due: number; stage: number }[] = [];
  for (const [id, xs] of byId) {
    let failed = false,
      stage = 0;
    for (const a of xs) {
      if (!a.success || a.hints > 0 || a.errors > 0) {
        failed = true;
        stage = 0;
      } else if (failed) stage++;
    }
    if (!failed) continue;
    const last = xs.at(-1)!;
    const days = [0, 1, 3, 7, 14, 30];
    const due = last.at + (stage === 0 ? 10 * 60000 : days[Math.min(stage, 5)] * 86400000);
    if (due <= now) out.push({ id, due, stage });
  }
  return out.sort((a, b) => a.due - b.due);
}
export function attemptsFrom(records: RecordItem[]) {
  return records.filter((r) => r.kind === 'attempt').map((r) => r.value as Attempt);
}
export function localDay(at = Date.now()) {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function streak(attempts: Attempt[], now = Date.now()) {
  const days = new Set(attempts.map((a) => localDay(a.at)));
  let d = new Date(now),
    count = 0;
  if (!days.has(localDay(+d))) d = new Date(+d - 86400000);
  while (days.has(localDay(+d))) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}
