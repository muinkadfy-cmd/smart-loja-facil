import React, { useEffect } from 'react';
import { AppIcon } from './AppIcon';

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ title, open, onClose, children }: ModalProps): JSX.Element | null {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className="modal-backdrop premium-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal-card premium-modal-card" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-head premium-modal-head">
          <div className="premium-modal-title">
            <span className="premium-modal-icon"><AppIcon name="configuracoes" size={24} className="app-icon-page" /></span>
            <div>
              <small>Janela segura</small>
              <h2>{title}</h2>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Fechar modal">×</button>
        </header>
        <div className="modal-body premium-modal-body">{children}</div>
      </section>
    </div>
  );
}
