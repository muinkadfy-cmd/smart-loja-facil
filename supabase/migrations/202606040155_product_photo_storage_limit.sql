-- Smart Loja Fácil PWA + Supabase
-- Mega Lote 155: permite selecionar fotos maiores no celular com compressão automática.
-- A foto original pode ser maior no aparelho, mas o app reduz antes de subir.
-- Este ajuste aumenta a tolerância do bucket para evitar falha em imagens preparadas um pouco maiores.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-photos',
  'product-photos',
  true,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 8388608,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

comment on table storage.objects is 'Fotos de produtos do Smart Loja Fácil ficam no bucket product-photos; o app reduz fotos grandes antes de enviar.';
