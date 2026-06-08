# Mega Lote 185 — Atividades/Vendas recentes com comprovantes no padrão da aba Comprovantes

## Objetivo
Padronizar os comprovantes gerados a partir de **Atividades recentes** e **Vendas recentes** para usar o mesmo padrão visual preto/branco da aba **Comprovantes**, mantendo PDF e PNG com a mesma hierarquia, espaçamento, tabela de produtos, pagamento, desconto e rodapé.

## O que foi alterado
- `src/mobile-app/components/receiptShare.ts`
  - Refeito o gerador usado por Dashboard/Atividades recentes, Vendas recentes mobile e Vendas recentes web.
  - PDF e PNG agora nascem do mesmo canvas/layout visual.
  - O PDF deixou de usar bloco resumido separado e passa a ter a mesma composição do PNG.
  - Desconto aparece sempre que existir em `sale.discount` ou no conteúdo do comprovante.
  - Produtos comprados são extraídos de tabela salva no comprovante quando houver; se não houver, usa fallback seguro da venda.
  - Compartilhamento continua sem link e sem texto extra, usando arquivo pronto.

## Fluxos afetados
- Dashboard mobile → Atividades recentes → Compartilhar PDF / Enviar PNG.
- Vendas/PDV mobile → Vendas recentes → Compartilhar PDF / Enviar PNG.
- Vendas web/desktop → Últimas vendas registradas → PDF / PNG.

## Não alterado
- Login, Supabase Auth, ENV, RLS, notificações push, regras de venda, regras de crediário e banco de dados.

## Validações executadas
- `npm run type-check`
- `npm run build`
- `npm run lint`
- `npm run release:check`
- `npm audit --audit-level=high`
- `node scripts/credit_payment_guard_tests.js`
- `npm run qa:push`
- `npm run qa:commercial`
- `npm run qa:load`
- `npm run release:commercial:check`
- `npm run release:commercial:prepare`

## Observação honesta
O layout agora é padronizado no gerador das vendas recentes, mas se um comprovante antigo não tiver tabela de itens salva no conteúdo, o sistema usa fallback com o primeiro produto e quantidade total conhecida pela venda.
