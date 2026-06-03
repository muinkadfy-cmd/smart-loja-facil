# Mega Lote 133 — Ambiente Demo com Dados Fictícios Separados

## COMANDO MESTRE 10/10

Status: aplicado.
Prioridade usada: P2/P1 comercial com proteção de dados reais.
Mobile-first: sim.
Supabase/sync/permissões: preservado; leituras demo foram separadas da loja real.
PWA/cache/versionamento: atualizado para v133.
ZIP limpo: deve conter apenas arquivos editados/novos.
Testes executados: type-check, build, lint, release checks, npm audit e validações JSON.
Limitações reais: ainda precisa teste físico em dois aparelhos e impressão real.
Próximo lote ideal: obrigatório.

## Objetivo

Criar um ambiente de demonstração seguro para apresentar o Smart Loja Fácil para cliente leigo sem expor dados reais da loja e sem misturar teste com venda, caixa, estoque, crediário ou backup real.

## O que mudou

- Adicionado modo demo separado no PWA web/mobile.
- Quando demo está ativa, listas e métricas usam dados fictícios.
- Dados reais não são lidos nas telas principais enquanto a demo estiver ativa.
- Gravações reais ficam bloqueadas por proteção de demo e treinamento.
- Diagnóstico Web ganhou seção “Ambiente demo separado”.
- Shell mobile mostra banner “Ambiente demo ativo”.
- Alertas globais informam que o app está usando dados fictícios.
- Relatórios, dashboard, clientes, produtos, vendas, pedidos, caixa, crediário, comprovantes e backup têm amostras fictícias.

## Segurança

A demo ativa bloqueia gravações reais de:

- clientes;
- produtos;
- estoque;
- venda;
- caixa;
- pedidos;
- crediário;
- configurações;
- backup/restauração.

Amostras de impressão continuam permitidas porque não alteram dados.

## PWA/cache

Nova versão:

```txt
pwa-supabase-v133-ambiente-demo-separado
smart-loja-pwa-supabase-v133-ambiente-demo-separado
```

## Como testar manualmente

1. Abrir o app no celular.
2. Ir em Diagnóstico Web.
3. Ativar “Ambiente demo separado”.
4. Abrir Dashboard, Produtos, Clientes, Vendas, Caixa, Pedidos, Crediário, Comprovantes, Relatórios e Backup.
5. Conferir que aparecem dados fictícios.
6. Tentar salvar uma venda/produto/cliente e confirmar que o app bloqueia gravação real.
7. Voltar ao Diagnóstico e desativar a demo antes de usar a loja real.
8. Rodar teste comercial e validar Supabase/permissões.

## Limitações reais

Este lote foi validado por código/build. Ainda precisa testar em ambiente real:

- PWA instalado no celular depois do deploy;
- Supabase produção;
- dois aparelhos;
- papéis owner/admin/operator/viewer;
- impressão física 58mm/80mm/A4;
- primeiro cliente acompanhado.
