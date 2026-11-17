// Build do site Saros.
//
// Lê os posts em content/blog/*.md, injeta os artigos, a listagem do blog, os menus e o
// sitemap dentro de src/index.template.html e escreve o resultado em dist/.
//
//   npm install && npm run build      (Cloudflare Pages: build command "npm run build", output "dist")
//
// Os posts são editados pelo CMS em /admin (admin/config.yml). Se mudar os campos
// de um lado, mude do outro.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import YAML from 'yaml';
import { translateHtml } from './i18n/translate.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = path.join(ROOT, 'content/blog');
const OUT = path.join(ROOT, 'dist');

// A ordem define o data-t dos botões de filtro em #blog-filters (no template).
// soon: true => mostra um cartão "Coming soon" enquanto o tópico não tiver posts.
// Os nomes precisam ser iguais às opções de "topic" em admin/config.yml.
const TOPICS = [
  { name: 'Learning operations' },
  { name: 'Training intake and prioritization' },
  { name: 'AI and content production', soon: true },
  { name: 'Instructional design models' },
  { name: 'Measuring training impact', soon: true },
];
const MENU_MAX = 4; // quantos posts aparecem nos menus (mais recentes)

// Idiomas. O inglês é o padrão (obrigatório) e sai em dist/index.html; os demais saem em
// dist/<idioma>/index.html, só se tiverem ao menos um post publicado naquele idioma.
// Os códigos precisam ser iguais aos de i18n.locales em admin/config.yml.
const LANGS = ['en', 'pt', 'es', 'fr'];
// es = espanhol da Espanha (es-ES); fr = francês canadense (fr-CA). Pastas: /es/ e /fr/.
const HTML_LANG = { en: 'en', pt: 'pt-BR', es: 'es-ES', fr: 'fr-CA' };
const NATIVE = { en: 'English', pt: 'Português', es: 'Español', fr: 'Français' };
const DEFAULT_LANG = 'en';

