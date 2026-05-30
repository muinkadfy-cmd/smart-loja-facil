# Mega Lote 74 — Login Supabase clean e responsivo

## Objetivo
Criar uma tela de login mais limpa, responsiva e fácil para usuário leigo, usando e-mail e senha do Supabase, sem expor chave service role no frontend.

## Alterações
- Redesenho do componente `WebAuthPanel`.
- Layout responsivo em duas colunas no desktop e uma coluna no mobile.
- Campos maiores para toque no celular.
- Botão para mostrar/ocultar senha.
- Texto mais claro sobre login, sincronização e segurança.
- Estados separados para Supabase não configurado, login pendente e sessão ativa.
- Ajustes visuais no bloqueio de login obrigatório.
- Atualização de versão/cache para `pwa-supabase-v74-login-clean-supabase`.

## Segurança
- Apenas URL e anon public key são usadas no frontend.
- A senha não é salva no navegador.
- O checkbox salva somente o e-mail localmente.
- Service role não deve entrar em React, PWA, GitHub ou Cloudflare público.

## Testes recomendados em aparelho real
1. Abrir o app no celular.
2. Conferir se a tela de login não corta em 360px/390px/430px.
3. Tocar em Mostrar/Ocultar senha.
4. Entrar com e-mail e senha Supabase.
5. Criar cliente/produto após login.
6. Abrir no outro dispositivo e testar atualização.
