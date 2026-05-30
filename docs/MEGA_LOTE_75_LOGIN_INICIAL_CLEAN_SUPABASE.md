# Mega Lote 75 — Login inicial clean Supabase

## Objetivo
Colocar o login de e-mail e senha Supabase diretamente na tela inicial do sistema, com layout limpo, responsivo e sem poluição visual.

## Alterações aplicadas
- A tela inicial web agora mostra o formulário de login Supabase no primeiro acesso.
- Removidos CTAs duplicados de "Entrar" no fluxo web inicial.
- Mantido botão de entrada simples apenas no modo desktop/offline local.
- O login bem-sucedido abre automaticamente o sistema.
- Quando já existe sessão ativa, o painel mostra opção clara para abrir o sistema ou sair.
- Campos de e-mail/senha ficaram otimizados para mobile e desktop.
- Mantida segurança: senha não é salva no navegador; service role não fica no frontend.
- Atualizada versão/cache para `pwa-supabase-v75-login-inicial-clean`.

## Arquivos alterados
- `src/pages/Welcome.tsx`
- `src/components/WebAuthPanel.tsx`
- `src/styles.css`
- `src/lib/webApi.ts`
- `public/sw.js`

## Validação recomendada
1. Abrir a URL web em aba limpa.
2. Verificar se a tela inicial já mostra e-mail e senha.
3. Entrar com conta Supabase.
4. Confirmar se abre o sistema sem precisar clicar em outro botão.
5. Testar no celular em 360px/390px/430px.
6. Conferir Diagnóstico Web: versão `v75`.

## QA executado nesta sessão
- `npm run type-check`
- `npm run lint`
- `npm run build`
- `npm run release:check`
- `node --check public/sw.js`
- `node --check dist/sw.js`

## Observação técnica
O `release_check` foi atualizado para permitir `src/pages/Welcome.tsx` como parte autorizada da camada web segura, porque agora a própria tela inicial contém o painel de login Supabase. Isso não expõe service role e não altera a regra offline local.
