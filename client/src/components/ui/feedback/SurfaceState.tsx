import type { ReactNode } from 'react';
import { Box, Typography, type SxValue } from '../../../ui/system';
import { AppButton } from '../controls/AppButton';
import { AppProgressSpinner } from './AppProgress';
import { Panel } from '../Panel';

export type SurfaceStateTone = 'neutral' | 'loading' | 'error';

export interface SurfaceStateProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  tone?: SurfaceStateTone;
  actionLabel?: string;
  onAction?: () => void;
  live?: 'polite' | 'assertive' | 'off';
  sx?: SxValue;
}

export function SurfaceState({
  title,
  description,
  icon,
  tone = 'neutral',
  actionLabel,
  onAction,
  live,
  sx,
}: SurfaceStateProps) {
  const resolvedLive = live ?? (tone === 'error' ? 'assertive' : tone === 'loading' ? 'polite' : 'off');
  const statusIcon = icon ?? (tone === 'loading' ? <AppProgressSpinner size={28} strokeWidth={3} /> : null);

  return (
    <Panel
      component="section"
      variant="sunken"
      sx={[
        {
          width: '100%',
          maxWidth: 520,
          mx: 'auto',
          borderColor: tone === 'error' ? 'error.main' : undefined,
        },
        sx,
      ]}
    >
      <Box
        role={tone === 'error' ? 'alert' : 'status'}
        aria-live={resolvedLive}
        aria-busy={tone === 'loading' ? true : undefined}
        sx={{ textAlign: 'center', py: 1.5 }}
      >
        {statusIcon != null && <Box sx={{ color: tone === 'error' ? 'error.main' : 'primary.main', mb: 1.25 }}>{statusIcon}</Box>}
        <Typography variant="h6" sx={{ color: tone === 'error' ? 'error.main' : 'text.primary', mb: description ? 0.75 : 0 }}>
          {title}
        </Typography>
        {description != null && (
          <Typography component="div" variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
            {description}
          </Typography>
        )}
        {actionLabel && onAction && (
          <AppButton variant={tone === 'error' ? 'danger' : 'secondary'} size="sm" onClick={onAction} sx={{ mt: 2 }}>
            {actionLabel}
          </AppButton>
        )}
      </Box>
    </Panel>
  );
}

export default SurfaceState;
