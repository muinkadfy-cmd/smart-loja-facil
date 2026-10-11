import type { PwaUpdateState } from '../lib/pwaUpdates';

interface PwaUpdateBannerProps extends PwaUpdateState {
  variant?: 'inline' | 'floating' | 'login';
}

export function PwaUpdateBanner({
  updateAvailable, updateLabel, updateBusy, updateError, installUpdate, variant = 'inline',
}: PwaUpdateBannerProps): JSX.Element | null {
  if (!updateAvailable) return null;

  return (
    <section
      className={'mapp-release-notice' + (variant === 'floating' ? ' is-floating' : variant === 'login' ? ' is-login' : '')}
      role="status"
      aria-live="polite"
      aria-label="Atualização do aplicativo disponível"
    >
      <span className="mapp-release-notice-mark" aria-hidden="true">↻</span>
      <div className="mapp-release-notice-content">
        <span className="mapp-release-notice-eyebrow">Atualização disponível · {updateLabel}</span>
        <strong>{variant === 'login' ? 'Seu aplicativo tem novidades.' : 'Uma versão nova do Smart Loja Fácil chegou.'}</strong>
        <p>Instale para aproveitar as melhorias. Seus dados salvos não serão apagados.</p>
        {updateError ? <p className="mapp-release-notice-error" role="alert">{updateError}</p> : null}
      </div>
      <button type="button" onClick={() => void installUpdate()} disabled={updateBusy} aria-busy={updateBusy}>
        {updateBusy ? 'Preparando…' : 'Atualizar agora'}
      </button>
    </section>
  );
}
