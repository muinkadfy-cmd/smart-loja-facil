# Mega Lote 75 — CSS/RLS/Mobile Final Seguro

## Objetivo

Aplicar o próximo lote ideal com foco em acabamento comercial real: melhorar manutenção/performance, reforçar diagnóstico de Supabase/RLS/multiaparelho, preparar validação em celular real e atualizar versão/cache do PWA.

## Alterações entregues

### 1. Versão/cache PWA v75

- `WEB_APP_VERSION` atualizado para `pwa-supabase-v75`.
- `WEB_CACHE_VERSION` atualizado para `smart-loja-pwa-supabase-v75-css-rls-mobile-final`.
- `public/sw.js` atualizado para limpar cache antigo e instalar o cache novo.
- Fila local web atualizada para `smart-loja:web-outbox-v75`.
- Migração preservada de pendências antigas dos lotes 74 e 73.

### 2. Checklist comercial Supabase/RLS/mobile

Criado o arquivo `src/lib/productionChecklist.ts` com checklist persistente no navegador.

A tela Diagnóstico Web agora mostra uma área de validação comercial para marcar testes reais:

- owner criando produto;
- operador fazendo venda sem acessar configurações;
- leitor bloqueado para alterações;
- dois aparelhos vendo a mesma loja;
- pendência local reenviando ao voltar internet;
- venda sem duplicar com oscilação;
- Cloudflare/PWA recebendo versão v75;
- celular pequeno sem corte lateral.

Também foi adicionado botão para copiar o checklist e enviar no suporte.

### 3. Remoção segura de base64 gigante do Rust

O `src-tauri/src/main.rs` tinha um logo PNG gigante embutido em base64 dentro do código.

Foi movido para:

- `src-tauri/assets/jaque-logo-premium.base64`

O Rust agora usa `include_str!`, preservando o data URI usado no comprovante, mas deixando o `main.rs` muito mais leve e legível.

Resultado aproximado:

- `src-tauri/src/main.rs` antes: cerca de 1.2 MB
- `src-tauri/src/main.rs` depois: cerca de 136 KB

### 4. Release check reforçado

O `scripts/release_check.js` agora:

- exige o asset `src-tauri/assets/jaque-logo-premium.base64`;
- bloqueia imagem base64 gigante embutida diretamente em arquivos de código;
- permite o novo arquivo seguro `src/lib/productionChecklist.ts` dentro da camada web/PWA.

### 5. Performance mobile segura

Adicionado CSS com `content-visibility: auto` para reduzir custo de renderização de cards/listas pesadas em navegadores modernos.

Aplicado em áreas seguras como:

- cards web;
- health cards;
- checklist comercial;
- painéis;
- stat cards;
- tabelas/listas;
- readiness card.

Também foi criado visual mobile-first para o checklist, com cards de toque confortável e layout 1 coluna em celular.

## Arquivos alterados/novos

- `src/lib/webApi.ts`
- `src/lib/productionChecklist.ts`
- `src/pages/WebDiagnostics.tsx`
- `src/styles.css`
- `public/sw.js`
- `scripts/release_check.js`
- `src-tauri/src/main.rs`
- `src-tauri/assets/jaque-logo-premium.base64`
- `docs/MEGA_LOTE_75_CSS_RLS_MOBILE_FINAL.md`

## Testes executados

Passaram:

- `npm ci`
- `npm run type-check`
- `npm run lint`
- `npm run build`
- `npm run release:check`
- `node --check scripts/release_check.js`
- `node --check public/sw.js`
- validação JSON de `package.json`
- validação JSON de `tsconfig.json`
- validação JSON de `public/manifest.webmanifest`
- validação JSONC de `wrangler.jsonc`
- `npm audit --audit-level=moderate`

## Resultado do build

- CSS final: 523.81 KB, gzip 84.56 KB
- JS principal: 123.20 KB, gzip 33.86 KB
- vendor: 164.51 KB, gzip 51.38 KB
- web-auth/Supabase: 201.76 KB, gzip 52.82 KB

## Limitações reais

- `cargo check` não foi executado porque o ambiente não possui Rust/Cargo.
- Teste real Supabase/RLS com usuários reais não pode ser executado neste ambiente.
- Teste real em Android/iPhone não pode ser executado neste ambiente.
- CSS global ainda continua grande e deve ser tratado em lote específico de consolidação estrutural.

## Próximo lote recomendado

Lote 76 — Consolidação estrutural de CSS/design system + teste real Supabase em produção.

Prioridades:

1. separar CSS antigo por módulos;
2. remover blocos CSS obsoletos com teste visual por tela;
3. validar owner/admin/operator/viewer no Supabase real;
4. testar Cloudflare/cache em celular instalado;
5. confirmar impressão/comprovantes Tauri após `cargo check`.
