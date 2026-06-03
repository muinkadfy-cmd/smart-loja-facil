# Mega Lote 126 — Validação Comercial Real, Supabase, Multiaparelho e Impressão

## Objetivo

Fechar o próximo lote ideal depois do Lote 125: transformar o diagnóstico em uma área realmente útil para validar o sistema em celular real antes de vender para cliente final.

## O que mudou

### Diagnóstico Web mobile

- Adicionado painel **Validação comercial real**.
- Novo botão **Rodar teste comercial**.
- O teste valida sem gravar dados:
  - configuração pública do Supabase;
  - ausência de service_role no frontend;
  - internet do aparelho;
  - login e papel do usuário;
  - permissões efetivas do papel atual;
  - leitura das tabelas principais por RLS;
  - fila de pendências locais;
  - service worker/cache PWA;
  - versão de cache v126.
- Resultado com nota automática de 0 a 10.
- Status leigo: **Liberado para piloto controlado**, **Quase pronto** ou **Não vender ainda**.
- Checklist agrupado por área: Segurança, Conexão, Permissões, Supabase/RLS, Sincronização, PWA/cache e Teste real.
- Botão **Copiar relatório** para enviar ao suporte.

### Impressão

- Adicionado teste seguro de impressão em:
  - 58mm;
  - 80mm;
  - A4/PDF.
- A amostra não grava venda, não baixa estoque e não altera caixa.

### Supabase / RPC / Permissões

Criada migration:

```txt
supabase/migrations/202606030126_commercial_validation_rpc_grants.sql
```

Ela:

- cria/garante RPC segura `create_owned_store(text)`;
- vincula o usuário autenticado como owner da primeira loja;
- registra auditoria simples;
- revoga execução pública/anônima de RPCs sensíveis;
- libera execução apenas para `authenticated`;
- não usa DROP destrutivo;
- não apaga dados;
- não faz UPDATE/DELETE em massa.

### PWA / Cache

Versão atualizada para:

```txt
pwa-supabase-v126-validacao-comercial-real
smart-loja-pwa-supabase-v126-validacao-comercial-real
```

## Arquivos alterados/novos

- `docs/MEGA_LOTE_126_VALIDACAO_COMERCIAL_REAL.md`
- `package.json`
- `public/manifest.webmanifest`
- `public/sw.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`
- `scripts/release_check.js`
- `src/lib/productionChecklist.ts`
- `src/lib/webApi.ts`
- `src/main.tsx`
- `src/mobile-app/layout/MobileShell.tsx`
- `src/mobile-app/screens/DiagnosticsScreen.tsx`
- `src/mobile-app/screens/GenericDataScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`
- `supabase/migrations/202606030126_commercial_validation_rpc_grants.sql`

## Testes executados

```bash
npm run type-check
npm run build
npm run lint
npm run release:check
npm run release:commercial:check
npm run release:commercial:prepare
node --check scripts/release_check.js
node --check scripts/commercial_package_check.js
node --check scripts/commercial_release_package.js
python3 validação JSON package.json e manifest.webmanifest
npm audit --audit-level=high
```

## Resultado dos testes

- TypeScript: OK.
- Build Vite: OK.
- Lint local: OK.
- Release check v126: OK com avisos esperados de workspace local.
- Commercial package check: OK com avisos de `.env.production` e logs protegidos, fora do pacote.
- Commercial release prepare: OK, pacote limpo gerado sem `.env`, logs, dist, node_modules, ZIPs antigos ou bancos reais.
- JSON: OK.
- npm audit high: 0 vulnerabilidades.

## Avisos reais

- `.env.production` existe no workspace local, mas está protegida e não entra no ZIP.
- Logs locais existem no workspace, mas estão protegidos e não entram no pacote.
- `src-tauri` continua como legado; este lote foca PWA web/mobile.
- O teste automático não substitui teste real com 2 aparelhos e 4 papéis.

## Como testar no celular

1. Aplicar o ZIP na raiz do projeto.
2. Rodar build e deploy.
3. Abrir o PWA instalado no Android/iPhone.
4. Entrar no **Diagnóstico Web**.
5. Tocar em **Rodar teste comercial**.
6. Tocar nos testes 58mm, 80mm e A4/PDF.
7. Copiar relatório e conferir se há algum item vermelho.

## Critério comercial

- Sem item vermelho: pode fazer piloto controlado.
- Com item amarelo: corrigir antes de vender em escala.
- Com item vermelho: não vender ainda.

