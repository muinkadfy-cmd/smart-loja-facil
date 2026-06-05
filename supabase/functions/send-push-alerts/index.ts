// Mega Lote 177 — rotina base para enviar alertas externos PWA.
// Deploy manual recomendado:
// supabase functions deploy send-push-alerts --no-verify-jwt
// Secrets necessários no Supabase:
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
// Chamar por cron uma vez ao dia/manhã e opcionalmente no meio do dia.

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

type PushRow = {
  id: string;
  store_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  platform: string;
  notification_prefs: Record<string, boolean> | null;
};

type DueAlertRow = {
  store_id: string;
  credit_id: string;
  customer_name: string;
  installment_id: string;
  installment_number: number;
  amount: number;
  paid_amount: number;
  due_date: string;
  alert_kind: 'overdue' | 'due_today' | 'future';
};

function env(name: string): string {
  const value = Deno.env.get(name)?.trim() || '';
  if (!value) throw new Error(`Secret ausente: ${name}`);
  return value;
}

function brl(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function dateLabel(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function buildPayload(alert: DueAlertRow): Record<string, unknown> {
  const open = Math.max(0, Number(alert.amount || 0) - Number(alert.paid_amount || 0));
  const overdue = alert.alert_kind === 'overdue';
  return {
    title: overdue ? 'Parcela atrasada' : 'Parcela vence hoje',
    body: `${alert.customer_name} · parcela ${alert.installment_number} · ${brl(open)} · ${dateLabel(alert.due_date)}`,
    icon: '/icons/icon-192.png',
    badge: '/icons/maskable-192.png',
    tag: `credit-${alert.installment_id}-${alert.alert_kind}`,
    requireInteraction: overdue,
    url: `/?source=push&view=credits&credit=${encodeURIComponent(alert.credit_id)}`,
    type: overdue ? 'credit_overdue' : 'credit_due_today',
    alertId: alert.installment_id,
  };
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = env('SUPABASE_URL');
    const serviceRole = env('SUPABASE_SERVICE_ROLE_KEY');
    const vapidSubject = env('VAPID_SUBJECT');
    const vapidPublicKey = env('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = env('VAPID_PRIVATE_KEY');
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
    const { data: alerts, error: alertsError } = await supabase
      .from('push_credit_due_alerts')
      .select('store_id, credit_id, customer_name, installment_id, installment_number, amount, paid_amount, due_date, alert_kind')
      .in('alert_kind', ['overdue', 'due_today'])
      .limit(300);
    if (alertsError) throw alertsError;

    const byStore = new Map<string, DueAlertRow[]>();
    for (const alert of (alerts || []) as DueAlertRow[]) {
      const list = byStore.get(alert.store_id) || [];
      list.push(alert);
      byStore.set(alert.store_id, list);
    }

    let sent = 0;
    let disabled = 0;
    let failed = 0;

    for (const [storeId, storeAlerts] of byStore.entries()) {
      const { data: subscriptions, error: subError } = await supabase
        .from('push_subscriptions')
        .select('id, store_id, endpoint, p256dh, auth, platform, notification_prefs')
        .eq('store_id', storeId)
        .eq('enabled', true)
        .limit(80);
      if (subError) throw subError;

      for (const subscription of (subscriptions || []) as PushRow[]) {
        for (const alert of storeAlerts.slice(0, 8)) {
          const key = alert.alert_kind === 'overdue' ? 'credit_overdue' : 'credit_due_today';
          if (subscription.notification_prefs && subscription.notification_prefs[key] === false) continue;
          try {
            await webpush.sendNotification({
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            }, JSON.stringify(buildPayload(alert)));
            sent += 1;
          } catch (error) {
            failed += 1;
            const statusCode = (error as { statusCode?: number }).statusCode;
            if (statusCode === 404 || statusCode === 410) {
              await supabase.from('push_subscriptions').update({ enabled: false }).eq('id', subscription.id);
              disabled += 1;
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, stores: byStore.size, sent, failed, disabled }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});
