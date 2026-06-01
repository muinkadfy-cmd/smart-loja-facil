# Mega Lote 81 — Redução controlada de !important em shell/sidebar

## Objetivo

Aplicar o COMANDO MESTRE 10/10 no próximo lote seguro depois do Lote 80, focando em reduzir prioridade CSS legada de `.neo-page-shell` e `.neo-sidebar` sem quebrar telas prontas, atualizar PWA/cache/fila para v81 e melhorar diagnóstico visual/comercial.

## Alterações principais

- Atualizado `WEB_APP_VERSION` para `pwa-supabase-v81`.
- Atualizado `WEB_CACHE_VERSION` para `smart-loja-pwa-supabase-v81-neo-important-reduction`.
- Atualizado service worker para cache v81.
- Atualizada fila local para `smart-loja:web-outbox-v81`, mantendo migração de v80 a v73.
- Criado `src/styles/lote81-neo-important-reduction.css` com reforço final de largura, scroll, overflow e espaço mobile sem usar `!important`.
- Criado `src/lib/neoImportantReadiness.ts` para medir no navegador os `!important` restantes em `.neo-page-shell` e `.neo-sidebar`.
- Adicionado bloco no Diagnóstico Web: **Redução !important v81**.
- Criado `scripts/css_reduce_neo_important_safe.js` para remover apenas `!important` de propriedades seguras em shell/sidebar.
- Criado `scripts/css_important_audit.js` para auditar prioridades por seletor e propriedade.
- Atualizados scripts de auditoria CSS para incluir o módulo v81.
- Atualizado `release_check.js` para bloquear release se v81/cache/fila/CSS/diagnóstico não estiverem presentes.

## Redução aplicada

O lote removeu 9 usos seguros de `!important` em `src/styles.css`, somente em propriedades ligadas a largura/scroll/espaço:

- `padding-bottom`
- `overflow-y`
- `overscroll-behavior`
- `scrollbar-gutter`

A remoção foi conservadora porque o CSS legado ainda tem muitas camadas históricas. Remover `!important` visual de cor, sombra, borda, fundo, largura rígida e layout sem abrir as telas reais poderia causar regressão.

## Auditoria após o lote

Resultado do `node scripts/css_audit.js`:

- CSS bruto total: 642.6 KB
- Seletores: 4288
- `!important`: 6662
- Media queries: 130
- Declarações idênticas repetidas: 331

Resultado do `node scripts/css_shell_sidebar_audit.js`:

- `.neo-page-shell`: 85 seletores, 196 declarações, 131 `!important`
- `.neo-sidebar`: 117 seletores, 395 declarações, 273 `!important`
- Total shell/sidebar: 404 `!important`

Resultado do `node scripts/css_important_audit.js`:

- `.neo-page-shell`: 131 `!important`
- `.neo-sidebar`: 273 `!important`
- Total alvo shell/sidebar: 404 `!important`

## Testes executados

Passaram:

```bash
npm ci
npm run type-check
npm run lint
npm run build
npm run release:check
node --check public/sw.js
node --check scripts/css_audit.js
node --check scripts/css_shell_sidebar_audit.js
node --check scripts/css_reduce_neo_important_safe.js
node --check scripts/css_important_audit.js
node scripts/css_audit.js
node scripts/css_shell_sidebar_audit.js
node scripts/css_important_audit.js
npm audit --audit-level=moderate
```

Resultado:

- TypeScript passou.
- Lint passou.
- Build Vite passou.
- Release check passou.
- Service worker passou no `node --check`.
- Auditorias CSS passaram.
- NPM audit encontrou 0 vulnerabilidades.

## Build final

- CSS final: 531.00 KB / gzip 86.14 KB
- JS principal: 123.53 KB / gzip 33.95 KB
- vendor: 164.51 KB / gzip 51.38 KB
- web-auth/Supabase: 201.76 KB / gzip 52.82 KB
- WebDiagnostics: 49.56 KB / gzip 13.87 KB

## Limitações reais

Não foi possível validar neste ambiente:

- `cargo check`, porque Rust/Cargo não está disponível.
- Android/iPhone real.
- Supabase real com RLS aplicada.
- Dois aparelhos sincronizando.
- Deploy real Cloudflare.
- PWA instalado recebendo cache v81.
- Impressão/comprovante Tauri real.

## Risco

Risco atual: baixo-médio.

O lote não mexeu em cálculo financeiro, vendas, caixa, crediário, estoque, Supabase RPC ou regras de negócio. O risco restante está no CSS legado, que ainda contém muitos `!important` e precisa de limpeza por tela com validação visual real.

## Próximo lote sugerido

Lote 82 — Redução por bloco visual em `.neo-sidebar`, começando por marca, footer, nav item e estados aberto/fechado, com validação em Dashboard, Produtos, Vendas, Caixa e Crediário.
