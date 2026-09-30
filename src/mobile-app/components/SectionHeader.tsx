interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionAriaLabel?: string;
  compact?: boolean;
  onAction?: () => void;
}

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  actionAriaLabel,
  compact = false,
  onAction,
}: SectionHeaderProps): JSX.Element {
  const className = ['mapp-section-title', compact ? 'mapp-section-title-compact' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className}>
      <div className="mapp-section-title-copy">
        <h2>{title}</h2>
        {subtitle ? <p className="mapp-section-note">{subtitle}</p> : null}
      </div>
      {actionLabel && onAction ? (
        <button type="button" aria-label={actionAriaLabel || actionLabel} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
