const CACHE_NAME = 'smart-loja-pwa-supabase-v185-recentes-comprovantes-padrao';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/logo.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
  '/icons/icon-192-maskable.png',
  '/icons/icon-512-maskable.png',
  '/icons/notification-flower-badge.png',
  '/icons/notification-flower-pink.png',
  '/brand/smart-loja-icon.png',
  '/brand/jaque-logo-premium.png',
];

async function precacheAppShell(cache) {
  await Promise.all(
    APP_SHELL.map(async (url) => {
      try {
        await cache.add(url);
      } catch {
        // Mantem o PWA instalavel mesmo se um asset opcional falhar no deploy.
      }
    })
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => precacheAppShell(cache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const fallback = await cache.match('/index.html');
    if (fallback) return fallback;
    throw new Error('offline');
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/brand/') || url.pathname === '/logo.svg' || url.pathname === '/manifest.webmanifest') {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  event.respondWith(networkFirst(event.request));
});

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readPushPayload(event) {
  try {
    return event.data ? event.data.json() : {};
  } catch {
    try {
      return { title: 'Jaque Confecções e Presentes', body: event.data ? event.data.text() : 'Novo alerta da loja.' };
    } catch {
      return {};
    }
  }
}

function routeForPayload(payload, action) {
  const type = clean(payload.type || payload.alertType || payload.kind);
  if (payload.url) return String(payload.url);
  const params = new URLSearchParams({ source: 'push' });
  const append = (name, value) => {
    const text = clean(value);
    if (text) params.set(name, text);
  };

  if (type.startsWith('credit_') || payload.creditId || payload.credit_id) {
    params.set('view', 'credits');
    append('credit', payload.creditId || payload.credit_id);
    append('sale', payload.saleNumber || payload.sale_number);
    append('installment', payload.installmentId || payload.installment_id || payload.installmentNumber || payload.installment_number);
    params.set('action', action === 'receipt' ? 'receipt' : action === 'open' ? 'open' : 'receive');
    return `/?${params.toString()}`;
  }

  if (type.startsWith('sale_') || payload.receiptId || payload.receipt_id) {
    params.set('view', 'receipts');
    append('sale', payload.saleNumber || payload.sale_number);
    append('receipt', payload.receiptId || payload.receipt_id);
    params.set('action', 'receipt');
    return `/?${params.toString()}`;
  }

  if (type === 'low_stock' || payload.productId || payload.product_id) {
    params.set('view', 'products');
    append('product', payload.productId || payload.product_id);
    params.set('action', 'filter');
    return `/?${params.toString()}#baixo-estoque`;
  }

  if (type === 'cash_open' || type === 'cash_alert') {
    params.set('view', 'cash');
    return `/?${params.toString()}`;
  }

  if (type === 'backup_reminder') {
    params.set('view', 'backup');
    return `/?${params.toString()}`;
  }

  if (type === 'sync_error') {
    params.set('view', 'diagnostics');
    return `/?${params.toString()}`;
  }

  params.set('view', payload.view || 'dashboard');
  return `/?${params.toString()}`;
}

function notificationActions(payload) {
  const type = clean(payload.type || payload.alertType || payload.kind);
  if (type.startsWith('credit_') || payload.creditId || payload.credit_id) {
    return [
      { action: 'open', title: 'Abrir conta' },
      { action: 'receipt', title: 'Comprovante' },
    ];
  }
  if (type === 'low_stock') return [{ action: 'open', title: 'Ver produto' }];
  return [{ action: 'open', title: 'Abrir app' }];
}

self.addEventListener('push', (event) => {
  const payload = readPushPayload(event);
  const title = payload.title || 'Jaque Confecções e Presentes';
  const options = {
    body: payload.body || payload.message || 'Novo alerta importante da loja.',
    icon: payload.icon || '/brand/jaque-logo-premium.png',
    badge: payload.badge || '/icons/notification-flower-badge.png',
    image: payload.image || undefined,
    tag: payload.tag || `smart-loja-${clean(payload.type) || 'alerta'}`,
    renotify: true,
    requireInteraction: Boolean(payload.requireInteraction),
    actions: notificationActions(payload),
    vibrate: [90, 40, 90],
    data: {
      url: routeForPayload(payload, 'open'),
      receiptUrl: routeForPayload(payload, 'receipt'),
      alertId: payload.alertId || payload.alert_id || '',
      type: payload.type || 'alert',
      payload,
    },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const action = event.action || 'open';
  const route = action === 'receipt' ? (data.receiptUrl || data.url) : data.url;
  const targetUrl = new URL(route || '/?source=push&view=dashboard', self.location.origin).href;
  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      if ('focus' in client) {
        try {
          client.postMessage?.({ type: 'SMART_LOJA_PUSH_NAVIGATE', url: targetUrl });
          await client.navigate(targetUrl);
          return client.focus();
        } catch {
          client.postMessage?.({ type: 'SMART_LOJA_PUSH_NAVIGATE', url: targetUrl });
          return client.focus();
        }
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    return undefined;
  })());
});
