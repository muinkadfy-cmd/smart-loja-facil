# Mega Lote 135 — Proposta Comercial / Tela de Planos e Benefícios

## COMANDO MESTRE 10/10

Status: aplicado.

- Prioridade usada: P2 comercial com proteção P1 dos dados reais.
- Mobile-first: sim.
- Supabase/sync/permissões: preservado; sem migration nova.
- PWA/cache/versionamento: atualizado para v135.
- ZIP limpo: obrigatório, somente arquivos editados/novos.
- Testes: type-check, build, lint, release, pacote comercial e audit.
- Limitações reais: teste físico em celular, Supabase produção, permissões por papel e impressão real ainda precisam ser validados fora do código.

## Objetivo

Adicionar uma etapa comercial dentro do Diagnóstico Web para transformar o tour/demo em proposta pronta para cliente leigo, com planos, benefícios, implantação, suporte, preço sugerido e próximo passo copiável.

## O que mudou

### Diagnóstico Web

Nova seção **Proposta comercial / planos** com:

- planos Essencial, Profissional e Premium Assistido;
- seleção visual do plano;
- campos para cliente/loja, mensalidade, implantação, validade, condição comercial, próximo passo e observações;
- benefícios incluídos por plano;
- itens de implantação por plano;
- checklist comercial com progresso;
- botão **Copiar proposta**;
- botão **Preparar demo da proposta**;
- botão **Zerar proposta**.

### Validação comercial

O teste comercial agora inclui o item **Proposta comercial / planos**, lendo o progresso salvo neste aparelho.

### Diagnóstico copiável

O relatório copiado agora inclui também a proposta comercial, junto de tour, onboarding, aceite, execução assistida, treinamento e demo.

### PWA/cache

Versão atualizada para:

- `pwa-supabase-v135-proposta-comercial`
- `smart-loja-pwa-supabase-v135-proposta-comercial`

## Segurança

- A proposta não grava venda, caixa, estoque, crediário, pedido ou cliente.
- O botão de preparação ativa demo/treinamento seguro, usando dados fictícios.
- Não copia senha, chave privada ou termos técnicos crus.
- Não altera migrations/Supabase neste lote.

## Como testar

1. Abrir Diagnóstico Web.
2. Ativar demo segura se for apresentar para cliente.
3. Abrir Tour comercial e marcar etapas.
4. Em Proposta comercial, escolher plano e preencher cliente, preço, implantação e próximo passo.
5. Marcar checklist da proposta.
6. Copiar proposta.
7. Rodar teste comercial e verificar o item Venda comercial / Proposta.
8. Conferir em celular pequeno se nada corta lateralmente.

## Risco

Risco baixo/médio. É uma camada comercial e de diagnóstico, sem alteração destrutiva de dados. O risco restante é validar usabilidade em aparelho real e conferir se o texto comercial está adequado ao preço final decidido pelo dono do produto.

## Próximo lote ideal

Mega Lote 136 — Contrato/Termo de Implantação e Aceite do Cliente.

Criar uma tela simples para gerar termo de implantação, responsabilidades, limites do suporte, aceite do cliente e checklist de entrega, sem substituir contrato jurídico formal.
