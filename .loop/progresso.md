# Progresso — loop de design, rodada 33

Rodadas globais executadas: 3 (rodada 4 em construção)

R3 (parte D, após remover preços): Briefing APROVADO · Sistema REPROVADO (dois botões cta-bg na mesma vista no fim da esteira) · Visual REPROVADO (faixa "A esteira começa aqui" no contato sem título, cards 15px).
Ressalva do briefing para a parte A: "Retorno mínimo de 3× em 12 meses" sem fonte; home sem rodapé.

| Parte | Estado | Briefing | Sistema | Visual | Maior lacuna (histórico) |
| --- | --- | --- | --- | --- | --- |
| A. Home: texto revisto + P3 (prova, FAQ, CTA final, rodapé) | aguardando proposta | – | – | – | – |
| B. esteira.html | aguardando proposta | – | – | – | – |
| C. casos-de-uso.html | aguardando proposta | – | – | – | – |
| D. contato.html + /api/contato (Turnstile + e-mail) | rodada 2 em construção | R1 REPROVADO | R1 REPROVADO | R1 REPROVADO | R1: vão de ~250px entre caminhos e formulário (visual, enviado ao construtor) |

## Notas da rodada 1 (parte D)
- Briefing: links para esteira.html e casos-de-uso.html dão 404 — resolvido pelas partes B e C, não pela D. Ressalva: foco cai no body após erro de envio.
- Sistema: logo SVG com símbolo no header contraria o DS ("não desenhe símbolo provisório"), mas veio de commits do cliente posteriores ao DS → decisão do cliente. Secundário: h2 da política sem eyebrow.
- Visual: X (referência) melhor em hierarquia; Y limpo porém monótono.
