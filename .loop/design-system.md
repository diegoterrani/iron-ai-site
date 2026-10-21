IA aplicada à operação inteira, com segurança desde o desenho: clara, técnica, quadrada e minimalista, em creme e argila.

A IRON AI é a marca irmã da IRON Security. As duas compartilham a mesma estrutura: grade, componentes, ícones e regra do quadrado. O que muda é a luz e a cor. A IRON Security é escura e verde-musgo; a IRON AI é clara, em creme e argila. Quando as duas aparecem juntas (grupo IRON, co-branding), cada uma mantém o próprio tema: nunca misture argila em superfície escura nem verde em superfície clara.

> **Valores finais do site (20/10/2026).** Este sistema reproduz o que está publicado em iron-ai-beryl.vercel.app (rodada 32). A paleta creme e argila, com títulos em serifa e botão principal escuro, é decisão do cliente na rodada 27, em linguagem visual próxima à do Claude.ai. Não se usa logo, nome nem marca da Anthropic: só a linguagem visual. A versão lavanda de 18/10/2026 está substituída.

## Princípios

1. **Claro por padrão, um só tema.** O fundo é `paper` (#faf9f5), creme; seções alternam entre `paper` e `soft`. `band` (#f0eee6) marca a faixa de confiança e o CTA final. Não existe modo escuro na IRON AI.
2. **Quadrado, sem exceção.** `radius-none` em botões, cards, campos, chips e modais. `radius-full` só no ponto ao vivo: é sinal de atividade, não decoração.
3. **Bordas, não sombras.** Estrutura vem de hairlines `line` em grade (cards e estatísticas dividem bordas direita/inferior). Sombra só no modal (`shadow-modal`).
4. **Argila contida.** A interface é creme e quase preta. A argila (`accent`, `accent-text`, `link`) é o destaque do texto; os tons quentes `clay`, `kraft`, `manilla` e `oat` ficam só nas ilustrações. O botão principal é escuro (`cta-bg`). Nada de gradiente, neon ou cor saturada fora dos achados de risco.
5. **Precisão de terminal.** Rótulos, índices, tags e eyebrows em IBM Plex Mono maiúsculo com tracking largo. Títulos em Source Serif 4, peso 400; texto e interface em Manrope.
6. **Minimalismo.** Texto curto (título até 8 palavras, descrição de uma frase), uma informação em um só lugar, `icon-box` só nos três pilares, a ação principal uma vez por vista.

## Voz

- Português do Brasil. Fale com o dono, o CEO ou o board: linguagem de margem, operação e decisão, não de tecnologia.
- Frases curtas, promessa medida, nada de superlativo sem número: "Coloque a IA para trabalhar na sua margem.", "Do diagnóstico à operação."
- Títulos destacam **uma** expressão com `<em>` (h1) ou `<i>` (h2), em `accent`, sem itálico. Exceção: o texto que acende do manifesto não leva destaque em `accent`.
- Eyebrow de 1 a 4 palavras antes de todo título de seção.
- CTAs com verbo: "Agendar diagnóstico", "Ver a esteira". Links de texto terminam com o ícone `arrow`.
- Números só se forem regras da oferta ou resultados medidos e autorizados. Nunca invente estatística.
- Sem emoji. Segurança aparece como garantia ("segurança desde o desenho"), não como medo.

## Cor

| Papel | Token | Valor | Uso |
| --- | --- | --- | --- |
| Fundo da página | `paper` | #faf9f5 | body e seções `.white` |
| Fundo alternado | `soft` | #f0eee6 | seções `.soft` |
| Faixa da marca | `band` | #f0eee6 | trust strip e CTA final |
| Texto principal | `text` | #141413 | títulos e texto forte (17,5:1 sobre `paper`) |
| Texto de corpo | `muted` | #3d3d3a | parágrafos e descrições (10,3:1) |
| Legenda | `subtle` | #6b6a65 | rodapé, índices, metadados (5,1:1) |
| Texto apagado | `faint` | #8f8d86 | só o estado apagado do manifesto, em corpo grande (3,15:1) |
| Botão primário | `cta-bg` → `cta-hover` | #141413 → #3d3d3a | com `cta-text` #faf9f5 por cima (17,5:1) |
| Destaque grande | `accent` | #c6613f | `<em>`/`<i>` de títulos e números; só texto ≥ 24px (3,85:1) |
| Destaque pequeno | `accent-text`, `link`, `icon-ink` | #a5502f | eyebrows, tags, text-links, ícones e traços finos (5,26:1) |
| Foco | `focus` | #c6613f | anel sólido 2px, offset 2px; ≥ 3,5:1 em todo fundo do sistema |
| Ilustração | `clay`, `kraft`, `manilla`, `oat` | #d97757, #d4a27f, #ebdbbc, #e3dacc | só dentro de ilustrações |
| Erro | `danger`, `field-error` | #b42330 | mensagens e bordas de erro |
| Risco | `risk-*`, `risk-*-ink`, `*-bg` | | achados do assessment |

- **Contraste.** Texto pequeno ≥ 4,5:1. Texto grande (≥ 24px, ou ≥ 18,66px em negrito) ≥ 3:1: é o caso de `accent` (3,85:1) e de `faint`. Elementos não textuais ≥ 3:1.
- `acid` e `acid-hover` ficam como legado (igual a `manilla`); o botão primário não é mais `acid`.
- Bordas de controle (`field-line`, `button-dark-border`) têm ≥ 3:1. `line` e `icon-border` são decorativas.
- O ponto ao vivo (`live`, 2,96:1) sempre vem com legenda em texto.
- Achados de risco sempre levam rótulo e ícone: vermelho e verde se distinguem por matiz.
- `accent-text` sobre `surface-2` dá 4,43:1: não use ali em texto pequeno.

## Ilustração em código

Campos em `clay`, `kraft`, `manilla` e `oat`, com tons diferentes em painéis vizinhos. Figuras em `paper`, branco (`modal-bg`) ou `band`. Um único tom de destaque, `clay`, em detalhes pequenos (no máximo ~3% de um campo que não seja clay). Traços finos em `accent-text` e, sobre `clay`, em `text`. Pelo menos metade do campo fica vazia. Rótulos de até 3 palavras no estilo `tag`. Texto de interface nunca fica por cima de uma ilustração.

## Tipografia

- **Source Serif 4** (variável, OFL, arquivo em `fonts/`) nos títulos: h1, h2, manifesto, nome da etapa e números do StatGrid, peso 400, tracking −0,02em (h1 −0,025em), entrelinha 1–1,1. **Manrope** (400–800) no texto e na interface, incluindo `card-title` (700). **IBM Plex Mono** (400–600) nos rótulos técnicos; Manrope e Plex vêm do Google Fonts (`@import` em `components/bundle.css`).
- Escala: `hero` 92px (fluido 48→92) · `section-title` 61px (36→61) · `stat` 53px · `product-title` 30px · `card-title` 20px · `lead` 17px · `body` 15px · `body-sm` 14px · `ui` 13px · `label`/`eyebrow`/`tag`/`index` 12px.
- Corpo: entrelinha 1,7–1,75.
- Wordmark (`brand`): "IRON" 500 + "AI" 800, 14px, tracking 0,1em, em Manrope.

## Espaço e grid

- Container `page-max` 1240px: `min(1240px, 100vw − 48px)`. Seções com `space-8` (120px) vertical e `max(6vw, 50vw − 620px)` lateral; no mobile `space-7` (78px) × `space-3` (22px).
- Entre o bloco de título da seção e o conteúdo, `space-6` (60px; 38px no mobile).
- Header de `header-height` 84px, borda inferior `hairline`.
- Breakpoints: 980px e 640px.

## Movimento

- Hover em botão: `translateY(-2px)` + troca de fundo, `.2s`.
- Cards: transição de `background`/`color` em `.25s`.
- O site tem camadas que cobrem a anterior e um zoom de ilustração controlados pelo scroll; fora disso, nada anima. Respeite `prefers-reduced-motion`.

## Iconografia

Use só o conjunto **Icons** (19 ícones de traço, os mesmos da IRON Security): viewBox 24, `fill: none`, `stroke-width: 1.8`, pontas e junções arredondadas, `currentColor` no código. Tamanhos 17–20px em linha; dentro de `icon-box` (46px, `icon-bg`, borda `icon-border`, traço `icon-ink`), que só aparece nos três pilares. Os arquivos do grupo vêm com o traço em `accent-text` (#a5502f) para visualização. `spark` é o ícone de IA; `shield` e `lock`, de segurança. Não misture outra biblioteca.

## Logo

Ainda não existe símbolo da IRON AI. Até existir, use só o wordmark em texto (`brand`): `IRON` peso 500 + `AI` peso 800. Não desenhe um símbolo provisório.

## Componentes

Os previews usam `components/bundle.css`, que reproduz as classes do site (`.button`, `.eyebrow`, `.product-card`, `.finding`…) sobre os tokens. Não há bundle React: os componentes são padrões de HTML + CSS. Cada componente tem guia e preview próprios.

## Segurança do front

CSP restritiva (`default-src 'self'`), fontes servidas do próprio domínio no site publicado, HSTS com preload, `X-Frame-Options: DENY`, Turnstile e consentimento LGPD em todo formulário. Nenhum componente novo carrega script ou estilo de terceiros fora dessa política.

## Decisões do cliente posteriores a este documento (20/10/2026)
- **Logo:** o header usa `img/logo-lockup.svg` (símbolo + wordmark, "AI" em argila). Decisão do cliente; substitui a regra "só wordmark em texto" no header. O wordmark em texto continua válido no rodapé.
- **Preços:** o site não mostra preço nenhum (nem R$, nem fórmula de preço). No lugar, texto comercial convidando a falar com a equipe e agendar uma reunião.
- **Condições por etapa:** cada etapa da esteira termina com o link "Condições: fale com a IRON AI" (decisão do cliente em 20/10/2026, no lugar dos preços). A repetição desse link nas cinco etapas é intencional.
- **Método de Casos de uso:** a seção mostra as 11 áreas como grade de chips (proposta aprovada pelo cliente em 21/10/2026). É exceção aprovada ao limite de "até 6 itens por seção" da barra visual.
- **Movimento em Esteira e Casos de uso:** o cliente pediu explicitamente "animação e scroll interativo" para essas páginas (21/10/2026). Além das camadas que cobrem a anterior, ficam permitidos indicadores de progresso ligados à rolagem: linha ou barra que se preenche, nós/índice que acendem para marcar o estado ativo. Continuam proibidas animações de entrada de conteúdo (fade/translate de títulos, textos, cards) e qualquer giro, pulso ou quique.
- **Prova em Casos de uso:** o parágrafo aprovado da seção Prova cita as frentes do iGaming (antifraude, CRM e marketing, sportsbook e cassino, financeiro), que também são as alavancas aprovadas do cartão iGaming. As duas falas são conteúdo aprovado pelo cliente; a repetição é aceita.
- **Painéis de etapa e de setor:** os painéis grandes (Esteira e Casos de uso) usam o título serif `product-title` 30px; o padrão de card (sans 20px/700) vale para as grades de cards.
- **Ritmo entre seções (leitura aplicada no site):** os 120px (`space-8`, 78px no mobile) são o espaço ENTRE seções vizinhas — do fim do conteúdo de uma ao eyebrow da seguinte —, como na página de contato aprovada. Por isso cada seção leva metade em cima e metade embaixo da hairline; não se somam 120 + 120.
- **Textos aprovados com duas frases:** o apoio do topo e do CTA final de Casos de uso e de Esteira vêm da proposta aprovada pelo cliente e podem ter duas frases.
