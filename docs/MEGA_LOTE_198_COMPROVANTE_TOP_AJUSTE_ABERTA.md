# Mega Lote 198 — Comprovante Top Ajuste ABERTA

## Objetivo
Fazer um pequeno micro ajuste no topo do comprovante, principalmente na área do status "ABERTA", e validar que as abas de Comprovante, Vendas Recentes e Atividades Recentes mantenham o mesmo layout em PDF, PNG e Compartilhar.

## Ajustes
- micro ajuste do topo do comprovante;
- refinamento da linha de status e do badge "ABERTA";
- melhor alinhamento do bloco de status no cabeçalho;
- mantido o mesmo layout para comprovante, vendas recentes e atividades recentes nos fluxos PDF/PNG/Compartilhar;
- mantido compartilhamento apenas do arquivo, sem texto e sem link.

## Validação
- Comprovante usa layout do ReceiptsScreen.
- Vendas Recentes e Atividades Recentes usam `shareSaleReceipt` em `receiptShare.ts`.
- Os três fluxos seguem o mesmo padrão visual do lote atual.
