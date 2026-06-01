# Mega Lote 66 — PWA meta + safe-area mobile + bottom nav seguro

## Objetivo
Corrigir o aviso do Chrome sobre `apple-mobile-web-app-capable`, reforçar PWA/cache e impedir que o menu inferior flutuante cubra conteúdo em telas mobile/tablet.

## Melhorias aplicadas
- Adicionado `mobile-web-app-capable` no `index.html`, mantendo os metas Apple para iPhone/Safari.
- Atualizado `apple-mobile-web-app-title` para `Smart Loja Fácil`.
- Manifest recebeu `display_override`, `prefer_related_applications: false` e atalhos PWA para Dashboard e PDV.
- Service worker versionado para `smart-loja-pwa-supabase-v66-safe-area-bottom-nav`.
- Versão web atualizada para `pwa-supabase-v66`.
- Bottom nav mobile recebeu safe-area, fundo claro, botão ativo azul e z-index seguro.
- Conteúdo das páginas recebeu respiro final para não ficar escondido atrás do menu inferior.
- Logs / Diagnóstico recebeu camada `audit-safe-v66` com cards claros e leitura mais limpa.
- Diagnóstico Web recebeu camada `webdiagnostics-safe-v66`, botão de copiar diagnóstico mais equilibrado no desktop e 100% no mobile.

## Arquivos alterados
- `index.html`
- `public/manifest.webmanifest`
- `public/sw.js`
- `src/lib/webApi.ts`
- `src/pages/Audit.tsx`
- `src/pages/WebDiagnostics.tsx`
- `src/styles.css`

## Riscos restantes
- O CSS ainda possui muitas camadas antigas e regras com `!important`; o próximo lote ideal é limpeza técnica/controlada do CSS.
- Type-check completo depende de `node_modules` instalado no ambiente local.

## Teste manual recomendado
1. Abrir DevTools e conferir se o aviso do meta PWA sumiu.
2. No mobile/tablet, rolar até o fim de Logs / Diagnóstico e Diagnóstico Web.
3. Confirmar que o bottom nav não cobre o último card.
4. Clicar em Copiar diagnóstico.
5. Atualizar a página duas vezes para validar cache v66.
