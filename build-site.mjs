// Gera a pasta site/ (uma URL por página, pronta pro Cloudflare Pages) a partir do dist/ atual.
// Uso: npm run build:site   (roda "node build.mjs" antes, automaticamente)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'site');
const STATIC = path.join(ROOT, 'site-static');
const LANGS = ['en', 'pt', 'es', 'fr'];

fs.rmSync(OUT, { recursive: true, force: true });

console.log('1/3 node build.mjs');
execFileSync(process.execPath, ['build.mjs'], { cwd: ROOT, stdio: 'inherit' });

console.log('2/3 build_site.py por idioma');
const python = process.platform === 'win32' ? 'python' : 'python3';
for (const lang of LANGS) {
  const src = lang === 'en' ? path.join(DIST, 'index.html') : path.join(DIST, lang, 'index.html');
  const args = ['build_site.py', src, OUT, '--langs', LANGS.join(',')];
  if (lang !== 'en') args.push('--lang', lang);
  execFileSync(python, args, { cwd: ROOT, stdio: 'inherit' });
}

console.log('3/3 copiando assets estáticos (favicons, og, guides, robots.txt, _redirects...)');
fs.cpSync(STATIC, OUT, { recursive: true });

console.log(`\nPronto: ${OUT}`);
