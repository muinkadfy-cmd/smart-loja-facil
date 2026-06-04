# Mega Lote 145 — Micro Interface / Sub-abas Contextuais

## Objetivo
Auditar se o Smart Loja Fácil precisava de sub-abas, sub-menus ou micro ajuste visual após o hotfix de login v144.

## Decisão técnica
Não foi criada uma árvore profunda de submenus dentro de cada tela, porque isso aumentaria complexidade para o usuário leigo e poderia esconder ações importantes no mobile.

A melhoria segura foi criar:

- menu lateral agrupado por área;
- sub-abas contextuais abaixo do título de cada tela;
- grupos simples: Início, Operação, Gestão e Controle;
- micro acabamento visual dos chips de navegação;
- navegação horizontal confortável no celular;
- preservação do bottom nav principal.

## Grupos criados

### Início
- Dashboard

### Operação
- Vendas / PDV
- Caixa
- Pedidos
- Crediário
- Comprovantes

### Gestão
- Produtos
- Clientes
- Relatórios
- Backup

### Controle
- Configurações
- Logs / Diagnóstico
- Diagnóstico Web

## Proteções
- Não mexe em venda real.
- Não mexe em caixa.
- Não altera estoque.
- Não altera crediário.
- Não altera Supabase.
- Não altera permissões.
- Não altera login além de preservar o hotfix v144.

## Versão
- App: pwa-supabase-v145-micro-interface-subabas
- Cache: smart-loja-pwa-supabase-v145-micro-interface-subabas

## Testes obrigatórios
- npm run type-check
- npm run build
- npm run lint
- npm run release:check
- npm run release:commercial:check
- npm run release:commercial:prepare
- npm audit --audit-level=high

## Resultado esperado
Interface mais fácil de entender no mobile, sem criar módulo novo e sem aumentar risco operacional.
