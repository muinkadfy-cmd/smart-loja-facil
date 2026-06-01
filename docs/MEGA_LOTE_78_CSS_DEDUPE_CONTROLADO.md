# Mega Lote 78 — CSS Dedupe Controlado + PWA v78

## Objetivo

Reduzir duplicidades CSS com segurança, sem apagar blocos visuais antigos às cegas, e elevar o diagnóstico comercial do PWA para a versão v78.

## Alterações principais

- Atualização da versão web para `pwa-supabase-v78`.
- Atualização do cache/service worker para `smart-loja-pwa-supabase-v78-css-dedupe-controlado`.
- Atualização da fila local para `smart-loja:web-outbox-v78`, preservando migração das filas v77, v76, v75, v74 e v73.
- Criação do módulo CSS `src/styles/lote78-css-cleanup.css` com token de diagnóstico `--lote78-css-cleanup: active`.
- Limpeza conservadora de declarações CSS idênticas repetidas em `src/styles.css` e `src/master-ui.css`.
- Criação de `scripts/css_dedupe_safe.js` para repetir a limpeza segura quando necessário.
- Reforço de `scripts/css_audit.js` para medir bytes, seletores, `!important`, media queries e declarações repetidas.
- Diagnóstico Web atualizado para mostrar limpeza CSS v78, cache v78 e checklist visual v78.
- Release check atualizado para travar entrega se versão/cache/fila/CSS v78 não estiverem presentes.

## Resultado da limpeza CSS

Antes do Lote 78:

- CSS bruto total: aproximadamente 641.2 KB.
- `!important`: 6.820.

Depois do Lote 78:

- CSS bruto total: aproximadamente 634.5 KB.
- `!important`: 6.673.
- Redução aproximada: 6.7 KB brutos e 147 `!important`.

A redução foi propositalmente conservadora. O CSS antigo ainda tem muitos seletores `neo-*` repetidos, mas apagar blocos inteiros sem navegador real poderia quebrar telas aprovadas.

## Arquivos alterados

- `src/lib/webApi.ts`
- `public/sw.js`
- `src/main.tsx`
- `src/styles.css`
- `src/master-ui.css`
- `src/styles/lote78-css-cleanup.css`
- `src/lib/cssInventoryReadiness.ts`
- `src/lib/moduleVisualChecklist.ts`
- `src/lib/productionChecklist.ts`
- `src/pages/WebDiagnostics.tsx`
- `scripts/release_check.js`
- `scripts/css_audit.js`
- `scripts/css_dedupe_safe.js`

## Validação executada

- `npm run type-check`
- `npm run lint`
- `npm run build`
- `npm run release:check`
- `node --check public/sw.js`
- `node --check scripts/css_audit.js`
- `node --check scripts/css_dedupe_safe.js`
- `node scripts/css_audit.js`
- `npm audit --audit-level=moderate`

## Limitações reais

- Não foi rodado `cargo check`, pois o ambiente não possui Rust/Cargo instalado.
- Não houve validação visual real em Android/iPhone.
- Não houve deploy real Cloudflare.
- Não houve teste Supabase real com RLS e múltiplos aparelhos.

## Próximo lote recomendado

Lote 79 — limpeza por família visual `neo-*` com validação tela por tela:

1. validar Dashboard, Produtos, Vendas, Caixa e Crediário no navegador;
2. remover blocos antigos por família visual, não por chute;
3. reduzir `!important` em blocos de baixo risco;
4. manter checklist visual por tela como trava antes de aprovar;
5. testar PWA instalado em celular depois do deploy.
