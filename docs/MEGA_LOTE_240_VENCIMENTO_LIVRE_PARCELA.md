# Mega Lote 240 — Vencimento livre e definitivo por parcela

## Objetivo
Corrigir definitivamente a edição de vencimento do crediário. Depois que as parcelas já estão prontas, deve ser possível alterar livremente a data de qualquer parcela sem voltar para o vencimento original.

## Causa corrigida
A edição de vencimento estava misturada com ajuste financeiro da parcela:
- valor;
- saldo;
- compensação na próxima parcela;
- confirmação pesada;
- cálculo financeiro.

Isso podia fazer uma data salvar e outra voltar ou deixar a operação dependente de valor/saldo.

## Solução entregue
Criada função exclusiva para alterar somente o vencimento:

- `api.updateCreditInstallmentDueDate`
- `webUpdateCreditInstallmentDueDate`

Payload exclusivo:
- `credit_id`
- `installment_id`
- `due_date`
- `reason`

## O que a função NÃO envia e NÃO altera
- `amount`
- `paid_amount`
- `balance`
- `total`
- status financeiro
- pagamento
- produto
- cliente
- redistribuição/compensação
- caixa/financeiro

## Regras
Permite alterar vencimento de:
- parcela vencida;
- parcela aberta;
- parcela pendente;
- parcela parcial;
- parcela paga/quitada.

Bloqueia apenas:
- cancelada;
- estornada;
- excluída.

## Ajustes de tela
### Aba Crediário
- O botão `Editar` da parcela agora salva somente vencimento.
- O valor aparece travado/somente leitura.
- Remove compensação de diferença na próxima parcela.
- Remove obrigação de checkbox pesado para mudar só vencimento.
- Botão final: `Salvar vencimento`.

### Aba Comprovantes
- `Editar vencimento` passou a usar a função exclusiva.
- Não usa mais `adjustCreditInstallment` para trocar data.

## Atualização e comprovantes
Após salvar, a tela recarrega o crediário real e os PDF/PNG/comprovantes passam a usar a nova data gerada a partir do dado atualizado.

## Arquivos alterados
- `src/lib/api.ts`
- `src/lib/webApi.ts`
- `src/mobile-app/screens/CreditsScreen.tsx`
- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`
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

## Resultado
Todos passaram. O Vite mostrou apenas o aviso conhecido de chunk maior que 500 kB.

## Critério de aceite
1. Abrir Crediário.
2. Pesquisar cliente com duas parcelas.
3. Alterar parcela 1 para `10/06/2026`.
4. Alterar parcela 2 para `20/07/2026`.
5. Sair da tela.
6. Voltar ao Crediário.
7. Pesquisar o cliente.
8. Confirmar que as duas datas continuam salvas.
9. Gerar PDF/PNG/comprovante e confirmar que as datas novas aparecem.

## Status final
PRONTO — vencimento livre por parcela sem ajuste financeiro.
