import { createTheme, alpha } from '@mui/material/styles';

// ─── Module Augmentation ──────────────────────────────────────────────────────
// On étend le thème pour inclure nos variables spécifiques de Star Citizen
declare module '@mui/material/styles' {
  interface Palette {
    brand: {
      violet: string;
      violetLight: string;
      blue: string;
      blueLight: string;
    };
    ui: {
      border: string;
      borderStrong: string;
      surface1: string;
      surface2: string;
      surface3: string;
    };
  }
  interface PaletteOptions {
    brand?: {
      violet?: string;
      violetLight?: string;
      blue?: string;
      blueLight?: string;
    };
    ui?: {
      border?: string;
      borderStrong?: string;
      surface1?: string;
      surface2?: string;
      surface3?: string;
    };
  }
}

export type ThemeMode = 'light' | 'dark';

// ─── Font Families ──────────────────────────────────────────────────────────────
export const FONT_HEADING = "'Khand', sans-serif";
export const FONT_MONO = "'Share Tech Mono', monospace";

// ─── Design Tokens ──────────────────────────────────────────────────────────────

const COLORS = {
  violet: '#818cf8',
  violetDark: '#4f46e5',
  violetLight: '#a5b4fc',
  blue: '#3b82f6',
  blueDark: '#2563eb',
  blueLight: '#60a5fa',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#ef4444',
};

const PALETTE_DARK = {
  background: {
    default: '#0b0f1a',
    paper: '#1a2235',
  },
  text: {
    primary: '#f1f5f9',
    secondary: '#94a3b8',
    disabled: '#64748b',
  },
  divider: 'rgba(255, 255, 255, 0.06)',
  ui: {
    border: 'rgba(255, 255, 255, 0.06)',
    borderStrong: COLORS.violet,
    surface1: '#1a2235',
    surface2: '#242f4d',
    surface3: '#2d3a5d',
  },
  brand: {
    violet: COLORS.violet,
    violetLight: COLORS.violetLight,
    blue: COLORS.blue,
    blueLight: COLORS.blueLight,
  }
};

const PALETTE_LIGHT = {
  background: {
    default: '#f8fafc',
    paper: '#ffffff',
  },
  text: {
    primary: '#0f172a',
    secondary: '#475569',
    disabled: '#64748b',
  },
  divider: 'rgba(0, 0, 0, 0.08)',
  ui: {
    border: 'rgba(0, 0, 0, 0.08)',
    borderStrong: COLORS.violetDark,
    surface1: '#ffffff',
    surface2: '#f1f5f9',
    surface3: '#e2e8f0',
  },
  brand: {
    violet: COLORS.violetDark,
    violetLight: COLORS.violet,
    blue: COLORS.blueDark,
    blueLight: COLORS.blue,
  }
};

// ─── Create Theme ────────────────────────────────────────────────────────────

export const createAppTheme = (mode: ThemeMode) => {
  const p = mode === 'dark' ? PALETTE_DARK : PALETTE_LIGHT;

  return createTheme({
    palette: {
      mode,
      ...p,
      primary: {
        main: p.brand.violet,
        light: p.brand.violetLight,
      },
      secondary: {
        main: p.brand.blue,
        light: p.brand.blueLight,
      },
      error: { main: COLORS.rose },
      warning: { main: COLORS.amber },
      success: { main: COLORS.emerald },
      info: { main: COLORS.blue },
    },

    shape: {
      borderRadius: 4,
    },

    shadows: Array(25).fill('none') as any,

    typography: {
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      fontSize: 14,
      h1: { fontFamily: FONT_HEADING, fontWeight: 700, textTransform: 'uppercase' },
      h2: { fontFamily: FONT_HEADING, fontWeight: 700, textTransform: 'uppercase' },
      h3: { fontFamily: FONT_HEADING, fontWeight: 700, textTransform: 'uppercase' },
      h4: { fontFamily: FONT_HEADING, fontWeight: 700, textTransform: 'uppercase' },
      h5: { fontFamily: FONT_HEADING, fontWeight: 700, textTransform: 'uppercase' },
      h6: { fontFamily: FONT_HEADING, fontWeight: 700, textTransform: 'uppercase' },
      button: { fontFamily: FONT_HEADING, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' },
      caption: { fontFamily: FONT_MONO, letterSpacing: '0.02em' },
      overline: { fontFamily: FONT_MONO },
    },

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: p.background.default,
            color: p.text.primary,
            transition: 'background-color 200ms ease, color 200ms ease',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true, disableRipple: true },
        styleOverrides: {
          root: {
            borderRadius: 2,
            '&:active': { transform: 'translateY(1px)' },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: p.ui.surface1,
            borderBottom: `1px solid ${p.ui.border}`,
            backgroundImage: 'none',
            color: p.text.primary,
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            borderColor: p.ui.border,
            '&.Mui-selected': {
              backgroundColor: alpha(p.brand.violet, 0.1),
              color: p.brand.violet,
              '&:hover': {
                backgroundColor: alpha(p.brand.violet, 0.2),
              },
            },
          },
        },
      },
    },
  });
};
