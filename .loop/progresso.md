# Progresso — loop de design, rodada 33

Rodadas globais executadas: parte D 8 rodadas; rodada 34 (B e C): 3 rodadas, R4 em construção

R3 (parte D, após remover preços): Briefing APROVADO · Sistema REPROVADO (dois botões cta-bg na mesma vista no fim da esteira) · Visual REPROVADO (faixa "A esteira começa aqui" no contato sem título, cards 15px).
Ressalva do briefing para a parte A: "Retorno mínimo de 3× em 12 meses" sem fonte; home sem rodapé.

| Parte | Estado | Briefing | Sistema | Visual | Maior lacuna (histórico) |
| --- | --- | --- | --- | --- | --- |
| A. Home: texto revisto + P3 (prova, FAQ, CTA final, rodapé) | aguardando proposta | – | – | – | – |
| B. esteira.html | R4 em construção | R3 REPROVADO | R3 REPROVADO (R2 APROVADO) | R3 REPROVADO | R1 foco Tab · R2 ritmo 217–494px / celular sem scroll interativo · R3 inert tira etapas do Tab (briefing) · CTA duplo sem JS (sistema) · ritmo real ~130px e vazio no painel (visual) |
| C. casos-de-uso.html | R4 em construção | R3 REPROVADO | R3 REPROVADO | R3 REPROVADO | R1 menu sem JS / 12 itens · R2 áreas por setor inventadas / ritmo / h1 80px · R3 foco sob header no celular (briefing) · nome/posição duplicados (sistema) · ritmo real 121–149px (visual) |
| D. contato.html + /api/contato (Turnstile + e-mail) | **APROVADA** (R8) | R8 APROVADO | R7 APROVADO | R7 APROVADO | R1 vão 250px · R3 dois CTAs / faixa esteira · R4 menu 20px · R5 menu não cobre / form 10 itens · R6 sucesso com form visível / card 3 linhas / manilla · R7 foco perdido no erro |

Parte D aprovada após 8 rodadas. A R8 só moveu o alerta de erro para junto do botão (sem mudança de layout, cor ou texto aprovados).
Pendências do cliente para D: chaves Turnstile/Resend + CONTACT_TO na Vercel; razão social, CNPJ, endereço, DPO e e-mail de privacidade.
Herdado para a parte A: na home a 390 o CTA do hero precisa ser o único (menu já cobre a tela); "Retorno mínimo de 3× em 12 meses" sem fonte; home sem rodapé; "Ver a esteira" encostado na camada do zoom.

## Notas da rodada 1 (parte D)
- Briefing: links para esteira.html e casos-de-uso.html dão 404 — resolvido pelas partes B e C, não pela D. Ressalva: foco cai no body após erro de envio.
- Sistema: logo SVG com símbolo no header contraria o DS ("não desenhe símbolo provisório"), mas veio de commits do cliente posteriores ao DS → decisão do cliente. Secundário: h2 da política sem eyebrow.
- Visual: X (referência) melhor em hierarquia; Y limpo porém monótono.
