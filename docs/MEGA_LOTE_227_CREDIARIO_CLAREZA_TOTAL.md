# Mega Lote 227 — Crediário/Comprovantes com Clareza Total

## Contexto
O cálculo estava correto:
- Nota #0018: R$ 73,30;
- outra nota: R$ 635,70;
- total aberto do cliente: R$ 709,00.

O problema era visual: o usuário leigo poderia confundir o total geral do cliente com o restante de uma nota individual. Além disso, o card da nota estava espremendo texto em várias linhas estreitas.

## Correções aplicadas
- O badge do cliente passou a explicar o contexto:
  - `Total aberto do cliente: R$ ...`;
  - `Total atrasado do cliente: R$ ...`;
  - `Sem saldo`.
- O card da nota passou a usar:
  - `Nota #0000`;
  - meta em uma linha controlada;
  - status sem encavalar;
  - hint curto: `Toque para abrir parcelas`.
- Corrigido texto quebrando palavra por palavra.
- Badge `Aberta` ficou menor e alinhado.
- Totais da nota continuam separados:
  - Total da nota;
  - Pago;
  - Restante;
  - Parcelas.
- Botões do card ficaram em 2 colunas, com mais respiro para não ficarem escondidos pelo menu inferior.
- Adicionado padding inferior de segurança na aba Comprovantes.
- Não foi alterado cálculo, saldo, pagamento, parcelas ou crediário.

## Arquivos alterados
- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`
- arquivos de versão/cache/release v227

## Classificação
- Cálculo do crediário: PRESERVADO — 9,5/10 — ★★★★★ 4,75/5.
- Clareza cliente x nota: PRONTO — 9,5/10 — ★★★★★ 4,75/5.
- Card da nota: PRONTO COM OBSERVAÇÃO — 9,3/10 — ★★★★★ 4,65/5.
- Hierarquia visual: PRONTO COM OBSERVAÇÃO — 9,3/10 — ★★★★★ 4,65/5.
- Risco: baixo, alteração de texto/layout sem regra de negócio.
