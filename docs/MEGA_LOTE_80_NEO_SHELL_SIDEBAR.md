# Mega Lote 80 — Neo Shell/Sidebar + CSS Auditável

## Objetivo
Consolidar com segurança a família visual `.neo-page-shell` e `.neo-sidebar`, sem alterar cálculos financeiros, vendas, caixa, crediário ou regras de negócio.

## Principais entregas
- Versão PWA atualizada para `pwa-supabase-v80`.
- Cache/service worker atualizado para `smart-loja-pwa-supabase-v80-neo-shell-sidebar-clean`.
- Fila local web atualizada para `smart-loja:web-outbox-v80`, migrando pendências antigas v79-v73.
- Novo módulo CSS `src/styles/lote80-neo-shell-sidebar.css` com token `--lote80-neo-shell-sidebar: active`.
- Novo diagnóstico `src/lib/neoShellSidebarReadiness.ts` para medir shell, sidebar, page shell, corte lateral, toque do menu, rolagem e tokens v80.
- Diagnóstico Web atualizado com bloco “Shell/sidebar v80”.
- Scripts novos:
  - `scripts/css_prune_duplicate_rules.js`
  - `scripts/css_shell_sidebar_audit.js`
- Release check reforçado para bloquear entrega sem v80, CSS v80 e diagnóstico v80.

## Limpeza CSS segura
Foi executada limpeza de regras duplicadas exatamente iguais dentro do mesmo contexto CSS.

Resultado:
- `src/styles.css`: 1 regra duplicada removida.
- `src/master-ui.css`: 1 regra duplicada removida.
- Total: 2 regras removidas, 164 bytes.

Essa limpeza foi conservadora. Não foram apagados blocos antigos inteiros de `.neo-page-shell` e `.neo-sidebar`, porque ainda existem muitos `!important` herdados e remover sem inspeção visual real poderia quebrar telas já prontas.

## Auditoria shell/sidebar atual
Resultado do script `node scripts/css_shell_sidebar_audit.js`:

- `.neo-page-shell`: 80 seletores, 187 declarações, 137 `!important`, 11 declarações repetidas no mesmo alvo.
- `.neo-sidebar`: 114 seletores, 388 declarações, 276 `!important`, 13 declarações repetidas no mesmo alvo.

Conclusão: a base está mais auditável, mas ainda existe legado alto. O próximo lote deve reduzir `!important` por bloco visual com navegador real aberto.

## Testes executados
- `npm ci`
- `npm run type-check`
- `npm run lint`
- `npm run build`
- `npm run release:check`
- `node --check public/sw.js`
- `node --check scripts/css_audit.js`
- `node --check scripts/css_neo_family_audit.js`
- `node --check scripts/css_prune_duplicate_rules.js`
- `node --check scripts/css_shell_sidebar_audit.js`
- `node scripts/css_audit.js`
- `node scripts/css_neo_family_audit.js`
- `node scripts/css_shell_sidebar_audit.js`
- `npm audit --audit-level=moderate`

## Limitações
- `cargo check` não foi possível no ambiente atual porque o comando `cargo` não está instalado.
- Teste real Android/iPhone, Cloudflare, Supabase/RLS e impressão Tauri precisam ser feitos fora do ambiente de entrega.

## Próximo lote recomendado
Lote 81 — Redução controlada de `!important` em `.neo-page-shell` e `.neo-sidebar` com inspeção visual real de Dashboard, Produtos, Vendas, Caixa e Crediário.
