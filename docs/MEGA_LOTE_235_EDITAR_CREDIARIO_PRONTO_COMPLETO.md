# Mega Lote 235 — Editar crediário pronto completo

## Objetivo
Permitir editar um crediário já feito/pronto, com foco em dados que aparecem na tela, no PDF, PNG e compartilhamento.

## O que foi entregue
- Botão `Editar crediário` dentro da nota do crediário.
- Modal completo para editar:
  - nome do cliente;
  - telefone;
  - WhatsApp;
  - vencimento de todas as parcelas da nota.
- Se a nota tiver 10 parcelas, aparecem as 10 datas para edição.
- Pode editar uma, várias ou todas as datas antes de salvar.
- Motivo obrigatório.
- Salvar tudo de uma vez.
- Atualiza a nota na tela sem recarregar.
- PDF/PNG/Compartilhar passam a usar os dados novos porque são gerados com o crediário atualizado.

## Regra de segurança
- Não altera valor da parcela.
- Não altera total da venda.
- Não altera saldo manualmente.
- Não altera produtos vendidos.
- Não altera pagamentos já feitos.
- Não altera número da nota.
- Apenas corrige dados do cliente e vencimentos.

## Back-end / sincronização
Criada função web:
- `webUpdateCreditDetails(payload)`

Criado método API:
- `api.updateCreditDetails(payload)`

Fila web/outbox aceita:
- `updateCreditDetails`

A atualização grava:
- `credits.customer_name`
- `customers.name`
- `customers.phone`
- `customers.whatsapp`
- `sales.customer_name`
- `credit_installments.due_date` para as parcelas enviadas

Também registra auditoria:
- antes/depois do cliente;
- antes/depois dos vencimentos alterados;
- motivo da alteração.

## Arquivos alterados
- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`
- `src/lib/api.ts`
- `src/lib/webApi.ts`
- `package.json`
- `package-lock.json`
- `public/manifest.webmanifest`
- `public/sw.js`
- `scripts/release_check.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`

## Testes executados
- `npm install --no-audit --no-fund`
- `./node_modules/.bin/tsc --noEmit --pretty false --incremental false`
- `npx vite build --configLoader runner --outDir dist-test --emptyOutDir true`
- `npm run lint`
- `npm run release:check`
- `npm run release:commercial:check`

## Resultado dos testes
Todos passaram. O Vite mostrou somente o aviso conhecido de chunk acima de 500 kB.

## Critério de aceite
1. Abrir Comprovantes.
2. Abrir um cliente do crediário.
3. Abrir uma nota.
4. Clicar em `Editar crediário`.
5. Alterar nome/telefone/WhatsApp.
6. Alterar vencimentos das parcelas.
7. Informar motivo.
8. Salvar.
9. Conferir que tela, PDF, PNG e compartilhar mostram os novos dados.

## Classificação
- Editar crediário pronto: PRONTO — 9,6/10.
- Editar 10+ parcelas: PRONTO — 9,5/10.
- PDF/PNG/Compartilhar: PRONTO — 9,5/10.
- Segurança financeira: PRONTO — 9,4/10.
- Risco de regressão: BAIXO/MÉDIO controlado.
