# Mega Lote 76 — Desbloqueio Web por Sessão Supabase

## Objetivo
Corrigir o bloqueio global que travava Produtos, Clientes, Pedidos, Vendas/PDV, Caixa, Crediário, Comprovantes, Relatórios, Backup e Configurações no modo PWA/Web mesmo depois do login Supabase estar ativo.

## Problema encontrado
A guarda global do App usava `status.sqlite_ok` para decidir se as abas web podiam abrir. Esse campo pertence ao fluxo local/desktop/SQLite e não deve ser usado como critério principal no modo Supabase Web.

Sintoma visto na tela:
- painel interno mostrava login ativo;
- header ainda mostrava “Aguardando login” / “Login pendente”;
- todas as abas exibiam “Entre para usar...”;
- o usuário ficava bloqueado mesmo autenticado.

## Correções aplicadas
- Criado `getWebAuthSnapshot()` como leitura central segura de autenticação web.
- App passou a bloquear telas web apenas quando falta configuração Supabase ou sessão Supabase.
- Removido o bloqueio global por `sqlite_ok` para páginas web.
- Realtime web/mobile passou a iniciar quando há sessão Supabase e loja ativa, não por SQLite.
- Header/Shell passou a ler sessão real do Supabase para exibir usuário, loja e status.
- Status superior agora diferencia:
  - Login pendente;
  - Loja pendente;
  - Dados sincronizados;
  - Pendências locais;
  - Sem conexão.
- Mantida segurança: sem login continua bloqueado; sem Supabase configurado continua bloqueado.
- Atualizado cache/service worker para `pwa-supabase-v76-web-auth-unlock`.

## Arquivos alterados
- `src/App.tsx`
- `src/components/Shell.tsx`
- `src/lib/webApi.ts`
- `public/sw.js`
- `dist/index.html`
- `dist/sw.js`
- `dist/assets/index-DBKsy1he.js`

## Testes executados
- `npm run type-check`
- `npm run lint`
- `npm run build`
- `npm run release:check`
- `node --check public/sw.js`
- `node --check dist/sw.js`
- validação JSON de `package.json`, `public/manifest.webmanifest` e `dist/manifest.webmanifest`

## Limitações
Não foi possível testar em dois aparelhos reais nesta sessão. Após aplicar, testar no navegador e no celular:
1. Entrar com Supabase.
2. Abrir Produtos, Clientes, Caixa, Crediário e Pedidos.
3. Criar um cliente teste.
4. Verificar se aparece no outro dispositivo.
5. Conferir em Diagnóstico Web se a versão está v76.

## Próximo lote ideal
Mega Lote 77: corrigir/fortalecer criação automática da primeira loja, vínculo em `store_members`, mensagens de erro de RLS e teste real de CRUD web/mobile por tabela.
