#!/usr/bin/env python3
"""Split the Saros single-file site into one HTML file per page (one URL per page).

Usage:  python3 build_site.py SOURCE.html OUT_DIR [--lang en|pt|es|fr] [--langs en,pt,es,fr]

- SOURCE.html : the full site exported from the artifact (all pages in one file, #hash routing)
- OUT_DIR     : folder to upload to Cloudflare Pages (for pt/es/fr, files go into OUT_DIR/<lang>/)
- --lang      : language of SOURCE (default en). English lives at the root; other languages under /pt/, /es/, /fr/.
- --langs     : languages that exist on the site, used for hreflang tags (default: en only)
"""
import sys, re, os, json, html as H, argparse

BASE = 'https://sarosops.com'
PATHS = {
 'home':'/', 'platform':'/platform', 'platform-training-intake':'/platform/training-intake',
 'platform-project-pipeline':'/platform/project-pipeline', 'platform-content-production':'/platform/content-production',
 'platform-learning-paths':'/platform/learning-paths', 'platform-learning-analytics':'/platform/learning-analytics',
 'platform-flux-ai-assistant':'/platform/flux-ai-assistant', 'platform-role-portals':'/platform/role-portals',
 'solutions':'/solutions', 'solutions-learning-operations-teams':'/solutions/learning-operations-teams',
 'solutions-chief-learning-officers':'/solutions/chief-learning-officers', 'solutions-hr-leaders':'/solutions/hr-leaders',
 'solutions-frontline-training':'/solutions/frontline-training', 'solutions-distributed-ld-teams':'/solutions/distributed-ld-teams',
 'solutions-instructional-design-services':'/solutions/instructional-design-services',
 'pricing':'/plans', 'demo':'/demo', 'security':'/security', 'integrations':'/integrations', 'implementation':'/implementation',
 'about':'/about', 'resources':'/resources', 'health-check':'/health-check',
 'tools-coordination-cost-calculator':'/tools/coordination-cost-calculator',
 'templates-training-intake-form':'/templates/training-intake-form',
 'blog':'/blog', 'blog-what-is-learning-operations':'/blog/what-is-learning-operations',
 'blog-training-intake-form-template-questions':'/blog/training-intake-form-template-questions',
 'blog-instructional-design-models':'/blog/instructional-design-models',
 'blog-measuring-training-impact':'/blog/measuring-training-impact',
 'sitemap':'/site-pages',
}
NOINDEX = {'sitemap'}
HOME_TITLE = {'en':'Saros: the learning operations platform for L&D teams'}
HOME_DESC = {'en':'Saros is the learning operations platform for L&D: guided training intake, a project pipeline, AI content production and analytics tied to the KPI.'}
OG_IMG = {'blog-what-is-learning-operations':'/og/blog-what-is-learning-operations.png',
          'blog-training-intake-form-template-questions':'/og/blog-training-intake-form-template-questions.png',
          'blog-instructional-design-models':'/og/blog-instructional-design-models.png',
          'blog-measuring-training-impact':'/og/blog-measuring-training-impact.png'}

ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('out')
ap.add_argument('--lang', default='en'); ap.add_argument('--langs', default='en')
a = ap.parse_args()
LANG = a.lang; LANGS = [l.strip() for l in a.langs.split(',') if l.strip()]
PRE = '' if LANG == 'en' else '/' + LANG
def url(pid, lang=None):
    lang = LANG if lang is None else lang
    pre = '' if lang == 'en' else '/' + lang
    p = PATHS[pid]
    return BASE + pre + (p if p != '/' else '/')
def lpath(pid):  # site-relative link in this language
    p = PATHS[pid]; return (PRE + p) if p != '/' else (PRE + '/')

src = open(a.src, encoding='utf-8').read()
# keep iframe documents untouched while editing the outer page
frames = []
def stash(m): frames.append(m.group(0)); return f'srcdoc="@@FRAME{len(frames)-1}@@"'
s = re.sub(r'srcdoc="[^"]*"', stash, src)

# 1. one clean document: drop the nested wrappers
for pat in [r'<!doctype html>', r'<html[^>]*>', r'</html>', r'<head>', r'</head>', r'<body[^>]*>', r'</body>']:
    s = re.sub(pat, '', s, flags=re.I)
s = re.sub(r'<title>.*?</title>', '', s, flags=re.S)
s = re.sub(r'<meta name="description"[^>]*>', '', s)
s = re.sub(r'<meta charset[^>]*>', '', s, flags=re.I)
s = re.sub(r'<meta name=["]?viewport["]?[^>]*>', '', s)

# page spans and element ids -> page
spans = [(m.start(), m.group(1)) for m in re.finditer(r'<div class="page" data-page="([^"]+)"', s)]
def page_at(i):
    n = None
    for st, name in spans:
        if st <= i: n = name
    return n
idpage = {}
for m in re.finditer(r'\sid="([^"]+)"', s):
    idpage.setdefault(m.group(1), page_at(m.start()))
