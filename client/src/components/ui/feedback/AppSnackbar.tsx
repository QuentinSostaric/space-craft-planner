import { Message } from 'primereact/message';
import { useEffect, type ReactNode } from 'react';
import { Box, useTheme, type SxValue } from '../../../ui/system';
import { compilePrimePartClasses, compilePrimeRootClass, type PrimePartStyles } from '../../../ui/prime/passThrough';

type AppSnackbarPart = 'root' | 'wrapper' | 'icon' | 'text' | 'button';

export interface AppSnackbarProps {
  open: boolean;
  onClose?: (reason: 'timeout') => void;
  autoHideDuration?: number | null;
  severity?: 'success' | 'info' | 'warn' | 'error' | 'secondary' | 'contrast';
  children: ReactNode;
  action?: ReactNode;
  role?: 'alert' | 'status';
  ariaLive?: 'off' | 'polite' | 'assertive';
  sx?: SxValue;
  partSx?: PrimePartStyles<AppSnackbarPart>;
}

export function AppSnackbar({
  open,
  onClose,
  autoHideDuration = null,
  severity = 'info',
  children,
  action,
  role = severity === 'error' ? 'alert' : 'status',
  ariaLive = severity === 'error' ? 'assertive' : 'polite',
  sx,
  partSx,
}: AppSnackbarProps) {
  const theme = useTheme();

  useEffect(() => {
    if (!open || autoHideDuration == null || !onClose) return undefined;
    const timer = window.setTimeout(() => onClose('timeout'), autoHideDuration);
    return () => window.clearTimeout(timer);
  }, [autoHideDuration, onClose, open]);

  if (!open) return null;

  return (
    <Box
      role={role}
      aria-live={ariaLive}
      sx={[
        {
          position: 'fixed',
          zIndex: (currentTheme) => currentTheme.zIndex.snackbar,
          right: { xs: 1.5, sm: 3 },
          bottom: { xs: 1.5, sm: 3 },
          width: { xs: 'calc(100vw - 24px)', sm: 'min(520px, calc(100vw - 48px))' },
          maxWidth: 520,
        },
        sx,
      ]}
    >
      <Message
        severity={severity}
        content={(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', minWidth: 0 }}>
            <Box sx={{ minWidth: 0, flex: 1 }}>{children}</Box>
            {action ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
          </Box>
        )}
        className={compilePrimeRootClass(theme, { width: '100%' })}
        pt={compilePrimePartClasses(theme, partSx)}
      />
    </Box>
  );
}
