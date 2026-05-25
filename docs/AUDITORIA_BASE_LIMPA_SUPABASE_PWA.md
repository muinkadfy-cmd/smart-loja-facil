# Auditoria — transformar Smart Loja Fácil Offline em base limpa PWA + Supabase

Data da análise: 2026-05-25
Arquivo analisado: `smart-loja-facil-offline(3).zip`

## Veredito direto

Sim, dá para usar este sistema como referência para criar outra base limpa com PWA web + mobile sincronizados pelo Supabase.

O melhor caminho é **não tentar converter tudo em cima da base atual**. A base atual é boa como prova de domínio comercial, regras de negócio, módulos e layout de referência, mas ela nasceu como **Tauri desktop + Rust + SQLite local**. Para PWA web/mobile com Supabase, o correto é criar uma base nova e reaproveitar apenas o que está sólido.

## O que existe hoje

- Frontend: React 18 + TypeScript + Vite.
- Desktop: Tauri v2.
- Banco principal atual: SQLite local controlado pelo Rust/Tauri.
- PWA atual: básico, com `manifest.webmanifest` e `sw.js` apenas para shell/assets.
- Backend atual: `src-tauri/src/main.rs` com schema, comandos, transações, backup, recibos, caixa, vendas, crediário e auditoria.
- Interface: modo dark com identidade clássica/comercial, porém ainda muito presa no estilo desktop/Delphi/Windows antigo.
- Supabase: não existe integração no código atual.

## O que impede usar como PWA web/mobile agora

1. O arquivo `src/lib/api.ts` exige Tauri com `window.__TAURI_INTERNALS__`. No navegador comum, ele bloqueia o uso.
2. Toda persistência real está no Rust/Tauri + SQLite, não no browser nem no Supabase.
3. Não existe login Supabase, sessão, permissões, RLS, store_id, owner/admin/operador, nem sincronização multi-dispositivo.
4. O service worker atual só faz cache básico do shell; não resolve dados offline nem fila de sincronização.
5. O layout foi feito primeiro para desktop; mobile precisaria ser refeito com menu inferior, cards compactos, formulários curtos e tabelas convertidas em cards.
6. O backend Rust está monolítico. Dá para estudar a regra de negócio, mas não é ideal portar linha por linha para PWA.

## O que dá para aproveitar

### Aproveitar bastante

- Estrutura de módulos comerciais:
  - dashboard;
  - clientes;
  - produtos;
  - vendas/PDV;
  - caixa;
  - crediário;
  - pedidos;
  - comprovantes;
  - relatórios;
  - backup/auditoria;
  - configurações.
- Tipos principais de dados em `src/types.ts`.
- Regras de negócio do Rust:
  - venda baixa estoque;
  - crediário gera parcelas;
  - pagamento entra no caixa;
  - estoque registra movimentação;
  - request_id evita duplicidade;
  - auditoria registra eventos importantes.
- Ideia de comprovantes HTML/A4/80mm.
- Textos e nomenclaturas em português simples.
- Preferência por modo dark, contraste forte e operação para usuário leigo.

### Aproveitar com ajustes

- CSS atual: usar como referência de cores, mas dividir em tokens, componentes e páginas. Hoje `src/styles.css` está grande demais.
- Componentes `DataTable`, `Modal`, `StatCard`, `TableFilters`: podem virar componentes base, mas precisam ser mobile-first.
- Alertas de estoque/crediário/caixa: bom conceito, mas precisa virar um sistema de notificações visual mais limpo.
- PWA shell: dá para manter a ideia, mas precisa versionamento de cache, estratégia de atualização e fallback offline.

### Não aproveitar diretamente

- `src/lib/api.ts` atual como API principal, porque depende de Tauri.
- `src-tauri/src/main.rs` como backend da nova base PWA, porque a nova base deve falar com Supabase/Postgres.
- Bancos `.sqlite3` dentro do ZIP, porque são base local/teste e não devem ir para produção cloud.
- Build Tauri como base principal se o objetivo agora é web/mobile sincronizado.

## O que modificar na interface antiga

A interface antiga pode virar uma identidade “Smart Loja” moderna, mas precisa de uma lapidação forte:

