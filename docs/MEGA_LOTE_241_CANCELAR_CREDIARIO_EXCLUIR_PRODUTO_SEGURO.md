# Mega Lote 241 — Cancelar crediário e excluir produto com segurança

## Base real utilizada

- Fonte enviada pelo usuário: `smart-loja-fonte-temp-20260730-222852.zip`
- Versão encontrada: `0.1.240`
- Versão entregue: `0.1.241`
- Escopo principal: PWA web/mobile com Supabase.
- A pasta Tauri permanece apenas como legado e não foi transformada em base principal deste lote.

## Objetivo

Adicionar duas operações administrativas sem destruir histórico comercial:

1. **Cancelar um crediário inteiro de uma pessoa**, retirando a nota de cobranças e vencidos, com motivo e confirmação forte.
2. **Excluir o cadastro de um produto criado por engano**, somente quando ele não possui histórico comercial ou de estoque.

## Decisão de segurança

### Crediário

Não foi criada exclusão física do crediário. A operação correta é **cancelar com histórico preservado**, porque apagar registros poderia quebrar:

- pagamentos já realizados;
- movimentos de caixa;
- vendas e relatórios;
- comprovantes/PDF;
- auditoria;
- rastreabilidade do cliente.

### Produto

O produto somente pode ser excluído se:

- estiver inativo;
- não tiver item de venda;
- não tiver item de pedido;
- não tiver movimentação de estoque.

Se existir qualquer histórico, a exclusão é recusada e o produto deve permanecer **inativo**.

## Implementação do cancelamento de crediário

Foi criada a RPC transacional:

```text
public.web_cancel_credit_safe
```

Payload:

```text
target_credit_id
cancel_reason_text
restore_stock
```

### O que o cancelamento faz

- valida usuário dono/administrador;
- exige motivo com no mínimo 6 caracteres;
- exige confirmação `CANCELAR` na interface;
- marca a venda como cancelada;
- marca todas as parcelas como canceladas;
- marca os comprovantes relacionados como cancelados;
- marca o crediário como cancelado;
- encerra o saldo ativo da nota;
- remove a nota dos filtros de cobrança e vencidos;
- mantém acesso pelo filtro **Cancelados**;
- permite devolver ou não os produtos ao estoque;
- impede devolução duplicada de estoque se a venda já estava cancelada;
- registra auditoria completa.

### O que não é alterado automaticamente

- pagamentos confirmados;
- movimentos anteriores de caixa;
- valores efetivamente pagos;
- cliente;
- produtos cadastrados;
- histórico comercial.

Se houver valor pago que precise ser devolvido ao cliente, o estorno deve ser lançado antes do cancelamento. O sistema não inventa nem executa estorno financeiro automático.

## Implementação da exclusão segura de produto

Foi criada a RPC transacional:

```text
public.web_delete_product_safe
```

Payload:

```text
target_product_id
delete_reason_text
```

### Fluxo

1. Inativar o produto.
2. Clicar em **Excluir cadastro**.
3. Informar motivo.
4. Digitar `EXCLUIR`.
5. A RPC confere vendas, pedidos e estoque.
6. Sem histórico: aplica exclusão lógica com `deleted_at` e remove das listas.
7. Com histórico: bloqueia a exclusão e orienta manter inativo.

## Interface mobile/PWA

### Crediário

- botão **Cancelar crediário**;
- resumo de total, pago preservado e saldo encerrado;
- opção **Devolver ao estoque os produtos desta venda**;
- motivo obrigatório;
- confirmação digitada `CANCELAR`;
- novo filtro **Cancelados**;
- notas canceladas não mostram ações de receber, editar ou corrigir;
- extrato continua disponível;
- parcelas canceladas mostram saldo operacional zerado e pagamento anterior preservado.

### Produtos

- ação existente foi corrigida para o nome real **Inativar**;
- produto inativo ganha a opção **Excluir cadastro**;
- motivo obrigatório;
- confirmação digitada `EXCLUIR`;
- exclusão com histórico é recusada pelo banco, não apenas pela tela.

## Comprovantes, PDF e PNG

- crediário cancelado aparece como **Cancelado/Cancelada**;
- não é exibido como quitado apenas porque o saldo ativo foi zerado;
- parcelas canceladas não entram como vencidas;
- pagamentos anteriores permanecem visíveis como preservados;
- saldo operacional cancelado aparece zerado;
- histórico permanece disponível para consulta e nova geração.

## Segurança e anti-regressão

