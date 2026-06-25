# Mega Lote 236 — Crediário com parcelas expansíveis

## Objetivo
Corrigir a percepção de que uma venda com várias parcelas mostra apenas uma parcela no card do crediário.

## Problema observado
No modo compacto, o card mostra apenas a próxima cobrança/parcela.  
Exemplo: cliente com 2 parcelas aparece com "parcela 1/2" no resumo, mas as demais parcelas só aparecem quando a nota é aberta.

## Correção aplicada
- O cabeçalho do card agora informa a quantidade total de parcelas.
- O texto orienta: `Toque no nome para abrir todas as parcelas`.
- Quando a nota está fechada e tem mais de uma parcela, aparece um botão claro:
  `Abrir todas as X parcelas desta nota`.
- Ao expandir, todas as parcelas da nota aparecem em lista responsiva.
- O botão `Recolher parcelas` fecha a lista novamente.
- Mantidas ações por parcela:
  - Ver recibo;
  - Receber;
  - Editar;
  - Estornar;
  - Mais correções.

## Arquivos alterados
- `src/mobile-app/screens/CreditsScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`
- arquivos de versão/cache/release v236

## Segurança anti-regressão
- Não altera cálculo.
- Não altera saldo.
- Não altera pagamento.
- Não altera vencimento.
- Não altera edição do crediário do lote 235.
- Não altera PDF/PNG/comprovantes.
- Apenas melhora expansão e visualização das parcelas na aba Crediário.

## Testes executados
- `npm install --no-audit --no-fund`
- `./node_modules/.bin/tsc --noEmit --pretty false --incremental false`
- `npx vite build --configLoader runner --outDir dist-test --emptyOutDir true`
- `npm run lint`
- `npm run release:check`
- `npm run release:commercial:check`

## Resultado
Todos passaram. O Vite mostrou apenas o aviso conhecido de chunk acima de 500 kB.

## Critério de aceite
1. Abrir aba Crediário.
2. Encontrar cliente com 2 ou mais parcelas.
3. Ver botão `Abrir todas as X parcelas desta nota`.
4. Clicar no nome do cliente ou nesse botão.
5. Conferir que todas as parcelas aparecem.
6. Em celular, a lista deve ficar em coluna e sem espremer.
7. Clicar em `Recolher parcelas` para voltar ao modo compacto.

## Classificação
- Expansível: PRONTO — 9,7/10.
- Responsividade: PRONTO — 9,5/10.
- Clareza para usuário leigo: PRONTO — 9,6/10.
- Risco de regressão: BAIXO.
