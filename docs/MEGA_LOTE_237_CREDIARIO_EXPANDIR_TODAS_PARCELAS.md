# Mega Lote 237 — Crediário expansível com todas as parcelas visíveis

## Objetivo
Quando a nota tiver parcelas vencidas, abertas e pagas, ao clicar no cliente o sistema deve abrir a nota e exibir **todas** as parcelas de forma clara e responsiva.

## Problema relatado
No card do crediário, especialmente em notas com parcela vencida, o usuário percebia apenas a próxima cobrança e não ficava claro que existiam outras parcelas já pagas ou ainda em aberto.

## Correção aplicada
- Mantido o card compacto mostrando a próxima cobrança.
- Melhorado o cabeçalho para informar:
  - total de parcelas;
  - quantas estão vencidas;
  - quantas estão em aberto;
  - quantas estão pagas.
- Ao clicar no cliente/card, a nota expande e exibe **todas** as parcelas da venda.
- Adicionado resumo visual expansível:
  - `Vencidas X`
  - `Em aberto Y`
  - `Pagas Z`
- Mantida ordenação por número da parcela.
- Mantidos botões por parcela dentro da área expandida.
- Mantido botão de recolher para voltar ao modo compacto.

## Arquivos alterados
- `src/mobile-app/screens/CreditsScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`
- `package.json`
- `package-lock.json`
- `public/manifest.webmanifest`
- `public/sw.js`
- `src/lib/webApi.ts`
- `scripts/release_check.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`

## Anti-regressão
- Não altera cálculo de crediário.
- Não altera saldo.
- Não altera pagamento.
- Não altera vencimento.
- Não altera PDF/PNG/extrato/comprovante.
- Não remove edição do lote 235.
- Melhoria apenas de visualização/expansão da aba Crediário.

## Testes executados
- `./node_modules/.bin/tsc --noEmit --pretty false --incremental false`
- `npx vite build --configLoader runner --outDir dist-test --emptyOutDir true`
- `npm run lint`
- `npm run release:check`
- `npm run release:commercial:check`

## Resultado
Todos passaram.
Aviso conhecido do Vite sobre chunk acima de 500 kB continua apenas como aviso.

## Critério de aceite
1. Abrir aba **Crediário**.
2. Encontrar cliente com 2 ou mais parcelas.
3. Ver no card os contadores de vencidas, abertas e pagas.
4. Clicar no nome do cliente.
5. Confirmar que todas as parcelas aparecem na expansão.
6. Confirmar que parcelas pagas também aparecem.
7. Confirmar que parcelas vencidas também aparecem.
8. Recolher e verificar que o card volta ao modo compacto.

## Status final
PRONTO.
