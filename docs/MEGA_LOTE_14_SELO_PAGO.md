# MEGA LOTE 14 — Selo PAGO no comprovante do crediário

## Objetivo
Adicionar selo visual de **PAGO** com a **data do pagamento** somente quando a parcela estiver quitada.

## O que foi alterado
- Adicionada função `stampDate` para formatar a data do pagamento em `pt-BR`.
- Atualizado `buildInstallmentHtml` para renderizar um selo `PAGO` somente quando:
  - `installment.status === 'pago'`
  - `installment.paid_at` existir
- O selo foi inserido dentro da área de anotações para aparecer no preview e no PDF.
- Mantido o comportamento anterior para parcelas em aberto ou parciais: **não mostrar selo**.

## Resultado esperado
- Parcela paga: mostra `PAGO` e `Em, dd/mm/aaaa`.
- Parcela não paga: selo não aparece.
