# Mega Lote 179 — Extrato do crediário com produtos + cliente rápido na venda

## Objetivo

Aplicar no ZIP mais atual duas melhorias comerciais P1:

1. Exibir no extrato do crediário os produtos que o cliente comprou.
2. Permitir cadastrar novo cliente dentro da tela de venda, sem sair do PDV e sem perder o carrinho.

## O que foi alterado

- O tipo `CreditSummary` agora aceita `sale_items` com produto, quantidade, valor unitário e total.
- O carregamento do crediário na web/Supabase busca os itens da venda vinculada e envia para a tela de comprovantes.
- O carregamento do crediário no Tauri/SQLite também passa a incluir os itens da venda vinculada.
- O extrato do crediário em HTML/tela interna ganhou a seção **Produtos comprados** antes da tabela de parcelas.
- O PDF manual real do extrato ganhou a tabela **PRODUTOS COMPRADOS** antes das parcelas.
- O texto de compartilhamento do extrato também inclui os produtos comprados.
- A tela mobile Vendas/PDV ganhou **Criar cliente rápido** dentro do pagamento/cliente.
- A tela web Vendas também ganhou cadastro rápido de cliente no painel do cliente.
- Ao salvar o cliente rápido, o sistema já seleciona o cliente na venda e mantém o carrinho pronto para finalizar no crediário.

## Arquivos alterados

- `src/types.ts`
- `src/lib/webApi.ts`
- `src-tauri/src/main.rs`
- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/screens/SalesScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`
- `src/pages/Sales.tsx`
- `src/styles.css`
- `package.json`
- `package-lock.json`
- `public/sw.js`
- `public/manifest.webmanifest`
- `src/lib/webApi.ts`
- scripts de release/comercial

## Preservado

- Login/Supabase Auth.
- Variáveis `.env`.
- RLS/policies.
- Notificações externas.
- Estrutura do PDF manual real.
- Regras de baixa de estoque e recebimento de crediário.

## Testes executados

Passaram:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run type-check
npm run build
npm run lint
npm run release:check
npm audit --audit-level=high
node scripts/credit_payment_guard_tests.js
npm run qa:push
npm run release:commercial:check
npm run release:commercial:prepare
```

Resultado: 0 vulnerabilidades high.

## Observações

- O build segue com aviso de chunk acima de 500 KB. Não quebrou, mas ainda é recomendado otimizar em lote futuro para celular fraco.
- O extrato só mostra produtos quando a venda vinculada tiver itens em `sale_items`. Se for dado antigo sem vínculo, o recibo mostra aviso leigo dizendo que os produtos não foram encontrados e mantém as parcelas/totais.

## Próximo lote ideal

- Criar tela de detalhes da venda/nota reaproveitando o mesmo bloco de produtos e parcelas.
- Adicionar busca por produto dentro do histórico de crediário/comprovantes.
- Otimizar chunk grande com code splitting.
