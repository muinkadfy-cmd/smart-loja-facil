import React, { useEffect } from 'react';

interface ModalProps { title: string; open: boolean; onClose: () => void; children: React.ReactNode; }

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
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-head"><h2>{title}</h2><button type="button" className="ghost-btn" onClick={onClose}>Fechar</button></header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}
