# MEGA LOTE 25 — Selecionar cliente antes de enviar produto no WhatsApp

## Objetivo
Abrir o WhatsApp direto na conversa do cliente escolhido ao enviar a descrição do produto.

## Ajustes aplicados
- A aba Produtos agora carrega clientes ativos cadastrados.
- No modal de produto, foi adicionado seletor **Cliente para WhatsApp direto**.
- O botão de WhatsApp da tabela abre o modal e pede seleção do cliente.
- O botão **Enviar descrição para cliente** valida se há cliente selecionado.
- O sistema usa o WhatsApp do cliente; se estiver vazio, usa o telefone.
- O link agora vai com `phone=55...` e `text=...`, abrindo direto na conversa quando o número existe no WhatsApp.
- O texto completo do produto continua sendo copiado para a área de transferência.

## Observação importante
O número cadastrado no cliente precisa existir no WhatsApp. Caso contrário, o WhatsApp pode abrir sem encontrar a conversa.

## Arquivo alterado
- `src/pages/Products.tsx`