known = set(PATHS)

# 2. links: #page -> /path ; #anchor in another page -> /path#anchor
def fix_href(m):
    hid = m.group(1); here = page_at(m.start())
    if hid in known: return f'href="{lpath(hid)}"'
    tp = idpage.get(hid)
    if tp and tp in known and tp != here: return f'href="{lpath(tp)}#{hid}"'
    return m.group(0)
s = re.sub(r'href="#([\w-]+)"', fix_href, s)
# links that open a page in a new tab no longer need to
s = re.sub(r'(href="/[^"]*") target="_blank" rel="noopener"', r'\1', s)

# 3. router: start on this file's page; intro only on the home page
s = s.replace("pages.find(p => p.dataset.page === (h || 'home'))", "pages.find(p => p.dataset.page === (h || document.documentElement.dataset.start || 'home'))")
assert 'document.documentElement.dataset.start' in s, 'router pattern not found'
s = s.replace("if(location.hash&&!/^#(home|top)?$/.test(location.hash))return;", "if((document.documentElement.dataset.start||'home')!=='home')return;if(location.hash&&!/^#(home|top)?$/.test(location.hash))return;")

# 4. iframe documents: absolute links to the new paths
def fix_frame(f):
    f = re.sub(r'https://sarosops\.com/#([\w-]+)', lambda m: BASE + (lpath(m.group(1)) if m.group(1) in known else (lpath(idpage[m.group(1)]) + '#' + m.group(1) if idpage.get(m.group(1)) in known else PRE + '/#' + m.group(1))), f)
    return f
frames = [fix_frame(f) for f in frames]
def unstash(t): return re.sub(r'srcdoc="@@FRAME(\d+)@@"', lambda m: frames[int(m.group(1))], t)

# 5. per-page head
def text(x): return ' '.join(H.unescape(re.sub(r'<[^>]+>', ' ', x)).split())
def page_html(pid):
    i = [st for st, n in spans if n == pid][0]; nxt = [st for st, n in spans if st > i]
    return s[i:(nxt[0] if nxt else len(s))]
def describe(pid):
    if pid == 'home' and LANG in HOME_DESC: return HOME_DESC[LANG]
    ph = page_html(pid)
    m = re.search(r'<p class="xh-sub">(.*?)</p>', ph, re.S) or re.search(r'<p[^>]*>(.*?)</p>', ph, re.S)
    t = text(m.group(1)) if m else ''
    if len(t) <= 158: return t
    cut = t[:158]; dot = cut.rfind('. ')
    return cut[:dot+1] if dot > 80 else cut[:cut.rfind(' ')] + '…'
def title(pid):
    if pid == 'home' and LANG in HOME_TITLE: return HOME_TITLE[LANG]
    m = re.search(r'data-page="%s" data-title="([^"]*)"' % re.escape(pid), s)
    return ' '.join(H.unescape(m.group(1)).split()) if m else 'Saros'
def faq(pid):
    out = []
    for q in re.finditer(r'<button class="qa-h".*?<span class="t">(.*?)</span>.*?<div class="qa-b"[^>]*><div>(.*?)</div></div>', page_html(pid), re.S):
        qt, at = text(q.group(1)), text(q.group(2))
        if qt and at and '[' not in at:
            out.append({'@type':'Question','name':qt,'acceptedAnswer':{'@type':'Answer','text':at}})
    return out
ORG = {'@type':'Organization','name':'Saros','url':BASE+'/','logo':BASE+'/icon-512.png',
       'parentOrganization':{'@type':'Organization','name':'ReFrame Learning, LLC','url':'https://reframelearning.com'}}
def head(pid, noindex=False, ttl=None):
    t = ttl or title(pid); d = describe(pid); u = url(pid)
    img = BASE + OG_IMG.get(pid, '/og/saros.png')
    E = lambda x: H.escape(x, quote=True)
    h = ['<meta charset="utf-8">', '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
         f'<title>{E(t)}</title>', f'<meta name="description" content="{E(d)}">']
    if noindex: h.append('<meta name="robots" content="noindex">')
    else:
        h.append(f'<link rel="canonical" href="{u}">')
        if len(LANGS) > 1:
            for l in LANGS: h.append(f'<link rel="alternate" hreflang="{l}" href="{url(pid, l)}">')
            h.append(f'<link rel="alternate" hreflang="x-default" href="{url(pid, "en")}">')
    is_art = pid.startswith('blog-')
    h += [f'<meta property="og:type" content="{"article" if is_art else "website"}">', '<meta property="og:site_name" content="Saros">',
          f'<meta property="og:title" content="{E(t)}">', f'<meta property="og:description" content="{E(d)}">',
          f'<meta property="og:url" content="{u}">', f'<meta property="og:image" content="{img}">',
          '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">',
          '<meta name="twitter:card" content="summary_large_image">',
          '<link rel="icon" href="/favicon.svg" type="image/svg+xml">', '<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">',
          '<link rel="apple-touch-icon" href="/apple-touch-icon.png">', '<link rel="manifest" href="/site.webmanifest">']
    ld = []
    if pid == 'home':
        ld += [dict(ORG, **{'@context':'https://schema.org'}), {'@context':'https://schema.org','@type':'WebSite','name':'Saros','url':BASE+'/'}]
    if is_art:
        ld.append({'@context':'https://schema.org','@type':'Article','headline':t,'description':d,'image':img,'mainEntityOfPage':u,
                   'author':{'@type':'Organization','name':'ReFrame Learning'},'publisher':ORG})
    fq = faq(pid)
    if fq and not noindex: ld.append({'@context':'https://schema.org','@type':'FAQPage','mainEntity':fq})
    for j in ld: h.append('<script type="application/ld+json">' + json.dumps(j, ensure_ascii=False) + '</script>')
    return '\n'.join(h)

