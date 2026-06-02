import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './master-ui.css';
import './styles/lote77-design-system.css';
import './styles/lote78-css-cleanup.css';
import './styles/lote79-neo-family.css';
import './styles/lote80-neo-shell-sidebar.css';
import './styles/lote81-neo-important-reduction.css';
import './styles/lote82-login-premium.css';
import './styles/lote83-dashboard-premium.css';
import './styles/lote84-mobile-dashboard-refine.css';
import './styles/lote85-sales-pdv-premium.css';
import './styles/lote86-orders-premium.css';
import './styles/lote87-products-premium.css';
import './styles/lote88-product-photos-storage.css';
import './styles/lote89-customers-premium.css';
import './styles/lote90-cash-premium.css';
import './styles/lote91-credits-premium.css';
import './styles/lote92-reports-premium.css';
import './styles/lote93-backup-settings-premium.css';
import './styles/lote95-css-consolidation.css';
import './styles/lote96-commercial-validation.css';
import './styles/lote97-realtime-sync.css';
import './styles/lote98-pwa-commercial-pdv-sync.css';
import './styles/lote99-commercial-final.css';

document.documentElement.classList.add('lote77-touch-guard', 'lote78-css-dedupe', 'lote79-neo-family', 'lote80-neo-shell-sidebar', 'lote81-neo-important-reduction', 'lote82-login-premium', 'lote83-dashboard-premium', 'lote84-mobile-dashboard-refine', 'lote85-sales-pdv-premium', 'lote86-orders-premium', 'lote87-products-premium', 'lote88-product-photos-storage', 'lote89-customers-premium', 'lote90-cash-premium', 'lote91-credits-premium', 'lote92-reports-premium', 'lote93-backup-settings-premium', 'lote95-css-consolidation', 'lote96-commercial-validation', 'lote97-realtime-sync', 'lote98-pwa-commercial-pdv-sync', 'lote99-commercial-final');

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
