import React from 'react';
import { AppIcon } from '../components/AppIcon';

type WelcomeAction = (() => void) | undefined;

interface WelcomeProps {
  onEnter?: () => void;
  onContinue?: () => void;
  onStart?: () => void;
  onOpen?: () => void;
  loading?: boolean;
  entering?: boolean;
  busy?: boolean;
  disabled?: boolean;
  className?: string;
}

function resolveAction(props: WelcomeProps): WelcomeAction {
  return props.onEnter ?? props.onContinue ?? props.onStart ?? props.onOpen;
}

function isBusy(props: WelcomeProps): boolean {
  return Boolean(props.loading || props.entering || props.busy);
}

function WelcomeLayout(props: WelcomeProps): JSX.Element {
  const action = resolveAction(props);
  const busy = isBusy(props);

  return (
    <div className={['welcome-screen', props.className].filter(Boolean).join(' ')}>
      <section className="welcome-card">
        <div className="welcome-left">
          <div className="welcome-hero-mark">
            <div className="welcome-hero-ring">
              <AppIcon name="app_logo_cadeado_carrinho" size={64} className="welcome-hero-icon" />
            </div>
          </div>

          <div className="welcome-copy">
            <span className="welcome-badge">
              <span className="welcome-badge-dot" />
              Offline local
            </span>

            <h1>Smart Loja Facil</h1>
            <p>Sistema rapido, local e pronto para abrir.</p>
          </div>
        </div>

        <div className="welcome-divider" />

        <div className="welcome-right">
          <div className="welcome-feature-grid">
            <div className="welcome-feature">
              <span className="welcome-feature-icon">
                <AppIcon name="offline_local" size={24} className="welcome-feature-image" />
              </span>
              <strong>Sem internet</strong>
            </div>
            <div className="welcome-feature">
              <span className="welcome-feature-icon">
                <AppIcon name="sqlite_ativo" size={24} className="welcome-feature-image" />
              </span>
              <strong>SQLite local</strong>
            </div>
            <div className="welcome-feature">
              <span className="welcome-feature-icon">
                <AppIcon name="acoes_rapidas" size={24} className="welcome-feature-image" />
              </span>
              <strong>Leve e direto</strong>
            </div>
          </div>

          <div className="welcome-cta-block">
            <button
              type="button"
              className="welcome-enter-btn"
              onClick={() => action?.()}
              disabled={props.disabled || busy || !action}
            >
              <span>{busy ? 'Abrindo...' : 'Entrar'}</span>
              <span className="welcome-enter-arrow" aria-hidden="true">→</span>
            </button>

            <div className="welcome-footnote">
              <AppIcon name="sistema_local" size={16} className="welcome-footnote-icon" />
              <small>Ambiente local no computador da loja</small>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function Welcome(props: WelcomeProps): JSX.Element {
  return <WelcomeLayout {...props} />;
}

export function WelcomePage(props: WelcomeProps): JSX.Element {
  return <WelcomeLayout {...props} />;
}

export function WelcomeScreen(props: WelcomeProps): JSX.Element {
  return <WelcomeLayout {...props} />;
}

export default Welcome;
