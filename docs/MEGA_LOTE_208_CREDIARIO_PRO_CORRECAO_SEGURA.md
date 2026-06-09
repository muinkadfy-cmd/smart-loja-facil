# Mega Lote 208 — Crediário Pro com Correção Segura

## Objetivo
Adicionar o fluxo completo analisado para a aba Crediário: editar parcela, corrigir valor errado, estornar pagamento, receber complemento, abater sobra nas próximas parcelas e jogar falta para a próxima parcela.

## Entregas
- Botão **Editar** em cada parcela.
- Edição de valor da parcela.
- Edição de vencimento.
- Motivo obrigatório para alteração.
- Opção de compensar diferença na próxima parcela para manter o total da nota.
- Botão **Estornar** quando a parcela tem valor pago.
- Botão **Complemento** quando a parcela ainda tem saldo.
- Estorno com saída no caixa e auditoria.
- Complemento sem apagar pagamento anterior.
- Recebimento com opção separada: **Abater sobra nas próximas parcelas quando pagar a mais**.
- Recebimento com opção separada: **Se pagar a menos, jogar a falta para a próxima parcela**.
- Prévia antes/depois no recebimento.
- Bloqueio para motivo vazio, valor inválido, vencimento inválido e valor menor que já pago.
- Preserva histórico; não apaga recibos antigos.

## Arquivos alterados
- `src/mobile-app/screens/CreditsScreen.tsx`
- `src/lib/api.ts`
- `src/lib/webApi.ts`
- `src/lib/webApi.ts` também atualiza cache/versionamento para v208.

## Regras de segurança
- Estorno lança movimento de saída no caixa.
- Complemento usa o fluxo oficial de recebimento.
- Editar valor abaixo do já pago é bloqueado.
- Alteração de valor pode compensar diferença na próxima parcela.
- Jogar falta para próxima parcela preserva o total da nota.
- Auditoria é registrada para edição, estorno e falta movida.
