# Login do CMS (Cloudflare Access + Worker)

A agência entra em `/admin` por e-mail (código de 6 dígitos ou Google/Microsoft), sem conta GitHub.
O Worker guarda o token do GitHub e só o entrega a quem passou pelo Access.

## Configuração (uma vez)
1. **Token do GitHub:** github.com → Settings → Developer settings → Fine-grained tokens. Só o repositório
   `rgangoni-rf/saros-homepage`, permissão *Contents: Read and write*. Validade máxima: 1 ano (anote para renovar).
2. **Publicar o Worker** (na raiz do repositório):
   ```
   npx wrangler login
   npx wrangler deploy --config auth-worker/wrangler.jsonc
   npx wrangler secret put GITHUB_TOKEN --config auth-worker/wrangler.jsonc   # cole o token
   ```
   O deploy mostra a URL `https://saros-cms-auth.<subdominio>.workers.dev`.
3. **Ligar o Access nesse Worker:** dash.cloudflare.com → Workers & Pages → `saros-cms-auth` → Settings →
   Domains & Routes → workers.dev → **Enable Cloudflare Access** → *Manage Cloudflare Access*.
   Crie a política *Allow* com os e-mails da agência (método: One-time PIN). Copie o **Application Audience (AUD) Tag**
   e o domínio da equipe (`<equipe>.cloudflareaccess.com`).
4. **Preencher** `auth-worker/wrangler.jsonc`: `ALLOWED_ORIGIN` (endereço do site, sem barra final),
   `TEAM_DOMAIN`, `POLICY_AUD`. Depois rode o deploy do passo 2 de novo.
5. **Ligar no CMS:** em `admin/config.yml`, descomente `base_url` com a URL do Worker. Commit e push.

## Uso
Em `/admin/` → *Entrar com GitHub* → informar o e-mail → colocar o código recebido. Para tirar o acesso de alguém,
remova o e-mail da política no Access. Os commits saem em nome do dono do token.

Sem JWT válido do Access, o Worker não entrega nada (falha fechada).
