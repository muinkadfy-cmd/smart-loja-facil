# Mega Lote 159 — Crediário com notas expansíveis e comprovantes por parcela

## Objetivo
Melhorar a aba Crediário no mobile para usuário leigo conseguir abrir cada nota/venda, enxergar todas as parcelas e enviar/imprimir comprovante da nota inteira ou de cada parcela com status correto.

## O que mudou
- Cards de crediário viraram notas expansíveis.
- Cada nota mostra valor original, pago, restante, contato e status.
- Cada nota tem ações de comprovante geral: 58mm, 80mm, A4 e Enviar nota.
- Cada parcela mostra valor original, pago, restante, vencimento e status.
- Cada parcela tem ações: Receber, 58mm, 80mm, A4 e Enviar.
- Comprovante de parcela mostra status correto: Paga, Parcial, Pendente, Vencida ou Parcial vencida.
- Comprovante geral da nota lista todas as parcelas com original, pago, restante e status.
- Mantida a lógica de proteção de pagamento maior/menor com redistribuição e confirmação antes de baixar.

## Segurança
- Não altera banco de dados.
- Não muda cálculo financeiro de backend.
- Não apaga valor original de parcela.
- Não altera venda, caixa, estoque ou backup.
- Não cria saldo negativo.
- Apenas melhora leitura, comprovante, impressão e envio no mobile.

## PWA/cache
- APP: pwa-supabase-v159-crediario-notas-comprovantes
- CACHE: smart-loja-pwa-supabase-v159-crediario-notas-comprovantes

## Testes executados
- npm run type-check
- npm run build
- npm run lint
- npm run release:check
- npm run release:commercial:check
- npm run release:commercial:prepare
- npm audit --audit-level=high
- node scripts/credit_payment_guard_tests.js
- node --check scripts/release_check.js
- node --check scripts/commercial_package_check.js
- node --check scripts/commercial_release_package.js
- Validação JSON de package.json, package-lock.json e manifest.webmanifest

## Como testar no celular
1. Abrir a aba Crediário.
2. Tocar em uma nota/venda para expandir.
3. Conferir parcelas e status.
4. Enviar comprovante da nota inteira.
5. Enviar comprovante de uma parcela paga, parcial e pendente.
6. Gerar 58mm, 80mm e A4.
7. Receber valor menor, exato e maior que uma parcela e conferir o status depois.
8. Abrir a aba Comprovantes e confirmar que parcelas continuam aparecendo com status correto.
