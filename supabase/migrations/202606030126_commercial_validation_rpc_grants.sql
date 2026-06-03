-- Smart Loja Fácil PWA + Supabase
-- Lote 126: validação comercial real e endurecimento seguro das RPCs usadas no mobile.
-- Objetivo: deixar explícito quem pode executar funções sensíveis, criar bootstrap seguro da primeira loja
-- e permitir teste comercial sem abrir policy pública ou expor service_role.

create or replace function public.create_owned_store(store_name text default 'Smart Loja Fácil Web')
returns public.stores
language plpgsql
security definer
set search_path = public
as $$
declare
  new_store public.stores%rowtype;
  clean_name text := nullif(trim(store_name), '');
begin
  if auth.uid() is null then
    raise exception 'Entre com login antes de criar a loja web.';
  end if;

  insert into public.stores (
    name,
    owner_id,
    receipt_message,
    low_stock_limit,
    status
  ) values (
    coalesce(clean_name, 'Smart Loja Fácil Web'),
    auth.uid(),
    'Obrigado pela preferência!',
    3,
    'active'
  )
  returning * into new_store;

  insert into public.store_members (store_id, user_id, role)
  values (new_store.id, auth.uid(), 'owner')
  on conflict (store_id, user_id) do update set role = 'owner';

  insert into public.audit_log (store_id, user_id, entity, entity_id, action, details)
  values (new_store.id, auth.uid(), 'stores', new_store.id, 'web_store_created', jsonb_build_object('source', 'create_owned_store_rpc'));

  return new_store;
end;
$$;

comment on function public.create_owned_store(text) is 'Cria a primeira loja do usuário autenticado, vincula owner e registra auditoria sem expor service_role no frontend.';

-- Bloqueia execução anônima/pública e libera apenas usuários autenticados.
revoke all on function public.create_owned_store(text) from public;
revoke all on function public.create_owned_store(text) from anon;
grant execute on function public.create_owned_store(text) to authenticated;

revoke all on function public.web_create_sale(jsonb) from public;
revoke all on function public.web_create_sale(jsonb) from anon;
grant execute on function public.web_create_sale(jsonb) to authenticated;

revoke all on function public.web_cancel_sale(uuid, text) from public;
revoke all on function public.web_cancel_sale(uuid, text) from anon;
grant execute on function public.web_cancel_sale(uuid, text) to authenticated;

revoke all on function public.web_receive_credit_payment(uuid, uuid, numeric, text, text, boolean) from public;
revoke all on function public.web_receive_credit_payment(uuid, uuid, numeric, text, text, boolean) from anon;
grant execute on function public.web_receive_credit_payment(uuid, uuid, numeric, text, text, boolean) to authenticated;

revoke all on function public.web_complete_order(uuid) from public;
revoke all on function public.web_complete_order(uuid) from anon;
grant execute on function public.web_complete_order(uuid) to authenticated;

-- Helpers de diagnóstico: leitura autenticada, sem liberar escrita.
revoke all on function public.current_store_role(uuid) from public;
revoke all on function public.current_store_role(uuid) from anon;
grant execute on function public.current_store_role(uuid) to authenticated;

-- Não há DROP/DELETE/UPDATE destrutivo neste arquivo.
-- Rollback seguro, se necessário: revogar execute de authenticated nas funções acima e restaurar grants anteriores.
