import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme, alpha } from '@mui/material/styles';
import { FONT_MONO } from '../../theme';

interface StatBarProps {
  label: string;
  value: string;
  /** Fill percentage 0–100 */
  fill: number;
  /** Domain hue for the gauge (theme.palette.domain.*). Defaults to the brand accent. */
  color?: string;
  ariaLabel?: string;
}

export function StatBar({ label, value, fill, color, ariaLabel }: StatBarProps) {
  const theme = useTheme();
  const clampedFill = Math.max(0, Math.min(100, fill));
  // Domain hue → single-hue gauge; default keeps the original brand gradient.
  const fillBackground = color
    ? `linear-gradient(90deg, ${alpha(color, 0.45)} 0%, ${color} 100%)`
    : `linear-gradient(90deg, ${theme.palette.secondary.main} 0%, ${theme.palette.primary.main} 100%)`;
  const valueColor = color ?? theme.palette.primary.main;

  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      role="meter"
      aria-label={ariaLabel ?? `${label}: ${value}`}
      aria-valuenow={clampedFill}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <Typography
        variant="caption"
        sx={{
          width: 80,
          flexShrink: 0,
          fontSize: '0.6875rem',
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontWeight: 600,
        }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          flex: 1,
          height: 6,
          backgroundColor: alpha(theme.palette.text.primary, 0.05),
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 0.5,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: `${clampedFill}%`,
            background: fillBackground,
            transition: 'width 400ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </Box>
      <Typography
        variant="caption"
        sx={{
          minWidth: 45,
          textAlign: 'right',
          fontFamily: FONT_MONO,
          fontVariantNumeric: 'tabular-nums',
          fontSize: '0.75rem',
          color: valueColor,
          fontWeight: 700,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
