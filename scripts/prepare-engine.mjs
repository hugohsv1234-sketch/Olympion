import { mkdir, readdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root = process.cwd();
const pkg = path.join(root, 'node_modules/stockfish');
const dest = path.join(root, 'public/engine');
await mkdir(dest, { recursive: true });
const candidates = ['bin', 'src', '.'];
let files, dir;
for (const c of candidates) {
  try {
    const d = path.join(pkg, c);
    const f = await readdir(d);
    if (f.some((n) => /^stockfish-19-lite-single.*\.js$/.test(n))) {
      files = f;
      dir = d;
      break;
    }
  } catch {}
}
if (!files || !dir)
  throw new Error(
    'Stockfish 19 lite-single fehlt. Bitte npm ci einschließlich devDependencies ausführen.',
  );
const selected = files.filter((n) => /^stockfish-19-lite-single.*\.(js|wasm)$/.test(n));
if (selected.length !== 2) throw new Error('Unerwarteter Stockfish-Build: ' + selected.join(','));
const manifest = {
  version: '19.0.1',
  flavor: 'lite-single',
  files: [],
  source: 'https://github.com/nmrugg/stockfish.js/tree/v19.0.1',
};
for (const f of selected) {
  await copyFile(path.join(dir, f), path.join(dest, f));
  const b = await readFile(path.join(dest, f));
  manifest.files.push({
    url: '/engine/' + f,
    bytes: b.length,
    sha256: createHash('sha256').update(b).digest('hex'),
  });
}
const license = (await readdir(pkg)).find((n) => /^(copying|license)(\.txt|\.md)?$/i.test(n));
if (license) await copyFile(path.join(pkg, license), path.join(dest, 'COPYING.txt'));
await writeFile(path.join(dest, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(
  'Stockfish lite-single bereit:',
  manifest.files.map((f) => f.bytes).reduce((a, b) => a + b, 0),
  'Bytes',
);
