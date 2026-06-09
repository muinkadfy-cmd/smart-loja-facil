# Mega Lote 200 — Sora + Comprovantes Unificados

## Objetivo
Aplicar a fonte Sora no sistema inteiro e nos comprovantes, além de auditar diferenças entre Aba Comprovantes, Vendas Recentes e Atividades Recentes para manter o mesmo padrão em PDF, PNG e Compartilhar.

## Ajustes
- `@font-face` para Sora em `mobile-app.css` e `styles.css`;
- fonte global do app alterada para Sora com fallback seguro;
- canvas dos comprovantes passa a carregar Sora antes de desenhar;
- comprovantes usam Sora em PDF/PNG/Compartilhar;
- descrição do produto e vencimento ficam no mesmo tamanho e sem negrito;
- badge/status ABERTA refinado;
- cache do service worker atualizado para aceitar `/fonts/`;
- mantido compartilhamento somente do arquivo, sem texto e sem link.

## Auditoria
- Aba Comprovantes: `src/mobile-app/screens/ReceiptsScreen.tsx`;
- Vendas Recentes e Atividades Recentes: `src/mobile-app/components/receiptShare.ts`;
- Os fluxos usam o mesmo padrão visual de fonte, tamanho, peso e exportação.

## Observação
O ZIP não inclui arquivos `.ttf`. Ele referencia `/public/fonts/Sora-*.ttf`, que já deve permanecer no projeto do cliente.
