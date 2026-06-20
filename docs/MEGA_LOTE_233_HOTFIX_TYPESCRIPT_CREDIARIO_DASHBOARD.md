# Mega Lote 233 — Hotfix TypeScript Crediário + Dashboard

## Erro corrigido
O `npm run type-check` falhava com 4 erros:

1. `adjustCreditInstallment` não existia em `WebOutboxAction`.
2. `correctCreditPayment` não existia em `WebOutboxAction`.
3. `webDemoDashboard()` não retornava `credit_overdue_installments`.
4. `webDemoDashboard()` não retornava `zero_stock_count`.
5. `emptyDashboard()` também não retornava os dois campos obrigatórios.

## Correção aplicada
- Adicionadas as ações:
  - `adjustCreditInstallment`
  - `correctCreditPayment`
- Atualizado o parser da fila offline/outbox para aceitar essas ações.
- Adicionados em `webDemoDashboard()`:
  - `credit_overdue_installments`
  - `zero_stock_count`
- Adicionados em `emptyDashboard()`:
  - `credit_overdue_installments: 0`
  - `zero_stock_count: 0`
- Versão/cache atualizados para `v233`.

## Arquivo principal alterado
- `src/lib/webApi.ts`

## Preservado
- Layout do lote 232;
- Status: Aberta;
- comprovantes/PDF/PNG;
- cálculos;
- venda;
- crediário;
- estoque;
- parcelas.

## Teste honesto
Foi feita conferência estrutural dos pontos que quebravam o TypeScript.  
Não rodei `tsc` real neste ambiente porque aqui não há `node_modules` instalado.

## Comandos recomendados após aplicar
```powershell
npm run type-check
npm run build
npm run release:check
npm run release:commercial:check
npx wrangler deploy
```
