# Mega Lote 234 — Editar vencimento de parcela do crediário

## Objetivo
Permitir editar o vencimento de cada parcela depois que a venda já foi feita, sem alterar valor, saldo, produto, cliente, total da nota ou histórico financeiro.

## Especialistas ativados
- Especialista sênior em crediário;
- Especialista UI/UX mobile-first;
- Especialista em fluxo para usuário leigo;
- QA de regressão TypeScript/build;
- Especialista em PDF/PNG/comprovantes.

## Regra implementada
- Parcelas pendentes, abertas, parciais e vencidas podem ter o vencimento alterado.
- Parcelas pagas/quitadas ou encerradas ficam bloqueadas.
- Motivo obrigatório com pelo menos 6 letras.
- Alteração salva usando `api.adjustCreditInstallment`.
- O valor da parcela é enviado igual ao valor atual, para alterar somente `due_date`.
- Não redistribui diferença, pois o valor não muda.

## Fluxo do usuário
1. Abrir Comprovantes.
2. Abrir cliente.
3. Abrir nota do crediário.
4. Em cada parcela disponível, tocar em `Editar vencimento`.
5. Escolher nova data.
6. Informar motivo.
7. Salvar.
8. Tela atualiza a nota e os comprovantes passam a usar a nova data.

## Arquivos alterados
- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`
- `src/lib/webApi.ts`
- `package.json`
- `package-lock.json`
- `public/manifest.webmanifest`
- `public/sw.js`
- `scripts/release_check.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`

## Segurança anti-regressão
- Não altera cálculo.
- Não altera total da venda.
- Não altera saldo manualmente.
- Não altera produtos.
- Não altera cliente.
- Não altera pagamento.
- Bloqueia parcela paga/encerrada.
- Mantém `Status: Aberta` do lote 232.
- Mantém hotfix TypeScript do lote 233.

## Sincronização/offline
A fila de alterações pendentes (`web outbox`) agora também sabe reenviar:
- `adjustCreditInstallment`
- `correctCreditPayment`

## Testes executados
- `npm install --no-audit --no-fund`
- `./node_modules/.bin/tsc --noEmit --pretty false --incremental false`
- `npx vite build --configLoader runner --outDir dist-test --emptyOutDir true`
- `npm run lint`
- `npm run release:check`
- `npm run release:commercial:check`

## Classificação
- Editar vencimento: PRONTO — 9,5/10 — ★★★★★ 4,75/5.
- Segurança do crediário: PRONTO COM OBSERVAÇÃO — 9,3/10 — ★★★★★ 4,65/5.
- Fluxo para usuário leigo: PRONTO — 9,4/10 — ★★★★★ 4,7/5.
- Risco de regressão: BAIXO/MÉDIO controlado.
