import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const args = process.argv.slice(2),
  portIndex = args.indexOf('--port');
const root = path.resolve('out'),
  port = Number(portIndex >= 0 ? args[portIndex + 1] : process.env.PORT || 3000),
  mime = {
    '.html': 'text/html;charset=utf-8',
    '.txt': 'text/x-component',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.wasm': 'application/wasm',
    '.webmanifest': 'application/manifest+json',
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.ttf': 'font/ttf',
    '.gz': 'application/gzip',
  };
http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let name = path.resolve(root, '.' + pathname);
      if (!name.startsWith(root + path.sep) && name !== root) {
        res.writeHead(403).end();
        return;
      }
      let data;
      for (const candidate of [name, name + '.html', path.join(name, 'index.html')]) {
        try {
          const stat = await fs.stat(candidate);
          if (stat.isFile()) {
            data = await fs.readFile(candidate);
            name = candidate;
            break;
          }
        } catch {}
      }
      if (!data) {
        res
          .writeHead(404, { 'Content-Type': 'text/html' })
          .end(await fs.readFile(path.join(root, '404.html')));
        return;
      }
      res.writeHead(200, {
        'Content-Type':
          (name.includes('/fonts/') || name.includes('/engine/')) && name.endsWith('.txt')
            ? 'text/plain;charset=utf-8'
            : mime[path.extname(name)] || 'application/octet-stream',
        'Cache-Control': name.endsWith('sw.js') ? 'no-cache' : 'public, max-age=0',
        'Service-Worker-Allowed': '/',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(data);
    } catch {
      res.writeHead(500).end('Serverfehler');
    }
  })
  .listen(port, '0.0.0.0', () => console.log('OLYMPION production preview on port', port));
