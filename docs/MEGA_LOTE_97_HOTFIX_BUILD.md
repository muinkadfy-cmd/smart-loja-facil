# Mega Lote 97 — Hotfix de Build

Correção emergencial para erro de build após aplicar uma variante antiga/parcial do Lote 97.

## Erros corrigidos

- `Cannot find module './lib/webSync'`
- `Cannot find module './webSync'`
- `Property 'source' does not exist on type 'PublicWebEnv'`

## Arquivos incluídos

- `src/App.tsx`
- `src/lib/webApi.ts`
- `src/lib/env.ts`
- `src/pages/WebDiagnostics.tsx`

## Como testar

```bash
npm run build
```

Depois do build passar:

```bash
npx wrangler deploy
```
