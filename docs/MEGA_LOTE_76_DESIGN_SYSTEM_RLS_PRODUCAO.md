# Mega Lote 76 — Design System, RLS Produção e Diagnóstico Mobile

## Objetivo

Consolidar o próximo nível comercial depois do Lote 75 sem mexer em cálculos críticos de venda, caixa, crediário ou estoque.

Foco deste lote:

- versão/cache/fila local v76;
- diagnóstico visual de design system e mobile;
- checklist comercial mais completo para Supabase/RLS, Cloudflare, mobile e Tauri;
- release check mais rígido para impedir versão/cache antigo;
- melhoria segura de performance percebida sem remover CSS antigo de forma arriscada.

## Alterações principais

### 1. PWA/cache/fila v76

Atualizados:

- `WEB_APP_VERSION`: `pwa-supabase-v76`;
- `WEB_CACHE_VERSION`: `smart-loja-pwa-supabase-v76-design-system-rls-producao`;
- `public/sw.js`: cache v76;
- fila local web: `smart-loja:web-outbox-v76`.

A fila v76 ainda lê pendências antigas de:

- `smart-loja:web-outbox-v75`;
- `smart-loja:web-outbox-v74`;
- `smart-loja:web-outbox-v73`.

### 2. Diagnóstico de design system/mobile

Criado o arquivo:

- `src/lib/designSystemReadiness.ts`.

Ele gera um relatório local no navegador verificando:

- tokens visuais essenciais no `:root`;
- suporte a `100dvh`;
- suporte a `content-visibility: auto`;
- suporte a `env(safe-area-inset-bottom)`;
- altura real do botão primário para toque confortável;
- tamanho da tela atual, separando celular pequeno, celular, tablet e desktop.

A tela `WebDiagnosticsPage` agora mostra o bloco:

- **Design system e tela atual**.

Esse bloco serve para suporte e QA perceberem rapidamente quando um navegador/celular está com risco visual antes de vender para cliente final.

### 3. Checklist comercial v76

O checklist foi ampliado com validações reais:

- RLS e policies aplicadas no Supabase real;
- design/mobile sem regressão visual;
- comprovante Tauri validado depois do logo externo;
- Cloudflare/PWA com versão v76;
- dois aparelhos na mesma loja;
- venda sem duplicar;
- leitor bloqueado para escrita.

O estado antigo do checklist v75 é migrado automaticamente para o v76 quando existir.

### 4. Release check reforçado

`scripts/release_check.js` agora exige:

- `src/lib/designSystemReadiness.ts` presente;
- `WEB_APP_VERSION` em `pwa-supabase-v76`;
- `WEB_CACHE_VERSION` em `smart-loja-pwa-supabase-v76-design-system-rls-producao`;
- fila local `smart-loja:web-outbox-v76`;
- service worker com cache v76.

Isso evita entregar deploy com cache antigo no celular.

### 5. CSS seguro

Adicionados estilos específicos para o bloco de diagnóstico de design system/mobile.

Não foi feita remoção agressiva do CSS antigo neste lote porque o arquivo ainda possui muitas camadas históricas. Remover sem inspeção visual por tela poderia quebrar módulos prontos.

## Testes executados

Passaram:

- `npm run type-check`;
- `npm run lint`;
- `npm run build`;
- `npm run release:check`;
- `node --check scripts/release_check.js`;
- `node --check public/sw.js`;
- `npm audit --audit-level=moderate`.

Resultado do `npm audit`:

- 0 vulnerabilidades.

## Limitações

Não validado neste ambiente:

- `cargo check`, porque o ambiente não possui Rust/Cargo disponível;
- teste real em Android/iPhone;
- deploy real Cloudflare;
- Supabase real com policies aplicadas;
- impressão/previews Tauri reais.

## Risco

Risco técnico: baixo.

Motivo: este lote não altera cálculos críticos nem schema de dados. As mudanças ficam concentradas em diagnóstico, versão/cache/fila, checklist e CSS isolado do novo bloco.

Risco comercial restante: médio-baixo.

Motivo: ainda falta teste real com Supabase/RLS, Cloudflare e celular instalado.

## Próximo lote recomendado

Lote 77 — limpeza modular real do CSS por tela com validação visual.

Prioridade:

1. mapear blocos CSS usados por Dashboard, Produtos, Vendas, Caixa, Crediário e Diagnóstico;
2. remover duplicidades apenas depois de build e inspeção por tela;
3. criar CSS por módulo ou camadas claras;
4. manter mobile-first e safe-area;
5. rodar teste real no celular instalado via Cloudflare.
