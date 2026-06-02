# Smart Loja Fácil Web Mobile

Sistema **PWA web/mobile** com React, TypeScript, Vite, Supabase e deploy Cloudflare.

Este projeto deve ser tratado como **PWA para navegador/celular**, não como entrega Tauri/desktop. Qualquer pasta ou script antigo de Tauri deve ser considerado legado e não deve bloquear o deploy web/mobile.

## Objetivo do projeto

- Rodar bem no navegador, Android e iPhone.
- Sincronizar dados entre web e mobile via Supabase.
- Usar Supabase Auth, banco, RLS/policies e Storage quando configurado.
- Publicar no Cloudflare usando a pasta `dist` gerada pelo Vite.
- Mostrar alertas simples para usuário leigo: salvando, sincronizando, sincronizado, pendente, erro e offline.

## Ambiente local

```bash
npm install
npm run type-check
npm run lint
npm run build
npm run release:check
```

O build gera a pasta:

```txt
dist
```

## Deploy Cloudflare

Depois do build passar:

```bash
npx wrangler deploy
```

O `wrangler.jsonc`/configuração de deploy deve apontar para:

```txt
dist
```

## Supabase

O modo web/mobile usa Supabase para:

- autenticação;
- loja/grupo;
- clientes;
- produtos;
- vendas;
- caixa;
- crediário;
- pedidos;
- recibos;
- estoque;
- permissões;
- fila/estado de sincronização;
- Storage de fotos, quando o bucket estiver configurado.

Antes de vender para cliente real:

1. aplicar as migrations em `supabase/migrations`;
2. validar RLS/policies no Supabase;
3. testar login real;
4. testar criar/editar no web e aparecer no mobile;
5. testar criar/editar no mobile e aparecer no web;
6. testar offline/online e pendências;
7. validar permissões de dono/admin/operador/leitor;
8. confirmar service worker/cache novo no celular.

## PWA/cache

Arquivos importantes:

```txt
public/manifest.webmanifest
public/sw.js
src/lib/webApi.ts
```

Quando alterar app PWA, atualizar versão/cache para evitar celular preso em versão antiga.

## Segurança

Não subir para GitHub e não colocar em ZIP comercial:

```txt
.env
.env.local
.env.production
*.sqlite3
*.sqlite
*.db
node_modules
dist
release-commercial
*.zip
```

A chave `anon public` do Supabase pode existir no frontend quando for pública. Nunca colocar `service_role`, chaves privadas, tokens privados, backups reais ou bancos de cliente no frontend.

## Release check PWA

O comando:

```bash
npm run release:check
```

valida o pacote PWA web/mobile. Ele **não exige Tauri** e não deve bloquear deploy por ausência de `src-tauri`.

Avisos sobre base64 gigante ou arquivos comerciais ausentes indicam melhoria futura, mas não impedem o deploy PWA quando `type-check`, `lint` e `build` passam.

## Checklist rápido antes de publicar

- `npm run type-check` passou.
- `npm run lint` passou.
- `npm run build` passou.
- `npm run release:check` passou.
- `dist/index.html` existe.
- Supabase URL e anon key estão configurados no Cloudflare.
- Migration do lote aplicada no Supabase.
- Teste real em web e celular feito.
- Nenhum `.env` real, banco SQLite ou ZIP antigo foi commitado.

## Mega Lote 98 — PWA Comercial + PDV Mobile + Sync Real

Projeto validado como **PWA web/mobile** com Supabase e Cloudflare. O lote 98 reforçou a base visual e o lote 99 atualiza a versão ativa abaixo. Histórico do lote 98:

- versionamento base `pwa-supabase-v98`;
- cache base `smart-loja-pwa-supabase-v98-commercial-pdv-sync`;
- fila local web base `smart-loja:web-outbox-v98`;
- PDV com guia mobile e cards de itens no celular;
- navegação rápida do topo oculta no desktop para evitar visual antigo duplicado;
- estados vazios mais claros;
- diagnóstico com teste guiado para clientes, produtos e vendas;
- release check PWA-only, sem exigir Tauri para deploy web.

A pasta `src-tauri`, se existir, é legado e não deve bloquear deploy PWA. Não subir `.env.production`, bancos SQLite, `node_modules`, `dist` ou `src-tauri/target` para o GitHub.



## Lote 99 — validação comercial final PWA

Este lote mantém o projeto como **PWA web/mobile com Supabase e Cloudflare**. O foco foi corrigir acabamento comercial sem trazer dependência Tauri/SQLite para o fluxo web.

Principais pontos:

- versão lógica `pwa-supabase-v99`;
- cache `smart-loja-pwa-supabase-v99-commercial-final-pdv-mobile`;
- fila local `smart-loja:web-outbox-v99`, preservando filas antigas como legado;
- Dashboard com cards mais estáveis para moeda, status e `PWA/cache`;
- PDV com reforço mobile-first, formas de pagamento em cards, últimas vendas em cards no celular e menor risco de corte lateral;
- diagnóstico com checklist manual de sincronização por módulo;
- `release_check` continua PWA-only: não exige Tauri e só bloqueia riscos reais para web/mobile.

Antes de vender para cliente real, valide no mínimo: criar cliente no PC e ver no celular, criar produto no celular e ver no PC, finalizar venda e conferir Dashboard/Caixa/Crediário nos dois aparelhos.
