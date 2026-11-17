# Tradução do site (PT-BR, ES-ES e FR-CA)

O site é escrito em inglês em `src/index.template.html`. O build gera uma versão por idioma:
`dist/index.html` (EN), `dist/pt/` (português do Brasil, `pt-BR`), `dist/es/` (espanhol da Espanha, `es-ES`) e `dist/fr/` (francês canadense, `fr-CA`).

- **Catálogos:** `i18n/pt.json`, `i18n/es.json` e `i18n/fr.json`. Chave = texto em inglês exatamente como está no HTML; valor = tradução.
  Textos sem entrada ficam em inglês. Pode editar os catálogos à mão para corrigir uma tradução.
- **Como funciona:** `i18n/translate.mjs` troca só os textos (e atributos como `aria-label`) no HTML, sem tocar no resto.
  Também traduz os textos das ferramentas embutidas (Health Check, calculadora, formulários) e de strings dentro de JavaScript.
- **Guia e glossário dos tradutores:** `i18n/GUIDE.md` (tú no ES-ES, vous no FR-CA, termos fixos, formatação de números).
- **Formatação de números e moeda** das ferramentas por idioma: `patchTools` em `build.mjs`.

## Mudou algum texto em inglês?
1. `npm run i18n:check` lista o que ficou sem tradução.
2. Traduza os textos listados e acrescente-os em `i18n/pt.json`, `i18n/es.json` e `i18n/fr.json` (mantenha tags HTML e entidades iguais ao original; regras no GUIDE).
3. `npm run build` e confira `dist/es/` e `dist/fr/`.

Texto fixo que o build gera sozinho (blog: listagem, sumário, FAQ, filtros) fica em `STR` no `build.mjs`.
Os artigos do blog traduzem-se por post (`content/blog/<slug>.pt.md`, `.es.md`, `.fr.md`), pelo CMS.
