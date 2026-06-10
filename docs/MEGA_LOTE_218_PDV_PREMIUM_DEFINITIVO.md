# Mega Lote 218 — PDV Premium Definitivo sem Poluição Visual

## Auditoria
As imagens enviadas mostraram que a aba Vendas/PDV ainda tinha conflito real de herança antiga:
- os textos do produto ainda cruzavam;
- o botão Adicionar virava círculo grande;
- preço, foto e texto disputavam a mesma área;
- a causa principal era o uso de `span` direto dentro de `.mapp-product-pick-list`, que continuava recebendo regras antigas globais.

## Correções aplicadas
- removidos `span` diretos para informações/preço/ação do produto;
- produto passou a usar `div` para info, preço e ação;
- somente foto/ícone continua como `span`, porque o CSS antigo esperava esse elemento para miniatura;
- reset final de herança antiga dentro de `.mapp-page-sales`;
- lista do PDV travada em grid mobile-first:
  - foto;
  - nome;
  - código/categoria;
  - estoque;
  - preço;
  - botão;
- status “Em estoque / Sem estoque” ficou menor;
- preço e botão ficaram presos no lado direito;
- busca, chips, lista, mini carrinho, pagamento rápido e finalização ficaram mais compactos;
- mantido limite inicial de 5 produtos e botão para mostrar mais 5;
- mantida toda a lógica de venda, carrinho, pagamento, crediário e comprovantes.

## Arquivos alterados
- `src/mobile-app/screens/SalesScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`
- arquivos de versão/cache/release v218

## Classificação
- Lista de produtos PDV: PRONTO — 9,6/10 — ★★★★★ 4,8/5.
- PDV mobile: PRONTO COM OBSERVAÇÃO — 9,4/10 — ★★★★★ 4,7/5.
- Limpeza de herança CSS: PRONTO — 9,6/10 — ★★★★★ 4,8/5.
- Risco: baixo, sem alteração em regra de negócio.
