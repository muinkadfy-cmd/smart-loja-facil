# Supabase — base limpa Smart Loja PWA

Este diretório é um ponto de partida para criar uma nova base PWA web/mobile sincronizada com Supabase.

## Ordem recomendada

```bash
npm install supabase --save-dev
npx supabase init
npx supabase start
npx supabase migration up
```

Depois de criar o projeto no Supabase:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

## Regras importantes

- Use RLS em todas as tabelas do schema público.
- Frontend usa somente anon/publishable key.
- Service role nunca vai no frontend.
- Ações sensíveis devem ir para Edge Functions ou policies fechadas.
- Toda tabela comercial precisa de `store_id`.
- Toda operação crítica precisa de `client_request_id` para evitar duplicidade.

## Módulos cobertos no schema inicial

- stores
- profiles
- store_members
- customers
- products
- sales
- sale_items
- cash_sessions
- cash_movements
- credits
- credit_installments
- payments
- orders
- order_items
- receipts
- stock_movements
- audit_log
- sync_conflicts
