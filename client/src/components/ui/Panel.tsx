import type { ReactNode, HTMLAttributes } from 'react';
import Paper from '@mui/material/Paper';
import { useTheme, alpha } from '@mui/material/styles';

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'raised' | 'sunken';
  glow?: boolean;
  noPad?: boolean;
}

export function Panel({ children, variant = 'default', glow = false, noPad = false, className, ...rest }: PanelProps) {
  const theme = useTheme();

  const VARIANT_SX = {
    default: {
      backgroundColor: theme.palette.ui.surface1,
      border: `1px solid ${theme.palette.ui.border}`,
    },
    raised: {
      backgroundColor: theme.palette.ui.surface2,
      border: `1px solid ${theme.palette.ui.borderStrong}`,
    },
    sunken: {
      backgroundColor: alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.6 : 0.4),
      border: '1px solid transparent',
    },
  };

  return (
    <Paper
      elevation={0}
      className={className}
      sx={{
        ...VARIANT_SX[variant],
        ...(glow && { borderColor: theme.palette.primary.main }),
        padding: noPad ? 0 : theme.spacing(2),
        transition: 'all 200ms ease',
      }}
      {...rest}
    >
      {children}
    </Paper>
  );
}
