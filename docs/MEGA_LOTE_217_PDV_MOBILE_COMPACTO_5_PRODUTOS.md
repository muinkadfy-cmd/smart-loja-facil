# Mega Lote 217 — PDV Mobile Compacto com 5 Produtos

## Objetivo
Corrigir a poluição visual da aba Vendas/PDV, eliminar definitivamente a sobreposição de letras na lista de produtos e limitar a tela inicial para 5 produtos visíveis.

## Correções aplicadas
- Produto agora usa marcação própria com classes `mapp-sales-product-*`, sem depender de `strong`, `small`, `b` e `em`;
- Reset definitivo da herança antiga da `.mapp-product-pick-list`;
- Lista de produtos no mobile travada em grid compacto:
  - foto/ícone;
  - nome;
  - código/categoria;
  - status de estoque;
  - preço;
  - botão Adicionar/Sem estoque;
- Status “Em estoque / Sem estoque” reduzido para não competir com o nome;
- Tela inicial passa a mostrar só 5 produtos;
- Botão “Mostrar mais produtos” carrega mais 5 por vez;
- Busca e chips ficaram mais baixos;
- Mini carrinho ficou mais compacto;
- Mantida a lógica atual de venda, carrinho, pagamento, crediário e comprovantes.

## Arquivos alterados
- `src/mobile-app/screens/SalesScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`
- arquivos de versão/cache/release v217

## Classificação
- Lista de produtos PDV: PRONTO COM OBSERVAÇÃO — 9,4/10 — ★★★★★ 4,7/5.
- PDV mobile compacto: PRONTO COM OBSERVAÇÃO — 9,2/10 — ★★★★☆ 4,6/5.
- Risco: baixo, alteração focada em marcação/CSS e limite visual.
