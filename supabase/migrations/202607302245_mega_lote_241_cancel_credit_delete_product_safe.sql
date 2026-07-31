-- Smart Loja Fácil PWA + Supabase
-- Mega Lote 241: cancelar crediário com histórico preservado e excluir cadastro de produto sem histórico.
-- Operações críticas executadas em RPC transacional e restritas a owner/admin.

create or replace function public.web_cancel_credit_safe(
  target_credit_id uuid,
  cancel_reason_text text,
  restore_stock boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  credit_row public.credits%rowtype;
  sale_row public.sales%rowtype;
  item_row public.sale_items%rowtype;
  product_stock numeric(12,3);
  paid_total numeric(12,2) := 0;
  stock_was_restored boolean := false;
  sale_found boolean := false;
  clean_reason text := nullif(trim(cancel_reason_text), '');
begin
  select * into credit_row
  from public.credits
  where id = target_credit_id
  for update;

  if not found then
    raise exception 'Crediário não encontrado.';
  end if;

  if not public.has_store_role(credit_row.store_id, array['owner','admin']) then
    raise exception 'Somente dono ou administrador pode cancelar crediário.';
  end if;

  if clean_reason is null or char_length(clean_reason) < 6 then
    raise exception 'Informe um motivo com pelo menos 6 letras para cancelar o crediário.';
  end if;

  if credit_row.status = 'canceled' then
    select coalesce(sum(paid_amount), 0) into paid_total
    from public.credit_installments
    where credit_id = credit_row.id
      and store_id = credit_row.store_id;

    return jsonb_build_object(
      'credit_id', credit_row.id,
      'stock_restored', false,
      'paid_total_preserved', paid_total,
      'message', 'Este crediário já estava cancelado.'
    );
  end if;

  select coalesce(sum(paid_amount), 0) into paid_total
  from public.credit_installments
  where credit_id = credit_row.id
    and store_id = credit_row.store_id;

  if credit_row.sale_id is not null then
    select * into sale_row
    from public.sales
    where id = credit_row.sale_id
      and store_id = credit_row.store_id
    for update;
    sale_found := found;

    if sale_found and restore_stock and sale_row.status <> 'canceled' then
      for item_row in
        select * from public.sale_items
        where sale_id = sale_row.id
          and store_id = credit_row.store_id
      loop
        if item_row.product_id is not null then
          select stock into product_stock
          from public.products
          where id = item_row.product_id
            and store_id = credit_row.store_id
          for update;

          if found then
            update public.products
            set stock = product_stock + item_row.qty,
                updated_at = now()
            where id = item_row.product_id
              and store_id = credit_row.store_id;

            insert into public.stock_movements (
              store_id, product_id, type, qty, before_stock, after_stock,
              reason, reference_id, created_by
            ) values (
              credit_row.store_id,
              item_row.product_id,
              'cancelamento_crediario',
              item_row.qty,
              product_stock,
              product_stock + item_row.qty,
              'Cancelamento do crediário da venda #' || sale_row.number || ' · ' || clean_reason,
              credit_row.id,
              auth.uid()
            );
            stock_was_restored := true;
          end if;
        end if;
      end loop;
    end if;

    if sale_found then
      update public.sales
      set status = 'canceled',
          canceled_at = coalesce(canceled_at, now()),
          cancel_reason = clean_reason,
          updated_at = now()
      where id = sale_row.id
        and store_id = credit_row.store_id;

      update public.receipts
      set status = 'canceled'
      where sale_id = sale_row.id
        and store_id = credit_row.store_id;
    end if;
  end if;

  update public.credit_installments
  set status = 'canceled',
      updated_at = now()
  where credit_id = credit_row.id
    and store_id = credit_row.store_id;

  update public.credits
  set status = 'canceled',
      balance = 0,
      updated_at = now()
  where id = credit_row.id
    and store_id = credit_row.store_id;

  -- Pagamentos e movimentos de caixa já confirmados são preservados.
  -- O cancelamento não cria estorno automático de caixa.
  insert into public.audit_log (store_id, user_id, entity, entity_id, action, details)
  values (
    credit_row.store_id,
    auth.uid(),
    'credits',
    credit_row.id,
    'credit_canceled_safe',
    jsonb_build_object(
      'reason', clean_reason,
      'sale_id', credit_row.sale_id,
      'original_total', credit_row.total,
      'original_balance', credit_row.balance,
      'paid_total_preserved', paid_total,
      'restore_stock_requested', restore_stock,
      'stock_restored', stock_was_restored,
      'cash_movements_changed', false,
      'payments_changed', false
    )
  );

  return jsonb_build_object(
    'credit_id', credit_row.id,
    'stock_restored', stock_was_restored,
    'paid_total_preserved', paid_total,
    'message', case
      when paid_total > 0 then 'Crediário cancelado. Pagamentos e caixa anteriores foram preservados no histórico.'
      else 'Crediário cancelado com histórico preservado.'
    end
  );
end;
$$;

comment on function public.web_cancel_credit_safe(uuid, text, boolean) is
'Cancela crediário e parcelas sem apagar histórico; opcionalmente devolve itens ao estoque e não altera pagamentos/caixa anteriores.';

revoke all on function public.web_cancel_credit_safe(uuid, text, boolean) from public;
revoke all on function public.web_cancel_credit_safe(uuid, text, boolean) from anon;
grant execute on function public.web_cancel_credit_safe(uuid, text, boolean) to authenticated;

create or replace function public.web_delete_product_safe(
  target_product_id uuid,
  delete_reason_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  product_row public.products%rowtype;
  sales_count bigint := 0;
  orders_count bigint := 0;
  stock_count bigint := 0;
  clean_reason text := nullif(trim(delete_reason_text), '');
begin
  select * into product_row
  from public.products
  where id = target_product_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Produto não encontrado ou já excluído.';
  end if;

  if not public.has_store_role(product_row.store_id, array['owner','admin']) then
    raise exception 'Somente dono ou administrador pode excluir cadastro de produto.';
  end if;

  if clean_reason is null or char_length(clean_reason) < 6 then
    raise exception 'Informe um motivo com pelo menos 6 letras para excluir o cadastro.';
  end if;

  if product_row.status <> 'inactive' then
    raise exception 'Inative o produto antes de excluir o cadastro.';
  end if;

  select count(*) into sales_count
  from public.sale_items
  where store_id = product_row.store_id
    and product_id = product_row.id;

  select count(*) into orders_count
  from public.order_items
  where store_id = product_row.store_id
    and product_id = product_row.id;

  select count(*) into stock_count
  from public.stock_movements
  where store_id = product_row.store_id
    and product_id = product_row.id;

  if sales_count > 0 or orders_count > 0 or stock_count > 0 then
    raise exception 'Este produto possui histórico de venda, pedido ou estoque. Para preservar relatórios, use Inativar em vez de excluir.';
  end if;

  update public.products
  set status = 'inactive',
      deleted_at = now(),
      updated_at = now()
  where id = product_row.id
    and store_id = product_row.store_id;

  insert into public.audit_log (store_id, user_id, entity, entity_id, action, details)
  values (
    product_row.store_id,
    auth.uid(),
    'products',
    product_row.id,
    'product_deleted_safe',
    jsonb_build_object(
      'reason', clean_reason,
      'product_name', product_row.name,
      'stock_at_deletion', product_row.stock,
      'sales_history_count', sales_count,
      'order_history_count', orders_count,
      'stock_history_count', stock_count,
      'soft_delete', true
    )
  );

  return jsonb_build_object(
    'deleted', true,
    'product_id', product_row.id,
    'product_name', product_row.name,
    'message', 'Cadastro do produto excluído. Como não havia histórico, ele saiu definitivamente das listas.'
  );
end;
$$;

comment on function public.web_delete_product_safe(uuid, text) is
'Faz exclusão lógica de produto somente quando não existe histórico de venda, pedido ou estoque; caso contrário exige inativação.';

revoke all on function public.web_delete_product_safe(uuid, text) from public;
revoke all on function public.web_delete_product_safe(uuid, text) from anon;
grant execute on function public.web_delete_product_safe(uuid, text) to authenticated;
