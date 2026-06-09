# Mega Lote 206 — Comprovante Crediário Alinhado

## Objetivo
Corrigir os desalinhamentos detectados no comprovante do crediário, principalmente o topo/status, o bloco do cliente e o resumo do crediário.

## Ajustes aplicados
- status textual subido para não invadir a tabela do cliente;
- início do bloco cliente reposicionado com mais respiro;
- produto centralizado melhor dentro da linha;
- resumo do crediário ganhou separação real do card TOTAL;
- texto "Acompanhe vencimentos..." agora quebra dentro do card e não invade o total;
- valor total continua destacado, mas sem brigar com o texto do resumo;
- mantido sem card rosa ABERTA;
- mantido sem bloco ANOTAÇÕES;
- mantida fonte Sora;
- mantidas fontes maiores;
- mantido padrão PDF/PNG/Compartilhar;
- compartilhamento continua somente arquivo, sem texto e sem link.

## Auditoria de consistência
- Aba Comprovantes: `src/mobile-app/screens/ReceiptsScreen.tsx`;
- Vendas Recentes e Atividades Recentes: `src/mobile-app/components/receiptShare.ts`;
- Ambos os motores receberam o mesmo ajuste de topo/status e resumo.
