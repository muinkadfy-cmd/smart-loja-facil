# Mega Lote 178 — Alertas externos com rota direta + ícone flor

## Objetivo
Melhorar os alertas externos PWA Android/iOS para ficarem mais comerciais e úteis no dia a dia da loja:

- trocar o mini ícone quadrado da notificação por uma flor minimalista própria para badge;
- manter logo da loja no card maior da notificação;
- fazer cada notificação abrir direto no fluxo correspondente;
- preservar login, Supabase Auth, ENV, RLS, PDF e regras comerciais.

## O que foi implementado

### Ícone de notificação
- Criado `public/icons/notification-flower-badge.png` para o ícone pequeno/monocromático da barra superior do Android.
- Criado `public/icons/notification-flower-pink.png` para o painel interno de alertas externos.
- O Service Worker agora usa `badge: /icons/notification-flower-badge.png` e `icon: /brand/jaque-logo-premium.png`.

### Clique da notificação com rota direta
- Criado `src/mobile-app/deepLinks.ts` para padronizar links de push.
- O `public/sw.js` agora interpreta payloads por tipo e abre a rota correta:
  - parcela vencida/vencendo → `Crediário` com conta/parcela focada;
  - ação de comprovante → `Comprovantes` com recibo/extrato focado;
  - estoque baixo → `Produtos`/baixo estoque;
  - caixa → `Caixa`;
  - backup → `Backup`;
  - sincronização/erro → `Diagnóstico`.
- `notificationclick` agora envia mensagem ao app aberto e também navega para a URL correta.
- `App.tsx` agora lê deep links do push e direciona o usuário para a aba certa depois do login/sessão.

### Crediário
- O `CreditsScreen` lê o foco da notificação.
- Ao abrir por push, localiza a conta pelo `credit_id` ou número da venda.
- Expande a nota e rola para a conta.
- Se a ação for `receive`, abre o recebimento rápido da parcela.
- Se a ação for `receipt`, encaminha para Comprovantes.

### Comprovantes
- O `ReceiptsScreen` agora aceita foco por parcela.
- Quando a notificação pede comprovante, abre o recibo da parcela ou extrato da nota dentro da aba Comprovantes.

### Supabase Function
- A função `send-push-alerts` agora envia payload com:
  - `creditId`;
  - `saleNumber`;
  - `installmentId`;
  - `installmentNumber`;
  - `url` para abrir a conta;
  - `receiptUrl` para abrir o comprovante.

### Migration
- Criada `supabase/migrations/202606051900_push_direct_routes_icon.sql`.
- Atualiza a view `push_credit_due_alerts` para incluir `sale_number` e aceitar status em inglês/português.

## Arquivos alterados/novos

- `package.json`
- `package-lock.json`
- `public/sw.js`
- `public/manifest.webmanifest`
- `public/icons/notification-flower-badge.png`
- `public/icons/notification-flower-pink.png`
- `scripts/release_check.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`
- `scripts/qa/push_notification_readiness_test.js`
- `src/App.tsx`
- `src/lib/webApi.ts`
- `src/lib/pushNotifications.ts`
- `src/mobile-app/deepLinks.ts`
- `src/mobile-app/components/NotificationCenter.tsx`
- `src/mobile-app/components/ExternalPushPanel.tsx`
- `src/mobile-app/screens/CreditsScreen.tsx`
- `src/mobile-app/screens/ReceiptsScreen.tsx`
- `src/mobile-app/styles/mobile-app.css`
- `supabase/functions/send-push-alerts/index.ts`
- `supabase/migrations/202606052030_push_notifications_external_alerts.sql`
- `supabase/migrations/202606051900_push_direct_routes_icon.sql`
- `supabase/functions/send-push-alerts/README.md`

## Testes executados

Passaram:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run type-check
npm run build
npm run lint
npm run qa:push
node scripts/credit_payment_guard_tests.js
npm run qa:commercial
npm run qa:load
npm run release:check
npm audit --audit-level=high
npm run release:commercial:check
npm run release:commercial:prepare
```

Resultado:

- TypeScript OK.
- Build OK.
- Lint OK.
- QA push OK.
- Proteção de pagamento do crediário OK.
- QA comercial OK.
- QA de carga OK.
- Audit high: 0 vulnerabilidades.
- Pacote comercial limpo gerado sem `.env`, bancos, logs, ZIPs antigos ou `node_modules`.

## Observação honesta

O Vite ainda mostra aviso de chunk acima de 500 KB. Não quebra o app, mas continua sendo recomendável otimizar depois com code splitting para celular fraco.

## Pós-deploy obrigatório

1. Aplicar a migration nova no Supabase:

```txt
supabase/migrations/202606051900_push_direct_routes_icon.sql
```

2. Redeploy da Supabase Function:

```bash
npx supabase functions deploy send-push-alerts --no-verify-jwt
```

3. Deploy do PWA e atualizar/limpar cache no celular para pegar `v178`.
