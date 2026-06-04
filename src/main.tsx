import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './mobile-app/styles/mobile-app.css';


document.documentElement.className = 'smart-mobile-rebuild smart-mobile-rebuild-v158';

function applyMobileViewportMetrics(): void {
  const root = document.documentElement;
  const visualViewport = window.visualViewport;
  const viewportHeight = Math.max(320, Math.round(visualViewport?.height ?? window.innerHeight));
  const viewportWidth = Math.max(280, Math.round(visualViewport?.width ?? window.innerWidth));
  const keyboardOpen = Math.max(0, window.innerHeight - viewportHeight) > 120;
  const ua = navigator.userAgent || '';

  root.style.setProperty('--mapp-vh', `${viewportHeight * 0.01}px`);
  root.style.setProperty('--mapp-vw', `${viewportWidth * 0.01}px`);
  root.style.setProperty('--mapp-viewport-height-px', `${viewportHeight}px`);
  root.style.setProperty('--mapp-viewport-width-px', `${viewportWidth}px`);
  root.classList.toggle('mapp-keyboard-open', keyboardOpen);
  root.classList.toggle('mapp-ios-device', /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  root.classList.toggle('mapp-android-device', /Android/i.test(ua));
}

applyMobileViewportMetrics();
window.addEventListener('resize', applyMobileViewportMetrics, { passive: true });
window.addEventListener('orientationchange', () => window.setTimeout(applyMobileViewportMetrics, 250), { passive: true });
window.visualViewport?.addEventListener('resize', applyMobileViewportMetrics, { passive: true });
window.visualViewport?.addEventListener('scroll', applyMobileViewportMetrics, { passive: true });

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  let reloadingForUpdate = false;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      void registration.update();
      window.setInterval(() => void registration.update(), 30 * 60 * 1000);

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('smart-loja:pwa-update'));
          }
        });
      });
    }).catch(() => undefined);

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadingForUpdate) return;
      reloadingForUpdate = true;
      window.location.reload();
    });
  });
}
