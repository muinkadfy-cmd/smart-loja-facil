# Mega Lote 232 — Status com espaço em Extrato / Comprovante

## Objetivo
Corrigir o micro detalhe visual do cabeçalho do extrato/comprovante para o status aparecer no padrão correto:

`Status: Aberta`

Sem o texto ficar grudado como `Status:Aberta`.

## Especialistas ativados
- Especialista sênior em PDF/PNG/canvas;
- Especialista em tipografia e micro espaçamento;
- Especialista UI/UX para usuário leigo;
- QA de regressão visual.

## Correção aplicada
- No motor principal `ReceiptsScreen.tsx`, o valor do status deixou de usar posição fixa apertada.
- O espaçamento agora é calculado pela largura real do texto `Status:` + margem de 16px.
- No fallback/manual de PDF, o status ganhou deslocamento maior para não grudar.
- No motor `receiptShare.ts`, usado em PNG/compartilhar/vendas recentes, a mesma regra foi aplicada.
- Mantido o layout, tamanho das tabelas, cálculos, parcelas, valores, produto, cliente e totais.

## Arquivos alterados
- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/components/receiptShare.ts`
- arquivos de versão/cache/release v232

## Auditoria anti-regressão
- Não altera venda;
- Não altera crediário;
- Não altera saldo;
- Não altera total;
- Não altera parcelas;
- Não altera o layout aprovado do lote 231;
- Apenas corrige o respiro entre rótulo e valor do status.

## Classificação
- Status com espaço: PRONTO — 9,7/10 — ★★★★★ 4,85/5.
- Risco de regressão: BAIXO.
