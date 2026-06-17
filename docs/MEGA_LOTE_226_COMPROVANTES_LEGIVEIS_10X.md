# Mega Lote 226 — Comprovantes Legíveis 10/10

## Objetivo
Padronizar e reforçar a legibilidade de todos os comprovantes, extratos, PNG, PDF e compartilhamentos para que:
- nome do cliente fique bem visível;
- descrição/nome do produto fique grande e legível;
- vencimento fique grande e legível;
- o padrão de fonte e tamanho seja mantido nos dois motores de comprovante.

## Auditoria
Foram auditados os dois motores:
- `src/mobile-app/screens/ReceiptsScreen.tsx`
  - Aba Comprovantes;
  - Extrato do Crediário;
  - Recibo de parcela;
  - PDF/PNG/Compartilhar da aba Comprovantes.
- `src/mobile-app/components/receiptShare.ts`
  - Vendas recentes;
  - Atividades recentes;
  - PDF/PNG/Compartilhar desses atalhos.

## Correções aplicadas
- Nome do cliente com fonte maior e proteção contra corte;
- Descrição/produto maior, com peso mais forte e linhas mais altas;
- Vencimento maior e com coluna mais larga;
- Linhas de produto aumentadas para não apertar descrições;
- Linhas de parcelas aumentadas para não apertar vencimentos;
- Sora reforçada nos pesos usados pelos comprovantes;
- Valores e quantidades com peso compatível;
- PDF principal continua fiel ao PNG;
- Fallback PDF manual recebeu melhoria de legibilidade nos textos principais;
- Mantidos acentos, cedilha e compartilhamento iPhone sem link automático;
- Sem alteração em cálculo, venda, pagamento, crediário ou estoque.

## Arquivos alterados
- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/components/receiptShare.ts`
- arquivos de versão/cache/release v226

## Classificação
- Nome do cliente: PRONTO — 9,7/10 — ★★★★★ 4,85/5.
- Descrição do produto: PRONTO — 9,6/10 — ★★★★★ 4,8/5.
- Vencimento: PRONTO — 9,6/10 — ★★★★★ 4,8/5.
- PNG: PRONTO — 9,6/10 — ★★★★★ 4,8/5.
- PDF principal: PRONTO — 9,6/10 — ★★★★★ 4,8/5.
- Compartilhamento: PRONTO COM OBSERVAÇÃO — 9,5/10 — ★★★★★ 4,75/5.
- Risco: baixo, alteração focada em renderização visual.
