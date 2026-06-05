-- Mega lote 175: preço de custo + SKU/código de barras automáticos no cadastro de produtos.
-- Seguro para rodar mais de uma vez.

alter table public.products
  add column if not exists cost_price numeric(12,2) not null default 0;

create index if not exists idx_products_store_internal_code
  on public.products(store_id, internal_code)
  where deleted_at is null and coalesce(internal_code, '') <> '';

create index if not exists idx_products_store_barcode
  on public.products(store_id, barcode)
  where deleted_at is null and coalesce(barcode, '') <> '';
