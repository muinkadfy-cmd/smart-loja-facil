# Mega Lote 131 — Kit de Venda / Onboarding do Primeiro Cliente

## Objetivo
Transformar a validação comercial em entrega guiada para o primeiro cliente real, com checklist simples dentro do Diagnóstico Web.

## O que entrou
- Versão/cache PWA v131.
- Seção real de Fechamento Comercial renderizada na tela, com aceite final, bloqueios e parecer copiável.
- Novo Kit do Primeiro Cliente no Diagnóstico Web.
- Checklist de instalação, configuração da loja, primeiros cadastros, primeira venda/caixa, comprovante, backup e revisão do primeiro dia.
- Campos para cliente/loja, contato responsável e observações de suporte.
- Relatório copiável sem senha e sem chave privada.

## Segurança
- Não altera venda, caixa, estoque, crediário ou clientes ao marcar checklist.
- Não grava segredo.
- Não remove pendências antigas.
- Não inclui .env, logs, dist, node_modules ou ZIP antigo no pacote comercial.

## Como testar
1. Aplicar o ZIP na raiz do projeto.
2. Rodar npm ci.
3. Rodar npm run type-check.
4. Rodar npm run build.
5. Rodar npm run lint.
6. Rodar npm run release:check.
7. Rodar npm run release:commercial:check.
8. Abrir Diagnóstico Web no celular e conferir v131.
9. Preencher Kit do primeiro cliente, copiar o checklist e testar em dois aparelhos.

## Limitação honesta
Este lote não substitui o teste físico real em celular, Supabase produção, impressora e primeiro cliente acompanhado.
