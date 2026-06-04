import type { PageKey } from '../../types';
import type { DelphiIconName } from '../../lib/icons';
import { InlineIcon } from './InlineIcon';

interface ActionTileProps {
  label: string;
  icon: DelphiIconName;
  tone?: string;
  page: PageKey;
  intent?: string;
  onNavigate: (page: PageKey) => void;
}

export function ActionTile({ label, icon, tone = 'blue', page, intent, onNavigate }: ActionTileProps): JSX.Element {
  function handleClick() {
    if (intent) window.location.hash = intent;
    onNavigate(page);
  }

  return (
    <button type="button" className={`mapp-action-tile tone-${tone}`} onClick={handleClick}>
      <span><InlineIcon name={icon} size={24} /></span>
      <strong>{label}</strong>
    </button>
  );
}
