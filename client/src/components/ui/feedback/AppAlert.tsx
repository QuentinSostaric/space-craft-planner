import type { ReactNode } from 'react';
import { Box, IconButton, alpha, useTheme, type SxValue } from '../../../ui/system';

export type AppAlertSeverity = 'error' | 'warning' | 'info' | 'success';

export interface AppAlertProps {
  severity?: AppAlertSeverity;
  children: ReactNode;
  /** Custom leading icon; pass `false` to hide the icon entirely. */
  icon?: ReactNode | false;
  action?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  className?: string;
  sx?: SxValue;
}

const DEFAULT_ICON: Record<AppAlertSeverity, string> = {
  error: 'pi-times-circle',
  warning: 'pi-exclamation-triangle',
  info: 'pi-info-circle',
  success: 'pi-check-circle',
};

export function AppAlert({
  severity = 'info',
  children,
  icon,
  action,
  onClose,
  closeLabel = 'Dismiss',
  className,
  sx,
}: AppAlertProps) {
  const theme = useTheme();
  const main = theme.palette[severity].main;
  // Urgent conditions interrupt (assertive); routine info/success announce politely.
  const isUrgent = severity === 'error' || severity === 'warning';

  return (
    <Box
      role={isUrgent ? 'alert' : 'status'}
      aria-live={isUrgent ? 'assertive' : 'polite'}
      className={className}
      sx={[{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        px: 1.75,
        py: 1.25,
        borderRadius: 1,
        border: `1px solid ${alpha(main, 0.4)}`,
        backgroundColor: alpha(main, 0.1),
        color: 'text.primary',
        fontFamily: theme.typography.fontFamily,
        fontSize: '0.8438rem',
      }, sx]}
    >
      {icon !== false && (icon ?? <i className={`pi ${DEFAULT_ICON[severity]}`} style={{ color: main, fontSize: '1rem', marginTop: 2 }} aria-hidden="true" />)}
      <Box sx={{ minWidth: 0, flex: 1 }}>{children}</Box>
      {action}
      {onClose && (
        <IconButton size="small" aria-label={closeLabel} onClick={onClose} sx={{ mt: -0.25 }}>
          <i className="pi pi-times" style={{ fontSize: '0.75rem' }} aria-hidden="true" />
        </IconButton>
      )}
    </Box>
  );
}

export default AppAlert;