// Textos que o build gera (artigos, listagem do blog). O resto do site (src/index.template.html)
// continua em inglês até ser traduzido. Os nomes dos tópicos por idioma ficam em topics.
const STR = {
  en: { language: 'Language', chooseLanguage: 'Choose a language', soonShort: 'soon', kinds: { Guide: 'Guide', Article: 'Article', Checklist: 'Checklist', Template: 'Template', 'Case study': 'Case study' }, home: 'Home', blog: 'Blog', all: 'All', latest: 'Latest articles', onThisPage: 'On this page', share: 'Share', copyLink: 'Copy link', faq: 'Frequently asked questions', sources: 'Sources', minRead: 'min read', featured: 'Featured · Article', readArticle: 'Read the article', comingSoon: 'Coming soon', inPrep: 'New article in preparation', soonText: 'One email a month with the new articles and research.', getEmail: 'Get it by email',
    topics: ['Learning operations', 'Training intake and prioritization', 'AI and content production', 'Instructional design models', 'Measuring training impact'] },
  pt: { language: 'Idioma', chooseLanguage: 'Escolha um idioma', soonShort: 'em breve', kinds: { Guide: 'Guia', Article: 'Artigo', Checklist: 'Checklist', Template: 'Modelo', 'Case study': 'Estudo de caso' }, home: 'Início', blog: 'Blog', all: 'Todos', latest: 'Últimos artigos', onThisPage: 'Nesta página', share: 'Compartilhar', copyLink: 'Copiar link', faq: 'Perguntas frequentes', sources: 'Fontes', minRead: 'min de leitura', featured: 'Destaque · Artigo', readArticle: 'Ler o artigo', comingSoon: 'Em breve', inPrep: 'Novo artigo em preparação', soonText: 'Um e-mail por mês com os novos artigos e pesquisas.', getEmail: 'Receba por e-mail',
    topics: ['Operações de aprendizagem', 'Entrada e priorização de treinamentos', 'IA e produção de conteúdo', 'Modelos de design instrucional', 'Medindo o impacto do treinamento'] },
  es: { language: 'Idioma', chooseLanguage: 'Elige un idioma', soonShort: 'próximamente', kinds: { Guide: 'Guía', Article: 'Artículo', Checklist: 'Lista de verificación', Template: 'Plantilla', 'Case study': 'Caso de estudio' }, home: 'Inicio', blog: 'Blog', all: 'Todos', latest: 'Últimos artículos', onThisPage: 'En esta página', share: 'Compartir', copyLink: 'Copiar enlace', faq: 'Preguntas frecuentes', sources: 'Fuentes', minRead: 'min de lectura', featured: 'Destacado · Artículo', readArticle: 'Leer el artículo', comingSoon: 'Próximamente', inPrep: 'Nuevo artículo en preparación', soonText: 'Un correo al mes con los nuevos artículos e investigaciones.', getEmail: 'Recíbelo por correo',
    topics: ['Operaciones de aprendizaje', 'Recepción y priorización de capacitaciones', 'IA y producción de contenidos', 'Modelos de diseño instruccional', 'Medición del impacto de la capacitación'] },
  fr: { language: 'Langue', chooseLanguage: 'Choisir une langue', soonShort: 'bientôt', kinds: { Guide: 'Guide', Article: 'Article', Checklist: 'Checklist', Template: 'Modèle', 'Case study': 'Étude de cas' }, home: 'Accueil', blog: 'Blog', all: 'Tous', latest: 'Derniers articles', onThisPage: 'Sur cette page', share: 'Partager', copyLink: 'Copier le lien', faq: 'Questions fréquentes', sources: 'Sources', minRead: 'min de lecture', featured: 'À la une · Article', readArticle: 'Lire l’article', comingSoon: 'Bientôt', inPrep: 'Nouvel article en préparation', soonText: 'Un courriel par mois avec les nouveaux articles et études.', getEmail: 'Recevez-le par courriel',
    topics: ['Opérations d’apprentissage', 'Réception et priorisation des formations', 'IA et production de contenu', 'Modèles de conception pédagogique', 'Mesurer l’impact de la formation'] },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stripTags = (s) => s.replace(/<[^>]*>/g, '');
const fail = (file, msg) => { throw new Error(`${file}: ${msg}`); };

// ---------------------------------------------------------------- markdown
let headingPrefix = '';
let headingSeen = new Set();
const slugify = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&amp;|&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';

marked.use({
  gfm: true,
  renderer: {
    heading({ tokens, depth }) {
      const inner = this.parser.parseInline(tokens);
      // ids são globais no documento (site de página única): prefixo = slug do post
      let id = `${headingPrefix}-${slugify(stripTags(inner))}`;
      for (let n = 2; headingSeen.has(id); n++) id = `${headingPrefix}-${slugify(stripTags(inner))}-${n}`;
      headingSeen.add(id);
      return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
    },
  },
});

function renderMarkdown(src) {
  let html = marked.parse(src, { async: false });
  html = html
    .replace(/<ul>\n/g, '<ul class="pg-list">\n')
    .replace(/(?<!<div class="tbl">)<table>[\s\S]*?<\/table>/g, (m) => `<div class="tbl">${m}</div>`)
    .replace(/<a href="(https?:\/\/[^"]+)"([^>]*)>/g, (m, href, rest) => (/target=/.test(rest) ? m : `<a href="${href}"${rest} rel="noopener" target="_blank">`));
  return html;
}

// ---------------------------------------------------------------- posts
// Arquivos: content/blog/<slug>.<idioma>.md  (ex.: meu-post.en.md, meu-post.pt.md)
function readRecord(file) {
  const base = path.basename(file, '.md');
  const m0 = base.match(/^(.+)\.([a-z]{2})$/);
  if (!m0 || !LANGS.includes(m0[2])) fail(file, `o nome precisa terminar em .<idioma>.md com idioma em ${LANGS.join(', ')} (ex.: ${base.replace(/\.[^.]*$/, '')}.en.md)`);
  const [, slug, lang] = m0;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) fail(file, `nome de arquivo inválido "${slug}" (use só minúsculas, números e hífens)`);
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) fail(file, 'front matter ausente (o arquivo precisa começar com --- ... ---)');
  return { file, slug, lang, fm: YAML.parse(m[1]) || {}, body: m[2].trim() };
}

