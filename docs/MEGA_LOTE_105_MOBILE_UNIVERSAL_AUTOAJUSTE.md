# Mega Lote 105 — Mobile Universal Autoajustável

## Objetivo
Auditar e corrigir o modo mobile para funcionar melhor em qualquer tela e dimensão, com micro ajuste universal, sem travar rolagem e sem quebrar a navegação.

## Problemas atacados
- telas pequenas com conteúdo preso;
- rolagem instável entre body, root, layout e main;
- bottom nav cobrindo conteúdo;
- sidebar/drawer sem rolagem confiável;
- cards e tabelas estourando largura;
- textos quebrando de forma ruim;
- formulários e modais sem adaptação consistente.

## Correções
- nova camada `src/styles/lote105-universal-responsive.css`;
- versão `pwa-supabase-v105-mobile-universal`;
- cache `smart-loja-pwa-supabase-v105-mobile-universal`;
- fila `smart-loja:web-outbox-v105`;
- rolagem universal com `height:auto`, `overflow-y:auto` e safe-area;
- sidebar mobile com rolagem própria;
- bottom nav fixo sem cobrir conteúdo;
- grids autoajustáveis para desktop, tablet e mobile;
- proteção contra scroll horizontal e texto quebrando letra por letra.

## Telas alvo
Dashboard, Vendas/PDV, Produtos, Clientes, Pedidos, Caixa, Crediário, Comprovantes, Backup, Configurações, Diagnóstico e Login.

## Teste manual recomendado
1. Testar 320px, 360px, 390px, 412px e desktop.
2. Rolar do topo ao final em todas as abas.
3. Abrir menu Mais, rolar até Diagnóstico Web e fechar.
4. Conferir se bottom nav não cobre botões.
5. Testar PDV, Caixa e Crediário no celular.
