import type { PageKey } from '../../types';
import { getMobileRoute } from '../mobileAppRoutes';
import { InlineIcon } from '../components/InlineIcon';

interface MobileBottomNavProps {
  activePage: PageKey;
  pendingCounts: Partial<Record<PageKey, number>>;
  onNavigate: (page: PageKey) => void;
  onOpenMore: () => void;
}

const bottomKeys: PageKey[] = ['dashboard', 'sales', 'products', 'customers'];

function pendingBadge(count: number): string {
  return count > 99 ? '99+' : String(count);
}

export function MobileBottomNav({ activePage, pendingCounts, onNavigate, onOpenMore }: MobileBottomNavProps): JSX.Element {
  const moreActive = !bottomKeys.includes(activePage);
  const morePending = Object.entries(pendingCounts).reduce((sum, [key, value]) => (
    bottomKeys.includes(key as PageKey) ? sum : sum + Math.max(0, Number(value || 0))
  ), 0);

  return (
    <nav className="mapp-bottom-nav" aria-label="Navegação principal">
      {bottomKeys.map((key) => {
        const route = getMobileRoute(key);
        const active = activePage === key;
        const pending = Math.max(0, Number(pendingCounts[key] || 0));
        return (
          <button key={key} type="button" className={[active ? 'active' : '', pending > 0 ? 'has-pending' : ''].filter(Boolean).join(' ')} onClick={() => onNavigate(key)}>
            <InlineIcon name={route.icon} size={24} />
            <span>{route.shortLabel}</span>
            {pending > 0 ? <em>{pendingBadge(pending)}</em> : null}
          </button>
        );
      })}
      <button type="button" className={[moreActive ? 'active' : '', morePending > 0 ? 'has-pending' : ''].filter(Boolean).join(' ')} onClick={onOpenMore}>
        <InlineIcon name="configuracoes" size={24} />
        <span>Mais</span>
        {morePending > 0 ? <em>{pendingBadge(morePending)}</em> : null}
      </button>
    </nav>
  );
}
