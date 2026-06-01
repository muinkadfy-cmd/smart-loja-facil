# MEGA LOTE 16 — Forma de pagamento circulada no comprovante

## Objetivo
Quando a parcela estiver paga, destacar visualmente somente a forma usada no pagamento.

## Regras aplicadas
- Se a parcela estiver paga, o comprovante busca o último pagamento confirmado da parcela.
- Se o pagamento foi Pix, circula somente Pix.
- Se o pagamento foi Dinheiro, circula somente Dinheiro.
- Se o pagamento foi Cartão, circula Crédito como representação do pagamento por cartão.
- Se a parcela estiver em aberto ou parcial, nenhuma forma fica circulada.
- O carimbo PAGO continua aparecendo apenas em parcela paga.

## Arquivos alterados
- src/pages/Credits.tsx
- src/types.ts
- src-tauri/src/main.rs

## Observação
O banco não foi alterado. A forma de pagamento é lida da tabela existente `payments`.
