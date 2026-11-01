import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const core = [
  '/',
  '/training',
  '/puzzles',
  '/arena',
  '/analyse',
  '/akademie',
  '/fortschritt',
  '/profil',
];
async function walk(dir) {
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) await walk(file);
    else {
      const rel = '/' + path.relative('out', file).replaceAll(path.sep, '/');
      if (
        (rel.startsWith('/_next/static/') ||
          rel.startsWith('/fonts/') ||
          rel.startsWith('/icons/') ||
          rel.startsWith('/images/') ||
          rel.endsWith('.txt') ||
          rel.endsWith('.webmanifest')) &&
        !rel.startsWith('/engine/')
      )
        core.push(rel);
    }
  }
}
await walk('out');
const digest = createHash('sha256');
for (const url of core) {
  let file = url === '/' ? 'out/index.html' : 'out' + url;
  if (!path.extname(file)) file += '.html';
  digest.update(url);
  digest.update(await fs.readFile(file));
}
const hash = digest.digest('hex').slice(0, 12);
const source = await fs.readFile('public/sw.js', 'utf8');
await fs.writeFile(
  'out/sw.js',
  source.replace('__BUILD__', hash).replace('__CORE__', JSON.stringify(core)),
);
console.log('PWA-Rahmen:', core.length, 'öffentliche Dateien · Build', hash);
