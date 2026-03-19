import type { ReactElement, ReactNode } from 'react';
import MuiTooltip from '@mui/material/Tooltip';

interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  return (
    <MuiTooltip title={content} placement={position}>
      {children}
    </MuiTooltip>
  );
}
