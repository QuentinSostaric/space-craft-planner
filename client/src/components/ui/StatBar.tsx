import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme, alpha } from '@mui/material/styles';
import { TEXT_LABEL } from '../../theme';

interface StatBarProps {
  label: string;
  value: string;
  /** Fill percentage 0–100 */
  fill: number;
  ariaLabel?: string;
}

export function StatBar({ label, value, fill, ariaLabel }: StatBarProps) {
  const theme = useTheme();
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
          fontSize: TEXT_LABEL,
          color: 'text.secondary',
          fontWeight: 500,
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
            background: `linear-gradient(90deg, ${theme.palette.secondary.main} 0%, ${theme.palette.primary.main} 100%)`,
            transition: 'width 400ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </Box>
      <Typography
        variant="caption"
        sx={{
          minWidth: 45,
          textAlign: 'right',
          fontSize: TEXT_LABEL,
          color: 'primary.main',
          fontWeight: 700,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
