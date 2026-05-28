-- Smart Loja Fácil PWA + Supabase
-- Mega Lote 52: entrega de pedido web com baixa de estoque transacional no Supabase.

create or replace function public.web_complete_order(target_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
  item_row public.order_items%rowtype;
  product_stock numeric(12,3);
  product_name text;
begin
  select * into order_row
  from public.orders
  where id = target_order_id
  for update;

  if not found then
    raise exception 'Pedido nao encontrado.';
  end if;

  if not public.has_store_role(order_row.store_id, array['owner','admin','operator']) then
    raise exception 'Usuario sem permissao para entregar este pedido.';
  end if;

  if order_row.status = 'canceled' then
    raise exception 'Pedido cancelado nao pode ser entregue.';
  end if;

  if order_row.status = 'delivered' then
    return order_row;
  end if;

  for item_row in
    select * from public.order_items
    where order_id = target_order_id
      and store_id = order_row.store_id
    order by created_at asc
  loop
    if item_row.product_id is null then
      raise exception 'Item % nao tem produto vinculado para baixa.', item_row.product_name;
    end if;

    select stock, name into product_stock, product_name
    from public.products
    where id = item_row.product_id
      and store_id = order_row.store_id
      and status = 'active'
    for update;

    if not found then
      raise exception 'Produto % nao encontrado ou inativo.', item_row.product_name;
    end if;

    if product_stock < item_row.qty then
      raise exception 'Estoque insuficiente para %. Disponivel: %, necessario: %.', product_name, product_stock, item_row.qty;
    end if;

    update public.products
    set stock = product_stock - item_row.qty
    where id = item_row.product_id
      and store_id = order_row.store_id;

    insert into public.stock_movements (
      store_id,
      product_id,
      type,
      qty,
      before_stock,
      after_stock,
      reason,
      reference_id,
      created_by
    ) values (
      order_row.store_id,
      item_row.product_id,
      'saida_pedido_web',
      item_row.qty,
      product_stock,
      product_stock - item_row.qty,
      'Entrega do pedido #' || order_row.number,
      order_row.id,
      auth.uid()
    );
  end loop;

  update public.orders
  set status = 'delivered'
  where id = order_row.id
  returning * into order_row;

  insert into public.audit_log (store_id, user_id, entity, entity_id, action, details)
  values (order_row.store_id, auth.uid(), 'orders', order_row.id, 'delivered', jsonb_build_object('source', 'web_complete_order'));

  return order_row;
end;
$$;

comment on function public.web_complete_order(uuid) is 'Entrega pedido web com bloqueio transacional, valida estoque e registra baixa/auditoria.';
