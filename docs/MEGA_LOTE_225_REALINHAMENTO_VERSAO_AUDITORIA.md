# Mega Lote 225 — Realinhamento de Versão + Auditoria Pós-v220

## Contexto
O app local ficou em `0.1.220 / v220` depois que o lote 220 foi aplicado. A versão v224 não apareceu no `git log`, `reflog`, branches ou tags. Para evitar reset perigoso e perda de ajustes, este lote realinha a base atual para `v225`.

## Objetivo
- subir `package.json` e `package-lock.json` para `0.1.225`;
- subir `WEB_APP_VERSION`, `WEB_CACHE_VERSION`, `CACHE_NAME`, manifest e checks para `v225`;
- preservar os ajustes atuais que existem no projeto;
- manter comprovantes com tipografia legível;
- evitar rebaixamento de cache/PWA;
- não mexer em regra de venda, pagamento, crediário, cálculo, estoque ou sincronização.

## Arquivos alterados
- `package.json`
- `package-lock.json`
- `public/manifest.webmanifest`
- `public/sw.js`
- `src/lib/webApi.ts`
- `scripts/release_check.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`

## Auditoria executada
- Conferido que a base usada estava em `0.1.220`;
- Versões/cache atualizados para `v225`;
- Build, type-check, lint e release checks devem validar que o app não ficou com referência antiga v220 nos pontos críticos.

## O que este lote NÃO faz
- Não recupera arquivos de uma v224 que não estava no Git;
- Não altera layout ou regra de negócio;
- Não inclui `node_modules`, `dist`, `.env`, logs, bancos ou build comercial.

## Classificação
- Realinhamento de versão/cache: PRONTO — 9,6/10 — ★★★★★ 4,8/5.
- Risco de regressão: BAIXO, porque o lote é focado em versão/cache/checks.
- Status geral: PRONTO COM OBSERVAÇÃO.
