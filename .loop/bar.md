# Barra de qualidade — rodada 33 (conclusão do site)

Referência: anthropic.com (home) e claude.com/contact-sales, medidas em 1440 × 900 em 20/10/2026.
Cada linha é verificável olhando o resultado renderizado.

1. **Escala serif dominante.** O título de cada seção é serif peso 400–500 com 4× ou mais o tamanho do corpo (ref.: 64px contra 15px) e no máximo 2 linhas no desktop a 1440px.
2. **Título à esquerda numa coluna estreita.** Cada seção abre com eyebrow e título alinhados à esquerda, com largura ≤ 2/3 da página; o conteúdo vem abaixo, em grade. Só o CTA final é centralizado.
3. **Contato em dois caminhos antes do formulário.** A página de contato separa por perfil ("quero começar já" × "operação complexa") antes de pedir dados. O formulário abre com uma pergunta de seleção do motivo e cada campo tem rótulo visível acima.
4. **CTA final em faixa de largura total.** Uma frase serif ≥ 56px, uma linha de apoio e um único botão, sobre faixa de cor diferente do fundo da página.
5. **Rodapé de colunas de texto.** Colunas de links em 13px, rótulo de coluna em tom apagado, linha de copyright. Nenhum ícone decorativo, nenhuma caixa.
6. **Cards separados por linha, nunca por sombra.** Título sans 20px negrito, descrição 14–15px de até 2 linhas, uma linha de metadado ou preço. Cards vizinhos dividem a mesma hairline.
7. **Ritmo vertical largo.** 96–120px entre seções no desktop; nenhuma seção mostra mais que um título e até 6 itens.

## Acréscimo — rodada 34 (esteira.html e casos-de-uso.html, com scroll interativo)
Referência de movimento: a própria home publicada (camadas que cobrem, pilha de cartões, zoom), que já passou pelo loop.

8. **O scroll conduz a leitura.** Em cada página há pelo menos um trecho em que a rolagem avança um estado visível (etapa ativa, setor ativo, linha que se preenche) e o estado ativo é sempre um só, indicado por número/índice e por cor de texto, nunca só por cor.
9. **Movimento contido e direcional.** Elementos entram de baixo para cima ou a camada seguinte cobre a anterior; nada gira, pisca ou quica; transições de 300 a 700 ms; com `prefers-reduced-motion` tudo aparece estático e completo, sem perder conteúdo.
10. **Nada se perde sem JS ou no celular.** A 390px e sem JavaScript, todo o conteúdo e todas as etapas/setores ficam legíveis em sequência, sem sobreposição e sem rolagem horizontal.
