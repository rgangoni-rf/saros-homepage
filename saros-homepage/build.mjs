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
function parsePost(file) {
  const slug = path.basename(file, '.md');
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) fail(file, 'front matter ausente (o arquivo precisa começar com --- ... ---)');
  const fm = YAML.parse(m[1]) || {};
  const body = m[2].trim();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) fail(file, `nome de arquivo inválido "${slug}" (use só minúsculas, números e hífens)`);
  for (const k of ['title', 'date', 'topic', 'summary']) if (!fm[k]) fail(file, `campo obrigatório ausente: ${k}`);
  const topicIdx = TOPICS.findIndex((t) => t.name === fm.topic);
  if (topicIdx < 0) fail(file, `topic "${fm.topic}" não existe. Opções: ${TOPICS.map((t) => t.name).join(' | ')}`);
  if (!body) fail(file, 'corpo vazio');
  const date = fm.date instanceof Date ? fm.date.toISOString().slice(0, 10) : String(fm.date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(file, `data inválida: ${fm.date}`);
  const adv = fm.advanced || {};
  return {
    slug, file, topicIdx, date, body,
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
    legacyCardClass: adv.legacy_card_class || '',
    legacyHeroClass: adv.legacy_hero_class || '',
    faq: Array.isArray(fm.faq) ? fm.faq.filter((q) => q && q.question && q.answer) : [],
    sources: Array.isArray(fm.sources) ? fm.sources.filter((s) => s && s.url && s.label) : [],
  };
}

const bgStyle = (img) => (img ? ` style="background-image:url('${esc(img)}')"` : '');

