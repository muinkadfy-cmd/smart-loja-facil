# Mega Lote 111 — Auditoria Visual Automatizada + Scroll Lock Universal + Checklist de Abas

## Objetivo
Estabilizar navegação, rolagem, espaçamento, hierarquia e diagnóstico visual em web/mobile sem mexer em dados críticos, Supabase, vendas, clientes, produtos, caixa, crediário ou permissões.

## Auditoria executada
Áreas consideradas no checklist visual:
- Dashboard
- Vendas / PDV
- Pedidos
- Produtos
- Clientes
- Relatórios
- Caixa
- Crediário
- Comprovantes
- Backup
- Configurações
- Logs / Diagnóstico
- Diagnóstico Web

## Correções principais
- adicionada camada final `src/styles/lote111-scroll-navigation-audit.css` para estabilizar rolagem e navegação;
- `neo-page-shell` passa a ser área principal de scroll com proteção mobile;
- sidebar/menu tem rolagem própria e evita corte de labels;
- bottom nav fica preservado e não deve cobrir conteúdo;
- tabelas e áreas densas ganham scroll interno seguro;
- troca de aba rola o conteúdo para o topo de forma segura;
- Diagnóstico Web ganhou painel de layout e checklist de abas;
- botão de atualizar tela, limpar cache e copiar checklist no diagnóstico;
- versão/cache atualizados para v111.

## Diagnóstico de layout
O Diagnóstico Web agora mostra:
- largura e altura da tela;
- modo mobile/tablet/desktop;
- status da rolagem principal;
- bottom nav;
- sidebar;
- checklist por aba;
- botões de atualizar tela, limpar cache e copiar checklist.

## Versionamento
- App: `pwa-supabase-v111-scroll-navigation-audit`
- Cache: `smart-loja-pwa-supabase-v111-scroll-navigation-audit`
- Fila local: mantida em `smart-loja:web-outbox-v107` para não arriscar pendências antigas já salvas nos aparelhos.

## Riscos restantes
- Ainda há muitas camadas CSS antigas com `!important`. O lote estabiliza por camada final, mas o próximo passo ideal é uma consolidação CSS assistida por prints reais por aba.
- PDV, Crediário, Produtos e Configurações continuam sendo as telas mais densas e precisam teste real em celular com teclado aberto.
