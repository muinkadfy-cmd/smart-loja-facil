# Mega Lote 239 — Editar data de qualquer parcela

## Objetivo
Permitir corrigir o vencimento/data de qualquer parcela do crediário depois que as parcelas já estão prontas.

## Regra entregue
- Pode alterar data de parcela:
  - vencida;
  - aberta/pendente;
  - parcial;
  - paga/quitada.
- A alteração exige motivo.
- Mantém auditoria.
- Não altera valor automaticamente.
- Para mudar somente a data, manter o valor igual e alterar apenas o vencimento.

## Onde foi aplicado
- Aba Crediário: modal de edição da parcela deixa claro que qualquer data pode ser corrigida.
- Aba Comprovantes: botão `Editar vencimento` também libera parcela paga/pronta, bloqueando apenas cancelada/estornada.

## Segurança
- Não altera saldo se o valor ficar igual.
- Não altera pagamento.
- Não apaga histórico.
- Não muda produto.
- Não muda cliente.
- Não muda número da nota.
- Não mexe em PDF/PNG além de refletir a nova data quando gerar novamente.

## Arquivos alterados
- `src/mobile-app/screens/CreditsScreen.tsx`
- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`
- arquivos de versão/cache/release v239

## Testes executados
- `npm install --no-audit --no-fund`
- `./node_modules/.bin/tsc --noEmit --pretty false --incremental false`
- `npx vite build --configLoader runner --outDir dist-test --emptyOutDir true`
- `npm run lint`
- `npm run release:check`
- `npm run release:commercial:check`

## Resultado
Todos passaram. O aviso do Vite sobre chunk acima de 500 kB permanece apenas como aviso.
