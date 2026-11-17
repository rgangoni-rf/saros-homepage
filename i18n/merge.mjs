// Junta i18n/work/<idioma>-NN.json em i18n/<idioma>.json (catálogo usado pelo build).
// Uso: node i18n/merge.mjs es fr
import fs from 'node:fs';
const D = new URL('./', import.meta.url).pathname;
const source = JSON.parse(fs.readFileSync(D + 'source.json', 'utf8'));

// Tipografia do francês canadense: espaço insécable antes de ? ! ; : % e dentro de « ».
// Só mexe no texto (tags HTML e entidades ficam intactas).
const NB = '\u00a0';
function frTypography(v) {
  return v.split(/(<[^>]*>|&[#a-zA-Z0-9]+;)/).map((seg, i) => {
    if (i % 2) return seg;
    return seg
      .replace(/(\S)[ \u00a0\u202f]*([?!;])/g, `$1${NB}$2`)
      .replace(/(\S)[ \u00a0\u202f]*:(?=[ \u00a0]|$)/g, `$1${NB}:`)
      .replace(/(\d)[ \u00a0\u202f]*%/g, `$1${NB}%`)
      .replace(/«[ \u00a0\u202f]*/g, `«${NB}`)
      .replace(/[ \u00a0\u202f]*»/g, `${NB}»`);
  }).join('');
}
for (const lang of process.argv.slice(2)) {
  const cat = {};
  const files = fs.readdirSync(D + 'work').filter((f) => new RegExp(`^${lang}-\\d+\\.json$`).test(f)).sort();
  for (const f of files) Object.assign(cat, JSON.parse(fs.readFileSync(D + 'work/' + f, 'utf8')));
  // ordem do documento; só chaves que ainda existem no texto-fonte (inclui as que ficam iguais, como marcas e siglas)
  const out = {};
  let miss = 0;
  for (const k of Object.keys(source)) {
    if (cat[k] === undefined) { miss++; continue; }
    out[k] = lang === 'fr' ? frTypography(cat[k]) : cat[k];
  }
  fs.writeFileSync(D + `${lang}.json`, JSON.stringify(out, null, 1));
  console.log(`${lang}: ${Object.keys(out).length} traduções de ${Object.keys(source).length} chaves (${miss} sem tradução) ← ${files.length} arquivo(s)`);
}
