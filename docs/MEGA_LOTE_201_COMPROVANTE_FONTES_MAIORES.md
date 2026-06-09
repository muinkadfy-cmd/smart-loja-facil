# Mega Lote 201 — Comprovante Fontes Maiores

## Objetivo
Corrigir o tamanho das letras nos comprovantes, porque descrição, vencimento, parcelas e valores estavam pequenos em alguns fluxos.

## Ajustes
- descrição do produto maior;
- vencimento maior;
- parcela, valor, unitário e total maiores;
- descrição e vencimento no mesmo tamanho visual;
- texto de linha sem negrito pesado;
- badge/palavra ABERTA micro ajustada;
- linhas ganharam um pouco mais de altura para não ficar espremido;
- comprovante da aba Comprovantes mantido no mesmo padrão;
- Vendas recentes e Atividades recentes também ajustadas via `receiptShare.ts`;
- PDF/PNG/Compartilhar continuam usando o padrão unificado;
- fonte Sora mantida nos comprovantes e no sistema.

## Auditoria
- `ReceiptsScreen.tsx` controla a aba Comprovantes;
- `receiptShare.ts` controla Vendas Recentes e Atividades Recentes;
- os dois foram ajustados para manter equivalência visual.
