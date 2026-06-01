# Mega Lote 77 — CSS modular e validação visual por tela

## Objetivo

Consolidar o próximo passo seguro depois do Lote 76 sem apagar regras antigas às cegas. O foco foi deixar o CSS novo modular, criar inventário visual no Diagnóstico Web e adicionar checklist real por tela crítica para orientar validação web/mobile antes de venda.

## Alterações principais

### 1. Versão PWA/cache/fila v77

- `WEB_APP_VERSION`: `pwa-supabase-v77`.
- `WEB_CACHE_VERSION`: `smart-loja-pwa-supabase-v77-css-modular-visual-check`.
- `public/sw.js`: cache v77.
- fila local web: `smart-loja:web-outbox-v77`.
- migração preservada das filas v76, v75, v74 e v73.

### 2. CSS modular isolado

Criado o arquivo:

- `src/styles/lote77-design-system.css`

Este arquivo concentra as regras novas do Lote 77 e moveu os blocos recentes de diagnóstico/checklist que estavam no fim de `src/styles.css`.

Resultado:

- `src/styles.css` ficou menor e menos poluído.
- novas regras v77 ficaram isoladas.
- nenhum `!important` foi adicionado no CSS novo.
- token de diagnóstico criado: `--lote77-css-module: active`.

### 3. Diagnóstico Web com inventário CSS

Criado:

- `src/lib/cssInventoryReadiness.ts`

A tela Diagnóstico Web agora mostra:

- se o CSS modular v77 está carregado;
- quantidade de regras CSS lidas pelo navegador;
- quantidade de folhas carregadas;
- detecção de corte lateral horizontal;
- token de toque mínimo;
- suporte a `content-visibility: auto`.

### 4. Checklist visual por tela crítica

Criado:

- `src/lib/moduleVisualChecklist.ts`

A tela Diagnóstico Web agora tem checklist manual para validar:

- Dashboard;
- Produtos;
- Vendas/PDV;
- Caixa;
- Crediário;
- Clientes/Pedidos;
- Backup/Configurações;
- Diagnóstico/CSS/PWA.

O checklist fica salvo neste aparelho em:

- `smart-loja:lote77-module-visual-checklist`.

### 5. Checklist comercial atualizado

Atualizado:

- `src/lib/productionChecklist.ts`

Agora usa:

- `smart-loja:lote77-production-checklist`.

E migra dados antigos de:

- `smart-loja:lote76-production-checklist`;
- `smart-loja:lote75-production-checklist`.

Também foi adicionado item de validação para CSS modular e checklist visual por tela.

### 6. Release check mais rígido

Atualizado:

- `scripts/release_check.js`

Agora confere:

- versão v77 em `src/lib/webApi.ts`;
- cache v77 no `public/sw.js`;
- fila local v77;
- import do CSS modular no `src/main.tsx`;
- token `--lote77-css-module: active` no CSS novo;
- novos arquivos de diagnóstico CSS e checklist visual.

### 7. Script de auditoria CSS

Criado:

- `scripts/css_audit.js`

Ele mede:

- tamanho bruto dos CSS;
- número de seletores;
- quantidade de `!important`;
- media queries;
- seletores mais repetidos.

Resultado atual do audit:

- `src/styles.css`: 494.5 KB, 3428 seletores, 4524 `!important`, 107 media queries.
- `src/master-ui.css`: 135.7 KB, 742 seletores, 2296 `!important`, 13 media queries.
- `src/styles/lote77-design-system.css`: 11.0 KB, 74 seletores, 0 `!important`, 5 media queries.
- Total: 641.2 KB, 4244 seletores, 6820 `!important`, 125 media queries.

## Testes executados

Passaram:

```bash
npm run type-check
npm run lint
npm run build
npm run release:check
node --check public/sw.js
node --check scripts/css_audit.js
node scripts/css_audit.js
npm audit --audit-level=moderate
```

Também validado:

- `package.json`;
- `tsconfig.json`;
- `public/manifest.webmanifest`;
- `wrangler.jsonc` com BOM tratado.

Resultado:

- TypeScript passou.
- Lint passou.
- Build passou.
- Release check passou.
- Service worker passou.
- CSS audit passou.
- npm audit: 0 vulnerabilidades.

## Build final

```txt
CSS final: 529.46 KB / gzip 85.40 KB
JS principal: 123.32 KB / gzip 33.90 KB
vendor: 164.51 KB / gzip 51.38 KB
web-auth/Supabase: 201.76 KB / gzip 52.82 KB
WebDiagnostics: 32.58 KB / gzip 9.94 KB
```

## Limitações reais

Não foi possível rodar:

```bash
cargo check
```

Motivo: o ambiente não tem Rust/Cargo instalado.

Também ainda precisa validar em ambiente real:

- Supabase real com RLS aplicada;
- dois aparelhos reais;
- Android/iPhone real;
- Cloudflare deploy real;
- PWA instalado recebendo cache v77;
- impressão/comprovante Tauri real.

## Risco

Risco técnico: baixo-médio.

Motivo: o lote não removeu CSS antigo agressivamente, então o risco de quebra visual é menor. O CSS ainda está grande e com muitos `!important`, mas agora existe inventário e checklist para guiar a limpeza real por tela.

## Próximo lote recomendado

Lote 78 — Remoção controlada de duplicidades CSS por tela, começando pelas classes `neo-*` mais repetidas.

Prioridade sugerida:

1. abrir Dashboard, Produtos, Vendas, Caixa e Crediário em web/mobile;
2. remover duplicidades por bloco visual, não por busca cega;
3. reduzir `!important` aos poucos;
4. medir CSS audit antes/depois;
5. manter release check e checklist visual v77 como trava de segurança.
