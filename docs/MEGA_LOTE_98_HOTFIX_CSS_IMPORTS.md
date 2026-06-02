# Hotfix Lote 98 — CSS imports faltando no build PWA

## Problema corrigido

O build falhava com:

```txt
Could not resolve "./styles/lote77-design-system.css" from "src/main.tsx"
```

A causa era que `src/main.tsx` importa a cadeia visual dos lotes 77 a 98, mas a pasta local clonada do GitHub não tinha todos esses arquivos CSS legados/modulares.

## Correção

Este hotfix adiciona os CSS necessários em `src/styles/`, sem mexer em Supabase, dados, permissões, service worker ou lógica de venda.

## Teste esperado depois de aplicar

```powershell
npm run type-check
npm run lint
npm run build
npm run release:check
```

Depois que `npm run build` passar, rode:

```powershell
npx wrangler deploy
```

## Observação

Não faça deploy se o build falhar. Se o deploy for executado depois de build quebrado, o Wrangler pode reenviar um `dist` antigo e o Lote 98 não aparece no site.
