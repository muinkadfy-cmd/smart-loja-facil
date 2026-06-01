# Manual de Uso - Smart Loja Fácil Offline

## 1. Abrir o sistema

Execute:

```bash
npm run tauri:dev
```

Na tela inicial, clique em **Abrir sistema**. O sistema deve mostrar o status **SQLite local ativo** e **100% Offline**.

## 2. Configurar a loja

Acesse **Configurações** e preencha:

- Nome da loja
- Responsável
- Telefone e WhatsApp
- Endereço
- Mensagem do comprovante
- Limite de estoque baixo
- Largura do recibo: 80mm, 58mm ou A4
- Modo PC lento, se o computador for fraco

Clique em **Salvar configurações**.

## 3. Cadastrar clientes

Acesse **Clientes**, preencha nome, telefone, WhatsApp, endereço, limite de crediário e observações. Clique em **Cadastrar cliente**.

## 4. Cadastrar produtos

Acesse **Produtos**, preencha produto, categoria, preço, estoque, unidade, tamanho, cor e código interno. Clique em **Cadastrar produto**.

Para entrada ou correção de estoque, use **Ajustar estoque** e informe motivo obrigatório.

## 5. Fazer venda

Acesse **Vendas / Caixa**:

1. Selecione produto.
2. Informe quantidade.
3. Clique em **Adicionar**.
4. Escolha cliente ou deixe como venda balcão.
5. Escolha forma: dinheiro, pix, cartão ou crediário.
6. Informe desconto, se houver.
7. Clique em **Finalizar venda**.

A venda é gravada em transação SQLite com baixa de estoque e comprovante.

## 6. Receber crediário

Acesse **Crediário**, localize o cliente/parcela e clique em **Receber**. O sistema registra pagamento, caixa e auditoria.

## 7. Criar pedido local

Acesse **Pedidos Locais**, selecione cliente, produto e quantidade. Clique em **Criar pedido**.

## 8. Comprovantes

Acesse **Comprovantes**, clique em **Abrir** e depois em **Imprimir / Salvar PDF**.

## 9. Relatórios

Acesse **Relatórios**, escolha o tipo, período e clique em **Gerar CSV local**.

## 10. Backup

Acesse **Backup**, clique em **Criar backup agora**. O sistema copia o banco e valida integridade.
