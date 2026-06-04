# Mega Lote 140 — Auditoria Final de Regressão / Pré-venda Real

## Objetivo
Criar uma camada final de conferência antes do primeiro cliente real, cobrindo abas críticas, permissões, PWA/cache, Supabase, sync, impressão e backup.

## O que mudou
- Nova seção **Auditoria final de regressão / pré-venda real** no Diagnóstico Web.
- Checklist com 12 áreas: login, dashboard mobile, clientes/produtos, venda/estoque/comprovante, caixa, pedidos, crediário, impressão, backup, permissões, sync/offline e PWA/cache.
- Cada item pode ser marcado como **Passou**, **Falhou**, **Bloqueado** ou **Pendente**.
- Falha/bloqueio em P0/P1 impede aprovação de pré-venda real.
- Relatório copiável sem senha, sem chave privada e sem dados técnicos crus.
- Versão/cache atualizados para v140.

## Segurança
A auditoria final não grava venda, não altera caixa, não baixa estoque, não recebe crediário, não restaura backup e não altera Supabase. É uma camada local de conferência e evidência para o responsável.

## Limitação honesta
A auditoria só deve ser marcada como passou após teste físico real em dois aparelhos, Supabase produção, papéis owner/admin/operator/viewer, impressão física, backup controlado e PWA instalado após deploy.
