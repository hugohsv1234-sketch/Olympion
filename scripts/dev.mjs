import { spawn } from 'node:child_process';
import fs from 'node:fs';
// The managed preview passes Vite-style flags. Keep the normal Next dev command
// and adapt those flags here. A finished export is previewed as production.
const args = process.argv.slice(2);
if (args.includes('--strictPort') && fs.existsSync('out/index.html')) {
  await import('./serve.mjs');
} else {
  const clean = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--strictPort') continue;
    clean.push(args[i] === '--host' ? '--hostname' : args[i]);
  }
  if (!clean.includes('--hostname')) clean.push('--hostname', '0.0.0.0');
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', ...clean], {
    stdio: 'inherit',
    env: process.env,
  });
  process.on('SIGTERM', () => child.kill('SIGTERM'));
  process.on('SIGINT', () => child.kill('SIGINT'));
  child.on('exit', (code) => process.exit(code || 0));
}