function renderArticle(p) {
  headingPrefix = p.slug;
  headingSeen = new Set();
  const bodyHtml = renderMarkdown(p.body);

  const toc = [...bodyHtml.matchAll(/<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => [m[1], stripTags(m[2])]);

  let faqHtml = '';
  if (p.faq.length) {
    const id = `${p.slug}-faq`;
    toc.push([id, 'Frequently asked questions']);
    const items = p.faq.map((q, i) => {
      const n = i + 1;
      const open = i === 0;
      return `<div class="qa" data-open="${open}"><button class="qa-h" aria-expanded="${open}" aria-controls="${id}-q${n}" id="${id}-qh${n}"><span class="ix">${String(n).padStart(2, '0')}.</span><span class="t">${marked.parseInline(String(q.question))}</span><span class="pm" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 1v14M1 8h14" stroke="currentColor" stroke-width="1.6" fill="none"/></svg></span></button><div class="qa-b" id="${id}-q${n}" role="region" aria-labelledby="${id}-qh${n}"><div>${marked.parse(String(q.answer), { async: false }).trim()}</div></div></div>`;
    });
    faqHtml = `<h2 id="${id}">Frequently asked questions</h2><div class="faqx">${items.join('')}</div>`;
  }

  let srcHtml = '';
  if (p.sources.length) {
    const id = `${p.slug}-sources`;
    toc.push([id, 'Sources']);
    srcHtml = `<h2 id="${id}">Sources</h2><div class="sources"><ul class="pg-list">${p.sources.map((s) => `<li><a href="${esc(s.url)}" rel="noopener" target="_blank">${esc(s.label)}</a></li>`).join('')}</ul></div>`;
  }

  const heroCls = p.legacyHeroClass || 'ah-bg';
  const heroCls2 = /(^| )ah-bg( |$)/.test(heroCls) ? heroCls : `ah-bg ${heroCls}`;
  const meta = `${esc(p.kind)}${p.readTime ? ` · ${p.readTime} min read` : ''}`;

  return `<div class="page" data-page="blog-${p.slug}" data-title="${esc(p.seoTitle)}" data-group="Blog" hidden>`
    + `<section class="art-hero s-dark"><div class="${esc(heroCls2)}" role="img" aria-label="${esc(p.imageAlt || p.title)}"${bgStyle(p.image)}></div>`
    + `<div class="wrap ah-in"><nav class="crumbs" aria-label="Breadcrumb"><a href="#home">Home</a><i>/</i><a href="#blog">Blog</a><i>/</i><span aria-current="page">${esc(p.menuTitle)}</span></nav>`
    + `<span class="bx-tag ah-tag">${esc(p.topic)}</span><h1 class="xh-h1">${esc(p.title)}</h1>`
    + `<div class="ah-meta"><span class="ah-av" aria-hidden="true"></span><div><b>${esc(p.author)}</b><small>${meta}</small></div></div></div></section>`
    + `<section class="s-light xsec art-sec"><div class="wrap art"><aside class="toc"><span class="k">On this page</span><ol>`
    + toc.map(([id, t]) => `<li><a href="#" data-scroll="${id}">${t}</a></li>`).join('')
    + `</ol><div class="toc-share"><span class="k">Share</span><button type="button" class="toc-copy" data-copy>Copy link</button></div></aside>`
    + `<article class="art-body">${bodyHtml}${faqHtml}${srcHtml}</article></div></section></div>`;
}

function card(p, { feat }) {
  const vis = `<div class="bx-vis${feat ? '' : ' sm'}${p.legacyCardClass ? ' ' + esc(p.legacyCardClass) : ''}" role="img" aria-label="${esc(p.imageAlt || p.title)}"${bgStyle(p.image)}></div>`;
  return `<a class="bx-art${feat ? ' bx-feat' : ''}" data-t="${p.topicIdx}" href="#blog-${p.slug}">${vis}<div class="bx-b"><span class="bx-tag">${esc(p.topic)}</span>${feat ? '<span class="bx-kick">Featured · Article</span>' : ''}<h3>${esc(p.cardTitle)}</h3><p>${esc(p.summary)}</p><span class="bx-go">Read the article <i aria-hidden="true">→</i></span></div></a>`;
}

function soonCard(idx) {
  return `<div class="bx-art bx-soon" data-t="${idx}"><div class="bx-vis soonv" aria-hidden="true"><div class="bx-ph"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="10"/></svg></div></div><div class="bx-b"><span class="bx-tag">${esc(TOPICS[idx].name)}</span><span class="bx-kick">Coming soon</span><h3>New article in preparation</h3><p>One email a month with the new articles and research.</p><a class="bx-go" href="#" data-scroll="blog-newsletter">Get it by email <i aria-hidden="true">→</i></a></div></div>`;
}

function renderList(posts) {
  const feat = posts.find((p) => p.featured) || posts[0];
  const rest = posts.filter((p) => p !== feat);
  const soon = TOPICS.map((t, i) => (t.soon && !posts.some((p) => p.topicIdx === i) ? soonCard(i) : '')).join('');
  return `<div class="bx-list">${feat ? `<div class="bx-top">${card(feat, { feat: true })}</div>` : ''}<div class="bx-row">${rest.map((p) => card(p, { feat: false })).join('')}${soon}</div></div>`;
}

// ---------------------------------------------------------------- build
function build() {
  const files = fs.existsSync(POSTS_DIR) ? fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md')).map((f) => path.join(POSTS_DIR, f)) : [];
  const all = files.map(parsePost);
  const drafts = all.filter((p) => p.draft);
  const posts = all.filter((p) => !p.draft).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));

  const tpl = fs.readFileSync(path.join(ROOT, 'src/index.template.html'), 'utf8');
  const recent = posts.slice(0, MENU_MAX);
  const parts = {
    '<!--@blog-pages-->': posts.map(renderArticle).join(''),
    '<!--@blog-list-->': renderList(posts),
    '<!--@blog-menu-->': recent.map((p, i) => `<li><a class="mm-i" style="--k:${4 + i}" href="#blog-${p.slug}"><b>${esc(p.menuTitle)}</b><span>${esc(p.menuSubtitle)}</span></a></li>`).join(''),
    '<!--@blog-overlay-->': recent.map((p) => `<li><a href="#blog-${p.slug}">${esc(p.menuTitle)}</a></li>`).join(''),
    '<!--@blog-sitemap-->': posts.map((p, i) => `<a class="sm-card rv" href="#blog-${p.slug}"><span class="sm-n">${11 + i} · /blog/${p.slug}</span><b>${esc(p.menuTitle)}</b><span class="sm-t">${esc(p.title)}</span><span class="sm-ph">P1</span></a>`).join(''),
  };
  let out = tpl;
  for (const [marker, html] of Object.entries(parts)) {
    if (!out.includes(marker)) throw new Error(`marcador ${marker} não encontrado em src/index.template.html`);
    out = out.split(marker).join(html);
  }

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'index.html'), out);
  for (const dir of ['admin', 'uploads']) {
    if (fs.existsSync(path.join(ROOT, dir))) fs.cpSync(path.join(ROOT, dir), path.join(OUT, dir), { recursive: true });
  }
  if (fs.existsSync(path.join(ROOT, '.nojekyll'))) fs.copyFileSync(path.join(ROOT, '.nojekyll'), path.join(OUT, '.nojekyll'));

  console.log(`build ok: ${posts.length} post(s) publicados${drafts.length ? `, ${drafts.length} rascunho(s) ignorado(s)` : ''} → dist/`);
  for (const p of posts) console.log(`  - ${p.date}  #blog-${p.slug}${p === (posts.find((x) => x.featured) || posts[0]) ? '  (destaque)' : ''}`);
}

try {
  build();
} catch (e) {
  console.error('\nERRO NO BUILD: ' + e.message + '\n');
  process.exit(1);
}
