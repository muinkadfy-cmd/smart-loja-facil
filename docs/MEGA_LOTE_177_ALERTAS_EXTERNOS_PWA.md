# Mega Lote 177 — Alertas externos PWA Android/iOS

## Objetivo
Implementar a base comercial para notificações externas no celular: alertas fora do app, barra de notificações e tela bloqueada quando o PWA/navegador permitir.

## O que foi entregue
- Painel **Alertas externos do celular** dentro da Central de avisos.
- Botão **Ativar alertas** para solicitar permissão e inscrever o aparelho.
- Botão **Teste** para disparar notificação local pelo Service Worker.
- Diagnóstico leigo de status: permissão, PWA, nuvem e inscrição.
- Service Worker com eventos `push` e `notificationclick`.
- Tabela `push_subscriptions` no Supabase para guardar aparelhos inscritos.
- View `push_credit_due_alerts` para rotina de parcelas vencidas/vencendo hoje.
- Edge Function `send-push-alerts` como base para envio automático na nuvem.
- Script `npm run qa:push` para validar estrutura de Web Push.
- Cache/manifest atualizados para v177.

## Alertas planejados
- Parcela vencida.
- Parcela vencendo hoje.
- Estoque baixo.
- Falha de sincronização.
- Backup pendente.

A Edge Function entregue implementa primeiro o fluxo de parcelas vencidas/vencendo hoje, que é a prioridade comercial.

## Android
No Android, o fluxo recomendado é ativar pelo Chrome/PWA e permitir notificações. Depois da inscrição salva, a rotina da nuvem pode enviar alertas mesmo com o app fechado.

## iPhone/iOS
No iPhone, o usuário precisa adicionar o PWA à Tela de Início e permitir notificações. Abrir apenas no navegador comum pode não oferecer o mesmo comportamento de tela bloqueada.

## Configuração necessária no deploy
No Cloudflare Pages / ambiente do frontend:

```env
VITE_WEB_PUSH_PUBLIC_KEY=SUA_CHAVE_PUBLICA_VAPID
```

No Supabase Edge Function:

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_APENAS_NA_FUNCTION
VAPID_SUBJECT=mailto:contato@sualoja.com
VAPID_PUBLIC_KEY=SUA_CHAVE_PUBLICA_VAPID
VAPID_PRIVATE_KEY=SUA_CHAVE_PRIVADA_VAPID
```

A chave privada VAPID e service role **não podem ir para o frontend, GitHub ou Cloudflare Pages**.

## Como ativar no Supabase
1. Rodar a migration:
   `supabase/migrations/202606052030_push_notifications_external_alerts.sql`
2. Deploy da função:
   `supabase functions deploy send-push-alerts --no-verify-jwt`
3. Configurar secrets da função.
4. Criar cron para chamar a função diariamente, por exemplo às 08:00.

## Arquivos alterados/criados
- `src/lib/pushNotifications.ts`
- `src/mobile-app/components/ExternalPushPanel.tsx`
- `src/mobile-app/components/NotificationCenter.tsx`
- `src/mobile-app/MobileApp.tsx`
- `src/mobile-app/styles/mobile-app.css`
- `public/sw.js`
- `public/manifest.webmanifest`
- `package.json`
- `package-lock.json`
- `scripts/qa/push_notification_readiness_test.js`
- `scripts/release_check.js`
- `scripts/commercial_package_check.js`
- `scripts/commercial_release_package.js`
- `supabase/migrations/202606052030_push_notifications_external_alerts.sql`
- `supabase/functions/send-push-alerts/index.ts`
- `supabase/functions/send-push-alerts/README.md`

## Limitações honestas
- Sem VAPID configurado, o painel mostra que falta chave externa e não inscreve o aparelho.
- Sem Edge Function/cron, o app consegue pedir permissão e testar notificação, mas não envia alerta automático com app fechado.
- iPhone exige PWA instalado na Tela de Início para comportamento correto de notificação externa.
- Não foi feito teste em aparelho físico dentro deste ambiente; foram feitas validações de build/código.

## Próximo lote ideal
Criar uma tela de Configurações > Alertas para escolher horários e tipos de alerta por aparelho: parcela vencida, vencendo hoje, estoque baixo, backup e sincronização.
