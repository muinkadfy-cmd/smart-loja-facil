# Mega Lote 95 — Consolidação CSS real / limpeza técnica segura

## Objetivo
Reduzir risco técnico do CSS legado depois dos lotes visuais premium, sem mexer em lógica financeira, Supabase, RLS ou cálculos.

## Alterações
- atualização para pwa-supabase-v95;
- cache smart-loja-pwa-supabase-v95-css-consolidation;
- criação de camada leve src/styles/lote95-css-consolidation.css;
- criação de script scripts/css_consolidate_safe.js;
- remoção segura de !important em propriedades de baixo risco;
- redução de peso em src/styles.css e src/master-ui.css;
- atualização do css_audit para v95;
- atualização do commercial package check para v95;
- relatório docs/generated/css-consolidation-v95.json.

## Resultado esperado
Menos conflito visual futuro, auditoria mais confiável e base mais segura para teste comercial real.
