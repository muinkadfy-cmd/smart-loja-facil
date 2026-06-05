# Mega Lote 173 — PDF polido + nome da loja cadastrada

## Objetivo

Manter o fluxo em PDF, remover textos genéricos do sistema nos comprovantes e telas visíveis, usar o nome da loja cadastrada e micro polir o layout do PDF sem mexer em login, Supabase, ENV, RLS ou autenticação.

## Ajustes principais

- PDF continua sendo gerado de forma manual/data-driven, sem HTML/CSS cru.
- Rodapé do PDF deixou de mostrar “Smart Loja Fácil”.
- PDF passa a usar `settings.store_name`/nome da loja cadastrada no cabeçalho e rodapé.
- Cabeçalho do PDF foi micro ajustado para evitar sobreposição entre logo, nome da loja e título.
- Logo do PDF foi reprocessada em JPEG interno mais leve e mais adequado para o documento.
- Manifest/PWA/cache atualizados para v173.
- Tela de login recebeu marca/nome da loja em vez de nome genérico do sistema.
- Shells/topbars/fallbacks visíveis passam a priorizar o nome cadastrado da loja.
- Textos visíveis antigos com “Smart Loja Fácil” foram removidos das telas principais incluídas neste lote.

## Arquivos alterados

- `package.json`
- `package-lock.json`
- `public/sw.js`
- `public/manifest.webmanifest`
- `scripts/release_check.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`
- `src/main.tsx`
- `src/lib/webApi.ts`
- `src/pages/Welcome.tsx`
- `src/components/Shell.tsx`
- `src/mobile-app/layout/MobileHeader.tsx`
- `src/mobile-app/layout/MobileShell.tsx`
- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/screens/GenericDataScreen.tsx`
- `src/mobile-app/screens/DiagnosticsScreen.tsx`
- `src/pages/Dashboard.tsx`

## Testes executados

- `npm ci --ignore-scripts --no-audit --no-fund`
- `npm run type-check`
- `npm run build`
- `npm run lint`
- `npm run release:check`
- `npm audit --audit-level=high`
- `node scripts/credit_payment_guard_tests.js`
- `npm run release:commercial:check`
- `npm run release:commercial:prepare`

## Resultado

Build aprovado, type-check aprovado, lint aprovado, auditorias de release aprovadas e 0 vulnerabilidades high no `npm audit`.

## Observação honesta

O Vite ainda exibe aviso de chunk acima de 500 KB. Não quebra o sistema, mas continua recomendado otimizar em lote futuro para celulares fracos.
