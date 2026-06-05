# Mega Lote 168 — Recibo padrão preto/branco Jaque

## Objetivo
Trocar o layout antigo dos comprovantes/extratos por um padrão único inspirado na referência enviada: recibo preto/branco, papel com serrilhado, logo Jaque no topo, tabela de parcelas/produtos, status destacado e visualização interna no app.

## Alterações feitas

- Criado padrão visual único para:
  - Comprovante de venda.
  - Comprovante de pagamento.
  - Comprovante parcial.
  - Parcela atrasada.
  - Parcela em aberto.
  - Extrato do crediário.
- A logo Jaque Confecções e Presentes foi tratada e adicionada em `public/brand`.
- A logo padrão de recibo agora é `public/brand/jaque-receipt-logo-wide.png`.
- O layout do recibo agora segue a referência:
  - fundo preto no visualizador;
  - recibo branco com borda preta;
  - topo com loja e logo;
  - título grande por tipo de documento;
  - dados do cliente;
  - tabela principal;
  - cards de total/pago/saldo;
  - anotações;
  - carimbo PAGO quando quitado;
  - status Pago, Parcial, Pendente e Atrasado.
- Botão Visualizar agora abre dentro do próprio app em tela cheia, sem HTML solto.
- Botão PDF baixa arquivo `.pdf` real e mantém a prévia interna aberta para conferência.
- Removida abertura automática de HTML externo no fluxo principal de Visualizar.
- Cache/versionamento atualizado para v168.

## Arquivos alterados

- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`
- `src/lib/webApi.ts`
- `src/main.tsx`
- `public/sw.js`
- `public/manifest.webmanifest`
- `package.json`
- `package-lock.json`
- `scripts/release_check.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`

## Arquivos novos/atualizados de marca

- `public/brand/jaque-receipt-logo-wide.png`
- `public/brand/jaque-receipt-logo.png`
- `public/brand/jaque-logo-premium.png`

## Testes executados

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run type-check
npm run build
npm run lint
npm run release:check
npm audit --audit-level=high
node scripts/credit_payment_guard_tests.js
npm run release:commercial:check
npm run release:commercial:prepare
```

## Resultado dos testes

- Type-check passou.
- Build passou.
- Lint passou.
- Release check passou.
- Audit high passou com 0 vulnerabilidades.
- Testes de proteção do crediário passaram.
- Pacote comercial foi preparado.

## Observação honesta

O Vite ainda avisou que o chunk principal está acima de 500 KB. Isso não quebrou o app, mas ainda é recomendável otimizar em lote futuro para celulares fracos.

## Limitação

O PDF baixado é arquivo `.pdf` real e seguro, mas a prévia visual mais fiel fica dentro do app. Para impressão com fidelidade máxima do recibo visual, o ideal futuro é adicionar uma biblioteca dedicada de PDF/print renderizado a partir do HTML/CSS.
