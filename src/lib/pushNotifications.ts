import { getPublicWebEnv } from './env';
import { getSupabaseClient } from './supabaseClient';
import { getWebStoreContext } from './webApi';

export type PushReadinessLevel = 'ok' | 'warning' | 'danger' | 'off';

export interface WebPushReadiness {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  serviceWorker: boolean;
  pushManager: boolean;
  secureContext: boolean;
  configured: boolean;
  subscribed: boolean;
  savedInCloud: boolean;
  level: PushReadinessLevel;
  title: string;
  detail: string;
  platformHint: string;
}

export interface WebPushRegistrationResult {
  ok: boolean;
  title: string;
  detail: string;
  readiness: WebPushReadiness;
}

type PushSubscriptionJsonKeys = {
  p256dh?: string;
  auth?: string;
};

type PushSubscriptionJson = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: PushSubscriptionJsonKeys;
};

type PushViteEnv = {
  VITE_WEB_PUSH_PUBLIC_KEY?: string;
  VITE_VAPID_PUBLIC_KEY?: string;
  VITE_PUSH_VAPID_PUBLIC_KEY?: string;
};

const PUSH_LOCAL_KEY = 'smart-loja:web-push-local-state-v178';
const PUSH_READY_EVENT = 'smart-loja:web-push-readiness-changed';
const PUSH_DEFAULT_URL = '/?source=push&view=credits&type=credit_due_today&action=receive';

const pushEnv = import.meta.env as unknown as PushViteEnv;

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getVapidPublicKey(): string {
  return clean(pushEnv.VITE_WEB_PUSH_PUBLIC_KEY) || clean(pushEnv.VITE_VAPID_PUBLIC_KEY) || clean(pushEnv.VITE_PUSH_VAPID_PUBLIC_KEY);
}

function emitPushChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PUSH_READY_EVENT));
}

export function onWebPushReadinessChange(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(PUSH_READY_EVENT, handler);
  window.addEventListener('online', handler);
  window.addEventListener('offline', handler);
  window.addEventListener('focus', handler);
  document.addEventListener('visibilitychange', handler);
  return () => {
    window.removeEventListener(PUSH_READY_EVENT, handler);
    window.removeEventListener('online', handler);
    window.removeEventListener('offline', handler);
    window.removeEventListener('focus', handler);
    document.removeEventListener('visibilitychange', handler);
  };
}

function canUseNotifications(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function canUseServiceWorker(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

function canUsePushManager(): boolean {
  return typeof window !== 'undefined' && 'PushManager' in window;
}

function getPermission(): NotificationPermission | 'unsupported' {
  if (!canUseNotifications()) return 'unsupported';
  return Notification.permission;
}

function platformHint(): string {
  if (typeof navigator === 'undefined') return 'Abra em Android/iPhone instalado como PWA para testar.';
  const ua = navigator.userAgent || '';
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return standalone
      ? 'iPhone pronto: mantenha o app na Tela de Início e permita notificações.'
      : 'No iPhone, adicione o app à Tela de Início para receber alertas com a tela bloqueada.';
  }
  if (/Android/i.test(ua)) {
    return 'Android: instale o PWA ou mantenha as notificações permitidas no Chrome.';
  }
  return 'No computador, use Chrome/Edge com notificações permitidas para testar.';
}

function readLocalState(): { enabled: boolean; savedInCloud: boolean; lastEndpoint: string; updatedAt: string } {
  if (typeof window === 'undefined') return { enabled: false, savedInCloud: false, lastEndpoint: '', updatedAt: '' };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PUSH_LOCAL_KEY) || '{}') as Partial<{ enabled: boolean; savedInCloud: boolean; lastEndpoint: string; updatedAt: string }>;
    return {
      enabled: Boolean(parsed.enabled),
      savedInCloud: Boolean(parsed.savedInCloud),
      lastEndpoint: clean(parsed.lastEndpoint),
      updatedAt: clean(parsed.updatedAt),
    };
  } catch {
    return { enabled: false, savedInCloud: false, lastEndpoint: '', updatedAt: '' };
  }
}

