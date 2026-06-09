# Mega Lote 199 — Comprovante Tipografia + ABERTA

## Objetivo
Deixar a tipografia do comprovante mais fiel ao pedido: letras de vencimento e descrição no mesmo tamanho, sem negrito, e corrigir o posicionamento da palavra "ABERTA".

## Ajustes
- descrição do produto sem negrito;
- descrição e vencimento com o mesmo tamanho de fonte no comprovante;
- unitário e total também suavizados para manter coerência visual;
- badge/status "ABERTA" com melhor posicionamento e centralização;
- mesmos ajustes aplicados no compartilhamento PDF/PNG e nas abas que usam `receiptShare.ts`;
- mantido compartilhamento apenas do arquivo, sem texto e sem link.

## Auditoria
- Comprovante: `src/mobile-app/screens/ReceiptsScreen.tsx`;
- Vendas Recentes e Atividades Recentes: `src/mobile-app/components/receiptShare.ts`;
- Todos seguem o mesmo padrão de exportação atual para PDF/PNG/Compartilhar.
