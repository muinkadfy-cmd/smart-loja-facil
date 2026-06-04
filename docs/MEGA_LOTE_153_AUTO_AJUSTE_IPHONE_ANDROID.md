# Mega Lote 153 — Auto ajuste iPhone/Android e micro organização responsiva

## Objetivo
Melhorar a adaptação automática do PWA em iPhone e Android, com foco em safe-area, altura real do navegador, teclado aberto, bottom nav, header, cards e telas estreitas.

## O que foi feito
- Atualizado viewport do HTML com `viewport-fit=cover` e `interactive-widget=resizes-content`.
- Criado cálculo de altura dinâmica via `visualViewport` para corrigir diferenças entre Chrome Android, Safari iOS e PWA instalado.
- Adicionadas classes automáticas para iOS, Android e teclado aberto.
- Ajustado `--mapp-vh`, `--mapp-vw`, altura real do app e scroll interno.
- Melhorado comportamento do login quando o teclado abre.
- Bottom nav agora respeita melhor safe-area e some temporariamente com teclado aberto para não cobrir campos.
- Header, nome da loja, cards, chips e botões receberam ajustes finos para telas estreitas.
- Adicionado ajuste para celulares pequenos, altura baixa e modo paisagem.

## O que não foi alterado
- Não alterou venda, caixa, estoque, crediário, pedidos ou backup.
- Não alterou tabelas Supabase.
- Não alterou permissões/RLS.
- Não alterou dados reais.

## Versão/cache
- App: `pwa-supabase-v153-auto-ajuste-iphone-android`
- Cache: `smart-loja-pwa-supabase-v153-auto-ajuste-iphone-android`

## Testes executados
- `npm run type-check`
- `npm run build`
- `npm run lint`
- `npm run release:check`
- `npm run release:commercial:check`
- `npm run release:commercial:prepare`
- `npm audit --audit-level=high`
- `node --check` nos scripts editados
- validação JSON em `package.json`, `package-lock.json` e `manifest.webmanifest`

## Limitação real
O código passou nos testes locais, mas ainda precisa validar visualmente em celular físico Android e iPhone, principalmente PWA instalado, teclado aberto, rolagem e bottom nav.
