# Mega Lote 144 — Hotfix Login Fluxo Único

## Objetivo
Corrigir a confusão em que o usuário vê a tela de login, entra, abre o painel e depois o sistema volta a pedir login/entrada.

## Causa corrigida
O fluxo web tinha dois estados separados:

1. sessão Supabase autenticada;
2. entrada visual no painel mobile.

Antes, depois de confirmar login, o usuário ainda precisava clicar para abrir o painel. Em alguns cenários, especialmente com cache/PWA antigo ou sessão já ativa, isso parecia um segundo login.

## Alterações
- `WebAuthPanel` agora aceita `onAuthenticated` e `autoContinueWhenSession`.
- Após login Supabase confirmado, o app abre o painel automaticamente.
- Se já existir sessão Supabase ativa ao abrir a tela inicial, o painel abre automaticamente.
- O evento `smart-loja:web-session-changed` agora informa `signed-in` ou `signed-out` no detalhe.
- A mensagem de sucesso mudou para “Login confirmado. Abrindo o painel da loja...”.
- PWA/cache atualizado para v144.

## Preservado
- Supabase, RLS, permissões e migrações não foram alterados.
- Venda, caixa, estoque, pedido, crediário e backup não foram alterados.
- Os dados reais e a fila offline foram preservados.

## Observação importante
Se depois deste hotfix o painel ainda mostrar “Faça login”, a causa mais provável não é a tela de login, e sim:

- migration `202606030126_commercial_validation_rpc_grants.sql` ainda não aplicada no Supabase;
- usuário logado sem loja vinculada em `store_members`;
- cache antigo do PWA preso no celular;
- variáveis públicas do Supabase ausentes/incorretas no deploy.
