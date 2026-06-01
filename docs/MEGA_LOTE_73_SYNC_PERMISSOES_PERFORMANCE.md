# Mega Lote 73 — Sincronização comercial, permissões e performance mobile

## Objetivo

Reforçar o PWA web/mobile para uso comercial com Supabase, reduzindo peso visual acumulado, criando fila local de pendências para oscilações de internet, melhorando alertas leigos e deixando o diagnóstico mais útil para suporte.

## Principais alterações

- Criada fila local web `smart-loja:web-outbox-v73` para guardar alterações que falharem por internet/rede.
- Adicionado reenvio manual no Shell e no Diagnóstico Web.
- Adicionado reenvio automático seguro quando a internet volta.
- Versão lógica do app atualizada para `pwa-supabase-v73`.
- Versão de cache atualizada para `smart-loja-pwa-supabase-v73-sync-permissoes-performance`.
- Service worker atualizado para limpar cache antigo e incluir o logo premium extraído no cache.
- Diagnóstico Web agora mostra pendências, último erro pendente e permissão por papel.
- Shell mostra banner global de pendências e banner de perfil somente leitura.
- Extraído o logo base64 gigante da tela de Crediário para `public/brand/jaque-logo-premium.png`.
- Fluxos pendentes usam `request_id`/`client_request_id` estável para reduzir risco de duplicidade ao reenviar.
- Operações críticas sem idempotência segura, como abrir/fechar caixa e ajuste manual de estoque, não são colocadas automaticamente na fila para evitar duplicidade comercial.

## Fluxos protegidos na fila

A fila cobre reenvio de operações com chave de requisição estável ou atualização idempotente:

- salvar cliente;
- inativar cliente;
- salvar produto;
- inativar produto;
- criar venda;
- movimento manual de caixa com `requestId`;
- receber parcela de crediário;
- criar pedido;
- alterar status de pedido;
- cancelar pedido;
- salvar configurações.

## Fluxos não enfileirados automaticamente por segurança

- abrir caixa;
- fechar caixa;
- ajuste manual de estoque.

Esses fluxos podem gerar duplicidade ou conflito se a resposta da internet cair depois do Supabase já ter gravado. O sistema agora avisa o usuário para conferir se a alteração apareceu antes de tentar novamente.

## Testes executados

- `npm ci`
- `npm run type-check`
- `npm run lint`
- `npm run build`
- `npm run release:check`
- `node --check public/sw.js`
- `npm audit --audit-level=moderate`
- validação JSON de `package.json`, `tsconfig.json` e `public/manifest.webmanifest`
- validação JSONC de `wrangler.jsonc`

## Limitações reais

- `cargo check` não foi executado porque o ambiente usado não tinha Rust/Cargo instalado.
- Não foi possível validar Supabase real com projeto online, usuários reais e RLS aplicada.
- Não foi possível validar visualmente em Android/iPhone real dentro deste ambiente.
- O CSS global ainda está grande e precisa de um lote futuro de limpeza/design-system.
- Ainda existe base64 grande em `src-tauri/src/main.rs`; não foi alterado neste lote para não arriscar o desktop sem `cargo check`.

## Próximo lote recomendado

Lote 74 — Teste real multiaparelho Supabase + limpeza CSS profunda + permissões visuais por tela.
