# Mega Lote 98 — PWA-only Comercial + PDV Mobile + Sync Real

## Objetivo

Este lote reforça o Smart Loja Fácil como projeto **PWA web/mobile com Supabase e Cloudflare**, sem tratar Tauri/SQLite como requisito de produção web.

## O que mudou

- Atualização do versionamento lógico para `pwa-supabase-v98`.
- Atualização do cache PWA para `smart-loja-pwa-supabase-v98-commercial-pdv-sync`.
- Atualização da fila local web para `smart-loja:web-outbox-v98`, preservando leitura da fila v97 como legado.
- Camada visual `lote98-pwa-commercial-pdv-sync.css` com foco em navegação web/mobile, PDV, estados vazios, tabelas/cards e diagnóstico.
- A navegação rápida antiga do topo fica oculta no desktop e aparece no celular como carrossel tocável.
- PDV recebeu guia mobile e cards de itens no celular para reduzir corte lateral.
- Estados vazios ficaram mais humanos e com contraste melhor.
- Diagnóstico recebeu painel de teste guiado para clientes, produtos e vendas.
- `release_check` passou para v98 e continua PWA-only.

## Testes executados

- `npm ci`: passou.
- `npm run type-check`: passou.
- `npm run lint`: passou.
- `npm run build`: passou e gerou `dist`.
- `npm run release:check`: passou com avisos de legado Tauri/SQLite no workspace.
- `node --check scripts/release_check.js`: passou.
- Validação JSON de `public/manifest.webmanifest`: passou.
- `npm run release:commercial:check`: falhou corretamente porque o ZIP/base original ainda contém `.env.production` e bancos SQLite de teste no workspace. Esses arquivos não entram no ZIP deste lote.

## Atenção

Não incluir no GitHub nem no ZIP comercial:

- `.env.production`
- `*.sqlite3`
- `*.sqlite`
- `*.db`
- `node_modules`
- `dist`
- `src-tauri/target`

## Como aplicar

```powershell
cd C:\smart-loja-facil-git
Expand-Archive "$env:USERPROFILE\Downloads\smart-loja-facil-lote98-pwa-comercial-pdv-sync.zip" "C:\smart-loja-facil-git" -Force
npm run type-check
npm run lint
npm run build
npm run release:check
npx wrangler deploy
```

## Commit sugerido

```powershell
git status
git add README.md docs/MEGA_LOTE_98_PWA_COMERCIAL_PDV_SYNC.md public/manifest.webmanifest public/sw.js scripts/release_check.js src/components/DataTable.tsx src/lib/webApi.ts src/main.tsx src/pages/Sales.tsx src/pages/WebDiagnostics.tsx src/styles/lote98-pwa-commercial-pdv-sync.css
git commit -m "mega lote 98 pwa comercial pdv mobile sync real"
git push origin main
```
