# Mega Lote 113 — Layout Mobile Universal Rescue

## Objetivo
Corrigir a bagunça estrutural do mobile vista nos prints: topo sobrepondo drawer, menu lateral desalinhado, conteúdo preso/cortado, bottom nav cobrindo tela e abas internas sem um padrão único.

## Estratégia segura
- Não mexer em dados, Supabase, vendas, clientes, produtos, caixa ou crediário.
- Criar uma camada final isolada: `src/styles/lote113-universal-mobile-layout.css`.
- Padronizar o shell mobile inteiro: topbar, card da loja, conteúdo, drawer, bottom nav e scroll.
- Ajustar navegação para fechar o menu ao trocar de aba e voltar o scroll ao topo.

## Correções principais
- uma única rolagem principal no mobile (`.neo-main`);
- `body/root` estáveis e sem scroll duplo;
- topbar sticky organizada com linha azul, menu, logo e sino;
- card da loja abaixo do topo sem busca;
- drawer lateral cobrindo a tela inteira e acima da topbar;
- backdrop com blur e z-index correto;
- sidebar com rolagem própria e botões legíveis;
- bottom nav fixo sem cobrir conteúdo;
- cards e painéis com largura 100%;
- tabelas com scroll interno seguro;
- formulários e modais responsivos;
- troca de aba fecha o drawer e volta para o topo.

## Versionamento
- App: `pwa-supabase-v113-universal-mobile-layout`
- Cache: `smart-loja-pwa-supabase-v113-universal-mobile-layout`

## Arquivos alterados
- `src/components/Shell.tsx`
- `src/styles/lote113-universal-mobile-layout.css`
- `src/main.tsx`
- `src/lib/webApi.ts`
- `public/sw.js`
- `public/manifest.webmanifest`
- `scripts/release_check.js`
- `package.json`
- `README.md`

## Risco restante
Ainda existe bastante CSS antigo com `!important`. Este lote cria uma camada final de estabilização para mobile, mas o próximo passo ideal é consolidar CSS antigo para reduzir conflitos futuros.
