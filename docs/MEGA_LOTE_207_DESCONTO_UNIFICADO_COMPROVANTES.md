# Mega Lote 207 — Desconto Unificado nos Comprovantes

## Objetivo
Unificar a exibição de desconto nos comprovantes, extrato do crediário, vendas recentes e atividades recentes.

## Ajustes aplicados
- adicionada faixa visual de desconto no extrato do crediário;
- quando houver desconto, mostra SUBTOTAL, DESCONTO e TOTAL FINAL;
- quando desconto for zero, a faixa não aparece;
- aplicado na aba Comprovantes (`ReceiptsScreen.tsx`);
- aplicado em Vendas Recentes e Atividades Recentes (`receiptShare.ts`);
- mantido total final destacado;
- removida duplicidade antiga de desconto em venda normal;
- mantido sem card ABERTA;
- mantido sem ANOTAÇÕES;
- mantida fonte Sora e fonte maior;
- mantido PDF/PNG/Compartilhar usando o mesmo padrão.

## Observação técnica
No extrato do crediário, o desconto é inferido quando a soma dos itens da venda é maior que o total final da nota.
