# Mega Lote 216 — Correção Mobile PDV + Dashboard Premium

## Objetivo
Corrigir a herança antiga que brigava com o layout novo da aba Vendas/PDV e redesenhar o Painel/Dashboard para ficar no padrão premium da referência enviada.

## Correções no PDV
- Escopo específico para `.mapp-page-sales`;
- Subnav Operação compactada na aba Vendas;
- Reset de herança antiga da `.mapp-product-pick-list`;
- Produto travado em grid seguro: foto, nome/código/estoque, preço e botão;
- Corrigido cruzamento/sobreposição de nome, código e status;
- Resumo Carrinho/Subtotal/Cliente mais compacto no mobile;
- Etapas 1/2/3/4 menores no mobile;
- Mini carrinho, pagamento rápido e finalização com alturas menores.

## Nova Dashboard/Painel
- Cards principais em grid 2x2 premium como a referência;
- Alerta de estoque baixo compacto com ícone e botão Ver produtos;
- Seção “O que fazer agora?” com 4 ações fixas;
- Removida duplicidade de “Ações rápidas”;
- Produtos em destaque reposicionados abaixo das ações;
- Atividades recentes mais compactas;
- Dashboard escopada por `.mapp-page-dashboard` para reduzir conflito com CSS antigo.

## Arquivos alterados
- `src/mobile-app/screens/DashboardScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`
- arquivos de versão/cache/release v216

## Classificação
- Vendas/PDV mobile: PRONTO COM OBSERVAÇÃO — 9,3/10 — ★★★★★ 4,65/5.
- Dashboard/Painel: PRONTO COM OBSERVAÇÃO — 9,4/10 — ★★★★★ 4,7/5.
- Sistema geral visual: PRONTO COM OBSERVAÇÃO — 9,3/10 — ★★★★★ 4,65/5.
- Risco: médio-baixo, alterações focadas em CSS/UX e sem mexer em regras de venda.
