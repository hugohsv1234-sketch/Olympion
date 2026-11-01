import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
const idx = JSON.parse(await fs.readFile('public/puzzles/index.json', 'utf8'));
function validSide(c) {
  const inactive = c.turn() === 'w' ? 'b' : 'w';
  const king = c
    .board()
    .flat()
    .find((p) => p?.color === inactive && p.type === 'k');
  assert(
    king && !c.isAttacked(king.square, c.turn()),
    'Nicht am Zug befindlicher König steht im Schach.',
  );
}
assert(idx.count >= 1000);
const ids = new Set(),
  positions = new Set();
for (const pack of new Set(idx.puzzles.map((p) => p.pack))) {
  const puzzles = JSON.parse(await fs.readFile('public/puzzles/' + pack, 'utf8'));
  for (const p of puzzles) {
    assert(!ids.has(p.id), 'Doppelte ID');
    ids.add(p.id);
    const c = new Chess(p.fen);
    validSide(c);
    for (const [i, m] of p.moves.entries()) {
      c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
      if (i === 0) {
        const key = c.fen().split(' ').slice(0, 4).join(' ');
        assert(!positions.has(key), 'Doppelte Aufgabenstellung');
        positions.add(key);
      }
    }
    if (p.themes.some((t) => /^mateIn[123]$/.test(t)))
      assert(c.isCheckmate(), 'Mattmotiv endet nicht in Matt: ' + p.id);
    for (const line of p.alternatives || []) {
      const alt = new Chess(p.fen);
      for (const m of [p.moves[0], ...line]) {
        alt.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
        validSide(alt);
      }
      assert(alt.isCheckmate(), 'Alternative endet nicht in Matt: ' + p.id);
    }
  }
}
assert.equal(ids.size, idx.count);
console.log(
  'BESTANDEN:',
  ids.size,
  'eindeutige Aufgaben, alle UCI-Züge legal, Mattlösungen geprüft.',
);
