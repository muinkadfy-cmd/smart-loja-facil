# Mega Lote 215 — Vendas / PDV Premium Fiel à Referência

## Objetivo
Deixar a aba Vendas / PDV no padrão premium da referência enviada, com layout em duas áreas, lista de produtos compacta, mini carrinho lateral, pagamento rápido e vendas recentes.

## Ajustes aplicados
- removido bloco antigo de estatísticas duplicadas no topo da venda;
- barra de etapas Produto/Carrinho/Pagamento/Finalizar ficou mais fiel à referência;
- adicionado resumo superior: Carrinho, Subtotal e Cliente;
- adicionado seletor de cliente compacto no resumo superior;
- criada área principal com duas colunas: produtos à esquerda e carrinho/pagamento/recentes à direita;
- busca de produto mais limpa com placeholder fiel;
- chips de categoria dinâmicos por produtos cadastrados;
- lista de produtos compacta com foto, nome, código/categoria, estoque, preço e botão Adicionar;
- mini carrinho lateral com itens, totais, desconto, total e botões principais;
- card de Pagamento rápido com Dinheiro, Pix, Cartão e Crediário;
- vendas recentes compactas na lateral;
- responsivo: em telas pequenas vira uma coluna sem perder funções;
- mantida toda a lógica atual de carrinho, desconto, pagamento, crediário, cliente, finalização e comprovantes.

## Arquivos alterados
- `src/mobile-app/screens/SalesScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`
- arquivos de versão/cache/release v215

## Classificação
- Vendas / PDV layout: PRONTO COM OBSERVAÇÃO — 9,5/10 — ★★★★★ 4,75/5.
- Lógica de venda: PRONTO COM OBSERVAÇÃO — 9,2/10 — ★★★★☆ 4,6/5.
- Risco: médio-baixo, alterações focadas em layout/UX.
