-- Smart Loja Fácil PWA + Supabase
-- Endurecimento comercial: histórico de backups na nuvem e fila de sincronização auditável.

create table if not exists public.backups_log (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  file_name text not null,
  file_path text not null,
  size_bytes bigint not null default 0,
  integrity_ok boolean not null default true,
  source text not null default 'web_json',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.backups_log add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.backups_log add column if not exists file_name text not null default '';
alter table public.backups_log add column if not exists file_path text not null default '';
alter table public.backups_log add column if not exists size_bytes bigint not null default 0;
alter table public.backups_log add column if not exists integrity_ok boolean not null default true;
alter table public.backups_log add column if not exists source text not null default 'web_json';
alter table public.backups_log add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.backups_log add column if not exists created_at timestamptz not null default now();
alter table public.backups_log add column if not exists updated_at timestamptz not null default now();

create table if not exists public.sync_outbox (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  module text not null default 'Web',
  action text not null default 'sync',
  client_request_id text,
  status text not null default 'pending' check (status in ('pending', 'syncing', 'synced', 'error', 'canceled')),
  payload jsonb not null default '{}'::jsonb,
  error_message text not null default '',
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sync_outbox add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.sync_outbox add column if not exists module text not null default 'Web';
alter table public.sync_outbox add column if not exists action text not null default 'sync';
alter table public.sync_outbox add column if not exists client_request_id text;
alter table public.sync_outbox add column if not exists status text not null default 'pending';
alter table public.sync_outbox add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.sync_outbox add column if not exists error_message text not null default '';
alter table public.sync_outbox add column if not exists attempts integer not null default 0;
alter table public.sync_outbox add column if not exists last_attempt_at timestamptz;
alter table public.sync_outbox add column if not exists created_at timestamptz not null default now();
alter table public.sync_outbox add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_backups_log_store_created on public.backups_log(store_id, created_at desc);
create index if not exists idx_sync_outbox_store_status on public.sync_outbox(store_id, status, created_at desc);
create index if not exists idx_sync_outbox_request on public.sync_outbox(store_id, client_request_id);

drop trigger if exists backups_log_set_updated_at on public.backups_log;
create trigger backups_log_set_updated_at
before update on public.backups_log
for each row execute function public.set_updated_at();

drop trigger if exists sync_outbox_set_updated_at on public.sync_outbox;
create trigger sync_outbox_set_updated_at
before update on public.sync_outbox
for each row execute function public.set_updated_at();

alter table public.backups_log enable row level security;
alter table public.sync_outbox enable row level security;

drop policy if exists backups_log_select_member on public.backups_log;
drop policy if exists backups_log_insert_operator on public.backups_log;
drop policy if exists backups_log_update_operator on public.backups_log;
drop policy if exists backups_log_delete_admin on public.backups_log;

create policy backups_log_select_member on public.backups_log
for select using (public.is_store_member(store_id));

create policy backups_log_insert_operator on public.backups_log
for insert with check (public.has_store_role(store_id, array['owner','admin','operator']));

create policy backups_log_update_operator on public.backups_log
for update using (public.has_store_role(store_id, array['owner','admin','operator']))
with check (public.has_store_role(store_id, array['owner','admin','operator']));

create policy backups_log_delete_admin on public.backups_log
for delete using (public.has_store_role(store_id, array['owner','admin']));

drop policy if exists sync_outbox_select_member on public.sync_outbox;
drop policy if exists sync_outbox_insert_operator on public.sync_outbox;
drop policy if exists sync_outbox_update_operator on public.sync_outbox;
drop policy if exists sync_outbox_delete_admin on public.sync_outbox;

create policy sync_outbox_select_member on public.sync_outbox
for select using (public.is_store_member(store_id));

create policy sync_outbox_insert_operator on public.sync_outbox
for insert with check (public.has_store_role(store_id, array['owner','admin','operator']));

create policy sync_outbox_update_operator on public.sync_outbox
for update using (public.has_store_role(store_id, array['owner','admin','operator']))
with check (public.has_store_role(store_id, array['owner','admin','operator']));

create policy sync_outbox_delete_admin on public.sync_outbox
for delete using (public.has_store_role(store_id, array['owner','admin']));

comment on table public.backups_log is 'Histórico auditável de backups web gerados por loja e usuário.';
comment on table public.sync_outbox is 'Fila auditável para operações web pendentes, erros e futuras sincronizações offline controladas.';
