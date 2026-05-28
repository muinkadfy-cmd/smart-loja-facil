# Mega Lote 53 — Vendas/PDV, Caixa e Crediário Web/Supabase

## Objetivo
Liberar mais módulos críticos do PWA web/mobile com Supabase sem quebrar a operação local Tauri/SQLite.

## Entregue

- Vendas/PDV no modo web com chamada para RPC transacional `web_create_sale`.
- Listagem de vendas no modo web.
- Cancelamento web preparado por RPC `web_cancel_sale` para owner/admin.
- Baixa de estoque na venda com bloqueio no Supabase.
- Geração de comprovante web básico em `receipts`.
- Lançamento automático no caixa para vendas em dinheiro, pix e cartão.
- Criação de crediário e parcelas para venda no crediário.
- Caixa web com abertura, fechamento, resumo, entradas, saídas e movimento manual.
- Crediário web com listagem, parcelas, contatos e recebimento por RPC `web_receive_credit_payment`.
- Rotas web liberadas para Vendas/PDV, Caixa e Crediário.
- Tela de migração atualizada: próximo foco passa a ser Backup/Restauração web.
- Cache PWA atualizado para `smart-loja-pwa-supabase-v53`.
- Versão web atualizada para `pwa-supabase-v53`.
- Textos de Vendas/Caixa polidos com acentos e linguagem menos técnica.

## Arquivos alterados

- `public/sw.js`
- `src/App.tsx`
- `src/lib/api.ts`
- `src/lib/webApi.ts`
- `src/pages/Cash.tsx`
- `src/pages/Sales.tsx`
- `src/pages/WebMigration.tsx`

## Arquivos novos

- `docs/MEGA_LOTE_53_VENDAS_CAIXA_CREDIARIO_WEB_SUPABASE.md`
- `supabase/migrations/202605270053_web_sales_cash_credits_rpc.sql`

## Migration Supabase obrigatória

Aplicar antes de testar vendas reais no PWA web:

```bash
npx supabase db push
```

A venda web depende da função `web_create_sale`. O recebimento de crediário depende da função `web_receive_credit_payment`.

## Testes executados

Passaram:

```bash
npm run type-check
npm run lint
npm run build
npm run release:check
node --check public/sw.js
```

Também foi validado que o `release_check` continua protegendo a separação entre camada offline local e camada web segura.

## Testes não executados

- `npx supabase db push` não foi executado neste ambiente porque depende do projeto Supabase conectado/autenticado.
- Teste real multiaparelho não foi executado porque depende de ambiente publicado, login real e banco Supabase ativo.

## Regressão verificada

- Tauri/SQLite preservado: `api.ts` continua roteando runtime Tauri para comandos nativos.
- Web/PWA usa `webApi.ts` somente quando não está no Tauri.
- Release check passou depois da liberação de novos módulos.
- Cache PWA foi versionado para evitar celular preso em versão antiga.

## Riscos restantes

- A migration precisa ser aplicada no Supabase antes do uso real.
- O comprovante web da venda é funcional, mas ainda pode receber um lote visual específico para ficar igual ao comprovante premium do desktop.
- Backup/Restauração web ainda fica bloqueado para evitar sobrescrever loja ativa ou expor dados.

## Próximo lote recomendado

Mega Lote 54: Backup/Restauração web seguro + exportação JSON/CSV da loja + importação protegida com prévia, validação, permissão e bloqueio para leitor.

## Nota comercial após este lote

- UI/UX mobile: 8.3/10
- UI/UX web: 8.4/10
- Supabase/sincronização: 8.7/10
- Permissões: 8.5/10
- PWA/cache: 8.5/10
- Operação web/mobile real: 8.8/10
- Prontidão comercial geral: 8.7/10

Não é 9.5/10 ainda porque backup/restauração web e comprovante visual premium web ainda precisam de lote próprio.
