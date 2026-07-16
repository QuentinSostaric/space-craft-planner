import { useState } from 'react';
import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTheme, alpha } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import { FONT_DISPLAY, FONT_MONO } from '../../theme';

export interface PanelProps {
  children: ReactNode;
  eyebrow?: string;
  title?: ReactNode;
  subtitle?: string;
  action?: ReactNode;
  /**
   * Hero value: the panel's single headline number, rendered big and bold
   * on the right side of the header (before `action`).
   */
  heroValue?: ReactNode;
  /** Small muted unit/context rendered right after the hero value. */
  heroUnit?: string;
  /**
   * Domain accent color (CSS color). Tints the panel's left edge, the
   * eyebrow tick and the hero value — use theme.palette.domain.* hues.
   */
  accent?: string;
  /** Show a chevron in the header that collapses the panel body. */
  collapsible?: boolean;
  defaultCollapsed?: boolean;
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
  heroValue,
  heroUnit,
  accent,
  collapsible = false,
  defaultCollapsed = false,
  noPad = false,
  dense = false,
  variant = 'default',
  component,
  sx,
  className,
}: PanelProps) {
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

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

  const hasHeader = eyebrow != null || title != null || subtitle != null || action != null
    || heroValue != null || collapsible;

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
        ...(accent && {
          boxShadow: `inset 2px 0 0 0 ${accent}`,
        }),
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
            borderBottom: collapsed ? 'none' : `1px solid ${theme.palette.ui.border}`,
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
                    height: accent ? 2 : 1,
                    flexShrink: 0,
                    backgroundColor: accent ?? theme.palette.text.disabled,
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

          {/* Right: hero value + action + collapse chevron */}
          {(heroValue != null || action || collapsible) && (
            <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
              {heroValue != null && (
                <Typography
                  component="div"
                  sx={{
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 800,
                    fontSize: dense ? '1.0625rem' : '1.25rem',
                    lineHeight: 1,
                    letterSpacing: '-0.01em',
                    fontVariantNumeric: 'tabular-nums',
                    color: 'text.primary',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 0.5,
                  }}
                >
                  {heroValue}
                  {heroUnit && (
                    <Box
                      component="span"
                      sx={{
                        fontFamily: FONT_MONO,
                        fontWeight: 500,
                        fontSize: '0.6875rem',
                        letterSpacing: '0.04em',
                        color: accent ?? theme.palette.text.disabled,
                      }}
                    >
                      {heroUnit}
                    </Box>
                  )}
                </Typography>
              )}
              {action}
              {collapsible && (
                <IconButton
                  size="small"
                  onClick={() => setCollapsed((prev) => !prev)}
                  aria-expanded={!collapsed}
                  sx={{ p: 0.25 }}
                >
                  <ExpandMoreIcon
                    sx={{
                      fontSize: 18,
                      transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                      transition: 'transform 180ms ease',
                    }}
                  />
                </IconButton>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* Body */}
      <Collapse in={!collapsible || !collapsed} timeout={180} unmountOnExit={false}>
        <Box sx={noPad ? undefined : { p: dense ? 1.5 : 2.5 }}>
          {children}
        </Box>
      </Collapse>
    </PaperAs>
  );
}

export default Panel;
