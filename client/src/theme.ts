import { createTheme } from '@mui/material/styles';

// ─── Design tokens matching styles.css :root ───────────────────────────────────
const bg       = '#111827';
const bgSubtle = '#1a2238';
const surface1 = '#222d47';
const surface2 = '#2a3656';
const surface3 = '#324066';

const border       = 'rgba(99, 102, 241, 0.30)';
const borderStrong = 'rgba(139, 92, 246, 0.55)';

const blue      = '#3b82f6';
const blueLight = '#60a5fa';
const violet    = '#8b5cf6';
const violetL   = '#a78bfa';
const mauve     = '#c084fc';

const text      = '#edf0f9';
const textMuted = '#a0aeca';
const textDim   = '#7d8ba8';

const success = '#34d399';
const warning = '#fbbf24';
const danger  = '#f87171';
const info    = '#60a5fa';

const noShadows = Array(25).fill('none') as unknown as import('@mui/material/styles').Shadows;

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: bg,
      paper: surface1,
    },
    primary: {
      main: violet,
      light: violetL,
    },
    secondary: {
      main: blue,
      light: blueLight,
    },
    error: {
      main: danger,
    },
    warning: {
      main: warning,
    },
    success: {
      main: success,
    },
    info: {
      main: info,
    },
    text: {
      primary: text,
      secondary: textMuted,
      disabled: textDim,
    },
    divider: border,
  },

  shape: {
    borderRadius: 0,
  },

  shadows: noShadows,

  typography: {
    fontFamily: "'Khand', 'Segoe UI', system-ui, sans-serif",
    fontSize: 15,
    h1: { fontFamily: "'Khand', sans-serif", fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.03em' },
    h2: { fontFamily: "'Khand', sans-serif", fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.03em' },
    h3: { fontFamily: "'Khand', sans-serif", fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.03em' },
    h4: { fontFamily: "'Khand', sans-serif", fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.03em' },
    h5: { fontFamily: "'Khand', sans-serif", fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.03em' },
    h6: { fontFamily: "'Khand', sans-serif", fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.03em' },
    body1: { fontFamily: "'Khand', 'Segoe UI', system-ui, sans-serif" },
    body2: { fontFamily: "'Khand', 'Segoe UI', system-ui, sans-serif" },
    button: { fontFamily: "'Khand', sans-serif", fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const },
    caption: { fontFamily: "'Share Tech Mono', monospace" },
    overline: { fontFamily: "'Share Tech Mono', monospace" },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Let styles.css handle global resets — avoid conflicts
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          fontFamily: "'Khand', sans-serif",
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
          borderRadius: 0,
          transition: 'color 150ms, background 150ms, border-color 150ms',
          '&:active:not(:disabled)': {
            transform: 'translateY(1px)',
          },
        },
        sizeSmall: {
          padding: '6px 12px',
          fontSize: '.78rem',
        },
        sizeMedium: {
          padding: '8px 16px',
          fontSize: '.85rem',
        },
        sizeLarge: {
          padding: '12px 24px',
          fontSize: '.95rem',
        },
        // Contained = gradient CTA
        contained: {
          backgroundColor: violet,
          color: '#fff',
          border: `1px solid ${violet}`,
          '&:hover': {
            backgroundColor: violetL,
            borderColor: violetL,
          },
        },
        // Outlined = secondary (border, inverts on hover)
        outlined: {
          backgroundColor: 'transparent',
          color: text,
          borderColor: textMuted,
          '&:hover': {
            backgroundColor: text,
            color: bg,
            borderColor: text,
          },
        },
        // Text = primary (animated underline)
        text: {
          backgroundColor: 'transparent',
          color: violet,
          paddingLeft: 0,
          paddingRight: 0,
          position: 'relative',
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 2,
            left: 0,
            right: 0,
            height: 2,
            background: violet,
            transform: 'scaleX(1)',
            transformOrigin: 'left',
            transition: 'transform 150ms',
          },
          '&:hover::after': {
            transform: 'scaleX(1.05)',
          },
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 0,
        },
      },
    },
    MuiChip: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          borderRadius: 0,
          fontFamily: "'Khand', sans-serif",
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase' as const,
          fontSize: '.68rem',
        },
      },
    },
    MuiTab: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          fontFamily: "'Khand', sans-serif",
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
          minHeight: 40,
          color: textMuted,
          '&.Mui-selected': {
            color: text,
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: violet,
          height: 2,
        },
      },
    },
    MuiDialog: {
      defaultProps: {
        PaperProps: {
          elevation: 0,
        },
      },
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          backgroundColor: surface2,
          border: `1px solid ${borderStrong}`,
          borderRadius: 0,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          backgroundColor: surface1,
          borderLeft: `1px solid ${border}`,
          borderRadius: 0,
        },
      },
    },
    MuiTooltip: {
      defaultProps: {
        arrow: false,
      },
      styleOverrides: {
        tooltip: {
          backgroundColor: surface3,
          border: `1px solid ${borderStrong}`,
          borderRadius: 0,
          fontSize: '.75rem',
          color: text,
          padding: '8px 12px',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
        variant: 'outlined',
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 0,
            '& fieldset': {
              borderColor: border,
            },
            '&:hover fieldset': {
              borderColor: borderStrong,
            },
            '&.Mui-focused fieldset': {
              borderColor: violet,
            },
          },
        },
      },
    },
    MuiSelect: {
      defaultProps: {
        size: 'small',
        variant: 'outlined',
      },
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
      },
    },
    MuiAccordion: {
      defaultProps: {
        disableGutters: true,
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
          borderRadius: '0 !important',
          '&::before': {
            display: 'none',
          },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          minHeight: 40,
          padding: '0 12px',
          '&.Mui-expanded': {
            minHeight: 40,
          },
        },
        content: {
          margin: '8px 0',
          '&.Mui-expanded': {
            margin: '8px 0',
          },
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 0,
          border: `1px solid ${border}`,
        },
      },
    },
    MuiToggleButton: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 0,
          fontFamily: "'Khand', sans-serif",
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase' as const,
          fontSize: '.68rem',
          color: textDim,
          borderColor: border,
          '&.Mui-selected': {
            color: text,
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            borderColor: borderStrong,
          },
          '&.Mui-selected:hover': {
            backgroundColor: 'rgba(139, 92, 246, 0.2)',
          },
        },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          color: violet,
          borderRadius: 0,
        },
        thumb: {
          borderRadius: 0,
          width: 12,
          height: 12,
        },
        track: {
          borderRadius: 0,
        },
        rail: {
          borderRadius: 0,
          opacity: 0.3,
        },
      },
    },
    MuiAppBar: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: bg,
          borderBottom: `1px solid ${border}`,
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: '56px !important',
        },
      },
    },
    MuiIconButton: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 0,
          color: textMuted,
          '&:hover': {
            color: text,
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
          },
        },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: {
          borderRadius: 0,
          fontFamily: "'Share Tech Mono', monospace",
          fontWeight: 600,
          fontSize: '.6rem',
        },
      },
    },
  },
});

// Re-export tokens for use in sx props
export const tokens = {
  bg, bgSubtle, surface1, surface2, surface3,
  border, borderStrong,
  blue, blueLight, violet, violetL, mauve,
  text, textMuted, textDim,
  success, warning, danger, info,
  gradient: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 55%, #c084fc 100%)',
  gradientDim: 'linear-gradient(135deg, rgba(59,130,246,.14) 0%, rgba(139,92,246,.14) 55%, rgba(192,132,252,.14) 100%)',
} as const;

export default theme;
