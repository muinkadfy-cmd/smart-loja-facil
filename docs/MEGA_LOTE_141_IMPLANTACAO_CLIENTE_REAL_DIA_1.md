# Mega Lote 141 — Checklist de Implantação em Cliente Real / Dia 1

## Objetivo
Criar uma etapa prática para o dia da implantação real do primeiro cliente, com checklist mobile-first, evidência copiável e trava contra liberar o cliente sozinho com P0/P1 aberto.

## COMANDO MESTRE 10/10
- Status: aplicado.
- Prioridade: P1 final / implantação real.
- Mobile-first: sim.
- Supabase/sync/permissões: preservado e conferível.
- PWA/cache: atualizado para v141.
- ZIP limpo: scripts de pacote comercial conferidos.
- Testes: type-check, build, lint, release, pacote comercial e audit passaram.

## Principais mudanças
- Nova seção `Implantação cliente real / Dia 1` no Diagnóstico Web.
- Checklist com 12 etapas críticas: preparo, login, PWA/cache, impressora, backup, cadastros teste, venda teste, caixa, segundo aparelho, permissões, primeira venda real e aceite/suporte.
- Marcação por etapa: Passou, Falhou, Bloqueado e Pendente.
- Decisão automática: Não iniciar cliente sozinho, Dia 1 quase pronto ou Dia 1 aceito com evidência.
- Travas de segurança se houver P0/P1 com Falhou/Bloqueado, auditoria final bloqueada, fechamento comercial bloqueado, painel executivo bloqueado, pendência local, offline ou sem login.
- Botões para aceitar Dia 1, copiar checklist e zerar somente as marcações do aparelho.

## Segurança
A nova área não grava venda, não abre caixa, não mexe em estoque, não altera crediário, não restaura backup e não altera Supabase. Ela apenas registra evidência local do processo de implantação.

## Versão PWA/cache
- App: `pwa-supabase-v141-implantacao-dia-1`
- Cache: `smart-loja-pwa-supabase-v141-implantacao-dia-1`

## Arquivos alterados/novos
- `docs/MEGA_LOTE_141_IMPLANTACAO_CLIENTE_REAL_DIA_1.md`
- `package.json`
- `package-lock.json`
- `public/manifest.webmanifest`
- `public/sw.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`
- `scripts/release_check.js`
- `src/lib/productionChecklist.ts`
- `src/lib/webApi.ts`
- `src/main.tsx`
- `src/mobile-app/screens/DiagnosticsScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`

## Testes executados
- `npm run type-check` — OK
- `npm run build` — OK
- `npm run lint` — OK
- `npm run release:check` — OK
- `npm run release:commercial:check` — OK com avisos esperados de arquivos locais ignorados
- `npm run release:commercial:prepare` — OK
- `npm audit --audit-level=high` — 0 vulnerabilidades
- `node --check` nos scripts editados — OK
- JSON de `package.json`, `package-lock.json` e `manifest.webmanifest` — OK

## Avisos honestos
- `.env.production` existe no workspace local, mas não entrou no ZIP.
- Logs locais existem no workspace, mas não entraram no ZIP.
- `src-tauri` segue como legado; este lote focou PWA web/mobile.
- Ainda falta validação física real em dois aparelhos, Supabase produção, papéis, impressão e primeiro cliente acompanhado.
