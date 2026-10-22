# IRON AI — site

Site estático da IRON AI (spin-off de IA do Grupo IRON). HTML/CSS/JS sem build; GSAP + ScrollTrigger e Lenis vendorizados em `vendor/`, fontes self-hosted em `fonts/` (OFL).

- Deploy: Vercel (projeto `iron-ai`, time Iron Security), saída estática da raiz.
- Cabeçalhos de segurança em `vercel.json`: CSP restrita (`'self'` apenas), HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer/Permissions-Policy, COOP/CORP. `X-Robots-Tag: noindex` só em `/politica-de-privacidade.html` (até sair dos campos `[a definir]`), em `/api/` e em qualquer host que não seja `iron-ai.io` (ex.: `*.vercel.app`).
- SEO: `sitemap.xml` (só páginas indexáveis, URLs `https://iron-ai.io`), `robots.txt` apontando para ele e `<link rel="canonical">` em cada página. Ao criar ou alterar uma página, atualize o sitemap (`<lastmod>`); `npm test` confere a coerência (`tests/seo.test.mjs`).
- Em construção (loop de design): home P1 (topo) fechado, P2 (pilares, esteira, zoom, casos) em correção; P3 e páginas internas pendentes.

## Google Ads e cookies (`js/consent.js`)

Tag do Google Ads `AW-18531760156`, carregada só depois do "Aceitar" no aviso de cookies (LGPD; Consent Mode v2 com tudo negado por padrão e só publicidade concedida no aceite, sem Analytics). Antes do aceite nenhuma requisição vai ao Google. A escolha fica em `localStorage` (`iron-consent`) por 12 meses; "Preferências de cookies" (rodapé e política) reabre o aviso, e Recusar apaga os cookies `_gcl_*`.

- Conversão do formulário: preencha `CONVERSIONS.contato` em `js/consent.js` com o rótulo da ação de conversão (a parte depois de `AW-18531760156/` no `send_to`). Vazio = desligado. `js/contato.js` chama `IronConsent.conversion('contato')` só no envio bem-sucedido, sem dados do formulário.
- CSP: os hosts do Google Ads (lista da documentação do Google) estão no `vercel.json` **e** na `<meta http-equiv>` de cada página; o navegador aplica as duas. `npm test` (`tests/consent.test.mjs`) confere a coerência.
- Teste de navegador: `NODE_PATH="$(npm root -g)" npm run test:e2e:consent` (sobe o próprio servidor com os cabeçalhos do `vercel.json` e simula o Google).

## Formulário de contato (`/api/contato`)

`contato.html` envia JSON para a função serverless `api/contato.js` (Node 20, sem dependências), que valida os campos, confere o Cloudflare Turnstile no servidor e envia o pedido por e-mail via Resend. A lógica pura fica em `api/_lib/contato-core.js`; testes com `npm test` (`node --test`).

Configure na Vercel (Project > Settings > Environment Variables, ambientes Production e Preview). Nomes em `.env.example`:

| Variável | Obrigatória | Conteúdo |
| --- | --- | --- |
| `ALLOWED_ORIGINS` | sim | Origens aceitas, separadas por vírgula (ex.: o domínio de produção e o de preview). |
| `TURNSTILE_SECRET_KEY` | sim | Secret key do widget Turnstile. |
| `TURNSTILE_EXPECTED_HOSTNAME` | não | Se definida, o hostname devolvido pelo Turnstile precisa ser igual. |
| `RESEND_API_KEY` | sim | Chave da API do Resend (só permissão de envio). |
| `CONTACT_FROM` | sim | Remetente em domínio verificado no Resend (ex.: `IRON AI <site@dominio>`). |
| `CONTACT_TO` | sim | Destinatário(s), separados por vírgula. |

Teste de navegador do formulário (fora do `npm test`): com o site servido em `http://localhost:8765` (ou `E2E_BASE_URL`), rode `NODE_PATH="$(npm root -g)" npm run test:e2e`. Precisa do Playwright com o Chromium (`npm i -g playwright && npx playwright install chromium`). O script simula `/api/contato` (200 e 500) e o Turnstile.

Em `contato.html`, troque `data-sitekey` (hoje a chave de teste `1x00000000000000000000AA`) pela site key do widget de produção. Se faltar alguma variável obrigatória, a função responde 500 e registra `config_missing` com o nome da variável (nunca o valor).

A CSP de `/contato.html` é a única que libera `https://challenges.cloudflare.com` (script e iframe do Turnstile); a regra global de `vercel.json` exclui essa página para as duas políticas não se somarem.
