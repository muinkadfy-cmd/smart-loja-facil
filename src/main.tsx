import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './styles/lote118-foundation-final.css';
import './styles/lote119-icon-login-rescue.css';
import './styles/lote120-commercial-components.css';
import './styles/lote121-clean-interface.css';
import './styles/lote122-clean-alerts.css';
import './styles/lote123-dashboard-supreme.css';

document.documentElement.classList.add('lote118-foundation-final', 'lote119-icon-login-rescue', 'lote120-commercial-components', 'lote121-clean-interface', 'lote122-clean-alerts', 'lote123-dashboard-supreme');

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
