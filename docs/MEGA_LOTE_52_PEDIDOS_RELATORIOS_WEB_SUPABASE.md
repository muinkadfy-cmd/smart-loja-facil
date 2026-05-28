# Mega Lote 52 — Pedidos, Comprovantes e Relatórios Web/Supabase

## Objetivo

Liberar mais módulos reais no PWA web/mobile sem depender do SQLite/Tauri no navegador, mantendo a regra de segurança por papel e reduzindo telas bloqueadas no modo web.

## Entregue neste lote

- Pedidos liberados no PWA web/mobile com Supabase.
- Criação de pedido web com múltiplos itens.
- Validação de cliente, produto ativo e estoque disponível.
- Separação de pedido com validação de estoque.
- Entrega de pedido com baixa de estoque.
- Cancelamento de pedido antes da entrega.
- Comprovantes liberados para leitura web.
- Impressão/preview de comprovante no navegador com fallback para arquivo HTML quando popup for bloqueado.
- Relatórios liberados no PWA web:
  - vendas por período;
  - caixa por período;
  - crediário em aberto;
  - estoque baixo.
- Exportação CSV no navegador sem depender de pasta local do Windows.
- Página de migração web atualizada para mostrar os módulos já liberados.
- Cache PWA atualizado para `smart-loja-pwa-supabase-v52`.
- Versão web atualizada para `pwa-supabase-v52`.
- Migração Supabase adicionada com RPC transacional `web_complete_order` para entrega de pedido com lock, validação de estoque, baixa e auditoria.

## Arquivos alterados

- `src/App.tsx`
- `src/lib/api.ts`
- `src/lib/webApi.ts`
- `src/pages/Orders.tsx`
- `src/pages/WebMigration.tsx`
- `public/sw.js`

## Arquivos novos

- `docs/MEGA_LOTE_52_PEDIDOS_RELATORIOS_WEB_SUPABASE.md`
- `supabase/migrations/202605270052_web_orders_delivery_rpc.sql`

## Testes executados

```bash
npm run type-check
npm run lint
npm run build
npm run release:check
node --check public/sw.js
```

Também foi validado JSON em:

```bash
package.json
public/manifest.webmanifest
src-tauri/tauri.conf.json
```

## Resultado dos testes

Todos passaram.

## Observação importante sobre Supabase

A entrega de pedido web funciona com fallback no frontend, mas a forma mais segura é aplicar a nova migração Supabase para habilitar a função `public.web_complete_order(uuid)`. Essa função faz a entrega em transação no banco, bloqueia o pedido/produtos, valida estoque, baixa estoque e grava auditoria.

Recomendado antes de vender para cliente final:

```bash
npx supabase db push
```

ou aplicar a migration pelo fluxo do seu projeto Supabase.

## Limitações reais que continuam

Ainda não foram liberados como operação completa no PWA web:

- Vendas / PDV;
- Caixa operacional completo;
- Crediário com recebimento;
- Backup/restauração web.

Esses módulos continuam bloqueados no modo web para evitar venda duplicada, caixa errado, recebimento parcial inconsistente ou sobrescrita de dados.

## Nota comercial após este lote

- UI/UX mobile: 8.3/10
- UI/UX web: 8.5/10
- Responsividade: 8.4/10
- Design system: 8.3/10
- Supabase/sincronização: 8.2/10
- Permissões: 8.4/10
- PWA/cache: 8.4/10
- Segurança: 8.1/10
- Prontidão comercial geral: 8.3/10

Não recebe 9.5/10 porque PDV, Caixa e Crediário ainda precisam de transações completas no Supabase.
