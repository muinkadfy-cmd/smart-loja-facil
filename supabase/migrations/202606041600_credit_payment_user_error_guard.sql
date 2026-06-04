-- Lote 159: proteção contra erro de digitação no recebimento do crediário.
-- Bloqueia excesso acima da dívida, permite pagamento parcial e só abate próximas parcelas quando solicitado.

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
  selected_installment public.credit_installments%rowtype;
  payment_row public.payments%rowtype;
  cash_session_id uuid;
  remaining_to_apply numeric(12,2);
  installment_open numeric(12,2);
  selected_open_before numeric(12,2);
  credit_open_before numeric(12,2);
  new_paid numeric(12,2);
  new_status text;
  new_balance numeric(12,2);
  affected_installments jsonb := '[]'::jsonb;
  sale_number_value integer;
  receipt_html text;
begin
  payment_amount := round(coalesce(payment_amount, 0), 2);
  payment_method_text := lower(trim(coalesce(payment_method_text, '')));

  if payment_amount <= 0 then
    raise exception 'Informe um valor maior que R$ 0,00.';
  end if;

  if payment_method_text not in ('dinheiro', 'pix', 'cartao', 'outro') then
    raise exception 'Escolha como o cliente pagou: dinheiro, PIX, cartão ou outro.';
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

  select * into payment_row
  from public.payments
  where store_id = credit_row.store_id
    and client_request_id = payment_request_id
  limit 1;

  if found then
    return credit_row;
  end if;

  select * into selected_installment
  from public.credit_installments
  where id = target_installment_id
    and credit_id = target_credit_id
    and store_id = credit_row.store_id
  for update;

  if not found then
    raise exception 'Parcela não encontrada.';
  end if;

  if selected_installment.status = 'paid' then
    raise exception 'Essa parcela já está paga. Escolha outra parcela em aberto.';
  end if;

  selected_open_before := greatest(selected_installment.amount - selected_installment.paid_amount, 0);

  select coalesce(sum(greatest(amount - paid_amount, 0)), 0) into credit_open_before
  from public.credit_installments
  where credit_id = target_credit_id
    and store_id = credit_row.store_id
    and status <> 'canceled';

  if payment_amount > credit_open_before + 0.009 then
    raise exception 'Esse valor parece maior que o saldo em aberto. Confira antes de receber.';
  end if;

  if payment_amount > selected_open_before + 0.009 and not redistribute_remaining then
    raise exception 'Esse valor parece maior que a parcela. Para abater próximas parcelas, marque a opção de redistribuir antes de confirmar.';
  end if;

  remaining_to_apply := payment_amount;

  for installment_row in
    select *
    from public.credit_installments
    where credit_id = target_credit_id
      and store_id = credit_row.store_id
      and number >= selected_installment.number
      and status <> 'paid'
      and status <> 'canceled'
    order by number asc
    for update
  loop
    exit when remaining_to_apply <= 0.009;
    installment_open := greatest(installment_row.amount - installment_row.paid_amount, 0);
    if installment_open <= 0 then
      continue;
    end if;

    new_paid := installment_row.paid_amount + least(remaining_to_apply, installment_open);
    new_status := case when new_paid + 0.009 >= installment_row.amount then 'paid' else 'partial' end;

    update public.credit_installments
    set paid_amount = new_paid,
        status = new_status,
        paid_at = case when new_status = 'paid' then now() else paid_at end,
        payment_method = payment_method_text
    where id = installment_row.id;

    affected_installments := affected_installments || jsonb_build_array(jsonb_build_object(
      'installment_id', installment_row.id,
      'number', installment_row.number,
      'before_paid', installment_row.paid_amount,
      'after_paid', new_paid,
      'before_open', installment_open,
      'after_open', greatest(installment_row.amount - new_paid, 0),
      'status_after', new_status
    ));

    remaining_to_apply := remaining_to_apply - least(remaining_to_apply, installment_open);
  end loop;

  if remaining_to_apply > 0.009 then
    raise exception 'Esse valor parece maior que o saldo em aberto. Confira antes de receber.';
  end if;

  select coalesce(sum(greatest(amount - paid_amount, 0)), 0) into new_balance
  from public.credit_installments
  where credit_id = target_credit_id
    and store_id = credit_row.store_id
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
    payment_amount,
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
    payment_amount,
    'Recebimento de crediário web',
    auth.uid()
  );

  if credit_row.sale_id is not null then
    select number into sale_number_value
    from public.sales
    where id = credit_row.sale_id
      and store_id = credit_row.store_id;

    receipt_html :=
      '<section style="font-family:Arial,sans-serif;max-width:320px;margin:auto;color:#111">' ||
      '<h2 style="margin:0 0 8px">Smart Loja Fácil</h2>' ||
      '<p style="margin:0 0 8px">Comprovante de crediário</p><hr>' ||
      '<p>Cliente: ' || coalesce(credit_row.customer_name, 'Cliente') || '</p>' ||
      '<p>Parcela: ' || selected_installment.number || '</p>' ||
      '<p>Valor recebido: R$ ' || replace(to_char(payment_amount, 'FM999999990.00'), '.', ',') || '</p>' ||
      '<p>Parcela antes em aberto: R$ ' || replace(to_char(selected_open_before, 'FM999999990.00'), '.', ',') || '</p>' ||
      '<p>Restante do crediário: R$ ' || replace(to_char(new_balance, 'FM999999990.00'), '.', ',') || '</p>' ||
      '<p>Status depois: ' || case when new_balance <= 0.009 then 'quitado' when payment_amount < selected_open_before then 'parcial' else 'em aberto' end || '</p>' ||
      '<p>Forma: ' || payment_method_text || '</p>' ||
      '<p>Data: ' || to_char(now(), 'DD/MM/YYYY HH24:MI') || '</p>' ||
      '<small>Se foi pagamento parcial, o restante continua em aberto. Se houve valor maior que a parcela, foi abatido nas próximas parcelas.</small>' ||
      '</section>';

    insert into public.receipts (
      store_id,
      sale_id,
      sale_number,
      receipt_type,
      total,
      content_html,
      status
    ) values (
      credit_row.store_id,
      credit_row.sale_id,
      coalesce(sale_number_value, 0),
      '80mm',
      payment_amount,
      receipt_html,
      'generated'
    );
  end if;

  insert into public.audit_log (store_id, user_id, entity, entity_id, action, details)
  values (credit_row.store_id, auth.uid(), 'credits', credit_row.id, 'receive_web', jsonb_build_object(
    'amount_received', payment_amount,
    'installment_id', target_installment_id,
    'credit_open_before', credit_open_before,
    'credit_open_after', new_balance,
    'method', payment_method_text,
    'redistributed_to_next_installments', redistribute_remaining,
    'affected_installments', affected_installments,
    'observation', 'Recebimento protegido contra erro de digitação; histórico anterior preservado.'
  ));

  return credit_row;
end;
$$;

comment on function public.web_receive_credit_payment(uuid, uuid, numeric, text, text, boolean) is
  'Recebe crediário com proteção contra erro de valor, pagamento parcial, abatimento seguro de próximas parcelas, comprovante e auditoria.';
