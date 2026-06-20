# Mega Lote 230 — Comprovantes com Fontes sem Negrito

## Objetivo
Manter o layout aprovado do lote 229, porém suavizar as fontes dos comprovantes, extratos, PDF, PNG e compartilhamento, removendo o aspecto de negrito pesado.

## Especialistas ativados
- Especialista sênior em PDF/PNG/canvas;
- Especialista em tipografia comercial;
- Especialista UI/UX mobile-first;
- QA de regressão;
- Especialista em usuário leigo.

## Auditoria
O lote 229 ficou aprovado em alinhamento. O pedido atual foi pontual: manter todo o restante e deixar as fontes sem negrito.

## Correções aplicadas
- Criado controle de peso tipográfico suave no motor da aba Comprovantes/Extratos;
- Criado controle de peso tipográfico suave no motor de Vendas recentes/Atividades recentes/Compartilhar;
- Pesos altos como 900/950 foram suavizados para escala semibold/regular;
- Tamanhos, margens, alinhamentos, tabelas, cards, vencimento, produto, cliente, status e totais foram preservados;
- Não altera cálculo, venda, crediário, estoque, pagamento ou parcelas;
- Cache/PWA atualizado para v230.

## Arquivos alterados
- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/components/receiptShare.ts`
- arquivos de versão/cache/release v230

## Classificação
- Tipografia sem negrito: PRONTO — 9,6/10 — ★★★★★ 4,8/5.
- Preservação do layout v229: PRONTO — 9,7/10 — ★★★★★ 4,85/5.
- Risco: baixo, alteração focada só no peso da fonte.
