# Mega Lote 61 — Dashboard clean, mobile-first e menos poluição visual

## Objetivo
Aplicar o COMANDO MESTRE 10/10 na aba Dashboard/Resumo rápido, com foco em web e mobile, aparência comercial premium, menos preto/navy, melhor hierarquia, micro acabamento e leitura mais simples para usuário leigo.

## Auditoria antes da edição
Pelas telas enviadas, a aba Dashboard estava funcional e já mais clara que as abas antigas, mas ainda tinha problemas de acabamento:

- card superior de login/usuário ainda grande para uma tela operacional;
- alguns blocos do Dashboard tinham respiro irregular;
- gráfico ficava visualmente fraco quando não havia venda no período;
- status do sistema e atalhos podiam ficar mais claros e menos técnicos;
- a tela misturava padrão limpo com resquícios do visual dark/navy antigo;
- em mobile, havia risco de cards altos demais e navegação com excesso de densidade.

## Alterações aplicadas

### Dashboard
- adicionada camada `smart-dashboard-v61` para isolar o polimento do Dashboard;
- KPIs mais compactos, claros e legíveis;
- cards de contexto com fundo branco, borda cinza e menor sombra;
- seção de atalhos rápidos com grade mais limpa e toque confortável;
- gráfico com estado vazio visível: “Nenhuma venda no período”;
- filtros de período mais claros e alinhados;
- status operacional com linhas mais leves e arredondadas;
- faixa final de segurança/performance mais limpa e menos escura.

### Header/Shell
- card “Olá/Aguardando login” ficou mais compacto e menos poluído;
- texto de login ficou mais humano: “Aguardando login” e “Entre para sincronizar a loja web”;
- botões do topo e chips de conexão ficaram mais leves, com fundo claro e azul controlado.

### PWA/cache
- service worker atualizado para `smart-loja-pwa-supabase-v61-dashboard-clean-premium`, evitando que o navegador mantenha CSS antigo.

## Arquivos alterados
- `src/pages/Dashboard.tsx`
- `src/components/Shell.tsx`
- `src/styles.css`
- `public/sw.js`

## Arquivo novo
- `docs/MEGA_LOTE_61_DASHBOARD_CLEAN_MOBILE_FIRST.md`

## Testes executados

Passaram:
- `npm run lint`
- `npm run release:check`

Não concluído:
- `npm run type-check`

Motivo: o ambiente do ZIP não possui `node_modules`; faltam módulos/tipos como `react`, `vite`, `@vitejs/plugin-react` e `react/jsx-runtime`. Esse mesmo problema já existia no ambiente de validação sem dependências instaladas.

## Risco
Baixo a médio.

- Baixo para regras de negócio, pois não foi alterada lógica de dados/Supabase/CRUD.
- Médio visual, porque o CSS do projeto ainda tem muitas camadas antigas e pode haver conflito em telas específicas.

## Próximo lote ideal
Depois de validar visualmente o Dashboard no celular e no desktop, o próximo lote ideal é aplicar a mesma camada clara em:

1. Produtos
2. Clientes
3. Pedidos
4. Vendas/PDV
5. Caixa
6. Crediário

com foco em reduzir dark/navy restante, limpar formulários e padronizar tabelas.
