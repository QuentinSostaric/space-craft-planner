import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { FONT_DISPLAY, FONT_MONO, TEXT_LABEL, TEXT_LABEL_SM } from '../../theme';

export function PageStatCard({
  label,
  value,
  hint,
  trend,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: string;
  icon?: ReactNode;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        px: { xs: 1.5, md: 2 },
        py: { xs: 1, md: 1.25 },
        minWidth: 0,
        minHeight: { xs: 64, md: 72 },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: 'ui.surface',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          color: 'text.secondary',
          fontWeight: 500,
          fontSize: TEXT_LABEL,
          letterSpacing: 0,
          mb: { xs: 0.5, md: 0.75 },
        }}
      >
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Typography
          sx={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: { xs: '1.25rem', md: '1.5rem' },
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: 'text.primary',
          }}
        >
          {value}
        </Typography>
        {icon && (
          <Box sx={{ color: 'text.disabled', mt: 0.25, flexShrink: 0 }}>{icon}</Box>
        )}
      </Box>
      {(trend || hint) && (
        <Typography
          sx={{
            mt: 0.5,
            fontSize: TEXT_LABEL_SM,
            color: trend ? (trend.startsWith('+') ? 'success.main' : 'error.main') : 'text.secondary',
          }}
        >
          {trend && <Box component="span" sx={{ fontFamily: FONT_MONO, fontWeight: 700, mr: 0.5 }}>{trend}</Box>}
          {hint}
        </Typography>
      )}
    </Paper>
  );
}
