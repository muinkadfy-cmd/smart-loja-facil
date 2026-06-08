import fs from 'node:fs';

const required = [
  ['src/lib/pushNotifications.ts', ['enableWebPushNotifications', 'disableWebPushNotifications', 'sendWebPushTestNotification', 'push_subscriptions', 'VITE_WEB_PUSH_PUBLIC_KEY']],
  ['src/mobile-app/components/ExternalPushPanel.tsx', ['Ativar alertas', 'Teste', 'Diagnóstico']],
  ['src/mobile-app/components/NotificationCenter.tsx', ['externalPanel', 'mapp-notification-external-slot']],
  ['src/mobile-app/MobileApp.tsx', ['ExternalPushPanel', 'externalPanel']],
  ['src/mobile-app/deepLinks.ts', ['readSmartLojaDeepLink', 'storeCreditFocusFromDeepLink', 'storeReceiptFocusFromDeepLink']],
  ['public/icons/notification-flower-badge.png', []],
  ['public/icons/notification-flower-pink.png', []],
  ['public/sw.js', ["self.addEventListener('push'", 'notificationclick', 'showNotification', 'notification-flower-badge.png', 'SMART_LOJA_PUSH_NAVIGATE']],
  ['supabase/migrations/202606052030_push_notifications_external_alerts.sql', ['push_subscriptions', 'push_credit_due_alerts', 'enable row level security']],
  ['supabase/functions/send-push-alerts/index.ts', ['webpush', 'push_credit_due_alerts', 'sendNotification', 'receiptUrl', 'saleNumber']],
];

let failed = false;
for (const [file, tokens] of required) {
  if (!fs.existsSync(file)) {
    process.stderr.write(`ERRO: arquivo ausente ${file}\n`);
    failed = true;
    continue;
  }
  const source = fs.readFileSync(file, 'utf8');
  for (const token of tokens) {
    if (!source.includes(token)) {
      process.stderr.write(`ERRO: ${file} não contém ${token}\n`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
process.stdout.write('OK: push_notification_readiness_test passou. Estrutura de Web Push preservada no v181.\n');
