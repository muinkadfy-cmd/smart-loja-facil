const CACHE_NAME = 'smart-loja-pwa-supabase-v177-alertas-externos-pwa';
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

self.addEventListener('push', (event) => {
  const payload = readPushPayload(event);
  const title = payload.title || 'Jaque Confecções e Presentes';
  const options = {
    body: payload.body || payload.message || 'Novo alerta importante da loja.',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/maskable-192.png',
    tag: payload.tag || 'smart-loja-alerta',
    renotify: true,
    requireInteraction: Boolean(payload.requireInteraction),
    data: {
      url: payload.url || '/?source=push&view=credits',
      alertId: payload.alertId || '',
      type: payload.type || 'alert',
    },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = new URL(data.url || '/?source=push&view=dashboard', self.location.origin).href;
  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      if ('focus' in client) {
        try {
          await client.navigate(targetUrl);
          return client.focus();
        } catch {
          return client.focus();
        }
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    return undefined;
  })());
});
