import React, { useEffect, useMemo, useState } from 'react';
import { DelphiIconName, DelphiIconSize, delphiIconSrc } from '../lib/icons';

interface AppIconProps {
  name: DelphiIconName;
  size: DelphiIconSize;
  alt?: string;
  className?: string;
}

export function AppIcon({ name, size, alt = '', className }: AppIconProps): JSX.Element {
  const candidates = useMemo(
    () => Array.from(new Set([size, 64, 48, 32, 24, 16])) as number[],
    [size],
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAttempt(0);
  }, [name, size]);

  const currentSize = candidates[Math.min(attempt, candidates.length - 1)] as DelphiIconSize;

  return (
    <img
      src={delphiIconSrc(name, currentSize)}
      alt={alt}
      width={size}
      height={size}
      className={className}
      loading="eager"
      decoding="async"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        display: 'block',
        objectFit: 'contain',
      }}
      onError={() => {
        if (attempt < candidates.length - 1) setAttempt((value) => value + 1);
      }}
    />
  );
}
