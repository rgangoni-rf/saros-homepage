// Worker de login do CMS (/admin).
//
// Fluxo: o CMS abre uma janela em  <este worker>/auth. O Cloudflare Access (ligado na
// workers.dev deste Worker) pede o e-mail da pessoa e só deixa passar quem está na lista.
// Quando passa, este Worker confere o JWT do Access e entrega ao CMS o token do GitHub
// que está guardado como secret (GITHUB_TOKEN). A agência nunca vê o token.
//
// Falha sempre fechado: sem JWT válido, sem TEAM_DOMAIN/POLICY_AUD ou sem GITHUB_TOKEN, não entrega nada.

const b64urlToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const b64urlToJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

async function verifyAccessJwt(jwt, env) {
  const [h, p, sig] = jwt.split('.');
  if (!h || !p || !sig) throw new Error('jwt malformado');
  const header = b64urlToJson(h);
  const payload = b64urlToJson(p);
  if (header.alg !== 'RS256') throw new Error('alg inesperado');

  const certsUrl = `https://${env.TEAM_DOMAIN}/cdn-cgi/access/certs`;
  const certs = await (await fetch(certsUrl, { cf: { cacheTtl: 300, cacheEverything: true } })).json();
  const jwk = (certs.keys || []).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('chave do Access não encontrada');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(sig), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new Error('assinatura inválida');

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) throw new Error('jwt expirado');
  if (payload.iss !== `https://${env.TEAM_DOMAIN}`) throw new Error('issuer inesperado');
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(env.POLICY_AUD)) throw new Error('aud inesperado');
  return payload;
}

const page = (body, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
const msg = (t, status) => page(`<!doctype html><meta charset="utf-8"><title>Login do CMS</title><body style="font:16px system-ui;padding:2rem"><p>${t}</p>`, status);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/auth') return msg('Login do CMS da Saros. Use o painel em /admin.', 404);

    if (!env.TEAM_DOMAIN || !env.POLICY_AUD || !env.GITHUB_TOKEN || !env.ALLOWED_ORIGIN) {
      const faltando = ['TEAM_DOMAIN', 'POLICY_AUD', 'GITHUB_TOKEN', 'ALLOWED_ORIGIN'].filter((k) => !env[k]);
      console.error('config ausente:', faltando.join(', '));
      return msg('Login não configurado. Avise quem administra o site.', 503);
    }
    const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!jwt) { console.error('sem header Cf-Access-Jwt-Assertion'); return msg('Acesso negado.', 401); }
    let who;
    try {
      who = await verifyAccessJwt(jwt, env);
    } catch (e) {
      console.error('jwt recusado:', e.message);
      return msg('Acesso negado.', 403);
    }

    // Protocolo do Sveltia/Decap: avisa a janela que abriu, espera o eco e responde com o token.
    const origin = JSON.stringify(env.ALLOWED_ORIGIN);
    const content = JSON.stringify({ token: env.GITHUB_TOKEN, provider: 'github' });
    return page(`<!doctype html><meta charset="utf-8"><title>Entrando…</title><body style="font:16px system-ui;padding:2rem"><p>Entrando no painel…</p><script>
(function(){
  var allowed=${origin}, payload=${JSON.stringify('authorization:github:success:')}+${JSON.stringify(content)};
  window.addEventListener('message',function(e){
    if(e.origin!==allowed) return;
    window.opener.postMessage(payload,e.origin);
    window.close();
  });
  if(window.opener) window.opener.postMessage('authorizing:github',allowed);
})();
</script>`);
  },
};
