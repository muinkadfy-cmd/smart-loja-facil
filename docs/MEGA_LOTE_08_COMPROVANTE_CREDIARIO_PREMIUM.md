# Mega Lote 08 — Comprovante de crediário premium

## Objetivo
Lapidar o layout de impressão/PDF da parcela do crediário para ficar mais próximo do modelo físico enviado: folha estreita, topo com marca, contato à direita, linhas para cliente/data/contato, tabela rosa de produtos, bloco de pagamento/total e anotações.

## Alterações
- Refeito `buildInstallmentHtml` em `src/pages/Credits.tsx`.
- Adicionada higienização de texto HTML para evitar quebrar o recibo com nomes ou observações contendo caracteres especiais.
- Ajustado formato visual para 80mm, com `@page size: 80mm auto`.
- Criadas linhas e tabela com dimensões mais parecidas com bloquinho manual.
- Melhorado preview dentro do modal, com folha centralizada e sombra leve.

## Limitações
- O logo ainda é textual/estilizado; para ficar idêntico ao papel físico é necessário cadastrar ou embutir imagem oficial da marca em asset local.
- A impressão depende do mecanismo Edge/WebView do Windows para gerar PDF/print.
