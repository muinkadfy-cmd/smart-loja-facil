# Mega Lote 11 — Comprovante 10,4cm x 14,4cm

## Objetivo
Recriar o comprovante do crediário como arte fixa de impressão, usando as dimensões reais informadas: 10,4cm de largura por 14,4cm de comprimento.

## Ajustes aplicados
- Página fixa com `@page size: 104mm 144mm`.
- Container fixo de `104mm x 144mm`.
- Bloqueio de quebra com `page-break-inside: avoid`, `break-inside: avoid` e `overflow: hidden`.
- Reproporção completa do topo, campos, tabela, pagamento e anotações.
- Tabela com mais linhas, largura cheia e colunas parecidas com a folha física.
- Bloco de pagamento/total e anotações mantidos dentro da mesma folha.
- Linhas e cabeçalhos com peso mais próximo de papel de gráfica.

## Observação
O Edge/Chrome ainda pode aplicar escala própria se a impressão for feita como A4. Para impressão física, selecionar tamanho personalizado 10,4cm x 14,4cm ou usar escala 100%.
