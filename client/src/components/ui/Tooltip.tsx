import { forwardRef } from 'react';
import type { ReactElement, ReactNode } from 'react';
import MuiTooltip from '@mui/material/Tooltip';

interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(
  function Tooltip({ content, children, position = 'top' }, ref) {
    return (
      <MuiTooltip
        ref={ref}
        title={content ?? ''}
        placement={position}
        enterDelay={400}
        enterNextDelay={200}
      >
        {children}
      </MuiTooltip>
    );
  },
);
