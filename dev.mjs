// Ambiente local de teste: gera o site, serve dist/ e refaz o build quando um arquivo muda.
// Uso: npm run dev   (abre em http://localhost:8787)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 8787;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.yml': 'text/yaml; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

function build() {
  const t = Date.now();
  const r = spawnSync(process.execPath, ['build.mjs'], { cwd: ROOT, encoding: 'utf8' });
  if (r.status === 0) console.log(`[${new Date().toLocaleTimeString()}] build ok (${Date.now() - t} ms)`);
  else console.log(`[${new Date().toLocaleTimeString()}] ERRO NO BUILD:\n${(r.stderr || r.stdout).trim()}`);
  return r.status === 0;
}

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(DIST, p);
  if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!p.endsWith('/')) { res.writeHead(307, { Location: p + '/' }).end(); return; }
    file = path.join(file, 'index.html');
  }
  if (!fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => {
  build();
  console.log(`\nSite local:  http://localhost:${PORT}/   (/pt/  /es/  /fr/  /admin/)\nMuda um arquivo e atualiza o navegador (Cmd+R). Ctrl+C para sair.\n`);
});

let timer = null;
for (const d of ['src', 'content', 'i18n', 'admin', 'uploads', 'build.mjs']) {
  const target = path.join(ROOT, d);
  if (!fs.existsSync(target)) continue;
  fs.watch(target, { recursive: true }, (_e, name) => {
    if (name && /(^|[\\/])(work|source\.json)/.test(name)) return;
    clearTimeout(timer);
    timer = setTimeout(build, 300);
  });
}
