-- Smart Loja Fácil PWA + Supabase
-- Lote 146: backup, fotos de produtos e histórico geral.
-- Objetivo: garantir tabela de histórico de backup web e bucket/policies para fotos de produtos.
-- Seguro: não apaga dados, não usa DROP, não altera vendas/caixa/estoque.

create table if not exists public.backups_log (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  file_name text not null,
  file_path text not null default '',
  size_bytes bigint not null default 0,
  integrity_ok boolean not null default false,
  source text not null default 'web_json',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_backups_log_store_created on public.backups_log(store_id, created_at desc);

alter table public.backups_log enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'backups_log' and policyname = 'backups_log_select_member') then
    create policy backups_log_select_member on public.backups_log
      for select using (public.is_store_member(store_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'backups_log' and policyname = 'backups_log_insert_admin') then
    create policy backups_log_insert_admin on public.backups_log
      for insert with check (public.has_store_role(store_id, array['owner','admin']));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'backups_log' and policyname = 'backups_log_update_admin') then
    create policy backups_log_update_admin on public.backups_log
      for update using (public.has_store_role(store_id, array['owner','admin']))
      with check (public.has_store_role(store_id, array['owner','admin']));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'backups_log' and policyname = 'backups_log_delete_owner') then
    create policy backups_log_delete_owner on public.backups_log
      for delete using (public.has_store_role(store_id, array['owner']));
  end if;
end $$;

-- Bucket público para leitura das imagens de produto via getPublicUrl.
-- Escrita fica limitada por policy abaixo e pelo caminho stores/{store_id}/products/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-photos',
  'product-photos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Políticas do Storage. Protegem escrita por loja/papel e mantêm leitura pública das imagens.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'product_photos_public_read') then
    create policy product_photos_public_read on storage.objects
      for select using (bucket_id = 'product-photos');
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'product_photos_insert_operator') then
    create policy product_photos_insert_operator on storage.objects
      for insert with check (
        bucket_id = 'product-photos'
        and name ~ '^stores/[0-9a-fA-F-]{36}/products/'
        and public.has_store_role(split_part(name, '/', 2)::uuid, array['owner','admin','operator'])
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'product_photos_update_operator') then
    create policy product_photos_update_operator on storage.objects
      for update using (
        bucket_id = 'product-photos'
        and name ~ '^stores/[0-9a-fA-F-]{36}/products/'
        and public.has_store_role(split_part(name, '/', 2)::uuid, array['owner','admin','operator'])
      ) with check (
        bucket_id = 'product-photos'
        and name ~ '^stores/[0-9a-fA-F-]{36}/products/'
        and public.has_store_role(split_part(name, '/', 2)::uuid, array['owner','admin','operator'])
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'product_photos_delete_admin') then
    create policy product_photos_delete_admin on storage.objects
      for delete using (
        bucket_id = 'product-photos'
        and name ~ '^stores/[0-9a-fA-F-]{36}/products/'
        and public.has_store_role(split_part(name, '/', 2)::uuid, array['owner','admin'])
      );
  end if;
end $$;

comment on table public.backups_log is 'Histórico de backups web/mobile gerados pelo Smart Loja Fácil. O arquivo JSON é baixado no aparelho; esta tabela registra evidência e metadados.';
comment on column public.backups_log.metadata is 'Metadados do backup: versão, cache, contagem de registros e resumo de fotos. Não guardar senha ou chave privada.';

-- Observação operacional:
-- O backup JSON salva dados e links/caminhos das fotos. Ele não embute arquivos físicos do Supabase Storage quando a foto está em product-photos.
-- Para migração completa entre projetos Supabase, exportar também o bucket product-photos.
