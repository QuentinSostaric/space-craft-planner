import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { tokens } from '../../theme';

interface StatBarProps {
  label: string;
  value: string;
  /** Fill percentage 0–100 */
  fill: number;
  ariaLabel?: string;
}

export function StatBar({ label, value, fill, ariaLabel }: StatBarProps) {
  const clampedFill = Math.max(0, Math.min(100, fill));

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
          fontSize: '0.75rem',
          color: tokens.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          flex: 1,
          height: 6,
          backgroundColor: tokens.surface2,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: `${clampedFill}%`,
            background: tokens.gradient,
            transition: 'width 300ms ease',
          }}
        />
      </Box>
      <Typography
        variant="caption"
        sx={{
          minWidth: 40,
          textAlign: 'right',
          fontSize: '0.75rem',
          color: tokens.blueLight,
          fontWeight: 600,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
