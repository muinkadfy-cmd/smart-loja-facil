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
  const summary = (
    <>
      {thumbnailSrc ? (
        <span className="mapp-list-thumb">
          <img src={thumbnailSrc} alt={thumbnailAlt || title} loading="lazy" />
        </span>
      ) : (
        <span className="mapp-list-icon"><InlineIcon name={icon} size={24} /></span>
      )}
      <span className="mapp-list-main">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      {value ? <strong className="mapp-list-value">{value}</strong> : null}
      {onClick ? (
        <span aria-hidden="true" className="mapp-more-button">{expanded ? '×' : '•••'}</span>
      ) : null}
    </>
  );

  return (
    <article className={`mapp-list-card tone-${tone} ${expanded ? 'is-expanded' : ''} ${onClick ? 'is-clickable' : ''}`}>
      {onClick ? (
        <button
          type="button"
          className="mapp-list-card-trigger"
          aria-expanded={expanded}
          onClick={onClick}
        >
          {summary}
        </button>
      ) : (
        <div className="mapp-list-card-static">{summary}</div>
      )}
      {expanded && children ? <div className="mapp-list-expanded">{children}</div> : null}
    </article>
  );
}
