# Mega Lote 67 — Interface clássica, ícones antigos, Supabase e PWA

## Objetivo
Auditar e aplicar um polimento grande e seguro no Smart Loja Fácil Web/PWA, com foco em:

- Visual mais clássico/antigo premium, inspirado em sistema comercial desktop/Delphi/Windows.
- Ícones antigos reais quando disponíveis, com fallback SVG seguro.
- Melhor diagnóstico de Supabase, permissões, ambiente e cache.
- Correção de inconsistência TypeScript encontrada na auditoria.
- Atualização de versão/cache PWA para reduzir risco de celular preso em versão antiga.

## Versão

- Antes: `pwa-supabase-v66`
- Depois: `pwa-supabase-v67`
- Cache/service worker: `smart-loja-pwa-supabase-v67-classico-supabase-polish`

## Arquivos alterados

- `.env.example`
- `public/manifest.webmanifest`
- `public/sw.js`
- `src/components/AppIcon.tsx`
- `src/components/Shell.tsx`
- `src/components/WebAuthPanel.tsx`
- `src/lib/env.ts`
- `src/lib/webApi.ts`
- `src/pages/Dashboard.tsx`
- `src/pages/Products.tsx`
- `src/pages/WebDiagnostics.tsx`
- `src/styles.css`

## Arquivo novo

- `docs/MEGA_LOTE_67_CLASSICO_SUPABASE_UI.md`

## Auditoria encontrada

### 1. Supabase ausente no ambiente atual
Pelo diagnóstico informado, o sistema está online e com service worker controlando cache, mas sem variáveis públicas do Supabase:

- `VITE_SUPABASE_URL`: faltando
- Chave pública: faltando

Isso deixa o nível operacional de Supabase em `0/5`, porque o app não consegue autenticar, carregar loja nem sincronizar dados em nuvem.

### 2. Mensagem de ambiente incompleta
O app tratava basicamente uma chave `VITE_SUPABASE_ANON_KEY`. O lote passou a aceitar também nomes novos usados em alguns ambientes Supabase/Cloudflare:

- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### 3. TypeScript quebrado em Produtos
A auditoria encontrou erro de tipo em `Products.tsx`: tamanho de ícone `18` não era aceito pelo tipo `DelphiIconSize`. Corrigido para tamanho permitido.

### 4. Visual moderno demais para o pedido atual
O visual estava limpo, mas ainda com aparência SaaS/web moderna. O lote aplicou uma camada visual clássica premium sem remover estrutura existente.

## Melhorias aplicadas

### Interface clássica premium
- Fundo geral mais bege/cinza antigo.
- Cards com borda mais marcada e raio menor.
- Topbar azul mais clássica.
- Sidebar com aparência de sistema comercial antigo.
- Botões, inputs e cards com acabamento mais próximo de desktop antigo, mas mantendo legibilidade web/mobile.
- Dashboard mais compacto e com leitura mais comercial.

### Ícones antigos
- `AppIcon` agora tenta usar os PNGs antigos em `/icons/delphi/png`.
- Se o PNG não carregar, o app volta automaticamente para SVG.
- Isso reduz risco de tela quebrada e preserva compatibilidade.

### Supabase e diagnóstico
- Criado indicador de nível Supabase no Dashboard e Diagnóstico.
- Diagnóstico copiado agora inclui o nível Supabase.
- Header mostra `Supabase faltando` quando o ambiente web não tem URL/chave pública.
- Mensagens explicam melhor que a chave deve ser pública e nunca `service_role`.

### PWA/cache
- Service worker atualizado para v67.
- Manifest atualizado com tema clássico e descrição mais clara.
- Objetivo: evitar celular preso em cache antigo após deploy.

### Segurança
- `.env.example` reforça que não pode colocar `service_role`, JWT secret, VAPID private key ou chaves privadas no frontend.
- Erro de criação de loja agora dá pista leiga/técnica quando a falha é RLS.

## Nível Supabase recomendado

### Estado atual informado
`0/5 · variáveis faltando`

Motivo: o app está online, mas sem URL pública e sem chave pública do Supabase no ambiente de execução.

### Após configurar variáveis
`2/5 · ambiente configurado, login pendente`

### Após login + loja + RLS básico funcionando
`3/5 · login, loja e RLS básicos ativos`

### Para chegar em 4/5 ou 5/5
Ainda precisa validar em ambiente real:

- Login owner/admin/usuário comum.
- Criar loja inicial.
- Criar cliente/produto/pedido/venda/crediário.
- Abrir web e mobile ao mesmo tempo.
- Conferir se alteração feita no web aparece no mobile.
- Conferir se alteração feita no mobile aparece no web.
- Testar logout/login novamente.
- Testar RLS impedindo acesso indevido.
- Testar Cloudflare depois do deploy.

## Testes executados

Todos passaram:

```bash
npm run type-check
npm run lint
npm run release:check
npm run build
npm audit --audit-level=low
node --check public/sw.js
node -e "JSON.parse(require('fs').readFileSync('public/manifest.webmanifest','utf8')); JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('JSON OK')"
```

## Testes não possíveis nesta sessão

Não foi possível validar com Supabase real porque o ambiente informado está sem:

- Supabase URL pública.
- Chave pública anon/publishable.
- Login real configurado.
- Deploy Cloudflare ativo para teste externo.

## Risco

Classificação: baixo a médio.

Motivo:

- Baixo para UI/CSS/ícones, porque foi feita camada de polimento com fallback.
- Médio para Supabase, porque a sincronização real depende de variáveis, login, policies e teste em ambiente publicado.

## Próximo lote recomendado

Lote 68 recomendado:

1. Configurar variáveis públicas no Cloudflare/Vite.
2. Testar criação da loja inicial.
3. Auditar migrations e policies RLS de `stores`, usuários, produtos, clientes, pedidos, vendas e crediário.
4. Criar painel de sincronização pendente por módulo.
5. Rodar teste web/mobile real com dois dispositivos.
6. Ajustar todas as mensagens leigas de erro Supabase/RLS.

## Comandos sugeridos

```bash
git status
git add .env.example public/manifest.webmanifest public/sw.js src/components/AppIcon.tsx src/components/Shell.tsx src/components/WebAuthPanel.tsx src/lib/env.ts src/lib/webApi.ts src/pages/Dashboard.tsx src/pages/Products.tsx src/pages/WebDiagnostics.tsx src/styles.css docs/MEGA_LOTE_67_CLASSICO_SUPABASE_UI.md
git commit -m "mega lote 67 interface classica icones antigos supabase pwa cache"
git push origin main
npx wrangler deploy
```

Se sua branch for `master`, troque `main` por `master`.
