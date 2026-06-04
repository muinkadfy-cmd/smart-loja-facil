# Mega Lote 117 — Desativação Controlada da Herança Antiga + CSS Foundation Única

## Objetivo
Reduzir a interferência de CSS antigo acumulado entre os lotes anteriores, estabilizar uma única fundação visual PWA web/mobile e preservar o funcionamento do Supabase/dados.

## Auditoria aplicada
Foi confirmada herança antiga carregada no `src/main.tsx`: dezenas de imports `lote77` até `lote116`, todos ativos ao mesmo tempo e aplicando regras concorrentes sobre os mesmos elementos estruturais (`neo-main`, `neo-topbar`, `neo-page-shell`, `neo-sidebar`, `neo-mobile-dock`, cards e tabelas).

## Correção feita
- `src/main.tsx` agora carrega apenas:
  - `src/styles.css`
  - `src/master-ui.css`
  - `src/styles/lote117-foundation-clean.css`
- Classes antigas dos lotes foram removidas do `document.documentElement.classList`.
- Arquivos antigos continuam no projeto, mas deixam de interferir porque não são mais importados.
- Criada camada única `lote117-foundation-clean.css` para:
  - shell web/mobile;
  - sidebar/drawer;
  - topbar;
  - card da loja;
  - dashboard/cards;
  - rolagem principal;
  - bottom nav;
  - tabelas, formulários e modais;
  - login central limpo;
  - alertas/cache/update.

## Versionamento
- App: `pwa-supabase-v117-css-foundation-clean`
- Cache: `smart-loja-pwa-supabase-v117-css-foundation-clean`
- Outbox: preservado em `smart-loja:web-outbox-v107` para não arriscar pendências locais antigas.

## O que foi preservado
- Login/Supabase.
- Dados existentes.
- Vendas, clientes, produtos, caixa e crediário.
- Alertas, som e atualização/cache PWA.
- Arquivos CSS antigos ainda existem para consulta, mas não carregam na interface.

## Riscos restantes
- Como a base anterior tinha muitas regras antigas, alguma tela interna pode revelar dependência visual específica de CSS legado.
- Se aparecer uma aba visualmente crua, o ideal é migrar apenas a regra necessária para a fundação atual, não reativar todos os lotes antigos.

## Próximo ideal
Mega Lote 118 — Validação real aba por aba após fundação limpa, com ajustes específicos por tela sem reativar herança antiga.
