// Tradução do site por catálogo (texto em inglês -> texto traduzido).
//
// translateHtml(html, catalog, opts) percorre o HTML com o parse5, acha os trechos de texto
// traduzíveis e troca SOMENTE esses trechos no HTML original (o resto fica idêntico, byte a byte).
// Texto sem entrada no catálogo fica em inglês. Com opts.missing (Set) ele só coleta o que falta.
//
// Chave do catálogo = o texto em inglês como está no HTML (espaços colapsados, entidades como &amp; mantidas).
// Em blocos com marcação (links, negrito), a chave é o HTML interno do bloco, e a tradução deve manter as mesmas tags.

import { parse } from 'parse5';

const INLINE = new Set(['a', 'abbr', 'b', 'strong', 'i', 'em', 'span', 'br', 'sup', 'sub', 'small', 'mark', 'code', 'kbd', 'time', 'wbr', 'u', 's', 'tspan', 'svg', 'label', 'img', 'bdi', 'q', 'cite']);
const SKIP = new Set(['script', 'style', 'noscript', 'textarea', 'pre', 'template']);
const SVG_INNER = new Set(['path', 'circle', 'rect', 'g', 'line', 'polyline', 'polygon', 'ellipse', 'defs', 'use', 'lineargradient', 'stop', 'clippath', 'mask']);
const ATTRS = ['aria-label', 'title', 'placeholder', 'alt', 'data-title', 'aria-description'];
const norm = (s) => s.replace(/\s+/g, ' ').trim();
// só vale traduzir se tiver letras e não for só número/símbolo, URL, e-mail ou caminho
export const translatable = (s) => {
  const t = s.replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').trim();
  if (!/[A-Za-zÀ-ÿ]{2}/.test(t)) return false;
  if (/^(\/\S*|https?:\S*|www\.\S*)$/i.test(t) || /^[\w.+-]+@[\w.-]+$/.test(t)) return false;
  if (/^[\d\s·.,:;%$€+\-–—/()→←|#]+$/.test(t)) return false;
  if (/^\d+ · \//.test(t)) return false;                       // rótulos de caminho do sitemap
  if (/hreflang=/.test(s)) return false;                        // links de idioma (tratados à parte)
  if (/^\[(confirmar|definir)/i.test(t)) return false;          // marcadores internos de pendência
  if (/^(translate\w*|rotate\w*|scale\w*|rgba?|hsla?|url|calc|var)\(/i.test(t) || /^\[data-/.test(t) || /^(REQ|PRJ)-/.test(t)) return false; // CSS e ids gerados por código
  return true;
};

const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const escDoc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function walkNodes(node, fn) {
  if (fn(node) === true) return; // true = não descer nos filhos
  const kids = node.content ? node.content.childNodes : node.childNodes;
  if (kids) for (const k of kids) walkNodes(k, fn);
}

function stashSvg(inner) {
  const svgs = [];
  const key = inner.replace(/<svg\b[\s\S]*?<\/svg>/gi, (m) => { svgs.push(m); return '<svg/>'; });
  return { key, svgs };
}

export function translateHtml(html, catalog, opts = {}) {
  const { missing = null, jsKey = true } = opts;
  const doc = parse(html, { sourceCodeLocationInfo: true });
  const edits = [];
  const get = (key) => (catalog && Object.prototype.hasOwnProperty.call(catalog, key) ? catalog[key] : undefined);

  const note = (key) => { if (missing && translatable(key) && get(key) === undefined) missing.add(key); };

  function translateSegment(start, end, keyRaw, lead, trail) {
    const { key: k0, svgs } = stashSvg(keyRaw);
    const key = norm(k0);
    if (!key) return;
    if (missing) { note(key); return; }
    let t = get(key);
    if (t === undefined || t === key) return;
    let i = 0;
    t = t.replace(/<svg\/>/g, () => svgs[i++] ?? '');
    edits.push({ start, end, text: lead + t + trail });
  }

  walkNodes(doc, (n) => {
    if (!n.tagName || !n.sourceCodeLocation) return false;
    const tag = n.tagName.toLowerCase();
    const loc = n.sourceCodeLocation;

    // atributos
    if (loc.attrs) {
      for (const a of n.attrs) {
        const al = loc.attrs[a.name];
        if (!al) continue;
        let isTr = ATTRS.includes(a.name);
        if (tag === 'meta' && a.name === 'content') {
          const nm = (n.attrs.find((x) => x.name === 'name' || x.name === 'property') || {}).value || '';
          isTr = /^(description|og:title|og:description|twitter:title|twitter:description)$/i.test(nm);
        }
        if (a.name === 'srcdoc' && (tag === 'iframe')) {
          // ferramenta embutida: documento HTML dentro do atributo
          const rawAttr = html.slice(al.startOffset, al.endOffset);
          const q = rawAttr.indexOf('=') + 1;
          const quote = rawAttr[q];
          const innerStart = al.startOffset + q + 1;
          const innerEnd = al.endOffset - 1;
          if (missing) { translateHtml(a.value, catalog, opts); }
          else {
            const out = translateHtml(a.value, catalog, opts);
            if (out !== a.value) edits.push({ start: innerStart, end: innerEnd, text: escDoc(out) });
          }
          continue;
        }
        if (!isTr || !a.value) continue;
        const key = norm(a.value);
        if (missing) { note(key); continue; }
        const t = get(key);
        if (t === undefined || t === key) continue;
        const rawAttr = html.slice(al.startOffset, al.endOffset);
        const q = rawAttr.indexOf('=') + 1;
        edits.push({ start: al.startOffset + q + 1, end: al.endOffset - 1, text: escAttr(t) });
      }
    }

    if (SKIP.has(tag)) {
      if (tag === 'script' && jsKey && loc.startTag && loc.endTag && !(n.attrs || []).some((x) => x.name === 'src')) {
        const s = loc.startTag.endOffset, e = loc.endTag.startOffset;
        const code = html.slice(s, e);
        const out = translateJs(code, catalog, missing);
        if (!missing && out !== code) edits.push({ start: s, end: e, text: out });
      }
      return true;
    }
    if (!loc.startTag || !loc.endTag) return false;

    const kids = n.childNodes || [];
    const textKids = kids.filter((k) => k.nodeName === '#text' && k.value.trim());
    if (!textKids.length) return false;
    const hasBlock = kids.some((k) => k.tagName && !INLINE.has(k.tagName.toLowerCase()) && !SVG_INNER.has(k.tagName.toLowerCase()));
    const s = loc.startTag.endOffset, e = loc.endTag.startOffset;
    if (!hasBlock) {
      const raw = html.slice(s, e);
      const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
      translateSegment(s, e, raw, lead, trail.length === raw.length ? '' : trail);
      return true;
    } else {
      for (const k of textKids) {
        const kl = k.sourceCodeLocation; if (!kl) continue;
        const raw = html.slice(kl.startOffset, kl.endOffset);
        const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
        translateSegment(kl.startOffset, kl.endOffset, raw, lead, trail.length === raw.length ? '' : trail);
      }
    }
    return false;
  });

  if (missing || !edits.length) return html;
  // remove edições aninhadas (um bloco traduzido inteiro já cobre atributos/filhos dentro dele)
  edits.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept = [];
  for (const ed of edits) {
    const last = kept[kept.length - 1];
    if (last && ed.start >= last.start && ed.end <= last.end && !(ed.start === last.start && ed.end === last.end)) continue;
    kept.push(ed);
  }
  let out = html;
  for (let i = kept.length - 1; i >= 0; i--) out = out.slice(0, kept[i].start) + kept[i].text + out.slice(kept[i].end);
  return out;
}

// ---------------- strings dentro de JavaScript ----------------
// Um scanner simples percorre o código (pulando comentários, regex e strings) e acha:
//  - literais 'texto' e "texto": chave "js:<texto>" no catálogo;
//  - template literals `...${expr}...`: cada ${expr} vira um marcador, o HTML resultante passa pelo
//    mesmo tradutor de HTML (os textos entram no catálogo como as demais chaves) e as expressões voltam no lugar.
const unJs = (s) => s.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (m, c) => (c[0] === 'u' || c[0] === 'x' ? String.fromCharCode(parseInt(c.slice(1), 16)) : c === 'n' ? '\n' : c === 't' ? '\t' : c));
const toJs = (s, q) => s.replace(/\\/g, '\\\\').replace(new RegExp(q, 'g'), '\\' + q).replace(/\n/g, '\\n');
// o texto do template literal já vem escapado do código-fonte; só protege crase e ${ que a tradução possa ter trazido
const safeTpl = (s) => s.replace(/(?<!\\)`/g, '\\`').replace(/(?<!\\)\$\{/g, '\\${');

// Palavras soltas em JS que são texto de interface (rótulos, opções, níveis). As demais ('A', 'ArrowDown', ids...)
// ficam fora para não quebrar a lógica. Lista verificada: nenhuma é comparada com valor vindo do HTML.
export const SINGLE_WORDS = new Set(['Other', 'Spreadsheets', 'Email', 'Often', 'Occasionally', 'High-Performance', 'Healthy', 'Developing', 'Reactive', 'Company', 'Required', 'Finance', 'Blended', 'Productivity', 'Volume', 'Complexity', 'Low', 'Medium', 'High', 'Deadline', 'Knowing', 'Analysis', 'Development', 'Rollout', 'Evaluation', 'Readiness', 'Southeast', 'Northeast', 'Midwest', 'West', 'South', 'GAP', 'Prediction', 'Signal', 'Assessment', 'Challenge', 'Scope', 'Design', 'Architecture', 'Scenario-based', 'Formats', 'Version', 'Approval', 'Instructor', 'Engagement', 'Sessions', 'Records', 'Learner', 'Learning', 'Path', 'Results', 'Report', 'Know', 'Do', 'Yes', 'No']);

export function jsCandidate(v) {
  const t = v.trim();
  if (/^\d{1,3}(,\d{3})+(–\d{1,3}(,\d{3})*)?\+?$/.test(t)) return true;  // faixas numéricas de respostas (1,000–4,999)
  if (/^[A-Za-z]+(-[A-Za-z]+)?$/.test(t)) return SINGLE_WORDS.has(t);
  if (t.length < 4 || !/[A-Za-z]{3}/.test(t)) return false;
  if (/^[#.\[]/.test(t) || /[{};]|=>|function|\(\)|^\w+:\s*\w+;/.test(t)) return false;
  if (/^[\w\-./:#?=&%]+$/.test(t)) return false;            // ids, classes, urls
  if (/^(M|m)[\d\s.,\-LlCcHhVvZz]+$/.test(t)) return false;  // path svg
  if (/^<(circle|path|rect|g|line|polyline|svg|text)\b/i.test(t)) return false; // fragmentos de SVG
  if (/prefers-|^\(|^@media|px\)|\bvar\(--/.test(t)) return false;            // media queries / CSS
  return /\s/.test(t) || /^[A-Z][a-z]+/.test(t);
}

const REGEX_PREV = /[(,=:\[!&|?{};+\-*%<>~^]$|(^|[^\w$.])(return|typeof|case|in|of|delete|void|throw|new|else|do)$/;

// devolve [{type:'str'|'tpl', start, end, quote, raw}] (end exclusivo, incluindo as aspas)
function scan(code) {
  const out = [];
  let i = 0;
  const n = code.length;
  let prev = '';
  const skipTpl = (j) => { // j aponta para o primeiro char depois da crase de abertura; devolve índice depois da crase final
    while (j < n) {
      const c = code[j];
      if (c === '\\') { j += 2; continue; }
      if (c === '`') return j + 1;
      if (c === '$' && code[j + 1] === '{') { j = skipExpr(j + 2); continue; }
      j++;
    }
    return j;
  };
  const skipExpr = (j) => { // dentro de ${ ... }; devolve índice depois da chave de fechamento
    let depth = 1; let pv = '';
    while (j < n && depth > 0) {
      const c = code[j];
      if (c === '{') { depth++; j++; pv = c; continue; }
      if (c === '}') { depth--; j++; pv = c; continue; }
      if (c === '`') { j = skipTpl(j + 1); pv = '`'; continue; }
      if (c === "'" || c === '"') { j = skipStr(j); pv = c; continue; }
      if (c === '/' && code[j + 1] === '/') { while (j < n && code[j] !== '\n') j++; continue; }
      if (c === '/' && code[j + 1] === '*') { j = code.indexOf('*/', j + 2); j = j < 0 ? n : j + 2; continue; }
      if (c === '/' && REGEX_PREV.test(pv)) { j = skipRegex(j); pv = ')'; continue; }
      if (!/\s/.test(c)) pv = (pv + c).slice(-12);
      j++;
    }
    return j;
  };
  const skipStr = (j) => { const q = code[j]; j++; while (j < n && code[j] !== q) { if (code[j] === '\\') j++; if (code[j] === '\n') break; j++; } return j + 1; };
  const skipRegex = (j) => { j++; let cls = false; while (j < n) { const c = code[j]; if (c === '\\') { j += 2; continue; } if (c === '[') cls = true; else if (c === ']') cls = false; else if (c === '/' && !cls) { j++; break; } else if (c === '\n') break; j++; } while (/[a-z]/i.test(code[j] || '')) j++; return j; };

  while (i < n) {
    const c = code[i];
    if (c === '/' && code[i + 1] === '/') { while (i < n && code[i] !== '\n') i++; continue; }
    if (c === '/' && code[i + 1] === '*') { const e = code.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === "'" || c === '"') { const e = skipStr(i); out.push({ type: 'str', start: i, end: e, quote: c, raw: code.slice(i + 1, e - 1) }); i = e; prev = c; continue; }
    if (c === '`') { const e = skipTpl(i + 1); out.push({ type: 'tpl', start: i, end: e, raw: code.slice(i + 1, e - 1) }); i = e; prev = '`'; continue; }
    if (c === '/' && REGEX_PREV.test(prev)) { i = skipRegex(i); prev = ')'; continue; }
    if (!/\s/.test(c)) prev = (prev + c).slice(-12);
    i++;
  }
  return out;
}

// separa o conteúdo de um template literal em partes estáticas e expressões ${...}
function splitTpl(raw) {
  const exprs = [];
  let out = '';
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === '\\') { out += raw.slice(i, i + 2); i += 2; continue; }
    if (raw[i] === '$' && raw[i + 1] === '{') {
      let depth = 1; let j = i + 2;
      const inner = scan(raw.slice(j)); // acha o fim da expressão contando chaves fora de strings/templates
      // contagem de chaves simples, ignorando literais já identificados pelo scanner
      const skip = new Set();
      for (const t of inner) for (let k = t.start; k < t.end; k++) skip.add(k);
      let k = 0;
      for (; j + k < raw.length; k++) {
        if (skip.has(k)) continue;
        const ch = raw[j + k];
        if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (!depth) break; }
      }
      exprs.push(raw.slice(i, j + k + 1));
      out += `⟦${exprs.length - 1}⟧`;
      i = j + k + 1;
      continue;
    }
    out += raw[i]; i++;
  }
  return { html: out, exprs };
}

export function translateJs(code, catalog, missing, depth = 0) {
  const toks = scan(code);
  const edits = [];
  for (const t of toks) {
    if (t.type === 'str') {
      const val = unJs(t.raw);
      if (!jsCandidate(val)) continue;
      const key = 'js:' + norm(val);
      if (missing) { missing.add(key); continue; }
      const tr = catalog && catalog[key];
      if (tr === undefined || tr === norm(val)) continue;
      edits.push({ start: t.start, end: t.end, text: t.quote + toJs(tr, t.quote) + t.quote });
    } else if (t.type === 'tpl' && /[A-Za-z]{3}/.test(t.raw) && depth < 2) {
      const { html, exprs } = splitTpl(t.raw);
      // só interessa se, tirando as expressões, sobra texto com letras
      if (!/[A-Za-z]{3}/.test(html.replace(/<[^>]*>/g, ' ').replace(/⟦\d+⟧/g, ' '))) continue;
      // o <div> temporário dá um elemento pai ao texto solto (só texto, sem tags, não seria traduzido)
      const wrapped = translateHtml('<div>' + html + '</div>', catalog, { missing, jsKey: false });
      const out = wrapped.slice(5, -6);
      if (missing || out === html) continue;
      const restored = out.replace(/⟦(\d+)⟧/g, (m, d) => exprs[Number(d)] ?? m);
      // escapa só o que o tradutor pode ter introduzido; as expressões originais ficam como estavam
      const parts = out.split(/(⟦\d+⟧)/).map((seg) => (/^⟦\d+⟧$/.test(seg) ? exprs[Number(seg.slice(1, -1))] : safeTpl(seg)));
      edits.push({ start: t.start, end: t.end, text: '`' + parts.join('') + '`' });
    }
  }
  if (missing || !edits.length) return code;
  let res = code;
  for (const e of edits.sort((a, b) => b.start - a.start)) res = res.slice(0, e.start) + e.text + res.slice(e.end);
  return res;
}
