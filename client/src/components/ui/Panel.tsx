import type { ReactNode, HTMLAttributes } from 'react';

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'raised' | 'sunken';
  glow?: boolean;
  noPad?: boolean;
}

export function Panel({ children, variant = 'default', glow = false, noPad = false, className = '', ...rest }: PanelProps) {
  return (
    <div
      className={['panel', `panel--${variant}`, glow && 'panel--glow', noPad && 'panel--no-pad', className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}