- operações críticas não são guardadas em fila offline;
- usuário precisa estar online para cancelar/excluir;
- RPCs usam `security definer`, `search_path` fixo e validação de papel;
- execução liberada apenas para `authenticated`;
- acesso de `public` e `anon` revogado;
- nenhuma atualização é feita em `payments` ou `cash_movements` durante o cancelamento;
- nenhuma exclusão em cascata de vendas ou crediários foi criada;
- busca e expansão de parcelas dos lotes anteriores foram preservadas;
- edição livre de vencimento do lote 240 foi preservada;
- cálculos normais de venda, recebimento, caixa e estoque não foram alterados.

## Arquivos alterados/criados

- `package.json`
- `package-lock.json`
- `public/manifest.webmanifest`
- `public/sw.js`
- `scripts/release_check.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`
- `src/types.ts`
- `src/lib/api.ts`
- `src/lib/webApi.ts`
- `src/mobile-app/screens/CreditsScreen.tsx`
- `src/mobile-app/screens/ProductsCustomersScreens.tsx`
- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`
- `src/pages/Credits.tsx`
- `src/pages/Products.tsx`
- `supabase/migrations/202607302245_mega_lote_241_cancel_credit_delete_product_safe.sql`
- `docs/MEGA_LOTE_241_CANCELAR_CREDIARIO_EXCLUIR_PRODUTO_SEGURO.md`
- `ENTREGA_MEGA_LOTE_241.txt`

## Validações executadas

### Passaram

- transpile/sintaxe TypeScript e TSX dos oito arquivos alterados;
- `npm run lint`;
- `npm run release:commercial:check`;
- `npm run release:check` estrutural com arquivo `.env.production` temporário, falso e não secreto, removido imediatamente após a validação;
- checklist estrutural das RPCs e das telas;
- verificação de que a migration não atualiza `payments` nem `cash_movements`;
- verificação de bloqueio de produto ativo e de produto com histórico;
- verificação de confirmação `CANCELAR` e `EXCLUIR`;
- verificação de saldo zerado para parcela cancelada na visualização.

### Não puderam ser executadas neste ambiente

```text
npm install --no-audit --no-fund
tsc --noEmit
vite build
```

Motivo real: o registry interno do ambiente retornou `404` para `youch-core@0.3.3`; o acesso direto ao registry público também não resolveu DNS. Portanto, não havia dependências locais para executar o type-check completo e o build Vite.

Isso não foi mascarado. O computador de publicação deve executar os três comandos antes do deploy.

## Migração obrigatória

O deploy do frontend não instala as RPCs sozinho. Antes de testar os botões, aplicar:

```text
supabase/migrations/202607302245_mega_lote_241_cancel_credit_delete_product_safe.sql
```

Pode ser pelo Supabase CLI com `npx supabase db push` ou pelo SQL Editor do projeto.

## Critérios de aceite

### Cancelar crediário

1. Abrir um crediário aberto ou vencido.
2. Clicar em **Cancelar crediário**.
3. Escolher se devolve estoque.
4. Informar motivo.
5. Digitar `CANCELAR`.
6. Confirmar que a nota saiu de Abertos/Vencidos.
7. Confirmar que apareceu em Cancelados.
8. Confirmar que não é mais possível receber ou editar parcelas.
9. Confirmar que extrato/PDF mostra Cancelado.
10. Conferir que pagamento e caixa anteriores continuam no histórico.
11. Se selecionou devolver estoque, conferir uma única devolução.

### Excluir produto

1. Criar um produto de teste sem venda, pedido ou movimento de estoque.
2. Inativar o produto.
3. Clicar em **Excluir cadastro**.
4. Informar motivo e digitar `EXCLUIR`.
5. Confirmar que saiu das listas.
6. Tentar excluir produto com histórico.
7. Confirmar que o banco bloqueia e orienta manter inativo.

## Status por setor

- Regra segura no Supabase: **PRONTO PARA APLICAÇÃO**
- Interface mobile/PWA: **PRONTO PARA VALIDAÇÃO REAL**
- Interface desktop legada: **ALINHADA**
- Comprovantes e status cancelado: **AJUSTADOS**
- Lint e verificações estruturais: **APROVADOS**
- Build/type-check completo: **PENDENTE NO COMPUTADOR DE PUBLICAÇÃO** por indisponibilidade do registry no ambiente de geração
- Migração em produção: **PENDENTE DE `supabase db push`/SQL Editor**

## Risco

- Nível: **alto, controlado**.
- Motivo: cancelamento de venda/crediário e estoque são operações comerciais críticas.
- Controles: transação no banco, papel owner/admin, motivo, palavra de confirmação, auditoria, sem fila offline e sem apagamento de pagamentos/caixa.
