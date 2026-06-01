-- Smart Loja Fácil PWA + Supabase
-- Mega Lote 53: Vendas/PDV, Caixa e Crediário web com RPC transacional.

create or replace function public.web_create_sale(sale_payload jsonb)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  target_store_id uuid := (sale_payload ->> 'store_id')::uuid;
  request_id_text text := coalesce(nullif(sale_payload ->> 'request_id', ''), gen_random_uuid()::text);
  customer_id_text text := nullif(sale_payload ->> 'customer_id', '');
  target_customer_id uuid := null;
  method_text text := coalesce(nullif(sale_payload ->> 'payment_method', ''), 'dinheiro');
  discount_value numeric(12,2) := greatest(coalesce((sale_payload ->> 'discount')::numeric, 0), 0);
  installment_count_value integer := least(24, greatest(1, coalesce((sale_payload ->> 'installment_count')::integer, 1)));
  first_due_date_value date := coalesce(nullif(sale_payload ->> 'first_due_date', '')::date, current_date);
  item_value jsonb;
  product_row public.products%rowtype;
  customer_row public.customers%rowtype;
  existing_sale public.sales%rowtype;
  sale_row public.sales%rowtype;
  cash_session_id uuid;
  sale_subtotal numeric(12,2) := 0;
  sale_total numeric(12,2) := 0;
  item_qty numeric(12,3);
  item_unit_price numeric(12,2);
  item_total numeric(12,2);
  item_index integer := 0;
  credit_id uuid;
  installment_amount numeric(12,2);
  installment_cents bigint;
  total_cents bigint;
  base_cents bigint;
  remainder_cents integer;
  i integer;
  open_balance numeric(12,2);