function writeLocalState(next: Partial<{ enabled: boolean; savedInCloud: boolean; lastEndpoint: string }>): void {
  if (typeof window === 'undefined') return;
  const current = readLocalState();
  window.localStorage.setItem(PUSH_LOCAL_KEY, JSON.stringify({ ...current, ...next, updatedAt: new Date().toISOString() }));
  emitPushChange();
}

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i);
  return outputArray.buffer.slice(outputArray.byteOffset, outputArray.byteOffset + outputArray.byteLength);
}

async function getReadyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!canUseServiceWorker()) return null;
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

async function getCurrentSubscription(): Promise<PushSubscription | null> {
  try {
    const registration = await getReadyRegistration();
    if (!registration?.pushManager) return null;
    return registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function getWebPushReadiness(): Promise<WebPushReadiness> {
  const env = getPublicWebEnv();
  const permission = getPermission();
  const serviceWorker = canUseServiceWorker();
  const pushManager = canUsePushManager();
  const secureContext = typeof window === 'undefined' ? false : window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const configured = Boolean(getVapidPublicKey()) && env.isConfigured;
  const subscription = await getCurrentSubscription();
  const local = readLocalState();
  const subscribed = Boolean(subscription) || (local.enabled && local.lastEndpoint.length > 0);
  const savedInCloud = subscribed && local.savedInCloud;

  if (!serviceWorker || !pushManager || permission === 'unsupported' || !secureContext) {
    return {
      supported: false,
      permission,
      serviceWorker,
      pushManager,
      secureContext,
      configured,
      subscribed: false,
      savedInCloud: false,
      level: 'danger',
      title: 'Este navegador não está pronto',
      detail: 'Use Chrome/Edge no Android ou o PWA instalado na Tela de Início do iPhone.',
      platformHint: platformHint(),
    };
  }

  if (permission === 'denied') {
    return {
      supported: true,
      permission,
      serviceWorker,
      pushManager,
      secureContext,
      configured,
      subscribed,
      savedInCloud,
      level: 'danger',
      title: 'Notificação bloqueada no celular',
      detail: 'Ative a permissão de notificações nas configurações do navegador/app.',
      platformHint: platformHint(),
    };
  }

  if (!configured) {
    return {
      supported: true,
      permission,
      serviceWorker,
      pushManager,
      secureContext,
      configured,
      subscribed,
      savedInCloud,
      level: 'warning',
      title: 'Falta chave de envio externa',
      detail: 'Configure VITE_WEB_PUSH_PUBLIC_KEY no deploy e VAPID_PRIVATE_KEY na rotina da nuvem para alertas com app fechado.',
      platformHint: platformHint(),
    };
  }

  if (subscribed && savedInCloud) {
    return {
      supported: true,
      permission,
      serviceWorker,
      pushManager,
      secureContext,
      configured,
      subscribed,
      savedInCloud,
      level: 'ok',
      title: 'Alertas externos ativos',
      detail: 'Este aparelho está cadastrado para receber vencimentos, estoque baixo e avisos importantes.',
      platformHint: platformHint(),
    };
  }

  return {
    supported: true,
    permission,
    serviceWorker,
    pushManager,
    secureContext,
    configured,
    subscribed,
    savedInCloud,
    level: subscribed ? 'warning' : 'off',
    title: subscribed ? 'Aparelho inscrito, falta confirmar nuvem' : 'Alertas externos desligados',
    detail: subscribed ? 'O navegador permitiu alertas, mas a inscrição ainda precisa salvar na loja.' : 'Ative para receber alertas fora do app quando a rotina da nuvem estiver configurada.',
    platformHint: platformHint(),
  };
}

async function saveSubscriptionToCloud(subscription: PushSubscription): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const context = await getWebStoreContext({ createIfMissing: true });
  const json = subscription.toJSON() as PushSubscriptionJson;
  const endpoint = clean(json.endpoint || subscription.endpoint);
  const p256dh = clean(json.keys?.p256dh);
  const auth = clean(json.keys?.auth);
  if (!endpoint || !p256dh || !auth) throw new Error('O navegador não entregou a chave completa da notificação. Tente remover e ativar de novo.');
  const platform = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios-pwa' : /Android/i.test(navigator.userAgent) ? 'android' : 'web';
  const { error } = await client
    .from('push_subscriptions')
    .upsert({
      store_id: context.store.id,
      user_id: context.userId,
      endpoint,
      p256dh,
      auth,
      platform,
      user_agent: navigator.userAgent.slice(0, 600),
      enabled: true,
      notification_prefs: {
        credit_overdue: true,
        credit_due_today: true,
        low_stock: true,
        sync_error: true,
        backup_reminder: true,
      },
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' });
  if (error) throw new Error(`Não consegui salvar este aparelho na nuvem: ${error.message}`);
  return true;
}

export async function enableWebPushNotifications(): Promise<WebPushRegistrationResult> {
  const before = await getWebPushReadiness();
  if (!before.supported) return { ok: false, title: before.title, detail: before.detail, readiness: before };
  if (!before.configured) return { ok: false, title: before.title, detail: before.detail, readiness: before };

  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') {
    const readiness = await getWebPushReadiness();
    return { ok: false, title: 'Permissão não liberada', detail: 'Sem permissão do celular não consigo mostrar alerta fora do app.', readiness };
  }

  const registration = await getReadyRegistration();
  if (!registration?.pushManager) {
    const readiness = await getWebPushReadiness();
    return { ok: false, title: 'Navegador sem envio externo', detail: 'Este navegador não ofereceu o gerenciador de notificações push.', readiness };
  }

  const vapid = getVapidPublicKey();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(vapid),
    });
  }

  const saved = await saveSubscriptionToCloud(subscription);
  writeLocalState({ enabled: true, savedInCloud: saved, lastEndpoint: subscription.endpoint });
  const readiness = await getWebPushReadiness();
  return { ok: saved, title: 'Alertas externos ativos', detail: 'Este aparelho foi cadastrado. A rotina da nuvem pode enviar vencimentos e alertas importantes.', readiness };
}

