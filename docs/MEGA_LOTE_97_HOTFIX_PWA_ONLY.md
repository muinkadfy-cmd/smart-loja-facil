# Mega Lote 97 — Hotfix PWA-only release check

## Correção

Este hotfix ajusta o `release:check` para o projeto Smart Loja Fácil Web Mobile como PWA web/mobile, sem exigir Tauri/desktop.

## Motivo

O build web já passava, mas o `release:check` ainda carregava regras antigas de Tauri/desktop e bloqueava o deploy por itens que não fazem parte da entrega PWA.

## Mudanças

- `scripts/release_check.js`: valida somente o núcleo PWA web/mobile.
- `README.md`: documentação ajustada para PWA, Supabase e Cloudflare.
- `package.json`: descrição atualizada para PWA web/mobile.

## Resultado esperado

Rodar:

```bash
npm run type-check
npm run lint
npm run build
npm run release:check
npx wrangler deploy
```

## Observações

Avisos sobre base64 gigante devem virar lote futuro de performance/cache, mas não bloqueiam deploy PWA.