begin
  if target_store_id is null then
    raise exception 'Loja web inválida.';
  end if;

  if not public.has_store_role(target_store_id, array['owner','admin','operator']) then
    raise exception 'Usuário sem permissão para finalizar venda.';
  end if;

  if method_text not in ('dinheiro', 'pix', 'cartao', 'crediario') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  select * into existing_sale
  from public.sales
  where store_id = target_store_id
    and client_request_id = request_id_text
  limit 1;

  if found then
    return existing_sale;
  end if;

  if jsonb_typeof(sale_payload -> 'items') <> 'array' or jsonb_array_length(sale_payload -> 'items') = 0 then
    raise exception 'Venda sem itens.';
  end if;

  if customer_id_text is not null then
    target_customer_id := customer_id_text::uuid;
    select * into customer_row
    from public.customers
    where id = target_customer_id
      and store_id = target_store_id
      and deleted_at is null
    limit 1;

    if not found then
      raise exception 'Cliente não encontrado para esta loja.';
    end if;
  end if;

  if method_text = 'crediario' and target_customer_id is null then
    raise exception 'Selecione um cliente cadastrado para venda no crediário.';
  end if;

  insert into public.sales (
    store_id,
    client_request_id,
    customer_id,
    customer_name,
    subtotal,
    discount,
    total,
    payment_method,
    status,
    created_by
  ) values (
    target_store_id,
    request_id_text,
    target_customer_id,
    coalesce(nullif(customer_row.name, ''), 'Balcão'),
    0,
    discount_value,
    0,
    method_text,
    'finalized',
    auth.uid()
  ) returning * into sale_row;

  for item_value in select * from jsonb_array_elements(sale_payload -> 'items') loop
    item_index := item_index + 1;
    item_qty := greatest(coalesce((item_value ->> 'qty')::numeric, 0), 0);
    if item_qty <= 0 then
      raise exception 'Quantidade inválida no item %.', item_index;
    end if;

    select * into product_row
    from public.products
    where id = (item_value ->> 'product_id')::uuid
      and store_id = target_store_id
      and status = 'active'
    for update;

    if not found then
      raise exception 'Produto do item % não encontrado ou inativo.', item_index;
    end if;

    if product_row.stock < item_qty then
      raise exception 'Estoque insuficiente para %. Disponível: %, necessário: %.', product_row.name, product_row.stock, item_qty;
    end if;

    item_unit_price := coalesce(nullif((item_value ->> 'unit_price')::numeric, 0), product_row.promo_price, product_row.price);
    item_total := round(item_unit_price * item_qty, 2);
    sale_subtotal := sale_subtotal + item_total;

    insert into public.sale_items (
      store_id,
      sale_id,
      product_id,
      product_name,
      qty,
      unit_price,
      total
    ) values (
      target_store_id,
      sale_row.id,
      product_row.id,
      product_row.name,
      item_qty,
      item_unit_price,
      item_total
    );

    update public.products
    set stock = product_row.stock - item_qty
    where id = product_row.id
      and store_id = target_store_id;

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
      target_store_id,
      product_row.id,
      'saida_venda_web',
      item_qty,
      product_row.stock,
      product_row.stock - item_qty,
      'Venda web #' || sale_row.number,
      sale_row.id,
      auth.uid()
    );
  end loop;

  sale_total := greatest(round(sale_subtotal - discount_value, 2), 0);

  if method_text = 'crediario' then
    if customer_row.credit_limit > 0 then
      select coalesce(sum(balance), 0) into open_balance
      from public.credits
      where store_id = target_store_id
        and customer_id = target_customer_id
        and status = 'open';

      if open_balance + sale_total > customer_row.credit_limit then
        raise exception 'Limite de crediário insuficiente. Limite: %, em aberto: %, nova venda: %.', customer_row.credit_limit, open_balance, sale_total;
      end if;
    end if;

    insert into public.credits (
      store_id,
      customer_id,
      customer_name,
      sale_id,
      total,
      balance,
      status
    ) values (
      target_store_id,
      target_customer_id,
      customer_row.name,
      sale_row.id,
      sale_total,
      sale_total,
      'open'
    ) returning id into credit_id;

    total_cents := round(sale_total * 100)::bigint;
    base_cents := total_cents / installment_count_value;
    remainder_cents := (total_cents % installment_count_value)::integer;

    for i in 1..installment_count_value loop
      installment_cents := base_cents + case when i <= remainder_cents then 1 else 0 end;
      installment_amount := installment_cents::numeric / 100;
      insert into public.credit_installments (
        store_id,
        credit_id,
        number,
        amount,
        paid_amount,
        due_date,
        status
      ) values (
        target_store_id,
        credit_id,
        i,
        installment_amount,
        0,
        (first_due_date_value + ((i - 1) || ' months')::interval)::date,
        'open'
      );
    end loop;
  else
    select id into cash_session_id
    from public.cash_sessions
    where store_id = target_store_id
      and status = 'open'
    order by opened_at desc
    limit 1;

    insert into public.cash_movements (
      store_id,
      cash_session_id,
      client_request_id,
      sale_id,
      type,
      method,
      amount,
      reason,
      created_by
    ) values (
      target_store_id,
      cash_session_id,
      'cash-' || request_id_text,
      sale_row.id,
      'entrada',
      method_text,
      sale_total,
      'Venda web finalizada',
      auth.uid()
    );
  end if;

  update public.sales
  set subtotal = sale_subtotal,
      discount = discount_value,
      total = sale_total
  where id = sale_row.id
  returning * into sale_row;

  insert into public.receipts (
    store_id,
    sale_id,
    sale_number,
    receipt_type,
    total,
    content_html,
    status
  ) values (
    target_store_id,
    sale_row.id,
    sale_row.number,
    '80mm',
    sale_total,
    '<section style="font-family:Arial,sans-serif;max-width:320px;margin:auto;color:#111"><h2 style="margin:0 0 8px">Smart Loja Fácil</h2><p style="margin:0 0 8px">Venda #' || sale_row.number || '</p><hr><p>Cliente: ' || sale_row.customer_name || '</p><p>Forma: ' || method_text || '</p><h3>Total: R$ ' || replace(to_char(sale_total, 'FM999999990.00'), '.', ',') || '</h3><small>Comprovante gerado pelo PWA web/Supabase.</small></section>',
    'generated'
  );

  insert into public.audit_log (store_id, user_id, entity, entity_id, action, details)
  values (target_store_id, auth.uid(), 'sales', sale_row.id, 'created_web', jsonb_build_object('total', sale_total, 'items', item_index, 'payment_method', method_text));

  return sale_row;
