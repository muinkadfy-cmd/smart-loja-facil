# Mega Lote 148 — Hotfix Backup + Alertas/Notificação Polidos

## Objetivo
Corrigir o erro real visto ao criar backup no PWA e refinar a janela de avisos/notificações para usuário leigo, mantendo logout seguro e sem mexer em venda, caixa, estoque, crediário ou regras de Supabase.

## Erro corrigido
O backup falhava ao tentar incluir `cash_sessions` porque o código ordenava todas as tabelas por `created_at`, mas a tabela de sessões de caixa usa `opened_at` no schema principal.

Correção aplicada:
- `cash_sessions` agora é ordenada por `opened_at` no backup.
- Foi criado fallback seguro: se uma ordenação falhar por diferença de schema, o backup tenta ler a tabela sem ordenação antes de desistir.
- Mensagem de erro do backup ficou mais leiga e menos técnica.

## Alertas e notificações
A Central de avisos foi polida:
- contador do sino agora prioriza avisos importantes, sem criar alarme por informação comum;
- título do modal trocou `atenção(ões)` por texto natural;
- janela ficou mais limpa no mobile, com cards menores, header fixo, ações mais claras e safe-area;
- erros técnicos comuns são traduzidos para linguagem simples;
- botão de sincronizar fecha a janela após acionar atualização.

## Versão/cache
- App: `pwa-supabase-v148-backup-alertas-polidos`
- Cache: `smart-loja-pwa-supabase-v148-backup-alertas-polidos`

## Segurança
Não foram alterados fluxos críticos de venda, caixa, estoque, crediário, permissões, RLS ou banco. O lote corrige leitura de backup e acabamento de interface/alertas.

## Testes executados
- `npm run type-check`
- `npm run build`
- `npm run lint`
- `npm run release:check`
- `npm run release:commercial:check`
- `npm run release:commercial:prepare`
- `npm audit --audit-level=high`
- `node --check scripts/release_check.js`
- `node --check scripts/commercial_package_check.js`
- `node --check scripts/commercial_release_package.js`

Todos passaram.

## Limitação honesta
O erro de código foi corrigido e os testes locais passaram, mas ainda precisa validar no Supabase real criando backup pela tela Backup após deploy/cache v148.
