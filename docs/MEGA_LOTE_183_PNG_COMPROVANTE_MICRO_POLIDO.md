# Mega Lote 183 — PNG de comprovante micro polido

## Objetivo
Corrigir o PNG compartilhado a partir de Vendas recentes/Atividades recentes para não sair como texto cru, espremido ou com hierarquia fraca.

## Alterações
- Refeito o gerador PNG de comprovante em `receiptShare.ts`.
- PNG agora usa layout de recibo com seções visuais claras:
  - topo com logo e título;
  - quadro de cliente/venda/data/forma;
  - tabela `PRODUTOS COMPRADOS`;
  - bloco de pagamento e total;
  - anotações limpas;
  - rodapé da loja.
- Removido texto operacional do rodapé do PNG, mantendo apenas mensagem comercial.
- Melhorado espaçamento, fonte, linhas, contraste, bordas e hierarquia.
- Mantido compartilhamento sem link e sem texto extra.

## Não alterado
- Login, Supabase Auth, ENV, RLS e notificações push.
- Regras de venda, crediário e PDF.

## Validação
- `npm run type-check`: passou.
- `npm run build`: passou.
- `npm run lint`: passou.
- `npm run release:check`: passou.
- `npm audit --audit-level=high`: passou, 0 vulnerabilidades high.
- `node scripts/credit_payment_guard_tests.js`: passou.
- `npm run qa:push`: passou.
- `npm run qa:commercial`: passou.
- `npm run qa:load`: passou.
- `npm run release:commercial:check`: passou.
- `npm run release:commercial:prepare`: passou.

## Observação
O PNG continua sendo gerado pelo navegador via canvas. O layout foi preparado para ficar mais próximo do padrão do recibo/PDF e mais legível ao compartilhar no WhatsApp.