end;
$$;

comment on function public.web_create_sale(jsonb) is 'Finaliza venda web com bloqueio de estoque, baixa, caixa/crediário, comprovante e auditoria em uma transação.';

create or replace function public.web_cancel_sale(target_sale_id uuid, cancel_reason_text text default 'Cancelamento manual web')
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  sale_row public.sales%rowtype;
  item_row public.sale_items%rowtype;
  product_stock numeric(12,3);
begin
  select * into sale_row
  from public.sales
  where id = target_sale_id
  for update;

  if not found then
    raise exception 'Venda não encontrada.';
  end if;

  if not public.has_store_role(sale_row.store_id, array['owner','admin']) then
    raise exception 'Usuário sem permissão para cancelar venda.';
  end if;

  if sale_row.status = 'canceled' then
    return sale_row;
  end if;

  for item_row in
    select * from public.sale_items
    where sale_id = target_sale_id
      and store_id = sale_row.store_id
  loop
    if item_row.product_id is not null then
      select stock into product_stock
      from public.products
      where id = item_row.product_id
        and store_id = sale_row.store_id
      for update;

      if found then
        update public.products
        set stock = product_stock + item_row.qty
        where id = item_row.product_id
          and store_id = sale_row.store_id;

        insert into public.stock_movements (
          store_id, product_id, type, qty, before_stock, after_stock, reason, reference_id, created_by
        ) values (
          sale_row.store_id, item_row.product_id, 'estorno_venda_web', item_row.qty, product_stock, product_stock + item_row.qty, 'Cancelamento da venda #' || sale_row.number, sale_row.id, auth.uid()
        );
      end if;
    end if;
  end loop;

  update public.cash_movements
  set amount = 0,
      reason = reason || ' · venda cancelada'
  where sale_id = sale_row.id
    and store_id = sale_row.store_id
    and type = 'entrada';

  update public.credits
  set status = 'canceled', balance = 0
  where sale_id = sale_row.id
    and store_id = sale_row.store_id
    and status <> 'paid';

  update public.credit_installments
  set status = 'canceled'
  where store_id = sale_row.store_id
    and credit_id in (select id from public.credits where sale_id = sale_row.id and store_id = sale_row.store_id);

  update public.receipts
  set status = 'canceled'
  where sale_id = sale_row.id
    and store_id = sale_row.store_id;

  update public.sales
  set status = 'canceled',
      canceled_at = now(),
      cancel_reason = coalesce(nullif(cancel_reason_text, ''), 'Cancelamento manual web')
  where id = sale_row.id
  returning * into sale_row;

  insert into public.audit_log (store_id, user_id, entity, entity_id, action, details)
  values (sale_row.store_id, auth.uid(), 'sales', sale_row.id, 'canceled_web', jsonb_build_object('reason', cancel_reason_text));

  return sale_row;
end;
$$;

comment on function public.web_cancel_sale(uuid, text) is 'Cancela venda web, estorna estoque, marca comprovante/crediário e audita.';

create or replace function public.web_receive_credit_payment(
  target_credit_id uuid,
  target_installment_id uuid,
  payment_amount numeric,
  payment_method_text text,
  payment_request_id text,
  redistribute_remaining boolean default false
)
returns public.credits
language plpgsql
security definer
set search_path = public
as $$
declare
  credit_row public.credits%rowtype;
  installment_row public.credit_installments%rowtype;
  payment_row public.payments%rowtype;
  to_pay numeric(12,2);
  new_paid numeric(12,2);
  new_status text;
  new_balance numeric(12,2);
  cash_session_id uuid;
  delta numeric(12,2);
  future_installment_id uuid;
