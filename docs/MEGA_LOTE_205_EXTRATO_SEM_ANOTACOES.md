# Mega Lote 205 — Extrato Sem Anotações

## Objetivo
Remover o bloco **Anotações** do Extrato PDF e do Extrato PNG, mantendo micro polimento, hierarquia visual e consistência entre as abas.

## Ajustes aplicados
- removido bloco **ANOTAÇÕES** do extrato PNG de Vendas Recentes e Atividades Recentes;
- removida chamada de anotações do PDF antigo/fallback da aba Comprovantes;
- mantido PNG fiel da aba Comprovantes sem bloco de anotações;
- removidas notas operacionais que poluíam o comprovante;
- rodapé fica mais limpo e com melhor respiro;
- mantida fonte Sora;
- mantidas fontes maiores dos comprovantes;
- mantido padrão PDF/PNG/Compartilhar;
- compartilhamento continua somente arquivo, sem texto e sem link.

## Auditoria de consistência
- Aba Comprovantes: `src/mobile-app/screens/ReceiptsScreen.tsx`;
- Vendas Recentes e Atividades Recentes: `src/mobile-app/components/receiptShare.ts`;
- Todos os fluxos foram revisados para não exibir bloco de anotações no extrato.
