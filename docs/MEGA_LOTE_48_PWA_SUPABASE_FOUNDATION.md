# Mega Lote 48 — Fundação PWA Web/Mobile + Supabase

## Objetivo
Transformar o foco do sistema para PWA web/mobile sincronizado via Supabase, preservando a base desktop existente sem forçar Tauri como caminho principal.

## Entregas
- Camada `src/lib/webApi.ts` para loja ativa, sessão, papel, dashboard, clientes, produtos e configurações no Supabase.
- Dashboard web passando a ler dados reais quando houver login e loja ativa.
- Clientes, Produtos e Configurações liberados no modo web por camada segura.
- Vendas, Caixa, Crediário, Pedidos e relatórios financeiros seguem bloqueados no PWA até migração transacional.
- Diagnóstico web ampliado com ambiente, loja ativa, usuário, papel, variáveis públicas e versão/cache.
- PWA reforçado com manifest melhorado, ícones PNG 192/512, ícones maskable, service worker versionado e aviso de atualização.
- Correção de RLS/membros para impedir autoentrada em loja apenas sabendo `store_id`.
- Trigger para adicionar automaticamente o criador da loja como `owner`.
- Proteção contra remoção/rebaixamento do dono principal.
- UI mais leiga: textos técnicos do topo foram reduzidos e o diagnóstico técnico ficou separado.

## Testes executados
- `npm run type-check`
- `npm run build`
- `npm run lint`
- `npm run release:check`
- `node --check public/sw.js`

## Limitações reais
- Vendas, caixa e crediário ainda não foram migrados para Supabase porque exigem transações, controle de duplicidade e auditoria mais forte.
- Não foi testado em Supabase real com credenciais de produção dentro deste ambiente.
- Não foi testado deploy real no Cloudflare dentro deste ambiente.
- Tauri foi preservado como legado/compatibilidade, mas não é o foco deste lote.

## Próximo lote ideal
Migrar Vendas, Caixa e Crediário para Supabase com transação lógica, `client_request_id`, auditoria, controle de estoque, pagamentos e proteção contra duplicidade.
