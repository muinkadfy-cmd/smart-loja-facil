# Mega Lote 154 — Fotos de produtos, miniatura, ampliação e backup das imagens

## COMANDO MESTRE 10/10
Status: aplicado.
Prioridade: P1/P2 seguro, focado em fotos de produtos e backup, sem mexer em venda, caixa, crediário, permissões ou dados críticos.

## Auditoria encontrada
- A tela desktop antiga de Produtos já tinha escolha de foto.
- A tela mobile nova de Produtos ainda não tinha campo de foto no formulário.
- A lista mobile não mostrava miniatura do produto.
- Não havia modal de ampliação da foto ao tocar na miniatura.
- O backup web salvava o cadastro e o link/caminho da foto, mas não tentava embutir o arquivo físico da imagem dentro do JSON.

## Correções feitas
- Adicionado campo de foto no formulário mobile de Produtos.
- Validação de foto PNG/JPG/WEBP até 2 MB.
- Prévia da foto antes de salvar.
- Miniatura na lista de produtos.
- Toque na miniatura para abrir foto ampliada.
- Botão para remover foto do cadastro antes de salvar.
- Mensagens leigas explicando quando a foto foi carregada e quando precisa salvar.
- Backup web agora tenta embutir as fotos pequenas no JSON em `product_photo_files`.
- Restauração web tenta reenviar as fotos embutidas para o Storage `product-photos`; se falhar, mantém fallback compatível no produto.
- Backup continua salvando link/caminho do Storage quando a imagem não puder ser lida pelo navegador.

## Observação importante sobre backup das fotos
O backup agora salva melhor as fotos, mas com regra honesta:
- fotos inline entram no JSON;
- fotos em Storage público/link tentam ser lidas e embutidas no JSON;
- se o navegador não conseguir ler alguma foto por bloqueio de acesso/CORS/projeto diferente, o cadastro mantém o link/caminho;
- para migração completa entre projetos Supabase, ainda é recomendado copiar também o bucket `product-photos`.

## Arquivos alterados
- package.json
- package-lock.json
- public/manifest.webmanifest
- public/sw.js
- scripts/commercial_package_check.js
- scripts/commercial_release_package.js
- scripts/release_check.js
- src/lib/productionChecklist.ts
- src/lib/webApi.ts
- src/main.tsx
- src/mobile-app/screens/BackupScreen.tsx
- src/mobile-app/screens/ProductsCustomersScreens.tsx
- src/mobile-app/styles/mobile-app.css
- src/pages/Backup.tsx

## Testes executados
- npm run type-check
- npm run build
- npm run lint
- npm run release:check
- npm run release:commercial:check
- npm audit --audit-level=high
- node --check scripts/release_check.js
- node --check scripts/commercial_package_check.js
- node --check scripts/commercial_release_package.js
- Validação JSON em package.json, package-lock.json e manifest.webmanifest

## PWA/cache
Versão: `pwa-supabase-v154-fotos-produtos-backup`
Cache: `smart-loja-pwa-supabase-v154-fotos-produtos-backup`

## Como testar em aparelho real
1. Abrir Produtos no celular.
2. Tocar em Novo produto.
3. Escolher uma foto JPG/PNG/WEBP até 2 MB.
4. Confirmar se a prévia aparece.
5. Salvar produto.
6. Conferir se a miniatura aparece na lista.
7. Tocar na miniatura e confirmar se expande.
8. Abrir em outro aparelho e conferir se a foto aparece.
9. Criar backup.
10. Abrir o JSON e verificar `product_photo_summary` e `product_photo_files`.
11. Restaurar em loja de teste e conferir se produto/foto voltam.

## Limitação real
Não foi testado em Supabase real nesta execução. Validar no celular e em loja de teste antes de vender como backup definitivo de fotos.
