# MEGA LOTE 23 — Produto no WhatsApp somente com descrição completa

## Objetivo
Corrigir o fluxo da aba Produtos para não prometer envio de foto pelo WhatsApp.

## Alterações
- O botão principal do modal agora mostra **Enviar descrição**.
- O WhatsApp é aberto somente com a descrição completa do produto.
- A descrição também é copiada para a área de transferência.
- Removidas ações que confundiam o usuário leigo: **Copiar foto** e **Salvar foto**.
- A foto do produto continua aparecendo somente como visualização local dentro do sistema.

## Arquivo alterado
- `src/pages/Products.tsx`
