import { Tooltip as SystemTooltip } from '../../ui/widgets';
import type { ReactElement, ReactNode } from 'react';

interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  return (
    <SystemTooltip title={content ?? ''} placement={position}>
      {children}
    </SystemTooltip>
  );
}
