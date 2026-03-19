import type { ReactNode, HTMLAttributes } from 'react';
import Paper from '@mui/material/Paper';
import type { SxProps, Theme } from '@mui/material/styles';
import { tokens } from '../../theme';

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'raised' | 'sunken';
  glow?: boolean;
  noPad?: boolean;
}

const VARIANT_SX: Record<string, SxProps<Theme>> = {
  default: {
    backgroundColor: tokens.surface1,
    border: `1px solid ${tokens.border}`,
  },
  raised: {
    backgroundColor: tokens.surface2,
    border: `1px solid ${tokens.borderStrong}`,
  },
  sunken: {
    backgroundColor: 'rgba(17,24,39,.6)',
    border: '1px solid transparent',
  },
};

export function Panel({ children, variant = 'default', glow = false, noPad = false, className, ...rest }: PanelProps) {
  return (
    <Paper
      elevation={0}
      className={className}
      sx={{
        ...VARIANT_SX[variant],
        ...(glow && { borderColor: tokens.violet }),
        padding: noPad ? 0 : '16px',
      }}
      {...rest}
    >
      {children}
    </Paper>
  );
}
