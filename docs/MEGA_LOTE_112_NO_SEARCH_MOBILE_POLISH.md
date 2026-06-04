# Mega Lote 112 — Remove busca global + micro ajuste mobile

## Objetivo
Remover a barra de busca global/topbar que estava poluindo o Dashboard e aplicar micro ajuste visual mobile/web sem alterar dados, Supabase, vendas, clientes, produtos, caixa ou crediário.

## Ajustes entregues
- barra de busca global removida visualmente da topbar;
- topbar com menos altura e mais respiro;
- ações da topbar alinhadas à direita no web;
- mobile mais limpo com loja ativa ocupando a largura correta;
- cards do Dashboard com menos altura e melhor leitura no mobile;
- alertas/avisos mais compactos;
- versão/cache atualizados para forçar atualização do PWA;
- botão limpar cache e aviso de nova versão preservados;
- fila local mantida em `smart-loja:web-outbox-v107` para não perder pendências antigas.

## Versão
- App: `pwa-supabase-v112-no-search-mobile-polish`
- Cache: `smart-loja-pwa-supabase-v112-no-search-mobile-polish`

## Arquivos alterados
- `src/main.tsx`
- `src/styles/lote112-no-search-mobile-polish.css`
- `src/lib/webApi.ts`
- `public/sw.js`
- `public/manifest.webmanifest`
- `scripts/release_check.js`
- `README.md`
- `package.json`

## Observação
A busca continua preservada no código, mas escondida visualmente. Isso evita quebrar lógica existente e deixa o caminho seguro caso a busca volte em outro formato no futuro.
