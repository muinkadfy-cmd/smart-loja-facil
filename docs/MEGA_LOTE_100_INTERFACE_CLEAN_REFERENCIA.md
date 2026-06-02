# Mega Lote 100 — Interface clean fiel à referência web/mobile

## Objetivo
Refatorar a aparência do Smart Loja Fácil PWA para ficar mais próxima da referência enviada: dashboard claro, pouco poluído, sidebar leve no web, topbar clean, cards brancos com sombras suaves, mobile-first e tela de login compatível com a mesma identidade.

## Escopo seguro
- Não altera tabelas Supabase.
- Não altera fonte oficial de dados.
- Não mexe em regras de venda, caixa, clientes, produtos ou crediário.
- Mantém projeto PWA-only web/mobile.
- Atualiza versão lógica/cache para `pwa-supabase-v100`.

## Principais melhorias
- Nova camada visual `lote100-reference-clean-interface.css`.
- Sidebar web clara com item ativo azul suave e melhor contraste.
- Topbar web com busca limpa, botões compactos e seletor de loja premium.
- Dashboard com KPI cards brancos, menos poluição e melhor hierarquia.
- PDV com campos e cards mais claros, mantendo lógica existente.
- Mobile com header compacto, cards 2 colunas no dashboard e dock inferior limpo.
- Login com painel hero + card de acesso compatível com a nova interface.
- Service worker/cache versionado para o celular puxar a nova interface após deploy.

## Testes esperados
- `npm run type-check`
- `npm run lint`
- `npm run build`
- `npm run release:check`
- `node --check scripts/release_check.js`
- validação JSON do `public/manifest.webmanifest`

## Validação manual recomendada
1. Abrir dashboard no desktop e conferir sidebar clara, topbar limpa e cards sem quebra.
2. Abrir no celular e conferir header, cards, dock inferior e scroll sem corte lateral.
3. Abrir Vendas/PDV no celular e conferir leitura dos campos e resumo da venda.
4. Sair da sessão e conferir a tela de login na mesma identidade visual.
5. Conferir versão `pwa-supabase-v100` no diagnóstico/sidebar.

## Próximo lote ideal
Lote 101 — aplicar o mesmo padrão clean, tela por tela, com revisão profunda de Produtos, Clientes, Caixa, Crediário, Relatórios e Comprovantes em mobile real.
