# Mega Lote 180 — Produtos inteligentes e alertas de destaque

## Objetivo
Criar inteligência comercial automática para detectar produtos que estão vendendo mais, subindo nas vendas, com bom lucro, com estoque baixo ou parados em estoque.

## Escopo executado
- Não mexe em login, Supabase Auth, senha, ENV, PDF ou regras de venda.
- Usa dados já existentes de `sales`, `sale_items` e `products`.
- Calcula insights no dashboard web/PWA.
- Mostra alertas no Dashboard mobile, Dashboard web e Central de avisos.
- Mantém versão/cache PWA atualizados para v180.

## Alertas criados
- Produto campeão com estoque baixo.
- Produto em destaque.
- Produto subindo nas vendas.
- Produto com bom lucro.
- Produto parado em estoque.

## Critérios usados
- Últimos 7 dias.
- Semana anterior.
- Últimos 30 dias.
- Quantidade vendida.
- Faturamento do item.
- Lucro estimado quando existe preço de custo.
- Estoque atual.
- Limite de estoque baixo configurado na loja.
- Última data de venda do produto.

## Arquivos alterados
- `src/types.ts`
- `src/lib/webApi.ts`
- `src/mobile-app/MobileApp.tsx`
- `src/mobile-app/screens/DashboardScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`
- `src/pages/Dashboard.tsx`
- `src/styles.css`
- `public/sw.js`
- `public/manifest.webmanifest`
- `package.json`
- `package-lock.json`
- `scripts/release_check.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`
- `scripts/qa/push_notification_readiness_test.js`

## Testes executados
- `npm run type-check` — OK
- `npm run build` — OK
- `npm run lint` — OK
- `npm run release:check` — OK
- `npm audit --audit-level=high` — OK, 0 vulnerabilidades high
- `node scripts/credit_payment_guard_tests.js` — OK
- `npm run qa:push` — OK
- `npm run qa:commercial` — OK
- `npm run qa:load` — OK
- `npm run release:commercial:check` — OK
- `npm run release:commercial:prepare` — OK

## Observação honesta
O build passou, mas o Vite ainda mostra aviso de chunk maior que 500 KB. Não quebrou o app, mas continua sendo próximo ponto de otimização para celular fraco.

## Próximo lote ideal
Criar tela/relatório dedicado de inteligência de estoque com filtros por período, margem, categoria e exportação PDF/CSV.