P_MAP = {k: lpath(k) for k in PATHS}
for aid in ('intake-express','intake-full-form'):
    if idpage.get(aid) in known: P_MAP[aid] = lpath(idpage[aid]) + '#' + aid
P_JS = json.dumps(P_MAP)
REDIRECT_JS = ('<script>window.__P=%s;(function(){var g=function(){var h=decodeURIComponent(location.hash.slice(1));'
               'if(h&&Object.prototype.hasOwnProperty.call(__P,h)){var t=__P[h];if(t.split("#")[0]!==location.pathname)location.replace(t);return true}};g();'
               'addEventListener("hashchange",g)})();</script>') % P_JS

TAG = re.compile(r'<div\b|</div>')
def page_end(st):
    d=0
    for t in TAG.finditer(s, st):
        d += 1 if t.group(0)!='</div>' else -1
        if d==0: return t.end()
    raise SystemExit('unbalanced page at %d' % st)
PAGE_RANGES = None
def _ranges():
    global PAGE_RANGES
    if PAGE_RANGES is None:
        PAGE_RANGES=[(m.start(), page_end(m.start()), m.group(1)) for m in re.finditer(r'<div class="page" data-page="([^"]+)"', s)]
    return PAGE_RANGES
def stripped_source(keep):
    out=[]; pos=0
    for a,b,n in _ranges():
        out.append(s[pos:a])
        if n==keep: out.append(s[a:b])
        else:
            css=''.join(re.findall(r'<style\b.*?</style>', s[a:b], flags=re.S))
            out.append('<div class="page" data-page="%s" hidden>%s</div>' % (n, css))
        pos=b
    out.append(s[pos:]); return ''.join(out)

def build(pid, noindex=False, ttl=None, start=None):
    start = start or pid
    body = stripped_source(start)
    # this page visible without JS, the others hidden
    body = re.sub(r'<div class="page" data-page="([^"]+)"([^>]*?)( hidden)?>',
                  lambda m: f'<div class="page" data-page="{m.group(1)}"{m.group(2)}{"" if m.group(1)==start else " hidden"}>', body)
    body = re.sub(r'(data-page="%s" data-title=")[^"]*"' % re.escape(start), lambda m: m.group(1) + H.escape(ttl or title(pid), quote=True) + '"', body)
    doc = (f'<!doctype html>\n<html lang="{LANG}" data-start="{start}">\n<head>\n{head(pid, noindex, ttl)}\n{REDIRECT_JS}\n</head>\n<body>\n'
           + unstash(body) + '\n</body>\n</html>\n')
    return doc

root = os.path.join(a.out, '' if LANG == 'en' else LANG)
os.makedirs(root, exist_ok=True)
pages_found = [n for _, n in spans]
missing = [p for p in pages_found if p not in PATHS]
if missing: print('WARNING pages without a path (skipped):', missing)
written = []
for pid in pages_found:
    if pid not in PATHS: continue
    p = PATHS[pid]
    fn = os.path.join(root, 'index.html' if p == '/' else p.lstrip('/') + '.html')
    os.makedirs(os.path.dirname(fn), exist_ok=True)
    open(fn, 'w', encoding='utf-8').write(build(pid, noindex=pid in NOINDEX))
    written.append(pid)
open(os.path.join(root, '404.html'), 'w', encoding='utf-8').write(build('home', noindex=True, ttl='Page not found | Saros'))
# sitemap.xml (one per language folder; the root one lists English)
urls = [pid for pid in written if pid not in NOINDEX]
xs = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
for pid in urls:
    xs.append(f'  <url><loc>{url(pid)}</loc>')
    if len(LANGS) > 1:
        for l in LANGS: xs.append(f'    <xhtml:link rel="alternate" hreflang="{l}" href="{url(pid, l)}"/>')
    xs.append('  </url>')
xs.append('</urlset>')
open(os.path.join(root, 'sitemap.xml'), 'w', encoding='utf-8').write('\n'.join(xs) + '\n')
print(f'{LANG}: {len(written)} pages + 404.html + sitemap.xml -> {root}')
