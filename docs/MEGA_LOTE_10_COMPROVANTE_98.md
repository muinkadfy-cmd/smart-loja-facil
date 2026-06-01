# Mega Lote 10 — Comprovante 9.8/10 Clone Premium

## Objetivo
Aproximar o comprovante de crediário da folha física de referência, com foco em escala real de impressão, largura 80mm, hierarquia visual, linhas fortes, cabeçalho rosa, campos superiores e bloco de pagamento/anotações.

## Alterações
- Refeito o HTML/CSS do comprovante da parcela em `src/pages/Credits.tsx`.
- Adicionado `@page size: 80mm 136mm` para evitar PDF A4 com recibo miniaturizado.
- Ajustada largura útil da folha, margens, altura da tabela e proporção das colunas.
- Produto ficou visualmente dominante, como na referência.
- Tabela ganhou 10 linhas e linhas pretas mais fortes.
- Bloco Pagamento/Total ficou mais próximo da folha física.
- Caixa Anotações ficou maior, mais baixa e proporcional.
- Preview do modal foi lapidado em `src/styles.css`.

## Observações
O layout agora é desenhado para impressão 80mm. A fidelidade final ainda depende da escala do Edge/Chrome estar em 100% e da impressora não aplicar ajuste automático de página.
