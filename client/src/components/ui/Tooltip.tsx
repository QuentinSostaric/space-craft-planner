import type { AriaAttributes, ReactElement, ReactNode } from 'react';
import { AppTooltip } from './overlays/AppTooltip';

export interface TooltipProps {
  content: ReactNode;
  children: ReactElement<{ className?: string } & AriaAttributes>;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  return (
    <AppTooltip content={content} position={position}>
      {children}
    </AppTooltip>
  );
}
