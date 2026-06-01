# Mega Lote 79 — Família neo-* + limpeza segura CSS + PWA v79

## Objetivo

Consolidar de forma segura a família visual `neo-*` sem apagar blocos antigos às cegas. O lote prioriza shell, sidebar, topbar, header grid, action ribbon, page shell e mobile dock, mantendo cálculos financeiros e regras de negócio intactos.

## Alterações principais

- PWA atualizado para `pwa-supabase-v79`.
- Cache atualizado para `smart-loja-pwa-supabase-v79-neo-family-css-clean`.
- Fila local web atualizada para `smart-loja:web-outbox-v79`, com migração das filas v78, v77, v76, v75, v74 e v73.
- Criado módulo CSS `src/styles/lote79-neo-family.css` com token `--lote79-neo-family: active`.
- Criado diagnóstico runtime `src/lib/neoFamilyReadiness.ts` para validar família `neo-*` no navegador.
- Diagnóstico Web ganhou bloco próprio para shell, topbar, sidebar, action ribbon e dock mobile.
- Checklist visual por tela ganhou item específico para família `neo-*`.
- Checklist comercial ganhou validação de família `neo-*` antes de vender.
- Criado `scripts/css_neo_family_audit.js` para medir famílias `neo-*`, regras vazias e pontos de próxima limpeza.
- Criado `scripts/css_prune_empty_rules.js` e removidas 40 regras CSS vazias do legado.
- `scripts/release_check.js` agora exige versão/cache/fila v79 e módulo `lote79-neo-family.css`.

## Resultado da limpeza CSS

Antes deste lote, depois do Lote 78:

- CSS bruto total: 634.5 KB
- Seletores: 4248
- `!important`: 6673
- Regras vazias: 40

Depois da limpeza de regras vazias e inclusão do módulo v79:

- CSS bruto total: 636.1 KB
- Seletores: 4236
- `!important`: 6673
- Regras vazias: 0

Observação: o CSS total subiu levemente porque o lote adicionou diagnóstico e camada v79. A limpeza real removeu 40 regras vazias do legado, mas a redução bruta foi compensada pelo novo módulo seguro.

## Resultado da auditoria neo-*

Famílias mais presentes ainda no CSS:

- `.neo-sidebar`: 86 ocorrências
- `.neo-shell`: 68 ocorrências
- `.neo-page-shell`: 52 ocorrências
- `.neo-mobile-dock`: 52 ocorrências
- `.neo-action-tile`: 44 ocorrências
- `.neo-topbar`: 41 ocorrências
- `.neo-header-status-row`: 37 ocorrências
- `.neo-action-ribbon`: 35 ocorrências
- `.neo-header-grid`: 29 ocorrências
- `.neo-main`: 22 ocorrências

## Risco controlado

Não foram alterados cálculos, vendas, caixa, crediário, estoque ou Supabase RPCs. A limpeza foi conservadora para não quebrar visual aprovado sem navegador real.

## Testes executados

- `npm run type-check`
- `npm run lint`
- `npm run build`
- `npm run release:check`
- `node --check public/sw.js`
- `node --check scripts/css_audit.js`
- `node --check scripts/css_dedupe_safe.js`
- `node --check scripts/css_prune_empty_rules.js`
- `node --check scripts/css_neo_family_audit.js`
- `node scripts/css_audit.js`
- `node scripts/css_neo_family_audit.js`
- `npm audit --audit-level=moderate`

## Limitações

- `cargo check` não foi executado porque o ambiente não possui Rust/Cargo.
- Não houve validação real em Android/iPhone, Cloudflare ou Supabase produção.
- O CSS legado ainda contém muitos `!important`; a próxima etapa deve consolidar uma família por vez com abertura visual real das telas.

## Próximo lote recomendado

Lote 80 — Consolidação real de `.neo-page-shell` e `.neo-sidebar` com comparação visual tela por tela.
