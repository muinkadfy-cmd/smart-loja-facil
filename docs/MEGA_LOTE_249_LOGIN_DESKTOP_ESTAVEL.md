# Mega Lote 249 — Login desktop estável e seguro

## Objetivo
Corrigir a regressão visual observada no login desktop após o lote 248, sem alterar o mobile aprovado.

## Correções
- Remove scroll interno do card de login em desktop.
- Amplia o card para 520 px e reduz densidade vertical com hierarquia SaaS.
- Preserva regras mobile porque todas as alterações visuais ficam em `@media (min-width: 1024px)`.
- Mantém somente a opção segura de salvar o e-mail; senha original nunca é persistida.
- Remove chaves legadas de senha/auto-login do localStorage.
- Login ganhou try/catch/finally para erro de rede não deixar estado `busy` preso.
- Adiciona `npm run verify:dist` para impedir deploy de `dist-codex-build` antigo.
- O verificador bloqueia build que ainda contenha textos da UI legada de salvar senha/auto-login.

## Não alterado
- Regras financeiras.
- Supabase/RLS/RPC.
- Crediário, recebimentos, caixa e estoque.
- Layout mobile.
- PDF/PNG/compartilhamento.

## Critério de aceite
- `npm run type-check` sem erros.
- `npm run build` concluído.
- `npm run verify:dist` confirma v249.
- `npm run lint`, `release:check` e `release:commercial:check` passam.
- Login desktop 1366x768 sem scrollbar interna.
- Mobile 390 continua sem regressão.

## QA visual estrutural executado
Foi usado um harness de layout com a mesma estrutura DOM do login e os CSS reais do projeto.

- 1366x768: card totalmente visível; `overflow-y: visible`; sem scroll interno; sem overflow horizontal.
- 1920x1080: card totalmente visível; sem scroll interno; sem overflow horizontal.
- 390x844: mobile permaneceu nas regras existentes; sem overflow horizontal.
- Em todos os cenários: textos legados `Salvar senha neste aparelho confiável` e `entrar automaticamente ao abrir` ausentes.

A validação visual não substitui o teste real do login contra o Supabase na máquina de publicação.

## Limitação do ambiente
O `node_modules` disponibilizado neste ambiente está incompleto. `npm run type-check` e `npm run build` não puderam ser concluídos aqui porque faltam pacotes/tipos instalados. A sintaxe dos TS/TSX alterados foi validada com o TypeScript global, e `lint`, `release:check` e `release:commercial:check` passaram.
