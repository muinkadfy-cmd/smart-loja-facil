# Smart Loja Fácil — PWA Web/Mobile + Desktop Offline

Sistema comercial para lojas com foco em operação simples para usuário leigo, interface premium mobile-first e base híbrida:

- **Web/PWA** com React, TypeScript, Vite, Supabase e deploy Cloudflare.
- **Desktop Tauri** com SQLite local para operação offline no Windows.
- **Sincronização web/mobile** via Supabase, com fila local de pendências e alertas claros.
- **Fotos de produtos** via Supabase Storage no web/mobile, com fallback seguro quando o bucket ainda não estiver configurado.

## Status atual

Base atual dos lotes premium até v94:

- Login premium
- Dashboard premium web/mobile
- Vendas/PDV premium
- Pedidos premium
- Produtos premium com fotos via Storage
- Clientes premium
- Caixa premium
- Crediário premium
- Relatórios premium
- Backup e Configurações premium
- Diagnóstico Web com checklist comercial
- Auditoria CSS/release técnica v94

## Rodar em modo web/PWA

```bash
npm ci
npm run type-check
npm run lint
npm run build
npm run release:check
npm run dev
```

Para deploy Cloudflare:

```bash
npm run build
npx wrangler deploy
```

## Rodar em modo desktop Tauri

```bash
npm ci
npm run type-check
npm run build
npm run tauri:dev
```

Build Windows:

```bash
npm run tauri:build
```

## Supabase

O modo web usa Supabase para:

- login/sessão;
- stores e store_members;
- clientes;
- produtos;
- vendas;
- caixa;
- crediário;
- pedidos;
- comprovantes;
- relatórios;
- backup web;
- Storage de fotos de produtos.

Antes de vender, aplicar todas as migrations em `supabase/migrations` e validar RLS em usuários reais:

- owner;
- admin;
- operator;
- viewer.

## Storage de fotos de produtos

Bucket esperado:

```txt
product-photos
```

Caminho usado:

```txt
stores/{store_id}/products/{product_id}/arquivo.webp
```

O app não deve salvar foto grande em base64 no banco para produção. O banco deve guardar o caminho/URL da foto.

## PWA/cache

O service worker fica em `public/sw.js` e usa cache versionado. Sempre que alterar UI/PWA, atualizar:

- `WEB_APP_VERSION` em `src/lib/webApi.ts`;
- `WEB_CACHE_VERSION` em `src/lib/webApi.ts`;
- `CACHE_NAME` em `public/sw.js`;
- `WEB_OUTBOX_KEY` quando houver mudança de fila/sincronização.

## Auditoria técnica

Comandos principais:

```bash
npm run type-check
npm run lint
npm run build
npm run release:check
node scripts/css_audit.js
node scripts/commercial_package_check.js
node scripts/commercial_package_check.js --strict
npm audit --audit-level=moderate
```

`commercial_package_check.js --strict` deve ser usado antes de montar entrega para cliente. Ele bloqueia bancos SQLite, `.env` real e outros riscos de pacote.

## Regras de entrega comercial

Não incluir no ZIP comercial final:

- `*.sqlite3`
- `*.sqlite`
- `*.db`
- `.env` real
- `node_modules`
- `dist` antigo
- `src-tauri/target`
- arquivos de teste com dados reais

Arquivos SQLite locais de desenvolvimento podem existir no workspace, mas devem ficar fora do pacote final.

## Validação obrigatória antes de vender

1. Login Supabase real.
2. Owner/admin/operator/viewer.
3. Duas lojas isoladas por RLS.
4. Dois aparelhos na mesma loja.
5. Criar cliente em um aparelho e aparecer no outro.
6. Criar produto com foto e aparecer no outro aparelho.
7. Fazer venda e conferir estoque/caixa.
8. Receber crediário e conferir pago/restante.
9. Abrir/fechar caixa.
10. Backup/restauração.
11. PWA instalado em Android/iPhone.
12. Cloudflare servindo SW/manifest corretamente.
13. `cargo check` e impressão no desktop Tauri.

## Onde fica o banco local desktop

No modo Tauri, o SQLite é criado na pasta de dados do aplicativo do Windows. O caminho aparece no diagnóstico/rodapé do sistema.


## Release comercial limpo v96

Antes de enviar para cliente, rode:

```bash
npm run release:commercial:check
npm run release:commercial:prepare
```

O check comercial bloqueia bancos de teste (`.sqlite`, `.sqlite3`, `.db`) e arquivos `.env` reais. O preparo comercial copia o projeto para uma pasta limpa, sem `node_modules`, `dist`, `src-tauri/target`, bancos SQLite de teste, ZIPs antigos ou arquivos sensíveis.

Validação obrigatória antes de vender em produção:

1. aplicar migrations Supabase e Storage `product-photos`;
2. testar owner, admin, operator e viewer;
3. testar duas lojas para confirmar RLS;
4. testar PC + celular na mesma loja;
5. criar produto com foto e abrir em outro aparelho;
6. fazer venda e conferir caixa/estoque;
7. receber parcela no crediário;
8. instalar PWA no celular e conferir cache/versão;
9. rodar `npm run release:check`;
10. rodar `npm run release:commercial:check`.
