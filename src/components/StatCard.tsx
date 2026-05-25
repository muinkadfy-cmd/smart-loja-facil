import React from 'react';
import { AppIcon } from './AppIcon';
import type { DelphiIconName } from '../lib/icons';

interface StatCardProps { icon: DelphiIconName; label: string; value: string; hint: string; tone?: 'blue' | 'green' | 'purple' | 'yellow' | 'red'; }

export function StatCard({ icon, label, value, hint, tone = 'blue' }: StatCardProps): JSX.Element {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-icon" aria-hidden="true">
        <AppIcon name={icon} size={48} className="app-icon-stat" />
      </div>
      <div><span className="muted micro-label">{label}</span><strong>{value}</strong><small>{hint}</small></div>
    </article>
  );
}
