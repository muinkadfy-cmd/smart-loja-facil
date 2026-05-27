# Mega Lote 40 - Páginas internas premium mobile-first

## Objetivo
Aproximar Produtos, Clientes, Vendas/PDV, Caixa, tabelas, filtros e modais do mesmo padrão visual premium aplicado ao dashboard, mantendo web/desktop e mobile como o mesmo produto.

## O que foi feito
- DataTable ganhou modo mobile-card com `data-label`, evitando tabela espremida no celular.
- Filtros ganharam estrutura mais premium com ícone de busca, campos maiores e melhor hierarquia.
- Modal recebeu acabamento premium e melhor comportamento no mobile.
- CSS global das páginas internas foi lapidado para cards, formulários, botões, tabelas, filtros, mensagens e ações.
- Layouts de Produtos, Vendas/PDV, Clientes, Caixa e páginas legadas passaram a ter melhor responsividade.
- Service worker atualizado para o celular puxar versão nova.

## Arquivos alterados
- `src/components/DataTable.tsx`
- `src/components/TableFilters.tsx`
- `src/components/Modal.tsx`
- `src/styles.css`
- `public/sw.js`

## Testes
Executar:
- `npm run type-check`
- `npm run build`
- `npm run lint`
- `npm run release:check`
- `node --check public/sw.js`
