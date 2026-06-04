# Mega Lote 161 — Crediário simplificado: cliente, nota expansível, parcelas e iPhone

## Objetivo
Simplificar a aba Crediário para usuário leigo: organizar por cliente, mostrar notas/vendas expansíveis com parcelas dentro, remover opções de impressão 58mm/80mm na tela e manter apenas Visualizar, A4/PDF e Enviar.

## O que mudou
- Crediários agrupados por cliente.
- Cada cliente mostra total, pago, restante, quantidade de notas e contato.
- Cada nota/venda fica expansível e mostra as parcelas dentro.
- Busca reforçada por cliente, telefone, nota, venda, status e parcelas.
- Ações da nota: Visualizar iPhone, A4/PDF e Enviar extrato.
- Ações da parcela: Receber, Visualizar, A4/PDF e Enviar.
- Removidos botões 58mm/80mm da aba Crediário para reduzir confusão.
- Visualização A4/HTML ficou orientada para iPhone/Android: conferir, tirar print, compartilhar ou salvar PDF.

## Segurança
Não altera venda, caixa, estoque, cálculo do crediário, backup, Supabase ou permissões. O lote mexe em apresentação, comprovantes e organização visual.

## Testes recomendados
- Buscar por nome do cliente.
- Buscar por número da nota/venda.
- Expandir cliente e nota.
- Conferir parcelas dentro da nota.
- Abrir Visualizar iPhone da nota e da parcela.
- Abrir A4/PDF da nota e da parcela.
- Enviar extrato.
- Testar em Android Chrome, Android PWA, iPhone Safari e iPhone PWA.
