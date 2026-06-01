# Mega Lote 88 — Supabase Storage para fotos de produtos

## Objetivo
Trocar o caminho comercial de fotos de produtos no web/mobile: quando o usuário salva produto com foto, o app tenta enviar a imagem para o Supabase Storage (`product-photos`) e gravar no banco apenas a URL/caminho da nuvem.

## Fluxo esperado
1. Usuário escolhe foto PNG/JPG/WEBP até 2 MB.
2. O app mostra que a foto está pronta.
3. Ao salvar, o produto é criado/atualizado.
4. O app envia a foto para `product-photos/stores/{store_id}/products/{product_id}/...`.
5. O banco salva a URL pública da foto em `products.image_url`.
6. Outro aparelho carrega a mesma foto pela nuvem.

## Fallback seguro
Se o bucket ainda não existir ou as policies não estiverem aplicadas, o produto continua sendo salvo e a foto fica em modo compatibilidade no campo `image_url` como base64. O Diagnóstico/Sync registra aviso para o usuário configurar o Storage.

## Arquivos alterados
- src/lib/productPhotoStorage.ts
- src/lib/webApi.ts
- src/lib/api.ts (compatibilidade mantida)
- src/pages/Products.tsx
- src/styles/lote88-product-photos-storage.css
- src/main.tsx
- src/lib/cssInventoryReadiness.ts
- src/lib/productionChecklist.ts
- public/sw.js
- scripts/release_check.js
- supabase/migrations/202605310088_product_photos_storage.sql

## Validação manual obrigatória
- Aplicar migration no Supabase.
- Entrar como owner/admin/operator.
- Salvar produto novo com foto.
- Confirmar objeto no bucket `product-photos`.
- Abrir em outro aparelho e conferir a foto.
- Testar viewer/somente leitura bloqueando alteração de foto.
