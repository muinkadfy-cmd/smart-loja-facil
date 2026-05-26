# Mega Lote 33 — Runtime Web/PWA + Supabase sem quebrar Tauri/SQLite

## Objetivo

Separar a base desktop local da futura base web/mobile. O sistema agora identifica o ambiente de execucao antes de chamar recursos nativos:

- PC/Tauri: continua usando SQLite local e comandos Rust.
- Navegador/Cloudflare: entra em modo Web/PWA protegido, com diagnostico e login Supabase inicial.

## O que foi feito

1. Criada camada de runtime em `src/lib/runtime.ts`.
2. Criada validacao de variaveis publicas em `src/lib/env.ts`.
3. Criado client Supabase seguro em `src/lib/supabaseClient.ts`.
4. Criado login web em `src/components/WebAuthPanel.tsx`.
5. Criada tela `src/pages/WebDiagnostics.tsx` para verificar ambiente, Supabase e sessao.
6. Criada tela `src/pages/WebMigration.tsx` para bloquear modulos ainda nao migrados no navegador.
7. Ajustado `src/App.tsx` para nao executar `api.boot()` no Cloudflare.
8. Ajustado `src/components/Shell.tsx` para nao buscar produtos/crediario no navegador e para exibir ambiente correto.
9. Ajustado `src/lib/api.ts` para falhar com mensagem controlada fora do Tauri.
10. Criado `.env.example` com somente variaveis publicas.
11. Criado `wrangler.jsonc` para deploy Worker com assets da pasta `dist`.
12. Atualizado `vite.config.ts` com split de chunks para melhorar peso do bundle.
13. Atualizado `.gitignore` para proteger build, banco, env, target, bin e obj.
14. Atualizado `scripts/release_check.js` para permitir Supabase apenas na camada web segura.
15. Aplicado micro polimento visual no shell, barra superior, aviso, cards web, diagnostico e responsividade.

## Variaveis permitidas no Cloudflare

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_ANON_KEY_PUBLICA
```

Nunca usar no frontend:

```txt
SERVICE_ROLE
SUPABASE_SERVICE_ROLE_KEY
APP_SERVICE_ROLE_KEY
```

## Limite atual

Este lote nao migra vendas, caixa, crediario, pedidos ou relatorios para Supabase. Ele cria a ponte segura e evita tela branca no Cloudflare. Os modulos comerciais ainda dependem do SQLite local no PC ate serem migrados por etapas.

## Proximo lote ideal

Migrar primeiro Clientes e Produtos para tabelas Supabase com RLS, store_id e papeis de acesso. Depois disso entram Vendas, Caixa e Crediario com transacoes e protecao contra duplicidade.
