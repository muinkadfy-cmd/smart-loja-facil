-- Mega Lote 178 — rotas inteligentes para notificações externas.
-- Atualiza a view usada pela Edge Function para levar o usuário direto na conta/parcela.

create or replace view public.push_credit_due_alerts as
select
  c.store_id,
  c.id as credit_id,
  c.customer_name,
  c.sale_id,
  s.number as sale_number,
  ci.id as installment_id,
  ci.number as installment_number,
  ci.amount,
  ci.paid_amount,
  ci.due_date,
  ci.status,
  case
    when lower(coalesce(ci.status, '')) not in ('paid', 'pago', 'canceled', 'cancelado') and ci.due_date < current_date then 'overdue'
    when lower(coalesce(ci.status, '')) not in ('paid', 'pago', 'canceled', 'cancelado') and ci.due_date = current_date then 'due_today'
    else 'future'
  end as alert_kind
from public.credits c
join public.credit_installments ci on ci.credit_id = c.id and ci.store_id = c.store_id
left join public.sales s on s.id = c.sale_id and s.store_id = c.store_id
where lower(coalesce(c.status, '')) not in ('canceled', 'cancelado')
  and lower(coalesce(ci.status, '')) not in ('paid', 'pago', 'canceled', 'cancelado')
  and ci.due_date <= current_date;
