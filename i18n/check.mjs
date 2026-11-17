// Confere se o texto do site (src/index.template.html) tem tradução em cada catálogo.
// Uso: npm run i18n:check   (sai com código 1 se faltar tradução)
// Para traduzir o que faltar: veja i18n/README.md.
import fs from 'node:fs';
import { translateHtml } from './translate.mjs';
const D = new URL('./', import.meta.url).pathname;
const html = fs.readFileSync(D + '../src/index.template.html', 'utf8');
const missing = new Set();
translateHtml(html, {}, { missing });
const keys = [...missing];
let bad = 0;
for (const lang of ['pt', 'es', 'fr']) {
  const cat = JSON.parse(fs.readFileSync(D + `${lang}.json`, 'utf8'));
  const miss = keys.filter((k) => cat[k] === undefined);
  console.log(`${lang}: ${keys.length - miss.length}/${keys.length} textos com tradução, ${miss.length} faltando`);
  for (const k of miss.slice(0, 40)) console.log('   -', k.slice(0, 110));
  if (miss.length > 40) console.log(`   ... e mais ${miss.length - 40}`);
  bad += miss.length;
}
process.exit(bad ? 1 : 0);
