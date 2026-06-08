# Mega Lote 184 — Auditoria e micro polimento de comprovantes PDF/PNG

## Objetivo
Padronizar e micro polir os comprovantes gerados em PDF e PNG/compartilhamento para que mantenham a mesma identidade visual, hierarquia, respiro, contraste e leitura no WhatsApp/celular.

## Alterações principais
- Refeito o gerador PNG da aba Comprovantes com base no mesmo padrão visual do PDF.
- Refeito o gerador PNG usado em Atividades recentes/Vendas recentes.
- Mantido o padrão preto/branco do recibo com logo no topo, recibo branco, borda preta, seções e tabelas.
- Aumentado o canvas/base do PNG para melhorar nitidez no WhatsApp.
- Ajustados espaçamentos, altura de linhas, tabela de produtos, tabela de parcelas, status e rodapé.
- Corrigido risco de rodapé ficar grudado/cortado no final do comprovante.
- Status continua visível: paga, parcial, vencida, aberta/pendente.
- Mantido compartilhamento sem link e sem texto extra.
- Atualizada versão/cache PWA para v184.

## Arquivos alterados
- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/components/receiptShare.ts`
- `src/lib/webApi.ts`
- `public/sw.js`
- `public/manifest.webmanifest`
- `package.json`
- `package-lock.json`
- `scripts/release_check.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`

## Testes executados
- `npm ci --ignore-scripts --no-audit --no-fund`
- `npm run type-check`
- `npm run build`
- `npm run lint`
- `npm run release:check`
- `npm audit --audit-level=high`
- `node scripts/credit_payment_guard_tests.js`
- `npm run qa:push`
- `npm run qa:commercial`
- `npm run qa:load`
- `npm run release:commercial:check`
- `npm run release:commercial:prepare`

## Resultado dos testes
- TypeScript: OK
- Build Vite: OK
- Lint local: OK
- Release check: OK
- Audit high: 0 vulnerabilidades
- QA push: OK
- QA comercial: OK
- QA carga/listas: OK
- Pacote comercial: OK

## Observação honesta
O build ainda mostra aviso de chunk acima de 500 KB. O aviso não quebrou o sistema, mas continua sendo bom alvo para um lote futuro de otimização de performance/celular fraco.

## Não alterado neste lote
- Login
- Supabase Auth
- ENV
- RLS
- Notificações push
- Regras de venda/crediário
- Estrutura de banco
