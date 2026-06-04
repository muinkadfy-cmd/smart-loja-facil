import { AppIcon } from '../../components/AppIcon';
import type { DelphiIconName } from '../../lib/icons';

interface InlineIconProps {
  name: DelphiIconName;
  size?: 16 | 24 | 32 | 48 | 64;
  className?: string;
}

export function InlineIcon({ name, size = 24, className }: InlineIconProps): JSX.Element {
  return <AppIcon name={name} size={size} className={className} />;
}
