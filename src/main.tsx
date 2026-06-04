import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './mobile-app/styles/mobile-app.css';

document.documentElement.className = 'smart-mobile-rebuild smart-mobile-rebuild-v149';

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
