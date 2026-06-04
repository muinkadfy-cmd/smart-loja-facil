import type { ReactNode } from 'react';
import type { DelphiIconName } from '../../lib/icons';
import { InlineIcon } from './InlineIcon';

interface ListCardProps {
  icon: DelphiIconName;
  title: string;
  subtitle: string;
  value?: string;
  tone?: string;
  thumbnailSrc?: string;
  thumbnailAlt?: string;
  expanded?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}

export function ListCard({ icon, title, subtitle, value, tone = 'blue', thumbnailSrc, thumbnailAlt, expanded = false, onClick, children }: ListCardProps): JSX.Element {
  return (
    <article
      className={`mapp-list-card tone-${tone} ${expanded ? 'is-expanded' : ''} ${onClick ? 'is-clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
    >
      {thumbnailSrc ? (
        <span className="mapp-list-thumb">
          <img src={thumbnailSrc} alt={thumbnailAlt || title} loading="lazy" />
        </span>
      ) : (
        <span className="mapp-list-icon"><InlineIcon name={icon} size={24} /></span>
      )}
      <div className="mapp-list-main">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </div>
      {value ? <strong className="mapp-list-value">{value}</strong> : null}
      <button type="button" aria-label={expanded ? 'Ocultar detalhes' : 'Ver detalhes'} className="mapp-more-button" onClick={(event) => { event.stopPropagation(); onClick?.(); }}>
        {expanded ? '×' : '•••'}
      </button>
      {expanded && children ? <div className="mapp-list-expanded" onClick={(event) => event.stopPropagation()}>{children}</div> : null}
    </article>
  );
}
