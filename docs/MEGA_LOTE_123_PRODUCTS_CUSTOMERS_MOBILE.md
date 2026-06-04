# Lote 123 — Produtos + Clientes na nova interface limpa

## Objetivo
Migrar Produtos e Clientes para a nova interface mobile-first em `src/mobile-app/`, preservando Supabase, login, dados e navegação nova.

## Entregas
- Tela nova de Produtos com lista real, busca, cadastro e edição.
- Tela nova de Clientes com lista real, busca, cadastro e edição.
- Cards mobile premium e layout desktop como versão ampliada do mobile.
- Feedback simples de sucesso/erro.
- Versionamento/cache v123.

## Dados reaproveitados
Foram usadas as funções existentes da camada de dados:
- `api.products()`
- `api.saveProduct()`
- `api.customers()`
- `api.saveCustomer()`

Não houve alteração de banco, RLS, políticas, tabelas ou regras financeiras.

## Limitações
- Inativação/ajuste de estoque continuam disponíveis na camada de dados, mas não foram expostos como ação principal nesta fase para evitar risco operacional.
- Fotos de produto não foram migradas nesta fase; ficam para lote específico.
- Vendas/PDV ainda fica para o próximo lote.

## Próximo lote ideal
Lote 124 — Migrar Vendas / PDV para a nova interface limpa.
