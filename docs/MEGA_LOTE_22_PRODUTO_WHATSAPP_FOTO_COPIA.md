# MEGA LOTE 22 — Produtos: WhatsApp com foto e painel de copiar informações

## Objetivo
Melhorar a aba Produtos para usuário leigo conseguir abrir o produto, copiar preço/descrição/cor/tamanho e enviar pelo WhatsApp com suporte à foto cadastrada.

## O que foi feito
- Adicionado botão **Abrir** na tabela de produtos.
- Criado modal de detalhes do produto com foto, preço, categoria, cor, tamanho, estoque e código quando existirem.
- Adicionado campo de texto pronto para copiar com descrição do produto.
- Botões novos:
  - **WhatsApp com foto**
  - **Copiar tudo**
  - **Copiar preço**
  - **Copiar cor/tamanho**
  - **Copiar foto**
  - **Salvar foto**
- O botão WhatsApp tenta copiar a foto para a área de transferência e abre o WhatsApp com texto pronto.
- Se a cópia da foto não for permitida pelo Windows/WebView, o sistema informa que a foto deve ser anexada manualmente.

## Arquivos alterados
- `src/pages/Products.tsx`
- `src/styles.css`

## Observação
O WhatsApp não permite anexar arquivo automaticamente de forma segura. O sistema agora copia a imagem quando possível e abre a mensagem pronta para o usuário colar/anexar.
