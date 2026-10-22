# IRON AI — histórico do desenvolvimento do site

Documento único de referência. Fonte: este arquivo no repositório `diegoterrani/iron-ai-site`
(pasta `.loop/`, que **não** vai para a Vercel — ver `.vercelignore`). As cópias no Projeto do Claude
e na pasta local devem ser geradas a partir dele.

> **Aviso de fidelidade.** Esta é uma reconstrução, não a transcrição literal do chat. A conversa foi
> compactada pelo sistema por excesso de contexto; o texto original das mensagens anteriores não
> existe mais no disco. O que está aqui vem do resumo da compactação, dos arquivos `.loop/` e do
> histórico do Git (60 commits, datas reais). O raciocínio detalhado de cada rodada dos críticos
> está em `progresso.md`.

## 1. Contexto

- **Cliente:** Terrani, CEO e fundador da IRON Security. A IRON AI é o spin-off de adoção de IA para empresas brasileiras.
- **Site:** estático (HTML/CSS/JS, sem build) no projeto Vercel `iron-ai`. Produção = branch `main`. Domínios: `iron-ai.io` e `iron-ai-beryl.vercel.app`. O site tem `X-Robots-Tag: noindex`.
- **Design system:** IRON AI (creme/argila, cantos retos, sem sombras; Source Serif 4 + Manrope + IBM Plex Mono). Regras em `design-system.md`.
- **Método:** `/loop-de-design` — um construtor e três críticos independentes por rodada (briefing, sistema, visual contra a referência anthropic.com). Todos precisam aprovar. Barra de qualidade em `bar.md` (10 mecanismos). Copy com `/landing-page-copywriter`.

## 2. Pedido original (20/10, 19:09)

Analisar `https://iron-ai-beryl.vercel.app/` e a proposta de serviço, melhorar a escrita e completar o desenvolvimento do site.

### Decisões do cliente
| Tema | Decisão |
| --- | --- |
| Logo | Manter o logo SVG (símbolo + wordmark) |
| Formulário de contato | Função serverless na Vercel + Cloudflare Turnstile + e-mail via Resend |
| Referência visual | anthropic.com (+ claude.com/contact-sales) |
| Deploy | Branch + preview primeiro; produção depois |
| Preços | Remover todos (valores, "gratuito", R$). Texto comercial: falar com a equipe IRON AI e agendar reunião |
| Promessa numérica | "Retorno mínimo de 3× em 12 meses" → "Retorno acompanhado no DRE" |
| Esteira e Casos de uso | Proposta aprovada em 21/10; construir com animação e scroll interativo e publicar em produção direto |

## 3. Linha do tempo

| Data | Marco | Commits |
| --- | --- | --- |
| 18/10 | Home: P1 fechada; zoom, esteira, manifesto e casos (rodadas 23–32) | c5e2bfe … d9d0998 |
| 20/10 manhã | Novo logo SVG (IRON preto, AI argila) | 613dae6, 11e4f4f |
| 20/10 tarde | **Parte D — contato:** página, política de privacidade, `/api/contato` com Turnstile + Resend, 61 testes + e2e. 8 rodadas até aprovar | d6fe603 … e83a888 |
| 20/10 20:07 | **Sem preços** no site | 13430d2 |
| 20/10 20:27 | Publicação em produção (pedido do cliente) | 01bde0d |
| 21/10 08:35 | Cliente pede proposta para Esteira e Casos de uso, sem publicar | — |
| 21/10 09:39 | Proposta aprovada; construir (`proposta-esteira-casos.md`) | 8ebbb85 |
| 21/10 09:53–13:17 | **Partes B e C:** `esteira.html` e `casos-de-uso.html` com palco fixo e scroll interativo, 12 rodadas cada | 01234bd … f6277b8 |
| 21/10 ~11:06 | Publicação a pedido do cliente antes de todos os críticos aprovarem (5f8a991), informada na época | 5f8a991 |
| 21/10 14:04 | Os três críticos aprovam as duas páginas; versão final em produção | 8352eee |

