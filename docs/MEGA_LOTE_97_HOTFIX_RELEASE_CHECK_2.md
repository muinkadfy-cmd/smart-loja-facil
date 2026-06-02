# Mega Lote 97 — Hotfix Release Check 2

## Objetivo
Corrigir o `npm run release:check` quando o repositório clonado do GitHub está mais antigo do que o ZIP do lote e não possui alguns arquivos comerciais/auditoria que existem no pacote completo.

## Problema corrigido
O build já estava passando, mas o release check travava por:

- arquivos comerciais/auditoria ausentes;
- `scripts/css_audit.js` ausente causando `ENOENT`;
- Service Worker não sincronizado com cache v97 em alguns ambientes.

## O que mudou
- `scripts/release_check.js` agora separa arquivos essenciais de arquivos comerciais opcionais.
- Arquivos opcionais ausentes geram aviso, mas não travam deploy web.
- O script não tenta ler arquivo ausente.
- Mantém bloqueio real para: core ausente, versão/cache PWA errados, URLs externas fora de camadas permitidas, CDN, fetch externo direto e base64 gigante.
- Reinclui scripts de auditoria CSS e empacotamento comercial.
- Reinclui `src/master-ui.css` e asset base64 usado pelo Tauri.
- Reforça `public/sw.js` com cache v97.

## Como testar

```bash
npm run type-check
npm run lint
npm run build
npm run release:check
```

Se passar, rode:

```bash
npx wrangler deploy
```
