import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { FONT_HEADING } from '../../theme';

export function PageStatCard({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        px: { xs: 1, md: 1.5 },
        py: { xs: 0.9, md: 1.25 },
        minWidth: 0,
        minHeight: { xs: 64, md: 72 },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: 'background.paper',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: { xs: '0.1em', md: '0.12em' },
          fontSize: '0.75rem',
          mb: { xs: 0.5, md: 0.75 },
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontFamily: FONT_HEADING,
          fontWeight: 700,
          fontSize: { xs: '1rem', md: '1.35rem' },
          lineHeight: 1,
          color: 'text.primary',
        }}
      >
        {value}
      </Typography>
    </Paper>
  );
}
