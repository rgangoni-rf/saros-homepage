// Extrai todos os textos traduzíveis de src/index.template.html para i18n/source.json
// (chave = texto em inglês). Uso: node i18n/extract.mjs
import fs from 'node:fs';
import { translateHtml } from './translate.mjs';
const html = fs.readFileSync(new URL('../src/index.template.html', import.meta.url), 'utf8');
const missing = new Set();
translateHtml(html, {}, { missing });
const keys = [...missing];
const words = (k) => k.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
fs.writeFileSync(new URL('./source.json', import.meta.url), JSON.stringify(Object.fromEntries(keys.map((k) => [k, k])), null, 0));
const js = keys.filter((k) => k.startsWith('js:'));
console.log('chaves:', keys.length, '| js:', js.length, '| palavras:', keys.reduce((a, k) => a + words(k), 0));
