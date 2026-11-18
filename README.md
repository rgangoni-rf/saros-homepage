# Saros Homepage v3

Site estático publicado no **Cloudflare Pages**.

## Como o site é montado
- `src/index.template.html`: o site inteiro, com marcadores `<!--@blog-...-->` onde entram os artigos, a listagem, os menus e o sitemap do blog.
- `content/blog/<slug>.<idioma>.md`: um arquivo por post e por idioma (en, pt, es, fr), com front matter YAML + corpo em Markdown. O inglês é obrigatório; os outros são opcionais.
- `build.mjs`: junta os dois e escreve `dist/index.html` (copia também `admin/` e `uploads/`).
- `admin/`: CMS (Sveltia) para a agência publicar posts em `/admin/`.

## Idiomas
O build gera `dist/index.html` (inglês) e, para cada idioma que tiver ao menos um post publicado, `dist/pt/`, `dist/es/` ou `dist/fr/`.
Nessas páginas o blog (artigos, listagem, filtros, menus) sai no idioma; o resto do site continua em inglês até ser traduzido.
Traduções em branco são ignoradas. Quando o resto do site estiver traduzido, o seletor de idioma só precisa apontar para `/pt/`, `/es/` e `/fr/`.

Rodar local: `npm install && npm run build` e abrir `dist/index.html`.

## Publicar um post (agência)
1. Abrir `https://<site>/admin/` e entrar com GitHub (conta com acesso de escrita a este repositório).
2. **Posts do blog → Novo Post**, preencher e desmarcar **Rascunho**.
3. **Publicar**. O CMS faz o commit; o Cloudflare publica em ~1 min.

## Editar o site (resto das páginas)
Edite `src/index.template.html`, commit e push na `main`.

## Cloudflare Pages
Build command: `npm run build` · Build output directory: `dist` · Variável `NODE_VERSION=22` (ou o arquivo `.node-version`, já incluído).

## Ao mudar tópicos ou campos do blog
Mantenha `TOPICS` em `build.mjs`, as opções de `topic` em `admin/config.yml` e os botões de `#blog-filters` em `src/index.template.html` iguais.
