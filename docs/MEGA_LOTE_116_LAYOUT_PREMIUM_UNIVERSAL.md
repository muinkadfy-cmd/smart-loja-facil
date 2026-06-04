# Mega Lote 116 — Layout Premium Universal Web/Mobile

## Objetivo
Auditoria sênior mobile-first para deixar o PWA com aparência comercial, sem blocos espremidos, cortados, gigantes demais, vazios demais ou fora do lugar.

## Problemas encontrados na base
- CSS acumulado de muitos lotes com várias regras concorrendo entre si.
- Header/mobile, topbar, page-shell e main ainda podiam competir pelo controle do scroll.
- Risco de conteúdo ficar por baixo do header ou do bottom nav em algumas dimensões.
- Desktop com risco de cards muito longos/esticados em telas grandes.
- Mobile com risco de cards, formulários, tabelas e modais excederem a largura segura.
- Estados vazios e blocos internos podiam gerar respiro excessivo.
- Sidebar/drawer precisava de regra final mais segura de altura, rolagem e z-index.

## Correções aplicadas
- Criada camada final `src/styles/lote116-premium-universal-layout.css`.
- Mobile: `neo-main` passa a ser o scroll principal, com header em fluxo real e bottom nav com espaço reservado.
- Mobile: store card abaixo do topo ocupa espaço real e não deve cobrir o título da página.
- Mobile: bottom nav preservado, fixo, com padding seguro para conteúdo não ficar escondido.
- Mobile: drawer/sidebar com z-index próprio, largura máxima e rolagem independente.
- Mobile: cards, formulários, tabelas, modais e estados vazios com largura segura e altura compacta.
- Desktop: largura máxima do conteúdo em 1320px, topbar alinhada e page-shell com scroll único.
- Desktop: sidebar com rolagem própria e labels com ellipsis seguro.
- Inputs/botões: toque confortável, largura segura e fonte compatível com mobile.
- Modais: max-height no mobile com rolagem interna.
- Tabelas: scroll horizontal controlado apenas no wrapper.

## Versionamento
- App: `pwa-supabase-v116-premium-universal-layout`
- Cache: `smart-loja-pwa-supabase-v116-premium-universal-layout`

## Testes executados
- `npm run type-check`
- `npm run lint`
- `npm run build`
- `npm run release:check`
- `npm run release:commercial:check`
- `node --check scripts/release_check.js`
- validação JSON do `public/manifest.webmanifest`

## Riscos restantes
- O projeto ainda carrega muitos CSS antigos. A camada final estabiliza, mas uma limpeza real futura seria criar um design system único e remover CSS legado gradualmente.
- Login depende das variáveis públicas do Supabase no build local/Cloudflare. Sem `VITE_SUPABASE_URL` e chave pública, o botão de login pode ficar desativado.
- Validação final precisa de prints reais em Android/iPhone após deploy e limpeza de cache.

## Próximo lote ideal
Mega Lote 117 — Equalização de componentes internos por aba: PDV, produtos, clientes, caixa, crediário, relatórios e configurações com o mesmo padrão visual, removendo CSS legado aos poucos.
