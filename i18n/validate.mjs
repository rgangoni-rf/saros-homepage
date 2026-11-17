// Valida traduções: node i18n/validate.mjs <arquivo-origem.json> <arquivo-traducao.json>
// Confere chaves, tags, atributos, entidades, <svg/> e placeholders. Sai com código 1 se houver erro.
import fs from 'node:fs';
const [, , srcF, trF] = process.argv;
const src = JSON.parse(fs.readFileSync(srcF, 'utf8'));
let tr;
try { tr = JSON.parse(fs.readFileSync(trF, 'utf8')); } catch (e) { console.log('JSON inválido: ' + e.message); process.exit(1); }
const tags = (s) => (s.match(/<\/?[a-zA-Z][^>]*>/g) || []).map((t) => t.replace(/\s+/g, ' ')).sort().join('|');
const ents = (s) => (s.match(/&[a-zA-Z#0-9]+;/g) || []).sort().join('');
const ph = (s) => (s.match(/%[sd]|\{[0-9a-zA-Z_]+\}|\$\{[^}]*\}/g) || []).sort().join('');
const errs = [], warns = [];
for (const k of Object.keys(src)) {
  const v = tr[k];
  if (v === undefined) { errs.push(['FALTA', k]); continue; }
  if (typeof v !== 'string' || !v.trim()) { errs.push(['VAZIO', k]); continue; }
  if (v.startsWith('js:') && k.startsWith('js:')) errs.push(['PREFIXO js: NO VALOR', k]);
  const kk = k.startsWith('js:') ? k.slice(3) : k;
  if (tags(kk) !== tags(v)) errs.push(['TAGS', k, v]);
  else if (ents(kk).replace(/&nbsp;/g, '') !== ents(v).replace(/&nbsp;/g, '')) warns.push(['ENTIDADES', k, v]);
  if (ph(kk) !== ph(v)) errs.push(['PLACEHOLDER', k, v]);
}
for (const k of Object.keys(tr)) if (!(k in src)) warns.push(['CHAVE EXTRA', k]);
console.log(`chaves: ${Object.keys(src).length} | erros: ${errs.length} | avisos: ${warns.length}`);
for (const e of errs.slice(0, 40)) console.log('ERRO', e[0], '\n  EN:', e[1].slice(0, 240), e[2] ? '\n  TR: ' + e[2].slice(0, 240) : '');
for (const e of warns.slice(0, 10)) console.log('aviso', e[0], '\n  EN:', e[1].slice(0, 160), e[2] ? '\n  TR: ' + e[2].slice(0, 160) : '');
process.exit(errs.length ? 1 : 0);
