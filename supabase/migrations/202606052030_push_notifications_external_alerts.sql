-- Mega Lote 177 — notificações externas PWA Android/iOS.
-- Guarda aparelhos autorizados para receber alertas fora do app.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  platform text not null default 'web',
  user_agent text not null default '',
  notification_prefs jsonb not null default '{"credit_overdue": true, "credit_due_today": true, "low_stock": true, "sync_error": true, "backup_reminder": true}'::jsonb,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_store_enabled_idx on public.push_subscriptions(store_id, enabled, last_seen_at desc);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id, updated_at desc);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_member on public.push_subscriptions;
create policy push_subscriptions_select_member on public.push_subscriptions
for select using (public.is_store_member(store_id));

drop policy if exists push_subscriptions_insert_own_member on public.push_subscriptions;
create policy push_subscriptions_insert_own_member on public.push_subscriptions
for insert with check (user_id = auth.uid() and public.is_store_member(store_id));

drop policy if exists push_subscriptions_update_own_or_admin on public.push_subscriptions;
create policy push_subscriptions_update_own_or_admin on public.push_subscriptions
for update using (user_id = auth.uid() or public.has_store_role(store_id, array['owner','admin']))
with check (user_id = auth.uid() or public.has_store_role(store_id, array['owner','admin']));

drop policy if exists push_subscriptions_delete_own_or_admin on public.push_subscriptions;
create policy push_subscriptions_delete_own_or_admin on public.push_subscriptions
for delete using (user_id = auth.uid() or public.has_store_role(store_id, array['owner','admin']));

create or replace function public.touch_push_subscriptions_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists push_subscriptions_touch_updated_at on public.push_subscriptions;
create trigger push_subscriptions_touch_updated_at
before update on public.push_subscriptions
for each row execute function public.touch_push_subscriptions_updated_at();

-- View de apoio para rotina diária de vencimentos. A Edge Function pode consultar esta view.
create or replace view public.push_credit_due_alerts as
select
  c.store_id,
  c.id as credit_id,
  c.customer_name,
  c.sale_id,
  ci.id as installment_id,
  ci.number as installment_number,
  ci.amount,
  ci.paid_amount,
  ci.due_date,
  ci.status,
  case
    when ci.status <> 'paid' and ci.due_date < current_date then 'overdue'
    when ci.status <> 'paid' and ci.due_date = current_date then 'due_today'
    else 'future'
  end as alert_kind
from public.credits c
join public.credit_installments ci on ci.credit_id = c.id and ci.store_id = c.store_id
where c.status <> 'canceled'
  and ci.status <> 'paid'
  and ci.status <> 'canceled'
  and ci.due_date <= current_date;