1. Trocar sensação de sistema antigo por layout SaaS/PWA premium.
2. Manter modo dark, mas com menos bordas fortes e menos excesso de caixas.
3. Mobile-first: menu inferior fixo, cards por módulo, botões grandes, formulários em etapas e tabelas virando cards.
4. Desktop: sidebar limpa, topbar mais baixa, dashboard com cards úteis e menos áreas mortas.
5. Reduzir textos repetidos como “100% offline / SQLite ativo” quando a nova base for cloud/sync.
6. Criar estados claros: online, offline, sincronizando, erro de sync, pendente, salvo.
7. Padronizar ícones por função comercial: venda, cliente, produto, caixa, crediário, relatório, backup, alerta.
8. Reduzir `classic-*` como padrão visual principal. Pode manter um “modo compacto desktop”, mas o design principal deve ser moderno.

## Arquitetura recomendada para a nova base

```txt
smart-loja-pwa-supabase/
  src/
    app/
    components/
    features/
      dashboard/
      customers/
      products/
      sales/
      cash/
      credits/
      orders/
      receipts/
      reports/
      settings/
      sync/
    lib/
      supabase.ts
      auth.ts
      repository/
      sync/
      format.ts
    styles/
      tokens.css
      layout.css
      components.css
  public/
    manifest.webmanifest
    sw.js
    icons/
  supabase/
    migrations/
    functions/
  docs/
```

## Estratégia de dados nova

### Camada cloud principal

- Supabase/Postgres como fonte principal sincronizada.
- `stores` para loja ativa.
- `store_members` para permissões.
- Tabelas comerciais com `store_id` obrigatório.
- RLS ativa em todas as tabelas expostas.
- `request_id`/`client_request_id` para evitar duplicidade em venda, pagamento e pedido.
- `updated_at`, `deleted_at` e `sync_version` para sincronização e resolução de conflitos.

### Camada offline no PWA

Para web/mobile, o ideal é ter uma fila local para momentos sem internet:

- IndexedDB/local cache **somente como cache/fila offline**, não como fonte definitiva quando Supabase estiver ativo.
- Operações críticas entram em `pending_mutations` local.
- Quando voltar internet, sincroniza em ordem.
- Cada operação crítica usa `client_request_id` único.
- Se houver conflito, grava em `sync_conflicts` e mostra alerta para o admin.

## Segurança obrigatória

- Nunca colocar `service_role` no frontend, GitHub, Cloudflare Pages ou `app-config.js`.
- Frontend usa apenas publishable/anon key com RLS ativa.
- Ações sensíveis ficam em Edge Functions ou policies bem fechadas.
- Separar papéis: owner, admin, operator e viewer.
- Cliente comum não pode ver dados internos de caixa/relatórios/crediário de outros clientes.

## Ordem correta de construção

1. Criar projeto limpo React + Vite + TypeScript + PWA.
2. Adicionar Supabase client e tela de login/cadastro admin.
3. Criar schema Supabase com RLS e roles.
4. Migrar módulos um por um: clientes, produtos, vendas, caixa, crediário, pedidos, comprovantes.
5. Criar camada repository para não espalhar Supabase direto nas telas.
6. Criar sync status: online/offline/sincronizando/pendente/erro.
7. Recriar interface mobile-first e depois adaptar desktop.
8. Criar importador opcional do SQLite antigo para CSV/Supabase.
9. Criar testes: type-check, build, lint, fluxo venda/estoque/caixa/crediário, RLS e permissões.
10. Só depois pensar em Cloudflare/domínio/produção.

## Nota técnica da base atual

- Base atual offline/Tauri/SQLite: **8.4/10**.
- Como base para virar PWA Supabase direto sem refatorar: **5.8/10**.
- Como referência para uma base limpa nova: **8.8/10**.

## O que falta para 10/10 na nova base

- Schema Supabase final com RLS testada.
- Auth real e papéis separados.
- Sync offline com fila e idempotência.
- Mobile-first completo.
- Interface moderna sem aparência antiga pesada.
- Testes automatizados de permissões.
- Importador seguro dos dados SQLite antigos.
- Deploy Cloudflare/HTTPS com variáveis corretas.
- Política clara de backup/exportação da nuvem.
