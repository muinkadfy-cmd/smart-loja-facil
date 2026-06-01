-- Smart Loja Fácil PWA + Supabase
-- Mega Lote 56: comprovante web premium 58mm/80mm/A4 com HTML gerado no banco.

create or replace function public.web_escape_html(value text)
returns text
language sql
immutable
as $$
  select replace(
           replace(
             replace(
               replace(
                 replace(coalesce(value, ''), '&', '&amp;'),
               '<', '&lt;'),
             '>', '&gt;'),
           '"', '&quot;'),
         '''', '&#039;');
$$;

create or replace function public.web_money_br(value numeric)
returns text
language sql
immutable
as $$
  select 'R$ ' || replace(to_char(coalesce(value, 0), 'FM999999999990.00'), '.', ',');
$$;

create or replace function public.web_qty_br(value numeric)
returns text
language sql
immutable
as $$
  select replace(to_char(coalesce(value, 0), 'FM999999990.###'), '.', ',');
$$;

create or replace function public.web_build_receipt_html(target_sale_id uuid, target_format text default '80mm')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  sale_row public.sales%rowtype;
  store_row public.stores%rowtype;
  items_html text := '';
  clean_format text := case when lower(coalesce(target_format, '80mm')) in ('58mm','a4') then lower(target_format) else '80mm' end;
  format_label text := case when lower(coalesce(target_format, '80mm')) = '58mm' then '58mm' when lower(coalesce(target_format, '80mm')) = 'a4' then 'A4' else '80mm' end;
  payment_label text := '';
  status_label text := '';
  logo_src text := '/brand/smart-loja-icon.png';
  contact_line text := '';
  generated_text text := '';
begin
  select * into sale_row
  from public.sales
  where id = target_sale_id
  limit 1;

  if not found then
    return '<section class="slf-receipt"><div class="slf-receipt-title">Comprovante não encontrado</div></section>';
  end if;

  select * into store_row
  from public.stores
  where id = sale_row.store_id
  limit 1;

  if found and nullif(store_row.logo_url, '') is not null then
    logo_src := store_row.logo_url;
  end if;

  payment_label := case sale_row.payment_method
    when 'dinheiro' then 'Dinheiro'
    when 'pix' then 'Pix'
    when 'cartao' then 'Cartão'
    when 'crediario' then 'Crediário'
    when 'misto' then 'Misto'
    else coalesce(sale_row.payment_method, '-')
  end;

  status_label := case sale_row.status
    when 'finalized' then 'Finalizada'
    when 'canceled' then 'Cancelada'
    when 'draft' then 'Rascunho'
    else coalesce(sale_row.status, '-')
  end;

  contact_line := trim(both ' · ' from concat_ws(' · ', nullif(store_row.phone, ''), nullif(store_row.whatsapp, ''), nullif(store_row.address, '')));
  generated_text := to_char(sale_row.created_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');

  select coalesce(string_agg(
    concat(
      '<tr><td>', public.web_escape_html(public.web_qty_br(si.qty)), '</td>',
      '<td>', public.web_escape_html(si.product_name), '</td>',
      '<td class="num">', public.web_escape_html(public.web_money_br(si.unit_price)), '</td>',
      '<td class="num">', public.web_escape_html(public.web_money_br(si.total)), '</td></tr>'
    ), '' order by si.created_at, si.id),
    '<tr><td colspan="4">Itens não encontrados para esta venda.</td></tr>'
  ) into items_html
  from public.sale_items si
  where si.sale_id = sale_row.id
    and si.store_id = sale_row.store_id;

  return concat(
    '<section class="slf-receipt slf-receipt-', public.web_escape_html(clean_format), '">',
      '<div class="slf-receipt-head">',
        '<div class="slf-receipt-brand">',
          '<img class="slf-receipt-logo" src="', public.web_escape_html(logo_src), '" alt="Logo da loja">',
          '<div><div class="slf-receipt-title">', public.web_escape_html(coalesce(nullif(store_row.name, ''), 'Smart Loja Fácil')), '</div>',
          '<div class="slf-receipt-sub">', public.web_escape_html(coalesce(nullif(contact_line, ''), 'Comprovante da loja')), '</div></div>',
        '</div>',
        '<div class="slf-receipt-badge">Venda #', sale_row.number, ' · ', public.web_escape_html(format_label), '</div>',
      '</div>',
      '<div class="slf-receipt-grid">',
        '<div class="slf-receipt-info"><span>Cliente</span><strong>', public.web_escape_html(coalesce(nullif(sale_row.customer_name, ''), 'Balcão')), '</strong></div>',
        '<div class="slf-receipt-info"><span>Data</span><strong>', public.web_escape_html(generated_text), '</strong></div>',
        '<div class="slf-receipt-info"><span>Pagamento</span><strong>', public.web_escape_html(payment_label), '</strong></div>',
        '<div class="slf-receipt-info"><span>Status</span><strong>', public.web_escape_html(status_label), '</strong></div>',
      '</div>',
      '<table class="slf-receipt-table"><thead><tr><th>Qtd.</th><th>Produto</th><th class="num">Unit.</th><th class="num">Total</th></tr></thead><tbody>', items_html, '</tbody></table>',
      '<div class="slf-receipt-total">',
        '<div class="slf-receipt-total-row"><span>Subtotal</span><strong>', public.web_money_br(sale_row.subtotal), '</strong></div>',
        '<div class="slf-receipt-total-row"><span>Desconto</span><strong>', public.web_money_br(sale_row.discount), '</strong></div>',
        '<div class="slf-receipt-total-row final"><span>Total</span><strong>', public.web_money_br(sale_row.total), '</strong></div>',
      '</div>',
      '<div class="slf-receipt-note">', public.web_escape_html(coalesce(nullif(store_row.receipt_message, ''), 'Obrigado pela preferência!')), '<br>Guarde este comprovante para conferência da compra.</div>',
      '<div class="slf-receipt-footer">Smart Loja Fácil · PWA Web/Mobile · Gerado com Supabase</div>',
    '</section>'
  );
end;
$$;

create or replace function public.web_apply_premium_receipt_html()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sale_id is not null then
    new.content_html := public.web_build_receipt_html(new.sale_id, new.receipt_type);
  end if;
  return new;
end;
$$;

drop trigger if exists receipts_premium_html on public.receipts;
create trigger receipts_premium_html
before insert or update of sale_id, receipt_type, total, status on public.receipts
for each row execute function public.web_apply_premium_receipt_html();

update public.receipts r
set content_html = public.web_build_receipt_html(r.sale_id, r.receipt_type)
where r.sale_id is not null
  and (
    r.content_html = ''
    or r.content_html ilike '%Comprovante gerado pelo PWA web%'
    or r.content_html ilike '%max-width:320px%'
  );

comment on function public.web_build_receipt_html(uuid, text) is 'Gera HTML premium de comprovante web para impressão 58mm, 80mm ou A4.';
