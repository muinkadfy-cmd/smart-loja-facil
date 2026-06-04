# Mega Lote 114 — Layout universal + blocos vazios compactos

## Objetivo
Investigar e corrigir a sensação de layout bagunçado, blocos vazios grandes e telas internas pouco consistentes no mobile e no web.

## Correções aplicadas
- camada CSS final `lote114-universal-layout-empty-rescue.css`;
- estados vazios compactos e úteis;
- tabelas mobile transformadas em lista/card sem bloco gigante;
- formulários, modais, cards e painéis com largura segura;
- topbar mobile padronizada;
- drawer/menu lateral com rolagem própria;
- bottom nav fixo sem cobrir conteúdo;
- PDV com instruções compactas no celular;
- redução de textos quebrando e cortes laterais;
- preservação de dados/Supabase.

## Abas consideradas
Dashboard, Vendas/PDV, Pedidos, Produtos, Clientes, Relatórios, Caixa, Crediário, Comprovantes, Backup, Configurações, Logs/Diagnóstico e Diagnóstico Web.

## Versionamento
- app: `pwa-supabase-v114-layout-empty-rescue`
- cache: `smart-loja-pwa-supabase-v114-layout-empty-rescue`

## Risco restante
A base ainda possui muitas camadas antigas de CSS com `!important`. O lote 114 estabiliza por camada final, mas o ideal futuro é consolidar/remover CSS legado em uma refatoração controlada.
