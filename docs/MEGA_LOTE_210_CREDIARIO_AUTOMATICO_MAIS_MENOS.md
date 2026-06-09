# Mega Lote 210 — Crediário Automático Mais/Menos

## Objetivo
Deixar o recebimento do crediário mais automático para usuário leigo: o operador digita o valor recebido, confere a prévia e confirma. Sem precisar marcar caixa no modo simples.

## Regras aplicadas no modo simples
- Valor exato: quita somente a parcela atual.
- Valor maior que a parcela: quita a parcela atual e abate automaticamente a sobra nas próximas parcelas.
- Valor menor que a parcela com próxima parcela existente: fecha a parcela atual com o valor recebido e joga automaticamente a falta para a próxima parcela.
- Valor menor na última parcela: mantém o restante em aberto na própria parcela.
- Valor maior que o saldo total: bloqueia e mostra alerta.

## Ajustes de UX
- Removidas as caixas manuais do modo simples.
- Adicionado card de regra automática com texto humano.
- Modo avançado mantém override manual para responsável.
- Prévia mostra abatimento e falta com base na regra ativa.
- Botões de correção para valor errado ficaram mais claros: usar valor da parcela ou saldo total.

## Arquivos principais
- `src/mobile-app/screens/CreditsScreen.tsx`
- `src/lib/creditPaymentGuard.ts`
- `src/lib/webApi.ts`
- `src/mobile-app/styles/mobile-app.css`

## Segurança
O fluxo continua exigindo conferir antes de receber. O recebimento segue pela função oficial `receiveInstallment`, mantendo caixa, crediário, auditoria e sincronização.