begin
  if payment_amount <= 0 then
    raise exception 'Valor inválido para recebimento.';
  end if;

  select * into credit_row
  from public.credits
  where id = target_credit_id
  for update;

  if not found then
    raise exception 'Crediário não encontrado.';
  end if;

  if not public.has_store_role(credit_row.store_id, array['owner','admin','operator']) then
    raise exception 'Usuário sem permissão para receber crediário.';
  end if;

  if credit_row.status = 'paid' then
    return credit_row;
  end if;

  select * into payment_row
  from public.payments
  where store_id = credit_row.store_id
    and client_request_id = payment_request_id
  limit 1;

  if found then
    return credit_row;
  end if;

  select * into installment_row
  from public.credit_installments
  where id = target_installment_id
    and credit_id = target_credit_id
    and store_id = credit_row.store_id
  for update;

  if not found then
    raise exception 'Parcela não encontrada.';
  end if;

  if installment_row.status = 'paid' then
    raise exception 'Parcela já está paga.';
  end if;

  to_pay := least(payment_amount, greatest(installment_row.amount - installment_row.paid_amount, 0));

  if to_pay <= 0 then
    raise exception 'Valor inválido para recebimento.';
  end if;

  new_paid := installment_row.paid_amount + to_pay;
  new_status := case when new_paid + 0.009 >= installment_row.amount then 'paid' else 'partial' end;

  if redistribute_remaining and new_status <> 'paid' then
    delta := installment_row.amount - new_paid;
    update public.credit_installments
    set amount = new_paid,
        paid_amount = new_paid,
        status = 'paid',
        paid_at = now(),
        payment_method = payment_method_text
    where id = installment_row.id;

    select id into future_installment_id
    from public.credit_installments
    where credit_id = target_credit_id
      and store_id = credit_row.store_id
      and number > installment_row.number
      and status <> 'paid'
    order by number desc
    limit 1;

    if future_installment_id is not null then
      update public.credit_installments
      set amount = amount + delta
      where id = future_installment_id;
    end if;
  else
    update public.credit_installments
    set paid_amount = new_paid,
        status = new_status,
        paid_at = case when new_status = 'paid' then now() else paid_at end,
        payment_method = payment_method_text
    where id = installment_row.id;
  end if;

  select coalesce(sum(amount - paid_amount), 0) into new_balance
  from public.credit_installments
  where credit_id = target_credit_id
    and status <> 'canceled';

  update public.credits
  set balance = new_balance,
      status = case when new_balance <= 0.009 then 'paid' else 'open' end
  where id = target_credit_id
  returning * into credit_row;

  insert into public.payments (
    store_id,
    client_request_id,
    credit_id,
    installment_id,
    amount,
    method,
    status,
    created_by
  ) values (
    credit_row.store_id,
    payment_request_id,
    target_credit_id,
    target_installment_id,
    to_pay,
    payment_method_text,
    'confirmed',
    auth.uid()
  ) returning * into payment_row;

  select id into cash_session_id
  from public.cash_sessions
  where store_id = credit_row.store_id
    and status = 'open'
  order by opened_at desc
  limit 1;

  insert into public.cash_movements (
    store_id,
    cash_session_id,
    client_request_id,
    payment_id,
    type,
    method,
    amount,
    reason,
    created_by
  ) values (
    credit_row.store_id,
    cash_session_id,
    'cash-' || payment_request_id,
    payment_row.id,
    'entrada',
    payment_method_text,
    to_pay,
    'Recebimento de crediário web',
    auth.uid()
  );

  insert into public.audit_log (store_id, user_id, entity, entity_id, action, details)
  values (credit_row.store_id, auth.uid(), 'credits', credit_row.id, 'receive_web', jsonb_build_object('amount', to_pay, 'method', payment_method_text));

  return credit_row;
end;
$$;

comment on function public.web_receive_credit_payment(uuid, uuid, numeric, text, text, boolean) is 'Recebe parcela do crediário web, atualiza saldo, registra pagamento, caixa e auditoria.';
