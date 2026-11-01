import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Chess } from 'chess.js';
const filename = process.argv[2];
if (!filename) throw new Error('Aufruf: npm run puzzles:import -- /absoluter/pfad/lichess.csv');
const source = await fs.readFile(filename, 'utf8');
const lines = source.trim().split(/\r?\n/);
const header = lines.shift().split(',');
const at = Object.fromEntries(header.map((k, i) => [k, i]));
const seen = new Set();
const valid = [];
let rejected = 0;
for (const line of lines) {
  const row = line.split(',');
  const fen = row[at.FEN];
  const moves = row[at.Moves]?.split(' ');
  if (!fen || !moves || moves.length < 2) continue;
  try {
    const c = new Chess(fen);
    for (const m of moves) c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
    const start = new Chess(fen);
    const first = moves[0];
    start.move({ from: first.slice(0, 2), to: first.slice(2, 4), promotion: first[4] });
    const key = start.fen().split(' ').slice(0, 4).join(' ');
    if (seen.has(key)) continue;
    seen.add(key);
    const p = {
      id: row[at.PuzzleId],
      fen,
      moves,
      rating: Number(row[at.Rating]),
      themes: row[at.Themes].split(' '),
      url: row[at.GameUrl],
    };
    if (p.rating >= 400 && p.rating <= 3000 && Number(row[at.Popularity]) >= 50) valid.push(p);
  } catch {
    rejected++;
  }
}
const chosen = new Map();
// Lichess hat kein eigenes overloading-Tag. Diese gesonderte, selbst erstellte
// Lehrstellung prüft die Doppelaufgabe des Turms g7: Dame decken und die Grundreihe schützen.
const overload = {
  id: 'olympion-overload-1',
  fen: '7k/6r1/5K2/7q/4B3/8/7Q/R7 b - - 0 1',
  moves: ['h5h7', 'h2h7', 'g7h7', 'a1a8'],
  alternatives: [['a1a8', 'g7g8', 'h2h7']],
  rating: 1400,
  themes: ['overloading', 'deflection', 'mateIn2', 'sacrifice'],
  url: 'https://database.lichess.org/#puzzles',
};
{
  const c = new Chess(overload.fen);
  for (const m of overload.moves) c.move({ from: m.slice(0, 2), to: m.slice(2, 4) });
  chosen.set(overload.id, overload);
}
const required = [
  'fork',
  'pin',
  'skewer',
  'discoveredAttack',
  'deflection',
  'attraction',
  'backRankMate',
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'promotion',
];
for (const theme of required) {
  const ps = valid.filter((p) => p.themes.includes(theme));
  if (!ps.length) throw new Error('Motiv fehlt: ' + theme);
  for (const p of ps.slice(0, 20)) chosen.set(p.id, p);
}
for (const [lo, hi] of [
  [400, 800],
  [800, 1100],
  [1100, 1400],
  [1400, 1700],
  [1700, 2000],
  [2000, 2300],
  [2300, 2600],
  [2600, 3001],
]) {
  let added = 0;
  for (const p of valid) {
    if (p.rating < lo || p.rating >= hi || chosen.has(p.id)) continue;
    chosen.set(p.id, p);
    if (++added >= 100) break;
  }
}
for (const p of valid) {
  if (chosen.size >= 1001) break;
  chosen.set(p.id, p);
}
let selected = [...chosen.values()];
if (selected.length < 1001) throw new Error('Zu wenige validierte Puzzles: ' + selected.length);
selected = selected.slice(0, 1001).sort((a, b) => a.rating - b.rating || a.id.localeCompare(b.id));
await fs.mkdir('public/puzzles', { recursive: true });
const metadata = [];
for (let i = 0; i < selected.length; i += 50) {
  const pack = `pack-${String(i / 50).padStart(2, '0')}.json`;
  const batch = selected.slice(i, i + 50);
  await fs.writeFile('public/puzzles/' + pack, JSON.stringify(batch));
  metadata.push(...batch.map(({ id, rating, themes }) => ({ id, rating, themes, pack })));
}
const manifest = {
  count: selected.length,
  source: 'https://database.lichess.org/lichess_db_puzzle.csv.zst',
  sourceLastModified: '2026-10-02',
  importedAt: new Date().toISOString(),
  sourceSampleSha256: createHash('sha256').update(source).digest('hex'),
  license: 'CC0-1.0',
  method:
    '60.000 Zeilen streamen; legale UCI-Folgen prüfen; Ausgangsstellungen deduplizieren; Motive und Schwierigkeit schichten.',
  puzzles: metadata,
};
await fs.writeFile('public/puzzles/index.json', JSON.stringify(manifest));
await fs.mkdir('data', { recursive: true });
await fs.writeFile(
  'data/puzzle-import.json',
  JSON.stringify(
    {
      ...manifest,
      puzzles: undefined,
      sourceRows: lines.length,
      rejected,
      themes: Object.fromEntries(
        required.map((t) => [t, selected.filter((p) => p.themes.includes(t)).length]),
      ),
    },
    null,
    2,
  ),
);
console.log(
  selected.length + ' unterschiedliche Puzzles importiert.',
  JSON.stringify(manifest.sourceSampleSha256),
);
