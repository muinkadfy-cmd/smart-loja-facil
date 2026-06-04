# Mega Lote 160 — Comprovantes Premium do Crediário + Logo + iPhone

## Objetivo
Corrigir e polir comprovantes do crediário, principalmente nota inteira/extrato e comprovante individual de parcela, com nome correto da loja, logo/monograma, status forte e opção de visualização amigável para iPhone.

## Alterações
- Nome da loja agora vem de `settings.store_name` em todos os comprovantes do crediário, evitando fallback visual para “Smart Loja Fácil”.
- `Settings` passou a aceitar `logo_url` opcional e o mapeamento web envia `stores.logo_url` para o app.
- Comprovante de parcela ganhou cabeçalho premium, logo/monograma, telefone/WhatsApp, status forte, KPIs, vencimento/atraso, pago/restante, forma e data do pagamento.
- Extrato completo da nota ganhou totais fortes: total da nota, total pago, total restante, parcelas pagas, parciais, vencidas e próximo vencimento.
- Botões da aba Crediário ficaram mais claros: Visualizar/print, Extrato 58mm, Extrato 80mm, Extrato A4 e Enviar extrato.
- Cada parcela recebeu opção Ver/print além de 58/80/A4/Enviar.
- A tela de impressão web agora evita auto-print em iPhone/Android e mostra instrução para conferir, tirar print, compartilhar ou imprimir/salvar PDF.
- Toolbar de impressão ganhou botão “Copiar texto”.

## Segurança
Não altera venda, caixa, estoque, backup, permissões ou regras financeiras. As mudanças são de exibição, comprovante, status e impressão/visualização.

## Testes
Executar:
- npm run type-check
- npm run build
- npm run lint
- npm run release:check
- npm run release:commercial:check
- npm run release:commercial:prepare
- npm audit --audit-level=high
- node scripts/credit_payment_guard_tests.js

## Teste manual recomendado
1. Abrir Crediário.
2. Expandir uma nota.
3. Gerar extrato inteiro A4/80/58.
4. Gerar comprovante de parcela Paga, Parcial, Pendente e Vencida.
5. Conferir se aparece Jaque Confecções e Presentes quando esse for o nome configurado.
6. Conferir logo ou monograma no topo.
7. No iPhone, usar Visualizar/print para tirar print ou compartilhar.
