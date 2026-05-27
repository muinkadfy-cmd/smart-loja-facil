import React, { useEffect, useState } from 'react';

export function PwaUpdateNotice(): JSX.Element | null {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const showUpdate = () => setAvailable(true);
    window.addEventListener('smart-loja:pwa-update', showUpdate);
    return () => window.removeEventListener('smart-loja:pwa-update', showUpdate);
  }, []);

  async function applyUpdate(): Promise<void> {
    setBusy(true);
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      return;
    }
    window.location.reload();
  }

  if (!available) return null;

  return (
    <div className="pwa-update-card" role="status" aria-live="polite">
      <div>
        <strong>Nova versão disponível</strong>
        <span>Atualize para o celular puxar os arquivos novos e evitar cache antigo.</span>
      </div>
      <button type="button" className="primary-btn" onClick={() => void applyUpdate()} disabled={busy}>
        {busy ? 'Atualizando...' : 'Atualizar app'}
      </button>
    </div>
  );
}
