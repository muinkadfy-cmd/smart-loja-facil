# Mega Lote 155 — Produto assistido, foto maior comprimida e crediário parcelado

## COMANDO MESTRE 10/10
Status: aplicado.

Prioridade usada: P1/P2 operacional com proteção de dados reais.

## Auditoria antes da correção

### Produtos
- A tela mobile já tinha foto, miniatura e ampliação do Lote 154.
- O cadastro ainda estava seco para loja de roupas: categoria, tamanho e cor eram campos manuais sem ajuda.
- Fotos acima de 2 MB eram bloqueadas antes de tentar otimizar.

### Fotos e backup
- O backup do Lote 154 já tentava embutir imagens quando possível.
- Faltava deixar claro e prático que foto grande pode ser escolhida no celular e preparada antes de salvar.
- O bucket product-photos continuava com limite antigo de 2 MB na migration anterior.

### Crediário
- O backend/RPC já aceitava `installment_count` e dividia em parcelas.
- O problema principal estava no mobile: campo numérico simples, sem atalhos 1x/2x/3x, sem prévia do valor por parcela e sem atalhos de vencimento.

## O que foi feito

### Novo Produto
- Adicionado preenchimento rápido para:
  - Blusa feminina
  - Vestido
  - Camiseta masculina
  - Infantil
  - Lingerie
  - Acessório
  - Presente
  - Utilitário
- Categoria virou seleção guiada com opções comuns de roupas e loja.
- Adicionados botões rápidos de tamanho.
- Adicionados botões rápidos de cor.
- Texto do formulário ficou mais leigo.

### Foto de produto
- O app agora aceita escolher foto original até 12 MB no aparelho.
- A foto é reduzida/comprimida no navegador antes de salvar.
- A meta de saída é manter imagem leve para sincronização e backup.
- O feedback mostra se a foto foi reduzida e de quanto para quanto.
- O limite do Storage foi reforçado em migration para 8 MB como margem de segurança.
- A constante de segurança do app para Storage subiu para 4 MB, mas a compressão mira bem menos que isso.

### Crediário
- Parcelas começam em 1x por padrão.
- Adicionados atalhos 1x, 2x, 3x, 4x, 5x, 6x, 10x e 12x.
- Adicionada prévia: “Nx de R$ X”.
- Adicionados atalhos de primeiro vencimento: Hoje, +15 dias e +30 dias.
- O valor enviado para o Supabase é normalizado entre 1 e 24 parcelas.
- Adicionada validação para primeiro vencimento obrigatório no crediário.

## Arquivos alterados/novos

- docs/MEGA_LOTE_155_PRODUTO_ASSISTIDO_FOTO_CREDIARIO.md
- package.json
- package-lock.json
- public/manifest.webmanifest
- public/sw.js
- scripts/commercial_package_check.js
- scripts/commercial_release_package.js
- scripts/release_check.js
- src/lib/productPhotoStorage.ts
- src/lib/productionChecklist.ts
- src/lib/webApi.ts
- src/main.tsx
- src/mobile-app/screens/BackupScreen.tsx
- src/mobile-app/screens/ProductsCustomersScreens.tsx
- src/mobile-app/screens/SalesScreen.tsx
- src/mobile-app/styles/mobile-app.css
- src/pages/Backup.tsx
- supabase/migrations/202606040155_product_photo_storage_limit.sql

## Testes executados

- npm run type-check — OK
- npm run build — OK
- npm run lint — OK
- npm run release:check — OK
- npm run release:commercial:check — OK
- npm run release:commercial:prepare — OK
- npm audit --audit-level=high — 0 vulnerabilidades
- JSON package/lock/manifest — OK

## PWA/cache

- WEB_APP_VERSION: pwa-supabase-v155-produto-assistido-crediario-foto
- WEB_CACHE_VERSION: smart-loja-pwa-supabase-v155-produto-assistido-crediario-foto

## Limitações reais

- A compressão usa recursos do navegador; aparelho muito antigo pode falhar em imagem muito pesada.
- O backup tenta embutir fotos quando o navegador consegue ler a imagem. Se alguma foto estiver inacessível por regra de Storage/CORS/projeto diferente, o JSON mantém link/caminho.
- Para migração completa entre projetos Supabase, ainda é recomendado copiar o bucket product-photos.
- Crediário precisa teste real criando venda de 1x, 2x e 3x no Supabase de produção.

## Como testar manualmente

1. Criar produto de roupa usando preenchimento rápido.
2. Escolher categoria, tamanho e cor por botões.
3. Selecionar foto maior que 2 MB e confirmar se o app reduz.
4. Salvar produto e conferir miniatura.
5. Criar backup e verificar `product_photo_files` quando possível.
6. Fazer venda no crediário em 1x.
7. Fazer venda no crediário em 2x.
8. Fazer venda no crediário em 3x.
9. Abrir a aba Crediário e conferir parcelas, valor original, pago e restante.
