import { createTheme, alpha } from '@mui/material/styles';

export type ThemeMode = 'light' | 'dark';

// ─── Design Tokens ──────────────────────────────────────────────────────────────

const tokensDark = {
  bg: '#0f172a',
  bgSubtle: '#1e293b',
  surface1: '#1e293b',
  surface2: '#334155',
  surface3: '#475569',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: '#8b5cf6',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  violet: '#8b5cf6',
  violetL: '#a78bfa',
  blue: '#3b82f6',
  blueLight: '#60a5fa',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  gradient: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
  rarityLegendary: '#f59e0b',
  rarityRare: '#8b5cf6',
  rarityCommon: '#64748b',
};

const tokensLight = {
  bg: '#f8fafc',
  bgSubtle: '#f1f5f9',
  surface1: '#ffffff',
  surface2: '#f1f5f9',
  surface3: '#e2e8f0',
  border: 'rgba(0, 0, 0, 0.08)',
  borderStrong: '#7c3aed',
  text: '#0f172a',
  textMuted: '#475569',
  textDim: '#64748b',
  violet: '#7c3aed',
  violetL: '#8b5cf6',
  blue: '#2563eb',
  blueLight: '#3b82f6',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
  info: '#2563eb',
  gradient: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
  rarityLegendary: '#d97706',
  rarityRare: '#7c3aed',
  rarityCommon: '#64748b',
};

export const getTokens = (mode: ThemeMode) => (mode === 'dark' ? tokensDark : tokensLight);

const noShadows = Array(25).fill('none') as unknown as import('@mui/material/styles').Shadows;

export const createAppTheme = (mode: ThemeMode) => {
  const t = getTokens(mode);

  return createTheme({
    palette: {
      mode,
      background: {
        default: t.bg,
        paper: t.surface1,
      },
      primary: {
        main: t.violet,
        light: t.violetL,
      },
      secondary: {
        main: t.blue,
        light: t.blueLight,
      },
      error: {
        main: t.danger,
      },
      warning: {
        main: t.warning,
      },
      success: {
        main: t.success,
      },
      text: {
        primary: t.text,
        secondary: t.textMuted,
        disabled: t.textDim,
      },
      divider: t.border,
    },

    shape: {
      borderRadius: 4,
    },

    shadows: noShadows,

    typography: {
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      fontSize: 14,
      h1: { fontFamily: "'Khand', sans-serif", fontWeight: 700, lineHeight: 1.1, textTransform: 'uppercase' },
      h2: { fontFamily: "'Khand', sans-serif", fontWeight: 700, lineHeight: 1.1, textTransform: 'uppercase' },
      h3: { fontFamily: "'Khand', sans-serif", fontWeight: 700, lineHeight: 1.1, textTransform: 'uppercase' },
      h4: { fontFamily: "'Khand', sans-serif", fontWeight: 700, lineHeight: 1.2, textTransform: 'uppercase' },
      h5: { fontFamily: "'Khand', sans-serif", fontWeight: 700, lineHeight: 1.2, textTransform: 'uppercase' },
      h6: { fontFamily: "'Khand', sans-serif", fontWeight: 700, lineHeight: 1.2, textTransform: 'uppercase' },
      body1: { lineHeight: 1.5 },
      body2: { lineHeight: 1.5 },
      button: { fontFamily: "'Khand', sans-serif", fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' },
      caption: { fontFamily: "'Share Tech Mono', monospace", letterSpacing: '0.02em' },
      overline: { fontFamily: "'Share Tech Mono', monospace" },
    },

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: t.bg,
            color: t.text,
            transition: 'background-color 200ms cubic-bezier(0.4, 0, 0.2, 1), color 200ms cubic-bezier(0.4, 0, 0.2, 1)',
            '&::before': mode === 'dark' ? {
              content: '""',
              position: 'fixed',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 0,
              opacity: 0.03,
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            } : {},
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true, disableRipple: true },
        styleOverrides: {
          root: {
            borderRadius: 2,
            padding: '8px 20px',
            transition: 'all 150ms ease',
            '&:active': { transform: 'translateY(1px)' },
          },
          containedPrimary: {
            background: `linear-gradient(135deg, ${t.blue} 0%, ${t.violet} 100%)`,
            color: '#fff',
            border: 'none',
            '&:hover': {
              background: `linear-gradient(135deg, ${t.blueLight} 0%, ${t.violetL} 100%)`,
              boxShadow: `0 4px 12px ${alpha(t.violet, 0.3)}`,
            },
          },
          outlined: {
            borderColor: t.border,
            '&:hover': {
              borderColor: t.violet,
              backgroundColor: alpha(t.violet, 0.04),
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            border: `1px solid ${t.border}`,
            backgroundColor: t.surface1,
            backgroundImage: 'none',
            transition: 'transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease',
            '&:hover': {
              borderColor: alpha(t.violet, 0.4),
              boxShadow: mode === 'dark' 
                ? `0 8px 24px rgba(0,0,0,0.4)`
                : `0 8px 24px rgba(0,0,0,0.08)`,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderRadius: 2,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: alpha(t.bg, 0.8),
            backdropFilter: 'blur(12px)',
            borderBottom: `1px solid ${t.border}`,
            color: t.text,
          },
        },
      },
      MuiToolbar: {
        styleOverrides: {
          root: {
            minHeight: '64px !important',
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            borderRadius: 2,
            border: `1px solid ${t.border}`,
            color: t.textDim,
            '&.Mui-selected': {
              color: t.violet,
              backgroundColor: alpha(t.violet, 0.08),
              borderColor: t.violet,
              '&:hover': {
                backgroundColor: alpha(t.violet, 0.12),
              },
            },
          },
        },
      },
    },
  });
};

// Re-export for legacy sx use (careful, these won't change unless we use theme.palette)
// It's better to use theme => theme.palette... in sx props
export const tokens = tokensDark; // Keep for fallback, but deprecated
