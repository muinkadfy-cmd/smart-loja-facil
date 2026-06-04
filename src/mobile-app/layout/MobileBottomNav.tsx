import type { PageKey } from '../../types';
import { getMobileRoute } from '../mobileAppRoutes';
import { InlineIcon } from '../components/InlineIcon';

interface MobileBottomNavProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  onOpenMore: () => void;
}

const bottomKeys: PageKey[] = ['dashboard', 'sales', 'products', 'customers'];

export function MobileBottomNav({ activePage, onNavigate, onOpenMore }: MobileBottomNavProps): JSX.Element {
  const moreActive = !bottomKeys.includes(activePage);

  return (
    <nav className="mapp-bottom-nav" aria-label="Navegação principal">
      {bottomKeys.map((key) => {
        const route = getMobileRoute(key);
        const active = activePage === key;
        return (
          <button key={key} type="button" className={active ? 'active' : ''} onClick={() => onNavigate(key)}>
            <InlineIcon name={route.icon} size={24} />
            <span>{route.shortLabel}</span>
          </button>
        );
      })}
      <button type="button" className={moreActive ? 'active' : ''} onClick={onOpenMore}>
        <InlineIcon name="configuracoes" size={24} />
        <span>Mais</span>
      </button>
    </nav>
  );
}
