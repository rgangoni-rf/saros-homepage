# Saros Homepage v3

Site estático publicado no **Cloudflare Pages**.

## Como o site é montado
- `src/index.template.html`: o site inteiro, com marcadores `<!--@blog-...-->` onde entram os artigos, a listagem, os menus e o sitemap do blog.
- `content/blog/<slug>.<idioma>.md`: um arquivo por post e por idioma (en, pt, es, fr), com front matter YAML + corpo em Markdown. O inglês é obrigatório; os outros são opcionais.
- `build.mjs`: junta os dois e escreve `dist/index.html` (copia também `admin/`, `uploads/` e `deck/index.html`).
- `build-site.mjs` + `build_site.py`: pegam o `dist/` e geram `site/`, com uma URL por página (`/about`, `/plans`, `/blog/<slug>`, e o mesmo em `/pt/`, `/es/`, `/fr/`), `404.html` e `sitemap.xml`. Copiam também `site-static/` (favicons, imagens og, guides em PDF, `robots.txt`, `_redirects`) e `admin/`, `uploads/` e `deck/`. É o que vai ao ar.
- `admin/`: CMS (Sveltia) para a agência publicar posts em `/admin/`.

## Idiomas
O build gera `dist/index.html` (inglês) e, para cada idioma que tiver ao menos um post publicado, `dist/pt/`, `dist/es/` ou `dist/fr/`.
Nessas páginas o blog (artigos, listagem, filtros, menus) sai no idioma; o resto do site continua em inglês até ser traduzido.
Traduções em branco são ignoradas. Quando o resto do site estiver traduzido, o seletor de idioma só precisa apontar para `/pt/`, `/es/` e `/fr/`.

Rodar local: `npm install && npm run build:site` (precisa de Python 3) e abrir `site/index.html`. `npm run build` gera só o `dist/`, útil para conferir o conteúdo.

## Publicar um post (agência)
1. Abrir `https://<site>/admin/` e entrar com GitHub (conta com acesso de escrita a este repositório).
2. **Posts do blog → Novo Post**, preencher e desmarcar **Rascunho**.
3. **Publicar**. O CMS faz o commit; o Cloudflare publica em ~1 min.

## Editar o site (resto das páginas)
Edite `src/index.template.html`, commit e push na `main`.

## Cloudflare Pages
Build command: `npm run build:site` · Deploy command: `npx wrangler deploy` (publica a pasta `site/`, definida em `wrangler.jsonc`) · Node 22 (arquivo `.node-version`, já incluído) · Python 3 disponível no build (se faltar, definir `PYTHON_VERSION=3.12`).
A pasta `site/` não vai para o git (está no `.gitignore`): ela é gerada no build.

## Ao mudar tópicos ou campos do blog
Mantenha `TOPICS` em `build.mjs`, as opções de `topic` em `admin/config.yml` e os botões de `#blog-filters` em `src/index.template.html` iguais.
