# Mega Lote 251 — Fase 3

## Escopo

Fase 3 do refinamento visual/operacional do Smart Loja Fácil, aplicada sobre a Fase 2 R1 aprovada.

Telas priorizadas neste lote:

- Pedidos
- Caixa
- Crediário

## Regras preservadas

Este lote não altera regras de negócio nem persistência. Permanecem intactos:

- criação e mudança de status de pedidos;
- baixa de estoque conforme regra existente do pedido;
- abertura, movimento e fechamento de caixa;
- cálculo de saldo esperado e diferença do caixa;
- recebimento de parcelas;
- redistribuição/compensação já existente do crediário;
- edição de vencimento, estorno, complemento e cancelamento protegido;
- histórico, comprovantes, Supabase, migrations, secrets e APIs.

## Pedidos

- hierarquia mais clara entre resumo, cadastro e histórico;
- montagem do pedido com produto/preço mais legíveis;
- área de busca e carrinho organizadas lado a lado no desktop;
- estados Aberto, Separado, Entregue e Cancelado com leitura visual mais rápida;
- ações com alvos de toque maiores e reorganização segura em telas estreitas.

## Caixa

- seletor Abrir / Entrada-saída / Fechar transformado em controle segmentado mais claro;
- status do caixa e aviso de caixa fechado com maior prioridade visual;
- formulário e conferência com densidade menor no desktop;
- resumo de fechamento com Esperado/Diferença mais fácil de conferir;
- movimentos do dia compactados sem esconder informação.

## Crediário

- quatro indicadores principais reorganizados em cards compactos;
- modo Simples/Avançado mais evidente sem mudar permissões ou regras;
- busca/filtros com melhor leitura;
- nota de crediário com cliente, status, total/pago/saldo e próxima cobrança hierarquizados;
- progresso e resumos de parcelas mais legíveis;
- ações de Receber, Editar, Estornar e correções reorganizadas para desktop e mobile;
- nenhuma alteração na lógica financeira ou nas confirmações críticas.

## Responsividade

Revisado para:

- desktop >= 1024 px;
- telas grandes >= 1440 px;
- tablet/mobile <= 1023 px;
- celulares <= 560 px;
- celulares estreitos <= 390 px.

Mantidos alvos de toque, campos com fonte mínima adequada, prevenção de overflow horizontal e suporte a `prefers-reduced-motion`.

## Arquivos do Delta

- `src/mobile-app/styles/ui-premium-polish.css`
- `docs/MEGA_LOTE_251_DESIGN_SYSTEM_FASE_3.md`

Não há banco, `.env`, build, cache, node_modules ou secrets no pacote.