## 4. Estado atual (22/10)

| Parte | Estado |
| --- | --- |
| A. Home (texto revisto, prova, FAQ, CTA final, rodapé) | **Não iniciada** |
| B. `esteira.html` | Aprovada (R12), em produção |
| C. `casos-de-uso.html` | Aprovada (R12), em produção |
| D. `contato.html` + `/api/contato` | Aprovada (R8), em produção; **não envia** até as variáveis serem configuradas |

Produção: commit `8352eee`, deployment `dpl_AT3p7o9R6ouh243zfNGiFhvY9r89` (READY).

## 5. Lições do loop (erros que viraram regra)

- Todo estado de página precisa funcionar **sem JS, no celular e com movimento reduzido**.
- Não usar `inert` no palco: tirava o acesso por Tab e por leitor de tela. O foco leva ao painel dono.
- Cada etapa fixa ≥ 1,05× a altura da janela, para PageDown não pular etapas.
- `[hidden]` sempre vence (`display:none!important`), com teste e2e.
- Erro de envio fica junto do botão, com foco e próximo passo.
- Sem animações de entrada (violavam o DS); só camadas que cobrem e indicadores de progresso.
- Âncoras: só `scroll-padding-top`, sem margem dupla.
- Rodapé em `paper` para a faixa de CTA final se destacar.

## 6. Pendências

**Do cliente**
1. Chaves: Turnstile (site + secret) e Resend. Variáveis na Vercel: `CONTACT_TO`, `CONTACT_FROM`, `ALLOWED_ORIGINS`, `TURNSTILE_EXPECTED_HOSTNAME`. Depois, colocar o `data-sitekey` real em `contato.html` e fazer redeploy. (Credenciais nunca passam pelo Claude.)
2. Política de privacidade: razão social, CNPJ, endereço, DPO e e-mail de privacidade (5 marcadores `[a definir]`).
3. Decidir quando remover o `noindex`.
4. Confirmar frases de FAQ fora da proposta aprovada ("a análise roda no seu próprio ambiente", "integração") e o enriquecimento (FAQ "Funciona com o meu ERP?", "Cinco etapas, cinco entregas.").
5. A proposta de serviço (pasta `E:\IDEIA\...`) nunca pôde ser lida.

**Do desenvolvimento**
- Parte A, home: reescrever o texto; incluir prova, FAQ, CTA final e rodapé; resolver o CTA duplicado no celular com o menu aberto e o "Ver a esteira" encostado na camada do zoom; achar a fonte do "3×" removido ou manter sem número.
- Limites conhecidos: com movimento reduzido em desktop alto, PageDown pode saltar o marcador ativo; no celular, cartões de setor/etapa são mais altos que a tela; a faixa de CTA tem cor parecida com as outras faixas alternadas.

## 7. Mapa dos arquivos

- Páginas: `index.html`, `esteira.html`, `casos-de-uso.html`, `contato.html`, `politica-de-privacidade.html`
- CSS: `tokens.css`, `css/site.css`, `css/esteira.css`, `css/casos.css`
- JS: `js/home.js`, `js/p2.js`, `js/visuals.js`, `js/esteira.js`, `js/casos.js`, `js/contato.js`
- Backend: `api/contato.js`, `api/_lib/contato-core.js`; testes em `tests/` (`npm run test:e2e`)
- Segurança: CSP estrita, HSTS, honeypot, checagem de origem, Turnstile no servidor, sem dados pessoais em logs, consentimento LGPD
- Processo: `.loop/bar.md`, `progresso.md`, `design-system.md`, `proposta-esteira-casos.md`, este arquivo

## 8. Histórico de commits (resumo)

Ver `git log --reverse` — 60 commits, de 18/10 15:26 (`c5e2bfe`) a 21/10 14:04 (`8352eee`).