export async function disableWebPushNotifications(): Promise<WebPushRegistrationResult> {
  const subscription = await getCurrentSubscription();
  if (subscription) {
    try { await subscription.unsubscribe(); } catch { /* navegador pode já ter removido */ }
    try {
      const client = getSupabaseClient();
      const context = await getWebStoreContext({ createIfMissing: false });
      if (client) await client.from('push_subscriptions').update({ enabled: false, updated_at: new Date().toISOString() }).eq('store_id', context.store.id).eq('endpoint', subscription.endpoint);
    } catch {
      // Se estiver offline, pelo menos desliga neste aparelho.
    }
  }
  writeLocalState({ enabled: false, savedInCloud: false, lastEndpoint: '' });
  const readiness = await getWebPushReadiness();
  return { ok: true, title: 'Alertas externos desligados', detail: 'Este aparelho não receberá mais notificações externas até ativar novamente.', readiness };
}

export async function sendWebPushTestNotification(): Promise<WebPushRegistrationResult> {
  const readiness = await getWebPushReadiness();
  if (readiness.permission !== 'granted') return { ok: false, title: 'Permissão pendente', detail: 'Ative os alertas antes de enviar teste.', readiness };
  const registration = await getReadyRegistration();
  if (!registration) return { ok: false, title: 'PWA não registrado', detail: 'Abra o app novamente instalado no celular e tente o teste.', readiness };
  const options = {
    body: 'Teste de alerta externo: parcela vencida, estoque baixo e avisos importantes aparecerão assim.',
    icon: '/brand/jaque-logo-premium.png',
    badge: '/icons/notification-flower-badge.png',
    tag: 'smart-loja-push-test',
    data: { url: PUSH_DEFAULT_URL, type: 'credit_due_today' },
  } as NotificationOptions;
  await registration.showNotification('Jaque Confecções e Presentes', options);
  return { ok: true, title: 'Teste enviado', detail: 'Veja a barra de notificações do celular. Se não aparecer, confira permissão do app.', readiness: await getWebPushReadiness() };
}
