import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useTheme, alpha } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import { FONT_DISPLAY, FONT_MONO } from '../../theme';

export interface PanelProps {
  children: ReactNode;
  eyebrow?: string;
  title?: ReactNode;
  subtitle?: string;
  action?: ReactNode;
  noPad?: boolean;
  dense?: boolean;
  variant?: 'default' | 'raised' | 'sunken';
  /** Allow rendering as a different root element (e.g. "section", "article"). */
  component?: React.ElementType;
  sx?: SxProps<Theme>;
  /** Legacy pass-through: class name applied to the root Paper. */
  className?: string;
}

export function Panel({
  children,
  eyebrow,
  title,
  subtitle,
  action,
  noPad = false,
  dense = false,
  variant = 'default',
  component,
  sx,
  className,
}: PanelProps) {
  const theme = useTheme();

  const VARIANT_SX = {
    default: {
      backgroundColor: theme.palette.ui.surface,
      border: `1px solid ${theme.palette.ui.border}`,
    },
    raised: {
      backgroundColor: theme.palette.ui.surface2,
      border: `1px solid ${theme.palette.ui.borderStrong}`,
    },
    sunken: {
      backgroundColor: alpha(
        theme.palette.background.default,
        theme.palette.mode === 'dark' ? 0.6 : 0.4,
      ),
      border: '1px solid transparent',
    },
  };

  const hasHeader = eyebrow != null || title != null || subtitle != null || action != null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const PaperAs = Paper as any;

  return (
    <PaperAs
      elevation={0}
      component={component}
      className={className}
      sx={{
        ...VARIANT_SX[variant],
        padding: hasHeader || noPad ? 0 : dense ? theme.spacing(1.25) : theme.spacing(2),
        transition: 'all 200ms ease',
        overflow: 'hidden',
        ...sx,
      }}
    >
      {hasHeader && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            px: dense ? 1.5 : 2.5,
            py: dense ? 1 : 1.5,
            borderBottom: `1px solid ${theme.palette.ui.border}`,
          }}
        >
          {/* Left: eyebrow + title + subtitle */}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {eyebrow && (
              <Typography
                variant="overline"
                sx={{
                  fontFamily: FONT_MONO,
                  fontSize: '0.6875rem',
                  letterSpacing: '0.08em',
                  color: 'text.disabled',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  mb: 0.25,
                  '&::before': {
                    content: '""',
                    display: 'block',
                    width: 14,
                    height: 1,
                    flexShrink: 0,
                    backgroundColor: theme.palette.text.disabled,
                  },
                }}
              >
                {eyebrow}
              </Typography>
            )}
            {title != null && (
              typeof title === 'string' ? (
                <Typography
                  sx={{
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 600,
                    fontSize: '0.9688rem',
                    lineHeight: 1.25,
                    color: 'text.primary',
                  }}
                >
                  {title}
                </Typography>
              ) : (
                title
              )
            )}
            {subtitle && (
              <Typography
                variant="caption"
                sx={{
                  color: 'text.disabled',
                  display: 'block',
                  fontSize: '0.75rem',
                  mt: 0.25,
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>

          {/* Right: action */}
          {action && (
            <Box sx={{ flexShrink: 0 }}>
              {action}
            </Box>
          )}
        </Box>
      )}

      {/* Body */}
      <Box sx={noPad ? undefined : { p: dense ? 1.5 : 2.5 }}>
        {children}
      </Box>
    </PaperAs>
  );
}

export default Panel;