// Campos que o CMS duplica entre idiomas; se faltarem numa tradução, vêm da versão em inglês.
const SHARED = ['date', 'topic', 'kind', 'featured', 'image', 'read_time'];

function toPost(rec, en) {
  const { file, slug, lang } = rec;
  const fm = { ...rec.fm };
  if (en && lang !== DEFAULT_LANG) for (const k of SHARED) if (fm[k] === undefined || fm[k] === null || fm[k] === '') fm[k] = en.fm[k];
  for (const k of ['title', 'date', 'topic', 'summary']) if (!fm[k]) fail(file, `campo obrigatório ausente: ${k}`);
  const topicIdx = TOPICS.findIndex((t) => t.name === fm.topic);
  if (topicIdx < 0) fail(file, `topic "${fm.topic}" não existe. Opções: ${TOPICS.map((t) => t.name).join(' | ')}`);
  if (!rec.body) fail(file, 'corpo vazio');
  const date = fm.date instanceof Date ? fm.date.toISOString().slice(0, 10) : String(fm.date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(file, `data inválida: ${fm.date}`);
  const adv = fm.advanced || {};
  return {
    slug, lang, file, topicIdx, date, body: rec.body,
    title: String(fm.title).replace(/\s+/g, ' ').trim(),
    topic: fm.topic,
    summary: String(fm.summary).trim(),
    kind: fm.kind || 'Article',
    readTime: fm.read_time ? Number(fm.read_time) : null,
    author: fm.author || 'The Saros team',
    featured: fm.featured === true,
    draft: fm.draft === true,
    image: fm.image || '',
    imageAlt: fm.image_alt || '',
    seoTitle: adv.seo_title || String(fm.title),
    cardTitle: adv.card_title || String(fm.title),
    menuTitle: adv.menu_title || adv.card_title || String(fm.title),
    menuSubtitle: adv.menu_subtitle || String(fm.summary),
    legacyCardClass: adv.legacy_card_class || en?.fm?.advanced?.legacy_card_class || '',
    legacyHeroClass: adv.legacy_hero_class || en?.fm?.advanced?.legacy_hero_class || '',
    faq: Array.isArray(fm.faq) ? fm.faq.filter((q) => q && q.question && q.answer) : [],
    sources: Array.isArray(fm.sources) ? fm.sources.filter((s) => s && s.url && s.label) : [],
  };
}

const bgStyle = (img) => (img ? ` style="background-image:url('${esc(img)}')"` : '');

function renderArticle(p, T) {
  headingPrefix = `${p.lang === DEFAULT_LANG ? '' : p.lang + '-'}${p.slug}`;
  headingSeen = new Set();
  const bodyHtml = renderMarkdown(p.body);

  const toc = [...bodyHtml.matchAll(/<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => [m[1], stripTags(m[2])]);

  let faqHtml = '';
  if (p.faq.length) {
    const id = `${headingPrefix}-faq`;
    toc.push([id, T.faq]);
    const items = p.faq.map((q, i) => {
      const n = i + 1;
      const open = i === 0;
      return `<div class="qa" data-open="${open}"><button class="qa-h" aria-expanded="${open}" aria-controls="${id}-q${n}" id="${id}-qh${n}"><span class="ix">${String(n).padStart(2, '0')}.</span><span class="t">${marked.parseInline(String(q.question))}</span><span class="pm" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 1v14M1 8h14" stroke="currentColor" stroke-width="1.6" fill="none"/></svg></span></button><div class="qa-b" id="${id}-q${n}" role="region" aria-labelledby="${id}-qh${n}"><div>${marked.parse(String(q.answer), { async: false }).trim()}</div></div></div>`;
    });
    faqHtml = `<h2 id="${id}">${esc(T.faq)}</h2><div class="faqx">${items.join('')}</div>`;
  }

  let srcHtml = '';
  if (p.sources.length) {
    const id = `${headingPrefix}-sources`;
    toc.push([id, T.sources]);
    srcHtml = `<h2 id="${id}">${esc(T.sources)}</h2><div class="sources"><ul class="pg-list">${p.sources.map((s) => `<li><a href="${esc(s.url)}" rel="noopener" target="_blank">${esc(s.label)}</a></li>`).join('')}</ul></div>`;
  }

  const heroCls = p.legacyHeroClass || 'ah-bg';
  const heroCls2 = /(^| )ah-bg( |$)/.test(heroCls) ? heroCls : `ah-bg ${heroCls}`;
  const meta = `${esc(T.kinds[p.kind] || p.kind)}${p.readTime ? ` · ${p.readTime} ${T.minRead}` : ''}`;
  const topicName = T.topics[p.topicIdx];

  return `<div class="page" data-page="blog-${p.slug}" data-title="${esc(p.seoTitle)}" data-group="Blog" hidden>`
    + `<section class="art-hero s-dark"><div class="${esc(heroCls2)}" role="img" aria-label="${esc(p.imageAlt || p.title)}"${bgStyle(p.image)}></div>`
    + `<div class="wrap ah-in"><nav class="crumbs" aria-label="Breadcrumb"><a href="#home">${esc(T.home)}</a><i>/</i><a href="#blog">${esc(T.blog)}</a><i>/</i><span aria-current="page">${esc(p.menuTitle)}</span></nav>`
    + `<span class="bx-tag ah-tag">${esc(topicName)}</span><h1 class="xh-h1">${esc(p.title)}</h1>`
    + `<div class="ah-meta"><span class="ah-av" aria-hidden="true"></span><div><b>${esc(p.author)}</b><small>${meta}</small></div></div></div></section>`
    + `<section class="s-light xsec art-sec"><div class="wrap art"><aside class="toc"><span class="k">${esc(T.onThisPage)}</span><ol>`
    + toc.map(([id, t]) => `<li><a href="#" data-scroll="${id}">${t}</a></li>`).join('')
    + `</ol><div class="toc-share"><span class="k">${esc(T.share)}</span><button type="button" class="toc-copy" data-copy>${esc(T.copyLink)}</button></div></aside>`
    + `<article class="art-body">${bodyHtml}${faqHtml}${srcHtml}</article></div></section></div>`;
}

function card(p, T, { feat }) {
  const vis = `<div class="bx-vis${feat ? '' : ' sm'}${p.legacyCardClass ? ' ' + esc(p.legacyCardClass) : ''}" role="img" aria-label="${esc(p.imageAlt || p.title)}"${bgStyle(p.image)}></div>`;
  return `<a class="bx-art${feat ? ' bx-feat' : ''}" data-t="${p.topicIdx}" href="#blog-${p.slug}">${vis}<div class="bx-b"><span class="bx-tag">${esc(T.topics[p.topicIdx])}</span>${feat ? `<span class="bx-kick">${esc(T.featured)}</span>` : ''}<h3>${esc(p.cardTitle)}</h3><p>${esc(p.summary)}</p><span class="bx-go">${esc(T.readArticle)} <i aria-hidden="true">→</i></span></div></a>`;
}

function soonCard(idx, T) {
  return `<div class="bx-art bx-soon" data-t="${idx}"><div class="bx-vis soonv" aria-hidden="true"><div class="bx-ph"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="10"/></svg></div></div><div class="bx-b"><span class="bx-tag">${esc(T.topics[idx])}</span><span class="bx-kick">${esc(T.comingSoon)}</span><h3>${esc(T.inPrep)}</h3><p>${esc(T.soonText)}</p><a class="bx-go" href="#" data-scroll="blog-newsletter">${esc(T.getEmail)} <i aria-hidden="true">→</i></a></div></div>`;
}

function renderList(posts, T) {
  const feat = posts.find((p) => p.featured) || posts[0];
  const rest = posts.filter((p) => p !== feat);
  const soon = TOPICS.map((t, i) => (t.soon && !posts.some((p) => p.topicIdx === i) ? soonCard(i, T) : '')).join('');
  return `<div class="bx-list">${feat ? `<div class="bx-top">${card(feat, T, { feat: true })}</div>` : ''}<div class="bx-row">${rest.map((p) => card(p, T, { feat: false })).join('')}${soon}</div></div>`;
}

// ---------------------------------------------------------------- build
function loadCatalog(lang) {
  const f = path.join(ROOT, 'i18n', `${lang}.json`);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}

// Seletor de idioma (menu desktop, menu mobile e rodapé). Só linka idiomas que foram gerados.
function switcher(out, lang, available) {
  const T = STR[lang];
  const href = (l) => (l === DEFAULT_LANG ? '/' : `/${l}/`);
  const items = LANGS.map((l) => {
    const code = l.toUpperCase();
    if (l === lang) return `<li><a class="lang-i on" href="#" role="menuitem" aria-current="true" data-lang="${l}">${NATIVE[l]}<b>${code}</b></a></li>`;
    if (available.includes(l)) return `<li><a class="lang-i" href="${href(l)}" role="menuitem" lang="${HTML_LANG[l]}" hreflang="${HTML_LANG[l]}" data-lang="${l}">${NATIVE[l]}<b>${code}</b></a></li>`;
    return `<li><span class="lang-i off" role="menuitem" aria-disabled="true">${NATIVE[l]}<b>${code}</b><em>${esc(T.soonShort)}</em></span></li>`;
  }).join('');
  out = out.replace(/<ul class="lang-m" id="lang-m" role="menu" aria-label="[^"]*">[\s\S]*?<\/ul>/, `<ul class="lang-m" id="lang-m" role="menu" aria-label="${esc(T.chooseLanguage)}">${items}</ul>`);
  out = out.replace(/(<button class="lang-b"[^>]*aria-label=")[^"]*(")/, `$1${esc(T.language)}: ${NATIVE[lang]}$2`);
  out = out.replace(/(<button class="lang-b"[\s\S]*?<\/svg><span>)[A-Z]{2}(<\/span>)/, `$1${lang.toUpperCase()}$2`);
  const ov = LANGS.map((l) => {
    const code = l.toUpperCase();
    if (l === lang) return `<a class="on" href="#" aria-current="true">${code}</a>`;
    if (available.includes(l)) return `<a href="${href(l)}" lang="${HTML_LANG[l]}" hreflang="${HTML_LANG[l]}" data-lang="${l}">${code}</a>`;
    return `<span class="off" title="${NATIVE[l]} · ${esc(T.soonShort)}">${code}<em>${esc(T.soonShort)}</em></span>`;
  }).join('');
  out = out.replace(/(<div class="ov-lang" aria-label=")[^"]*("><span class="ov-lk">)[^<]*(<\/span>)[\s\S]*?(<\/div>)/, `$1${esc(T.language)}$2${esc(T.language)}$3${ov}$4`);
  out = out.replace(/<span><a href="#home" hreflang="en">EN<\/a>[\s\S]*?<\/span>/, `<span>${LANGS.map((l) => (available.includes(l) || l === lang ? `<a href="${l === lang ? '#home' : href(l)}" hreflang="${HTML_LANG[l]}"${l !== lang ? ` data-lang="${l}"` : ''}>${l.toUpperCase()}</a>` : l.toUpperCase())).join(' / ')}</span>`);
  // ao trocar de idioma, mantém a página (hash) em que a pessoa está
  out = out.replace('</body>', `<script>document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-lang]');if(!a||a.getAttribute('href')==='#')return;e.preventDefault();location.href=a.getAttribute('href')+location.hash;});</script></body>`);
  return out;
}

// Ferramentas embutidas (iframes srcdoc): formatação de números, datas e moeda por idioma.
// Os trechos são buscados na forma escapada em que estão no atributo srcdoc.
const attrEsc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const LOCALE = { es: 'es-ES', fr: 'fr-CA' };
function patchTools(html, lang) {
  const loc = LOCALE[lang];
  if (!loc) return html;
  const swap = (from, to, label) => {
    const f = attrEsc(from);
    if (!html.includes(f)) { console.warn(`aviso: trecho não encontrado nas ferramentas (${label}); a formatação em ${lang} pode ficar em estilo inglês.`); return; }
    html = html.split(f).join(attrEsc(to));
  };
  // $1.2M / $250K  ->  1,2 M$ / 250 k$ (espaço insécable), com separadores do idioma
  swap("const money = n => n >= 1e6 ? '$' + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : '$' + fmt(n / 1000) + 'K';",
    `const money = n => n >= 1e6 ? (n / 1e6).toLocaleString('${loc}', {minimumFractionDigits: n >= 1e7 ? 0 : 1, maximumFractionDigits: n >= 1e7 ? 0 : 1}) + '\u00a0M$' : fmt(n / 1000) + '\u00a0k$';`, 'moeda da calculadora');
  html = html.split(attrEsc("'en-US'")).join(attrEsc(`'${loc}'`));
  html = html.split("'en-US'").join(`'${loc}'`); // contadores da página principal
  html = html.split('&lt;html lang=&quot;en&quot;').join(`&lt;html lang=&quot;${HTML_LANG[lang]}&quot;`);
  return html;
}

function renderPage(tpl, lang, posts, catalog, available) {
  const T = STR[lang];
  const recent = posts.slice(0, MENU_MAX);
  const inLang = (p, html) => (p.lang === lang ? html : html);
  const parts = {
    '<!--@blog-pages-->': posts.map((p) => renderArticle(p, STR[p.lang])).join(''),
    '<!--@blog-list-->': renderList(posts, T),
    '<!--@blog-menu-->': recent.map((p, i) => `<li><a class="mm-i" style="--k:${4 + i}" href="#blog-${p.slug}"><b>${esc(p.menuTitle)}</b><span>${esc(p.menuSubtitle)}</span></a></li>`).join(''),
    '<!--@blog-overlay-->': recent.map((p) => `<li><a href="#blog-${p.slug}">${esc(p.menuTitle)}</a></li>`).join(''),
    '<!--@blog-sitemap-->': posts.map((p, i) => `<a class="sm-card rv" href="#blog-${p.slug}"><span class="sm-n">${11 + i} · /blog/${p.slug}</span><b>${esc(p.menuTitle)}</b><span class="sm-t">${esc(p.title)}</span><span class="sm-ph">P1</span></a>`).join(''),
  };
  let out = tpl;
  for (const [marker, html] of Object.entries(parts)) {
    if (!out.includes(marker)) throw new Error(`marcador ${marker} não encontrado em src/index.template.html`);
    out = out.split(marker).join(html);
  }
  if (lang !== DEFAULT_LANG) {
    out = out.replace('<html lang="en">', `<html lang="${HTML_LANG[lang]}">`);
    out = out.replace('<h2 class="h2 rv">Latest articles</h2>', `<h2 class="h2 rv">${esc(T.latest)}</h2>`);
    // botões de filtro do blog: mesmos data-t, rótulos traduzidos
    out = out.replace(/(<div class="filters bx-filters rv" id="blog-filters"[^>]*>)([\s\S]*?)(<\/div>)/, (m, a, inner, c) =>
      a + inner.replace(/(<button[^>]*data-t="([^"]+)"[^>]*>)([^<]*)(<\/button>)/g, (mm, o, t, label, cl) => o + esc(t === 'all' ? T.all : T.topics[Number(t)] ?? label) + cl) + c);
    out = patchTools(out, lang);
    if (catalog) out = translateHtml(out, catalog);
  }
  return switcher(out, lang, available);
}

function build() {
  const files = fs.existsSync(POSTS_DIR) ? fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md')).map((f) => path.join(POSTS_DIR, f)) : [];
  const recs = files.map(readRecord);
  const enBySlug = new Map(recs.filter((r) => r.lang === DEFAULT_LANG).map((r) => [r.slug, r]));
  const tpl = fs.readFileSync(path.join(ROOT, 'src/index.template.html'), 'utf8');

  // posts publicados por idioma
  const byLang = {};
  const skippedBy = {};
  for (const lang of LANGS) {
    const posts = [];
    skippedBy[lang] = 0;
    for (const r of recs.filter((x) => x.lang === lang)) {
      // tradução ainda em branco (o CMS pode criar o arquivo vazio): ignora sem erro
      if (lang !== DEFAULT_LANG && !(r.fm.title && r.fm.summary && r.body)) { skippedBy[lang]++; continue; }
      if (lang !== DEFAULT_LANG && !enBySlug.has(r.slug)) console.warn(`aviso: ${r.file} não tem a versão em inglês (${r.slug}.en.md); data e tópico precisam estar preenchidos nela.`);
      const p = toPost(r, enBySlug.get(r.slug));
      if (!p.draft) posts.push(p);
    }
    byLang[lang] = posts;
  }
  const catalogs = Object.fromEntries(LANGS.map((l) => [l, l === DEFAULT_LANG ? null : loadCatalog(l)]));
  // idiomas com página: inglês sempre; os outros se o site foi traduzido (catálogo) ou se há posts nele
  const available = LANGS.filter((l) => l === DEFAULT_LANG || catalogs[l] || byLang[l].length);

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const report = [];
  for (const lang of LANGS) {
    if (!available.includes(lang)) { report.push(`${lang}: sem tradução do site e sem posts, página não gerada`); continue; }
    // posts do idioma + posts em inglês que ainda não foram traduzidos para ele (aparecem em inglês)
    const have = new Set(byLang[lang].map((p) => p.slug));
    const posts = [...byLang[lang], ...(lang === DEFAULT_LANG ? [] : byLang[DEFAULT_LANG].filter((p) => !have.has(p.slug)))];
    posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));
    const out = renderPage(tpl, lang, posts, catalogs[lang], available);
    const dir = lang === DEFAULT_LANG ? OUT : path.join(OUT, lang);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), out);
    const feat = posts.find((x) => x.featured) || posts[0];
    const nTr = byLang[lang].length;
    report.push(`${lang}: ${posts.length} post(s)${lang !== DEFAULT_LANG ? ` (${nTr} traduzido(s), ${posts.length - nTr} em inglês)` : ''}${catalogs[lang] ? `, site traduzido (${Object.keys(catalogs[lang]).length} textos)` : ''} → ${lang === DEFAULT_LANG ? 'dist/index.html' : `dist/${lang}/index.html`}${skippedBy[lang] ? `, ${skippedBy[lang]} tradução(ões) em branco ignorada(s)` : ''}`);
    for (const p of posts) report.push(`    - ${p.date}  #blog-${p.slug}${p.lang !== lang ? `  [${p.lang}]` : ''}${p === feat ? '  (destaque)' : ''}`);
  }

  for (const dir of ['admin', 'uploads']) {
    if (fs.existsSync(path.join(ROOT, dir))) fs.cpSync(path.join(ROOT, dir), path.join(OUT, dir), { recursive: true });
  }
  if (fs.existsSync(path.join(ROOT, '.nojekyll'))) fs.copyFileSync(path.join(ROOT, '.nojekyll'), path.join(OUT, '.nojekyll'));
  console.log('build ok\n  ' + report.join('\n  '));
}

try {
  build();
} catch (e) {
  console.error('\nERRO NO BUILD: ' + e.message + '\n');
  process.exit(1);
}
