# Mega Lote 204 — Remover Card ABERTA

## Objetivo
Remover o card rosa **ABERTA** do topo dos comprovantes e manter apenas a linha textual `Status: Aberta`, deixando o layout mais limpo e unificado.

## Ajustes aplicados
- removido o card/badge **ABERTA** da aba Comprovantes;
- removido o card/badge **ABERTA** dos comprovantes de Vendas Recentes;
- removido o card/badge **ABERTA** dos comprovantes de Atividades Recentes;
- mantida a informação textual `Status: Aberta`;
- micro ajuste no alinhamento da linha de status;
- mantida fonte Sora;
- mantidas fontes maiores do lote anterior;
- mantido padrão PDF/PNG/Compartilhar;
- mantido compartilhamento somente arquivo, sem texto e sem link.

## Auditoria de consistência
- Aba Comprovantes: `src/mobile-app/screens/ReceiptsScreen.tsx`;
- Vendas Recentes e Atividades Recentes: `src/mobile-app/components/receiptShare.ts`;
- Todos os fluxos foram ajustados para não manter layout diferente no topo.
