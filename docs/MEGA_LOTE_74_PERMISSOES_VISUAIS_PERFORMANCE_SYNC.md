# Mega Lote 74 — Permissões visuais, performance mobile e sincronização multiaparelho

## Objetivo

Elevar o sistema para um nível mais comercial no PWA web/mobile, principalmente para usuário leigo:

- deixar claro quando o perfil é somente leitura;
- bloquear visualmente ações que o Supabase já bloqueia por RLS/permissão;
- reduzir o peso inicial do JavaScript com carregamento por módulo;
- melhorar atualização de dados ao voltar para a aba/app;
- manter pendências offline sem perder fila anterior do Lote 73.

## Alterações principais

### Permissões visuais por módulo

Criado o helper `src/lib/useWebPermissions.ts` para consultar o papel web atual e expor permissões simples para as telas.

Aplicado bloqueio visual em:

- Clientes: cadastrar, editar, inativar e campos do formulário.
- Produtos: cadastrar, editar campos, foto, inativar e ajustar estoque.
- Vendas/PDV: montar carrinho, alterar itens, selecionar cliente, forma de pagamento e finalizar venda.
- Caixa: abrir, fechar e lançar movimento manual.
- Crediário: receber parcela e confirmar recebimento.
- Pedidos: criar, remover itens, separar, entregar, reabrir e cancelar.
- Configurações: alterar dados da loja apenas para dono/admin.
- Backup: importar/restaurar bloqueado para perfil sem gestão da loja.

### UX para usuário leigo

Adicionado aviso `web-readonly-module-note` em módulos críticos quando o usuário web não pode operar.

Texto humano usado no padrão:

> Seu perfil é somente leitura. Você pode consultar, mas não pode salvar, excluir, receber, vender ou alterar dados.

### Performance mobile/web

O `App.tsx` passou a usar `React.lazy` e `React.Suspense` para carregar páginas sob demanda.

Impacto medido no build:

- JS principal caiu de cerca de 249 KB para cerca de 123 KB.
- Cada módulo passou a sair em chunk separado.
- Produtos, Crediário, Vendas, Caixa, Pedidos, Backup e Diagnóstico carregam apenas quando abertos.

### Sincronização multiaparelho

No web/PWA, ao voltar para a aba, ganhar foco ou recuperar internet, o app força atualização leve com trava de 15 segundos para evitar excesso de chamadas.

Isso ajuda o aparelho B a enxergar alterações feitas no aparelho A sem depender apenas de refresh manual.

### Fila offline/pedidos pendentes

A fila local mudou para `smart-loja:web-outbox-v74`, mas lê e migra automaticamente pendências antigas de `smart-loja:web-outbox-v73`.

Também foi reforçada deduplicação por `request_id`, `client_request_id`, `requestId` e IDs estáveis para evitar duas pendências iguais no mesmo aparelho.

### PWA/cache

Atualizado cache para:

`smart-loja-pwa-supabase-v74-permissoes-visuais-mobile-sync`

Atualizada versão lógica para:

`pwa-supabase-v74`

## Testes executados

- `npm run type-check`
- `npm run lint`
- `npm run build`
- `npm run release:check`
- `node --check public/sw.js`
- `npm audit --audit-level=moderate`

## Limitações reais

- Não foi possível validar com Supabase real e dois aparelhos reais neste ambiente.
- Não foi possível rodar `cargo check` porque o ambiente não possui Rust/Cargo instalado.
- CSS global ainda está grande e precisa de um lote dedicado de limpeza profunda.
- Não há Supabase Realtime; a atualização multiaparelho foi melhorada por foco/online/refresh, não por realtime instantâneo.

## Próximo lote recomendado

Lote 75 — Limpeza profunda de CSS/design system + teste real Supabase/RLS em dois aparelhos + ajustes finos de tabelas mobile.
