-- Smart Loja Fácil PWA + Supabase
-- Correção de segurança da fundação web/mobile: membros, dono e RLS.

create or replace function public.attach_store_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.store_members (store_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (store_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

drop trigger if exists stores_attach_owner_member on public.stores;
create trigger stores_attach_owner_member
after insert on public.stores
for each row execute function public.attach_store_owner_member();

drop policy if exists members_insert_admin on public.store_members;
create policy "members_insert_admin" on public.store_members
for insert
with check (public.has_store_role(store_id, array['owner','admin']));

create or replace function public.prevent_store_owner_member_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  store_owner uuid;
begin
  select owner_id into store_owner from public.stores where id = coalesce(old.store_id, new.store_id);

  if tg_op = 'DELETE' and old.user_id = store_owner and old.role = 'owner' then
    raise exception 'O dono principal da loja nao pode ser removido.';
  end if;

  if tg_op = 'UPDATE' and old.user_id = store_owner and (new.role <> 'owner' or new.store_id <> old.store_id or new.user_id <> old.user_id) then
    raise exception 'O dono principal da loja nao pode ser rebaixado ou movido.';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists store_members_protect_owner_update on public.store_members;
create trigger store_members_protect_owner_update
before update on public.store_members
for each row execute function public.prevent_store_owner_member_change();

drop trigger if exists store_members_protect_owner_delete on public.store_members;
create trigger store_members_protect_owner_delete
before delete on public.store_members
for each row execute function public.prevent_store_owner_member_change();

create or replace function public.current_store_role(target_store_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select sm.role
  from public.store_members sm
  where sm.store_id = target_store_id
    and sm.user_id = auth.uid()
  limit 1;
$$;

comment on function public.attach_store_owner_member() is 'Adiciona automaticamente o criador da loja como owner sem permitir autoentrada em lojas de terceiros.';
comment on function public.prevent_store_owner_member_change() is 'Bloqueia remocao/rebaixamento do dono principal da loja.';
comment on function public.current_store_role(uuid) is 'Retorna o papel do usuario autenticado na loja ativa para diagnostico web.';
