# Mega Lote 109 — Atualização e limpeza de cache PWA

## Objetivo
Criar uma experiência simples para usuário leigo atualizar o PWA quando chegar nova versão, limpar cache do navegador/PWA e recarregar a página sem precisar abrir DevTools.

## Entregas
- banner na tela quando o service worker indicar nova versão;
- botão `Atualizar agora`;
- botão `Limpar cache`;
- botão `Atualizar tela` na central de alertas;
- mensagens humanas de progresso;
- CSS responsivo para web e mobile;
- versionamento PWA/cache em v109.

## Segurança
Não altera Supabase, vendas, produtos, clientes, caixa, crediário ou permissões. A limpeza afeta cache de arquivos do app, não dados da loja no Supabase.

## Versionamento
- App: `pwa-supabase-v109-pwa-cache-update`
- Cache: `smart-loja-pwa-supabase-v109-pwa-cache-update`
- Outbox: mantido em `smart-loja:web-outbox-v107` para preservar pendências locais já criadas.
