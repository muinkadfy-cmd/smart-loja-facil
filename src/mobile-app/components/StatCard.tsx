import type { DelphiIconName } from '../../lib/icons';
import { InlineIcon } from './InlineIcon';

interface StatCardProps {
  label: string;
  value: string;
  detail: string;
  icon: DelphiIconName;
  tone?: 'blue' | 'purple' | 'green' | 'orange' | 'mint' | 'sky' | 'slate';
}

export function StatCard({ label, value, detail, icon, tone = 'blue' }: StatCardProps): JSX.Element {
  return (
    <article className={`mapp-stat-card tone-${tone}`}>
      <span className="mapp-stat-icon"><InlineIcon name={icon} size={24} /></span>
      <div>
        <span className="mapp-stat-label">{label}</span>
        <strong className="mapp-stat-value">{value}</strong>
        <small className="mapp-stat-detail">{detail}</small>
      </div>
    </article>
  );
}
