import { ValueFeedback } from './ValueFeedback';
import { Box, Paper, Typography, useTheme } from '../../ui/system';
import type { Palette } from '../../ui/system';
import type { ReactNode } from 'react';
import { FONT_MONO, TEXT_LABEL, TEXT_LABEL_SM } from '../../theme';

export function PageStatCard({
  label,
  value,
  hint,
  trend,
  icon,
  accent: accentProp,
  domain,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: string;
  icon?: ReactNode;
  /** Domain accent color for the left strip (any CSS color). Defaults to the brand accent. */
  accent?: string;
  /** Named functional hue from theme.palette.domain — preferred over raw `accent`. */
  domain?: keyof Palette['domain'];
}) {
  const theme = useTheme();
  const accent = accentProp ?? (domain ? theme.palette.domain[domain] : undefined);
  return (
    <Paper
      variant="outlined"
      className="workspace-stat"
      sx={{
        px: 1.5,
        py: 1,
        minWidth: 0,
        minHeight: 46,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'center',
        columnGap: 1.5,
        backgroundColor: 'transparent',
        borderColor: 'divider',
        position: 'relative',
        overflow: 'hidden',
        // Domain accent strip — only rendered when a functional hue is given
        ...(accent && {
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: accent,
            opacity: 0.8,
          },
        }),
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
          mb: 0,
        }}
      >
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Typography
          sx={{
            fontFamily: FONT_MONO,
            fontWeight: 700,
            fontSize: '1.125rem',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
            color: 'text.primary',
          }}
        >
          <ValueFeedback value={value} />
        </Typography>
        {icon && (
          <Box sx={{ color: accent ?? 'text.disabled', opacity: accent ? 0.9 : 1, mt: 0.25, flexShrink: 0 }}>{icon}</Box>
        )}
      </Box>
      {(trend || hint) && (
        <Typography
          sx={{
            mt: 0.5,
            gridColumn: '1 / -1',
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
