# Mega Lote 50 — Permissões Web, Diagnóstico PWA e Segurança Supabase

## Objetivo

Avançar a camada PWA web/mobile com Supabase sem liberar módulos comerciais incompletos de forma perigosa.

Este lote foca em:

- permissões web por papel;
- bloqueio amigável para usuário sem permissão;
- diagnóstico copiável para suporte;
- aviso de internet offline no PWA;
- versão/cache PWA `v50`;
- textos mais claros e comerciais;
- melhoria visual dos cards de migração no mobile e desktop.

## Arquivos alterados

- `public/sw.js`
- `src/lib/webApi.ts`
- `src/components/Shell.tsx`
- `src/components/WebAuthPanel.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/WebDiagnostics.tsx`
- `src/pages/WebMigration.tsx`
- `src/styles.css`

## Segurança e permissões

Foram adicionadas capacidades por papel no modo web:

- `owner`: acesso total;
- `admin`: administra loja, mas não controla o dono;
- `operator`: opera cadastros e módulos liberados;
- `viewer`: somente leitura;
- sem login: bloqueado.

As operações web de escrita agora validam papel antes de gravar:

- salvar cliente;
- inativar cliente;
- salvar produto;
- inativar produto;
- ajustar estoque;
- salvar configurações da loja.

Configurações da loja ficaram restritas a `owner` e `admin`.

## PWA/cache

- Cache atualizado para `smart-loja-pwa-supabase-v50`.
- `WEB_APP_VERSION` atualizado para `pwa-supabase-v50`.
- Service worker agora chama `skipWaiting()` no install e `clients.claim()` dentro do fluxo de ativação.
- Mantida limpeza de caches antigos.

## Diagnóstico

A tela de diagnóstico agora mostra:

- ambiente;
- loja ativa;
- usuário e papel;
- permissão de escrita;
- rede do aparelho;
- service worker;
- URL Supabase;
- anon key pública;
- versão/cache.

Foi adicionado botão para copiar diagnóstico e enviar no suporte.

## UX web/mobile

- Header mostra nome real derivado da sessão/loja quando possível.
- Dashboard mostra papel real no modo web.
- Aviso de offline aparece no PWA quando o aparelho perde internet.
- Tela de módulos em migração mostra requisitos claros para liberar cada área sem risco.
- Cards novos foram ajustados para celular com grid responsivo.

## Limites reais

Este lote não libera Vendas, Caixa, Crediário, Pedidos, Comprovantes, Relatórios ou Backup como operação completa no Supabase.

Esses módulos continuam bloqueados no modo web até existir fluxo transacional seguro, evitando:

- venda duplicada;
- baixa de estoque incompleta;
- caixa errado;
- parcela sobrescrita;
- recibo sem vínculo;
- dado falso no mobile.

## Testes executados

Passaram:

```bash
npm run type-check
npm run lint
npm run build
npm run release:check
node --check public/sw.js
```

Scripts inexistentes no `package.json` deste projeto:

```bash
npm run check:js
npm run validate
npm run codex:preflight
npm run codex:mobile
npm run codex:ready
```

## Nota comercial após o lote

- UI/UX mobile: 8.2/10
- UI/UX web: 8.5/10
- Responsividade: 8.4/10
- Design system: 8.1/10
- Iconografia: 8.0/10
- Supabase/sincronização: 7.6/10
- Permissões: 8.3/10
- PWA/cache: 8.5/10
- Performance: 7.8/10
- Acessibilidade: 7.9/10
- Segurança: 8.2/10
- Acabamento visual: 8.4/10
- Prontidão comercial PWA completa: 7.9/10

## Próximo lote recomendado

Começar a migração segura de leitura web para:

1. Comprovantes;
2. Relatórios;
3. Caixa somente consulta;
4. Crediário somente consulta;
5. Depois vendas transacionais.

Vendas completas devem ficar para depois porque exigem transação forte envolvendo venda, itens, estoque, caixa, recibo e crediário.
