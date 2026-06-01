# Mega Lote 49 — Scroll PWA Web/Mobile + Densidade Comercial

## Objetivo
Corrigir a sensação de rolagem ruim no PWA web/mobile-first, mantendo o visual premium e deixando o desktop parecido com uma versão expandida do mobile.

## Ajustes aplicados

- Criado contrato de rolagem para desktop/web:
  - janela travada em `100dvh`;
  - body/root sem rolagem duplicada;
  - sidebar rola somente dentro dela quando necessário;
  - conteúdo principal rola dentro do painel da página;
  - topbar e atalhos permanecem estáveis.
- Ajustado contrato mobile/tablet:
  - rolagem natural no aparelho;
  - menu inferior com área segura;
  - painel principal sem scroll interno aninhado no celular;
  - sidebar mobile em overlay com altura `100dvh`.
- Reduzida densidade exagerada do topo:
  - greeting menor;
  - atalhos mais compactos;
  - chips de status menores;
  - dashboard usa melhor a altura disponível.
- Reduzida densidade da sidebar:
  - itens menores;
  - marca menor;
  - footer compacto;
  - textos com ellipsis seguro.
- Corrigidos textos visíveis com acentos em Shell, diagnóstico web e migração web.
- Atualizado versionamento PWA/cache de `v48` para `v49`.

## Arquivos alterados

- `src/styles.css`
- `src/components/Shell.tsx`
- `src/components/PwaUpdateNotice.tsx`
- `src/pages/WebMigration.tsx`
- `src/pages/WebDiagnostics.tsx`
- `src/lib/webApi.ts`
- `public/sw.js`

## Observações

Este lote não altera regras de negócio, banco, Supabase, RLS nem fluxo de dados. O foco é layout, rolagem, legibilidade, cache e acabamento visual.

## Testes esperados

- `npm run type-check`
- `npm run lint`
- `npm run build`
- `npm run release:check`

Depois do deploy, abrir o PWA no celular, aceitar a atualização e conferir se a versão/cache aparece como `pwa-supabase-v49`.
