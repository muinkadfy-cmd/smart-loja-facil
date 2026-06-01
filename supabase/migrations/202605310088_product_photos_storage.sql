-- Mega Lote 88 — Supabase Storage para fotos de produtos
-- Cria bucket product-photos e policies por loja.

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

drop policy if exists "product photos select by store member" on storage.objects;
drop policy if exists "product photos insert by store operator" on storage.objects;
drop policy if exists "product photos update by store operator" on storage.objects;
drop policy if exists "product photos delete by store admin" on storage.objects;

create policy "product photos select by store member"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'product-photos'
  and exists (
    select 1
    from public.store_members sm
    where sm.store_id::text = split_part(storage.objects.name, '/', 2)
      and sm.user_id = auth.uid()
      and sm.status = 'active'
  )
);

create policy "product photos insert by store operator"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-photos'
  and split_part(storage.objects.name, '/', 1) = 'stores'
  and split_part(storage.objects.name, '/', 3) = 'products'
  and exists (
    select 1
    from public.store_members sm
    where sm.store_id::text = split_part(storage.objects.name, '/', 2)
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'operator')
  )
);

create policy "product photos update by store operator"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-photos'
  and exists (
    select 1
    from public.store_members sm
    where sm.store_id::text = split_part(storage.objects.name, '/', 2)
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'operator')
  )
)
with check (
  bucket_id = 'product-photos'
  and exists (
    select 1
    from public.store_members sm
    where sm.store_id::text = split_part(storage.objects.name, '/', 2)
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin', 'operator')
  )
);

create policy "product photos delete by store admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-photos'
  and exists (
    select 1
    from public.store_members sm
    where sm.store_id::text = split_part(storage.objects.name, '/', 2)
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'admin')
  )
);
