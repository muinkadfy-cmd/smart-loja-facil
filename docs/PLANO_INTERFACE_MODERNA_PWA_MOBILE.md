# Plano de interface moderna — Smart Loja PWA Supabase

## Direção visual

A nova interface deve manter a seriedade comercial do sistema antigo, mas com aparência de app moderno:

- modo dark premium;
- contraste forte;
- cards mais limpos;
- menos bordas competindo entre si;
- botões principais claros;
- hierarquia visual por prioridade;
- mobile-first antes do desktop;
- sensação igual no celular e no PC.

## Layout mobile ideal

### Topo

- Nome da loja com reticências se for grande.
- Status pequeno: Online, Offline, Sincronizando ou Pendências.
- Botão de perfil/configuração.

### Menu inferior

Itens principais:

1. Início
2. Vender
3. Produtos
4. Clientes
5. Mais

Dentro de “Mais”:

- Caixa
- Crediário
- Pedidos
- Comprovantes
- Relatórios
- Backup/Exportação
- Configurações
- Auditoria

### Dashboard mobile

- Card grande: vendas de hoje.
- Card pequeno: caixa atual.
- Card pequeno: crediário vencido.
- Card pequeno: estoque baixo.
- Ações rápidas: Nova venda, Novo produto, Novo cliente, Receber parcela.
- Últimas vendas em lista compacta.

### Formulários

- Campos em uma coluna.
- Botão principal sempre visível no final.
- Inputs altos o suficiente para toque.
- Menos campos na primeira dobra da tela.
- Se o formulário for grande, dividir em blocos.

### Tabelas

No celular, não usar tabela larga. Usar cards:

- título forte;
- status/chip;
- valor destacado;
- dados secundários em duas linhas;
- ações em botões pequenos.

## Layout desktop ideal

- Sidebar fixa mais compacta.
- Topbar menor.
- Cards alinhados em grid.
- Tabelas densas, mas legíveis.
- Ações rápidas sempre no topo da página.
- Rodapé/statusbar menos pesado.

## Micro polimento obrigatório

- Espaçamento consistente: 8/12/16/20/24.
- Cards com raio consistente.
- Botão principal sempre mais forte que secundários.
- Status sempre com cor e texto, não só cor.
- Evitar cards gigantes vazios.
- Evitar scroll duplo.
- Evitar textos quebrando no celular.
- Evitar menu cobrindo conteúdo.
- Tabelas desktop com cabeçalho fixo quando necessário.

## Páginas prioritárias para redesenhar primeiro

1. Login/Admin inicial.
2. Dashboard.
3. PDV/Venda.
4. Produtos.
5. Clientes.
6. Crediário.
7. Caixa.
8. Pedidos.
9. Comprovantes.
10. Configurações.

## Rank visual atual e alvo

- Visual atual: **7.6/10** — bom começo, mas ainda pesado e antigo.
- Alvo mobile-first: **9.4/10**.
- Alvo desktop/web: **9.2/10**.

Para chegar nesse nível, o correto é recriar o layout base e ir migrando as telas por módulo, sem tentar apenas “maquiar” o CSS antigo.
