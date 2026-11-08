import { build } from 'esbuild';

await build({
  entryPoints: ['server/ranking.ts'],
  outfile: 'server/ranking.bundle.mjs',
  bundle: true,
  packages: 'external',
  platform: 'node',
  target: 'node22',
  format: 'esm',
});
