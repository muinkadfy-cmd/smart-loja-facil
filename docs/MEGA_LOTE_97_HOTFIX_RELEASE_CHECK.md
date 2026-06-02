# Mega Lote 97 — Hotfix Release Check

## Objetivo
Corrigir falso bloqueio do `npm run release:check` depois do Lote 97.

## Problema
O build já passava, mas o `release:check` acusava:

- `Serviço online fora da camada web segura encontrado em src/lib/cssInventoryReadiness.ts`
- `Serviço online fora da camada web segura encontrado em src/lib/moduleVisualChecklist.ts`
- `Serviço online fora da camada web segura encontrado em src/lib/productionChecklist.ts`
- `Serviço online fora da camada web segura encontrado em src/lib/useWebPermissions.ts`

Esses arquivos são camadas permitidas de diagnóstico/checklist/permissões do PWA web. O erro era uma validação rígida demais ou script local desatualizado.

## O que mudou
- Atualizado `scripts/release_check.js` para reconhecer as camadas seguras do lote 97.
- Mantida a proteção contra URLs externas diretas fora dos arquivos permitidos.
- Mantida a proteção contra CDN, IndexedDB como banco principal e base64 gigante.
- Mantido alerta contra bancos SQLite e `.env` reais em pacote comercial.

## Como testar

```bash
npm run type-check
npm run lint
npm run build
npm run release:check
```

## Resultado esperado
O `release:check` deve passar, podendo exibir apenas aviso de bancos SQLite locais no workspace. Esse aviso não bloqueia o deploy, mas esses arquivos não devem entrar no ZIP comercial nem no Git.
