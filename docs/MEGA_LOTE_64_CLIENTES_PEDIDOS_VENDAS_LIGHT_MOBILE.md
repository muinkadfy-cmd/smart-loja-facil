# Mega Lote 64 — Clientes, Pedidos e Vendas/PDV Light Mobile-first

## Objetivo
Aplicar o COMANDO MESTRE 10/10 nas abas Clientes, Pedidos e Vendas/PDV, reduzindo o excesso de preto/navy, melhorando micro acabamento, hierarquia visual, textos, botões, estados vazios, formulários, tabelas e responsividade mobile-first.

## Arquivos alterados
- `src/pages/Customers.tsx`
- `src/pages/Orders.tsx`
- `src/pages/Sales.tsx`
- `src/styles.css`
- `public/sw.js`
- `docs/MEGA_LOTE_64_CLIENTES_PEDIDOS_VENDAS_LIGHT_MOBILE.md`

## Melhorias aplicadas

### Clientes
- Adicionada camada visual `customers-light-v64`.
- Cadastro ficou mais claro, com bloco de orientação para usuário leigo.
- Formulário, filtros e tabela recebem padrão branco/gelo com bordas suaves.
- Correções de texto: crediário, Endereço, Observações, Salvar alterações, Cancelar edição e Ação.
- Melhorada leitura de estados vazios, botões e ações.

### Pedidos
- Adicionada camada visual `orders-light-v64`.
- Bloco de orientação para montar pedido com menos dúvida.
- Formulário, filtros, tabela do carrinho e lista de pedidos recebem acabamento mais claro.
- Correção de Balcão e abreviação Qtd.
- Status e chips ficam mais legíveis.

### Vendas / PDV
- Adicionada camada visual `sales-light-v64`.
- Fluxo do PDV ganhou orientação rápida no topo.
- Adicionar produto, itens da venda, cliente, pagamento, resumo e últimas vendas recebem padrão mais claro.
- Reduzido peso de painéis escuros e sombras pesadas.
- Correções de texto: Disponível, última, unitário, Cartão Débito / Crédito e Resumo da venda.
- Botões principais e secundários ficam mais consistentes.

## Mobile-first
- Grids passam para 1 coluna em telas menores.
- Botões ficam 100% no mobile quando faz sentido.
- Campos mantêm altura confortável para toque.
- Tabelas e listas usam estados vazios mais legíveis.
- Ações múltiplas ficam em grade mais limpa.

## Testes executados
- `npm run lint` — passou.
- `npm run release:check` — passou.
- `npm run type-check` — não concluiu porque o ambiente está sem `node_modules` e faltam dependências/tipos como React, Vite e JSX runtime.

## Riscos restantes
- É necessário validar visualmente no navegador real, especialmente mobile 360px, 390px e 430px.
- Ainda existem camadas antigas no CSS global; este lote sobrepõe de forma segura nas três abas, mas uma refatoração futura pode reduzir dívida visual.
- Produtos já foi melhorado nos lotes anteriores, mas ainda pode receber uma revisão conjunta com Clientes/Pedidos/Vendas após teste real.

## Nota estimada
- Antes: 6.1/10 em consistência visual e poluição.
- Depois: 8.0/10 nas três abas trabalhadas.

## Próximo mega lote ideal
1. Aplicar o mesmo padrão light final em Caixa, Crediário e Comprovantes.
2. Revisar Relatórios, Backup, Configurações e Diagnóstico Web para reduzir trechos técnicos e melhorar leitura leiga.
3. Consolidar classes antigas dark/neo para reduzir `!important` e conflito visual.
4. Fazer QA visual em celular real com login, cadastro de cliente, criação de pedido e venda completa.
