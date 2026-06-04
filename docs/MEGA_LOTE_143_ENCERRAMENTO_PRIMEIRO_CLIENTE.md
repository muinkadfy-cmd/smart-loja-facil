# Mega Lote 143 — Encerramento do Primeiro Cliente / Pronto para Replicar

## Objetivo
Criar uma etapa final para fechar a implantação do primeiro cliente com evidência, autorização de referência, plano de replicação e checklist do próximo cliente.

## O que foi incluído
- Nova seção no Diagnóstico Web: Encerramento do primeiro cliente / pronto para replicar.
- Checklist P0/P1/P2 para evidência final, Dia 1, Dia 2, operação estável, pós-venda, feedback, autorização de referência e próximo cliente.
- Trava para não aprovar replicação com P0/P1 aberto, Dia 2 sem aceite, pendências locais, offline, auditoria/painel bloqueado ou suporte/feedback crítico aberto.
- Relatório copiável sem senha, sem chave privada e sem dados técnicos crus.
- Teste comercial atualizado para ler `smart-loja:first-client-closeout-v143`.
- PWA/cache atualizado para v143.

## Segurança
Este lote não grava venda, não abre/fecha caixa, não altera estoque, não recebe crediário, não altera pedido, não restaura backup e não altera Supabase. Ele registra apenas checklist local no aparelho para controle comercial e suporte.

## Validação
Rodar:

```bash
npm run type-check
npm run build
npm run lint
npm run release:check
npm run release:commercial:check
npm run release:commercial:prepare
npm audit --audit-level=high
```

## Limitação honesta
A aprovação v143 organiza o processo, mas ainda depende de evidência real: dois aparelhos, Supabase produção, papéis, impressão, PWA instalado e cliente real acompanhado.
