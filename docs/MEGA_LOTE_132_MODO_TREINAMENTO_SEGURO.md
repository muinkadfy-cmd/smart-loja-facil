# Mega Lote 132 — Modo Treinamento / Demonstração Segura

## COMANDO MESTRE 10/10

Status: aplicado.
Prioridade usada: P1/P2 comercial com proteção de dados reais.
Mobile-first: sim.
Supabase/sync/permissões: preservado e reforçado por bloqueio local de gravações reais no modo treinamento.
PWA/cache/versionamento: atualizado para v132.
ZIP limpo: obrigatório.
Testes executados: listados no relatório final.
Limitações reais: o modo treinamento bloqueia gravações locais/web via API do PWA, mas ainda precisa teste em celular real após deploy.
Próximo lote ideal: obrigatório.

## Objetivo

Criar um modo de demonstração seguro para treinar cliente sem misturar teste com venda, caixa, estoque, crediário, pedidos, configurações ou backup real.

## O que mudou

- Nova versão PWA/cache: v132 modo treinamento seguro.
- Nova seção no Diagnóstico Web: Modo treinamento seguro.
- Banner global no app quando o treinamento estiver ativo.
- Alerta na central de alertas quando o treinamento estiver ativo.
- Proteção local em funções de gravação da API web/Supabase.
- Relatório copiável do treinamento sem senha e sem chave privada.
- Teste comercial passa a avisar quando o treinamento está ativo.

## Gravações bloqueadas quando ativo

- Salvar/inativar cliente.
- Salvar/inativar produto e ajustar estoque.
- Finalizar/cancelar venda.
- Abrir/fechar caixa e lançar movimento.
- Criar/alterar/cancelar pedido.
- Receber crediário.
- Alterar configurações.
- Criar/restaurar backup.
- Reenviar pendências reais.

## Ações permitidas quando ativo

- Navegar pelas abas.
- Ler dados existentes.
- Rodar diagnóstico.
- Copiar relatórios.
- Abrir amostras de impressão 58mm/80mm/A4.
- Explicar o sistema para o cliente sem alterar operação real.

## Como testar manualmente

1. Abrir Diagnóstico Web.
2. Ativar Modo treinamento seguro.
3. Tentar salvar cliente/produto ou finalizar venda de teste.
4. Confirmar que aparece mensagem dizendo que não foi gravado na loja real.
5. Conferir banner global no topo do app.
6. Copiar orientação do treinamento.
7. Desativar o modo treinamento.
8. Rodar teste comercial e confirmar P0/P1 zerados antes de venda real.

## Limitação honesta

Este lote foi validado por build/type-check/lint/release checks. Ainda precisa validação em celular real após deploy, com Supabase produção e usuários owner/admin/operator/viewer.
