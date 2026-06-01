# Mega Lote 70 — Web e mobile separados, login limpo e acabamento comercial clássico

## Objetivo
Ativar o Comando Mestre 10/10 na interface web/mobile do Smart Loja Fácil sem gerar imagem, entregando auditoria real, arquivos editados e polimento de UI com foco em mobile-first.

## Auditoria visual aplicada

### Problemas observados nos prints
- A tela de login ainda parecia uma composição de apresentação web + mobile, em vez de uma tela real separada por dispositivo.
- A versão web precisava ficar mais próxima da referência comercial: menu lateral escuro, área clara, cards organizados, botões simples e status bem legível.
- O topo do sistema estava funcional, mas com atalhos menos comerciais para operação diária.
- O mobile precisava priorizar navegação rápida: Início, Vendas, Clientes, Produtos e Mais.
- O usuário leigo precisava de textos e botões mais diretos, sem aparência de mockup.

## Alterações realizadas

### Login
- Removidos os marcadores visuais WEB/MOBILE da tela real.
- Removida a apresentação lateral da tela de login.
- Criada tela única e limpa que se adapta ao viewport: web centralizado e mobile em tela inteira.
- Card de login ficou parecido com a referência: logo no topo, nome forte, campos grandes, botão verde e observação de segurança discreta.
- Campos de login e senha receberam ícones comerciais antigos via `AppIcon`.
- Botão extra de painel ficou discreto para não competir com o botão principal de login.

### Shell / navegação
- Menu inferior mobile reordenado para o fluxo mais comercial: Início, Vendas, Clientes, Produtos e Mais.
- Atalhos do topo alterados para ações reais de loja: Nova venda, Novo cliente, Novo produto, Relatórios e Mais ações.
- O botão Mais ações abre o menu completo.
- O web ficou com menu escuro clássico, área clara e cards com bordas visíveis.
- Topbar, status e page shell receberam alinhamento e largura máxima consistente.

### Mobile-first
- No celular, a busca e o bloco de saudação são escondidos para reduzir poluição.
- Atalhos principais aparecem em 4 cards tocáveis.
- Status fica empilhado em cards legíveis.
- Cards e KPIs mantêm duas colunas quando possível, caindo para uma coluna em telas muito estreitas.
- Bottom dock preserva safe-area e destaque visual clássico.

### Design system
- Criadas variáveis v70 para fundo, papel, linhas, texto, marrom clássico, azul comercial e verde de ação.
- Bordas, sombras, chips, cards, tabelas e estados vazios receberam acabamento mais consistente.
- Tabelas e filtros ficaram mais legíveis, com cabeçalho bege/cinza e linhas claras.

### PWA/cache
- Versão web atualizada para `pwa-supabase-v70`.
- Cache PWA atualizado para `smart-loja-pwa-supabase-v70-web-mobile-separado-polimento`.
- Manifest ajustado para refletir a nova proposta de web/mobile separado.

## Arquivos alterados
- `src/pages/Welcome.tsx`
- `src/components/WebAuthPanel.tsx`
- `src/components/Shell.tsx`
- `src/lib/webApi.ts`
- `src/styles.css`
- `public/sw.js`
- `public/manifest.webmanifest`
- `docs/MEGA_LOTE_70_WEB_MOBILE_SEPARADO_LOGIN_UI.md`

## Testes executados
- `npm run type-check` — passou
- `npm run lint` — passou
- `npm run release:check` — passou
- `npm run build` — passou
- `npm audit --audit-level=low` — passou, 0 vulnerabilidades
- `node --check public/sw.js` — passou
- Validação JSON de `package.json` — passou
- Validação JSON de `public/manifest.webmanifest` — passou
- `npm run preview` em `127.0.0.1:4173` — respondeu HTTP 200

## Teste não executado
- Login Supabase real e RLS real não foram testados porque o projeto enviado não inclui `.env` com URL e anon key pública.
- Dev server em `127.0.0.1:1420` não foi iniciado porque a porta já estava ocupada no ambiente de teste; a build e o preview de produção passaram.

## Risco
Baixo para UI, CSS, build, PWA/cache e navegação.
Médio para prontidão comercial total enquanto Supabase real, RLS e sincronização em dois aparelhos não forem validados com credenciais públicas corretas.

## Próximo lote ideal
Lote 71: testar Supabase real com URL/anon key, validar RLS/policies, produtos/clientes/vendas em dois aparelhos, criação de loja inicial, permissões por papel e alertas leigos de salvando/sincronizando/sincronizado/pendente/erro por módulo.
