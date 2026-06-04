# Mega Lote 162 — Correção: Comprovantes recebem cliente/nota/parcela, Crediário volta a ser operacional

## Objetivo
Corrigir o direcionamento do lote anterior: a organização por cliente, nota expansível, parcelas, Visualizar iPhone, A4/PDF e envio de comprovantes pertence à aba **Comprovantes**, não à aba **Crediário**.

## Alterações principais
- Aba **Crediário** voltou a ficar focada em consulta de saldo e recebimento de parcelas.
- Removidos da aba **Crediário** os botões de comprovante/visualização/envio que confundiam o fluxo.
- Aba **Comprovantes** agora carrega comprovantes salvos + crediários da loja.
- Crediário dentro de **Comprovantes** foi organizado por cliente.
- Cada cliente mostra notas/vendas e totais: total, pago e restante.
- Cada nota/venda é expansível e mostra as parcelas dentro.
- Cada parcela mostra valor original, pago, restante, vencimento e status.
- Ações de comprovante ficaram apenas em **Comprovantes**: Visualizar/print iPhone, A4/PDF e Enviar/compartilhar.
- Removidos botões 58mm/80mm da aba **Comprovantes**, deixando somente A4/PDF e visualização HTML/PDF para iPhone.
- Comprovante individual da parcela e extrato da nota usam nome da loja, logo/monograma, status forte e totais detalhados.
- Corrigido erro de função duplicada em `ReceiptsScreen.tsx` que podia quebrar build.

## Segurança
- Não altera banco de dados.
- Não altera cálculo financeiro.
- Não baixa parcela automaticamente.
- Não mexe em vendas, estoque, caixa, backup, login ou permissões.
- Mudança concentrada em interface, organização e geração/visualização de comprovantes.

## Testes executados
- `npm ci --ignore-scripts --no-audit --no-fund`
- `npm run type-check`
- `npm run build`
- `npm run lint`
- `npm run release:check`
- `npm run release:commercial:check`
- `npm audit --audit-level=high`
- `node scripts/credit_payment_guard_tests.js`

## Teste manual recomendado
1. Abrir **Crediário** e conferir que a aba está focada em receber parcelas.
2. Abrir **Comprovantes**.
3. Buscar cliente por nome, telefone ou número da nota.
4. Abrir cliente, abrir nota/venda e conferir as parcelas.
5. Testar Visualizar/print iPhone na nota inteira.
6. Testar A4/PDF na nota inteira.
7. Testar Visualizar, A4/PDF e Enviar em uma parcela paga, parcial, pendente e vencida.
8. Conferir se o nome/logo da loja aparece corretamente no comprovante.
