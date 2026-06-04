import type { DelphiIconName } from '../../lib/icons';
import type { PageKey } from '../../types';
import { InlineIcon } from './InlineIcon';

interface EmptyStateProps {
  icon: DelphiIconName;
  title: string;
  detail: string;
  actionLabel?: string;
  actionPage?: PageKey;
  onNavigate?: (page: PageKey) => void;
}

export function EmptyState({ icon, title, detail, actionLabel, actionPage, onNavigate }: EmptyStateProps): JSX.Element {
  return (
    <section className="mapp-empty-state">
      <span><InlineIcon name={icon} size={32} /></span>
      <strong>{title}</strong>
      <p>{detail}</p>
      {actionLabel && actionPage && onNavigate ? (
        <button type="button" className="mapp-primary-button" onClick={() => onNavigate(actionPage)}>{actionLabel}</button>
      ) : null}
    </section>
  );
}
