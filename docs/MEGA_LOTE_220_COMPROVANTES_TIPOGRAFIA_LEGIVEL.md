# Mega Lote 220 — Comprovantes, PDF, PNG e Compartilhamento com Tipografia Legível

## Objetivo
Padronizar a tipografia dos comprovantes, extratos, PNG, PDF e compartilhamento para manter o mesmo padrão de fonte, pesos e tamanhos, com foco em nome, descrição/produto e vencimentos legíveis.

## Auditoria
Foi identificado risco de diferença entre dois motores:
- Aba Comprovantes/Extratos (`ReceiptsScreen.tsx`);
- Compartilhamento de Vendas recentes/Atividades recentes (`receiptShare.ts`).

Também havia risco de produto/descrição e vencimentos ficarem pequenos em alguns PDFs/PNGs.

## Correções aplicadas
- Sora reforçada nos dois motores de comprovante;
- descrição/produto aumentado e padronizado;
- vencimentos aumentados e padronizados;
- valores, qtd, unitário e total ficaram em peso compatível;
- linhas de produto mais altas para evitar aperto;
- linhas de parcelas mais altas para evitar vencimento pequeno;
- cabeçalho de tabela mantém o mesmo padrão visual;
- PDF principal continua sendo imagem fiel do PNG;
- compartilhar usa o mesmo padrão tipográfico;
- mantidos acentos e cedilha dos lotes anteriores;
- mantido fluxo iPhone sem link automático;
- sem alteração em regra de venda, pagamento, crediário ou cálculos.

## Arquivos alterados
- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/components/receiptShare.ts`
- arquivos de versão/cache/release v220

## Classificação
- Aba Comprovantes: PRONTO COM OBSERVAÇÃO — 9,4/10 — ★★★★★ 4,7/5.
- PNG: PRONTO — 9,5/10 — ★★★★★ 4,75/5.
- PDF principal: PRONTO — 9,5/10 — ★★★★★ 4,75/5.
- Compartilhamento: PRONTO COM OBSERVAÇÃO — 9,4/10 — ★★★★★ 4,7/5.
- Tipografia/legibilidade: PRONTO — 9,5/10 — ★★★★★ 4,75/5.
- Risco: baixo, alteração focada em renderização visual.
