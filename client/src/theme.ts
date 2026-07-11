import { createTheme, alpha } from '@mui/material/styles';
import type { Shadows } from '@mui/material/styles';

// ─── Module Augmentation ──────────────────────────────────────────────────────
declare module '@mui/material/styles' {
  interface Palette {
    brand: {
      accent: string;
      accentHover: string;
      accentSoft: string;
      accentBorder: string;
      blue: string;
      blueLight: string;
    };
    ui: {
      border: string;
      borderStrong: string;
      borderAccent: string;
      surface: string;
      surface1: string; // alias for surface
      surface2: string;
      surface3: string;
      bgElev: string;
    };
    // legacy aliases for components not yet migrated
    brand_legacy: {
      violet: string;
      violetLight: string;
      blue: string;
      blueLight: string;
    };
  }
  interface PaletteOptions {
    brand?: {
      accent?: string;
      accentHover?: string;
      accentSoft?: string;
      accentBorder?: string;
      blue?: string;
      blueLight?: string;
    };
    ui?: {
      border?: string;
      borderStrong?: string;
      borderAccent?: string;
      surface?: string;
      surface1?: string;
      surface2?: string;
      surface3?: string;
      bgElev?: string;
    };
    brand_legacy?: {
      violet?: string;
      violetLight?: string;
      blue?: string;
      blueLight?: string;
    };
  }
}

export type ThemeMode = 'light' | 'dark';

// ─── Font Families ────────────────────────────────────────────────────────────
export const FONT_DISPLAY = "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
export const FONT_BODY    = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
export const FONT_MONO    = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

// legacy alias used by unmigrated components
// DEPRECATED 2026-06: migrate usages to FONT_DISPLAY, then delete (along with
// the brand_legacy and ui.surface1 palette aliases below).
export const FONT_HEADING = FONT_DISPLAY;

// ─── Micro-text scale ─────────────────────────────────────────────────────────
// The only three sizes allowed below body2. 11px (TEXT_LABEL_SM) is the absolute
// floor for any rendered text — never hardcode a smaller font size in components.
export const TEXT_LABEL_LG = '0.8125rem'; // 13px — prominent labels
export const TEXT_LABEL    = '0.75rem';   // 12px — data labels, meta, chips
export const TEXT_LABEL_SM = '0.6875rem'; // 11px — eyebrows, fine print (floor)

// ─── Design Tokens ────────────────────────────────────────────────────────────
const ACCENT_DARK  = '#818CF8';
const ACCENT_LIGHT = '#4F46E5';

const PALETTE_DARK = {
  bg:    '#07121F',
  bgElev:'#0C1B2E',
  surface: '#0F2138',
  surface2:'#16294A',
  surface3:'#1D365C',
  border: 'rgba(148, 178, 220, 0.10)',
  borderStrong: 'rgba(148, 178, 220, 0.22)',
  borderAccent: 'rgba(129, 140, 248, 0.35)',
  text:   '#ECF2FA',
  textSecondary: '#B7C5DA',
  textTertiary:  '#8A9CB6',
  accent: ACCENT_DARK,
  accentHover: '#A5B4FC',
  accentSoft: 'rgba(129, 140, 248, 0.16)',
  accentBorder: 'rgba(129, 140, 248, 0.45)',
  success: '#2FCB8A',
  warn:    '#F4B740',
  danger:  '#F87171',
};

const PALETTE_LIGHT = {
  bg:    '#ECEDF6',
  bgElev:'#F4F4FB',
  surface: '#FAFAFD',
  surface2:'#EFF0F8',
  surface3:'#E3E5EE',
  border: '#D8DBE9',
  borderStrong: '#BFC3D7',
  borderAccent: 'rgba(79, 70, 229, 0.35)',
  text:   '#14112E',
  textSecondary: '#3D3F6B',
  textTertiary:  '#5A5E8B',
  accent: ACCENT_LIGHT,
  accentHover: '#4338CA',
  accentSoft: 'rgba(79, 70, 229, 0.10)',
  accentBorder: 'rgba(79, 70, 229, 0.35)',
  success: '#0E9F6E',
  warn:    '#C77700',
  danger:  '#C8362E',
};

// ─── Create Theme ─────────────────────────────────────────────────────────────
export const createAppTheme = (mode: ThemeMode) => {
  const p = mode === 'dark' ? PALETTE_DARK : PALETTE_LIGHT;
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: p.accent,
        light: p.accentHover,
        dark: isDark ? '#6366F1' : '#4338CA',
        contrastText: isDark ? '#0B0F1E' : '#FFFFFF',
      },
      secondary: {
        main: isDark ? '#6BB6FF' : '#1E6FE3',
        light: isDark ? '#93C5FD' : '#60A5FA',
      },
      error:   { main: p.danger },
      warning: { main: p.warn },
      success: { main: p.success },
      // Explicit info so MUI's default light-blue never leaks into the palette
      // (used by Badge variant="info" and ScaleBadge).
      info: {
        main: isDark ? '#6BB6FF' : '#1E6FE3',
        light: isDark ? '#93C5FD' : '#60A5FA',
      },
      background: {
        default: p.bg,
        paper:   p.bgElev,
      },
      text: {
        primary:   p.text,
        secondary: p.textSecondary,
        disabled:  p.textTertiary,
      },
      divider: p.border,
      contrastThreshold: 4.5,
      brand: {
        accent:       p.accent,
        accentHover:  p.accentHover,
        accentSoft:   p.accentSoft,
        accentBorder: p.accentBorder,
        // backwards-compat aliases used by unmigrated components
        blue:         isDark ? '#6BB6FF' : '#1E6FE3',
        blueLight:    isDark ? '#93C5FD' : '#60A5FA',
      },
      // DEPRECATED 2026-06: see FONT_HEADING note — resorb before it re-diverges.
      brand_legacy: {
        violet:       p.accent,
        violetLight:  p.accentHover,
        blue:         isDark ? '#6BB6FF' : '#1E6FE3',
        blueLight:    isDark ? '#93C5FD' : '#60A5FA',
      },
      ui: {
        border:       p.border,
        borderStrong: p.borderStrong,
        borderAccent: p.borderAccent,
        surface:      p.surface,
        surface1:     p.surface, // backwards-compat alias
        surface2:     p.surface2,
        surface3:     p.surface3,
        bgElev:       p.bgElev,
      },
    },

    shape: {
      borderRadius: 6,
    },

    // Shadows are calibrated per mode: the dark values are far too heavy on a
    // light background, so light mode gets a much softer ramp.
    shadows: (isDark
      ? [
          'none',
          '0 1px 2px rgba(0,0,0,0.25)',
          '0 2px 4px rgba(0,0,0,0.28)',
          '0 3px 6px rgba(0,0,0,0.30)',
          '0 6px 18px rgba(0,0,0,0.35)',
          '0 10px 28px rgba(0,0,0,0.40)',
          '0 18px 40px rgba(0,0,0,0.45)',
          ...Array(18).fill('none'),
        ]
      : [
          'none',
          '0 1px 2px rgba(20,17,46,0.06)',
          '0 2px 4px rgba(20,17,46,0.07)',
          '0 3px 6px rgba(20,17,46,0.08)',
          '0 6px 18px rgba(20,17,46,0.10)',
          '0 10px 28px rgba(20,17,46,0.12)',
          '0 18px 40px rgba(20,17,46,0.14)',
          ...Array(18).fill('none'),
        ]) as Shadows,

    typography: {
      fontFamily: FONT_BODY,
      fontSize: 14,
      htmlFontSize: 16,
      h1: { fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: '-0.022em', lineHeight: 1.1 },
      h2: { fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: '-0.018em', lineHeight: 1.15 },
      h3: { fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: '-0.012em', lineHeight: 1.2 },
      h4: { fontFamily: FONT_DISPLAY, fontWeight: 600, letterSpacing: '-0.008em' },
      h5: { fontFamily: FONT_DISPLAY, fontWeight: 600 },
      h6: { fontFamily: FONT_DISPLAY, fontWeight: 600 },
      subtitle1: { fontFamily: FONT_BODY, fontWeight: 500, fontSize: '0.9375rem' },
      subtitle2: { fontFamily: FONT_BODY, fontWeight: 500, fontSize: '0.875rem' },
      body1:  { fontFamily: FONT_BODY, fontSize: '0.9063rem', lineHeight: 1.55 },
      body2:  { fontFamily: FONT_BODY, fontSize: '0.8125rem', lineHeight: 1.5 },
      button: { fontFamily: FONT_BODY, fontWeight: 600, letterSpacing: '0.01em', textTransform: 'none' },
      caption: { fontFamily: FONT_MONO, fontSize: TEXT_LABEL, letterSpacing: '0.02em' },
      overline: { fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, letterSpacing: '0.06em', textTransform: 'uppercase' },
    },

    components: {
      MuiCssBaseline: {
        styleOverrides: `
          *, *::before, *::after { box-sizing: border-box; }
          html { scroll-behavior: smooth; }
          body {
            margin: 0;
            background-color: ${p.bg};
            color: ${p.text};
            font-family: ${FONT_BODY};
            font-size: 14.5px;
            line-height: 1.55;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
            transition: background-color 180ms ease, color 180ms ease;
          }
          ::selection { background: ${alpha(p.accent, 0.25)}; }
          :focus-visible {
            outline: none;
            box-shadow: 0 0 0 2px ${p.bg}, 0 0 0 4px ${p.accent};
            border-radius: 4px;
          }
          *::-webkit-scrollbar { width: 10px; height: 10px; }
          *::-webkit-scrollbar-track { background: transparent; }
          *::-webkit-scrollbar-thumb {
            background: ${p.borderStrong};
            border-radius: 6px;
            border: 2px solid ${p.bg};
          }
          *::-webkit-scrollbar-thumb:hover { background: ${p.accentBorder}; }
          @keyframes if-fade-in {
            from { opacity: 0; transform: translateY(4px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes if-slide-right {
            from { opacity: 0; transform: translateX(8px); }
            to   { opacity: 1; transform: translateX(0); }
          }
          @keyframes if-pulse-ring {
            0%   { box-shadow: 0 0 0 0 ${alpha(p.accent, 0.4)}; }
            100% { box-shadow: 0 0 0 6px transparent; }
          }
          .if-appear { animation: if-fade-in 240ms cubic-bezier(0.22,1,0.36,1) both; }
          @media (prefers-reduced-motion: reduce) {
            html { scroll-behavior: auto; }
            *, *::before, *::after {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
            }
          }
        `,
      },

      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: p.surface,
            border: `1px solid ${p.border}`,
          },
          outlined: {
            borderColor: p.border,
          },
        },
      },

      MuiButton: {
        defaultProps: { disableElevation: true, disableRipple: false },
        styleOverrides: {
          root: {
            borderRadius: 6,
            fontWeight: 600,
            textTransform: 'none',
            letterSpacing: 0,
            transition: 'background-color 120ms ease, border-color 120ms ease, transform 120ms ease',
            '&:active': { transform: 'translateY(1px)' },
          },
          contained: {
            backgroundColor: p.accent,
            color: isDark ? '#0B0F1E' : '#FFFFFF',
            '&:hover': { backgroundColor: p.accentHover },
          },
          outlined: {
            borderColor: p.borderStrong,
            color: p.text,
            '&:hover': { borderColor: p.accentBorder, backgroundColor: p.accentSoft },
          },
          text: {
            color: p.textSecondary,
            '&:hover': { backgroundColor: p.surface2, color: p.text },
          },
        },
      },

      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            transition: 'background-color 120ms ease, color 120ms ease',
            color: p.textSecondary,
            '&:hover': { backgroundColor: p.surface2, color: p.text },
          },
        },
      },

      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: p.bgElev,
            borderBottom: `1px solid ${p.border}`,
            backgroundImage: 'none',
            color: p.text,
            boxShadow: 'none',
          },
        },
      },

      MuiToggleButton: {
        styleOverrides: {
          root: {
            borderColor: p.border,
            color: p.textSecondary,
            fontWeight: 600,
            textTransform: 'none',
            letterSpacing: 0,
            transition: 'background-color 120ms ease, color 120ms ease',
            '&:hover': { backgroundColor: p.surface2, color: p.text },
            '&.Mui-selected': {
              backgroundColor: p.accentSoft,
              color: p.accent,
              borderColor: p.accentBorder,
              '&:hover': { backgroundColor: alpha(p.accent, 0.22) },
            },
          },
        },
      },

      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 46 },
          indicator: {
            backgroundColor: p.accent,
            height: 2,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            fontFamily: FONT_BODY,
            fontWeight: 550,
            fontSize: '0.8438rem',
            textTransform: 'none',
            letterSpacing: 0,
            color: p.textSecondary,
            minHeight: 46,
            padding: '12px 16px',
            transition: 'color 120ms ease',
            '&:hover': { color: p.text },
            '&.Mui-selected': { color: p.accent, fontWeight: 600 },
          },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            fontWeight: 600,
            fontSize: TEXT_LABEL,
            fontFamily: FONT_BODY,
          },
        },
      },

      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 6,
              backgroundColor: p.surface,
              transition: 'border-color 120ms ease, background-color 120ms ease',
              '& fieldset': { borderColor: p.border },
              '&:hover fieldset': { borderColor: p.borderStrong },
              '&.Mui-focused fieldset': { borderColor: p.accent, borderWidth: 1 },
            },
            '& .MuiInputBase-input': {
              color: p.text,
              fontSize: '0.875rem',
              '&::placeholder': { color: p.textTertiary, opacity: 1 },
            },
          },
        },
      },

      MuiSelect: {
        styleOverrides: {
          root: { borderRadius: 6 },
        },
      },

      MuiSlider: {
        styleOverrides: {
          root: {
            color: p.accent,
            height: 6,
            padding: '12px 0',
          },
          rail: {
            opacity: 1,
            background: `linear-gradient(to right,
              rgba(248, 113, 113, 0.4) 0%,
              rgba(244, 183, 64, 0.4) 35%,
              ${p.borderStrong} 48%,
              ${p.borderStrong} 52%,
              ${alpha(p.accent, 0.35)} 65%,
              ${p.accent} 100%)`,
          },
          track: { display: 'none' },
          thumb: {
            width: 20,
            height: 20,
            backgroundColor: p.bgElev,
            border: `3px solid ${p.accent}`,
            boxShadow: `0 2px 8px rgba(0,0,0,0.35), 0 0 0 6px ${alpha(p.accent, 0.14)}`,
            transition: 'border-color 150ms ease, box-shadow 150ms ease',
            '&::before': { display: 'none', boxShadow: 'none' },
            '&::after': { width: 0, height: 0 },
            '&:hover': { boxShadow: `0 2px 8px rgba(0,0,0,0.35), 0 0 0 6px ${alpha(p.accent, 0.14)}` },
            '&.Mui-focusVisible': { boxShadow: `0 2px 8px rgba(0,0,0,0.35), 0 0 0 6px ${alpha(p.accent, 0.28)}` },
          },
          mark: { display: 'none' },
          markLabel: { fontSize: TEXT_LABEL_SM, fontFamily: FONT_MONO, color: p.textSecondary, top: 28 },
          markLabelActive: { color: p.textSecondary },
          valueLabel: {
            backgroundColor: p.surface3,
            color: p.text,
            fontSize: TEXT_LABEL,
            fontFamily: FONT_MONO,
            fontWeight: 700,
          },
        },
      },

      MuiTooltip: {
        defaultProps: { arrow: true },
        styleOverrides: {
          tooltip: {
            backgroundColor: p.surface3,
            color: p.text,
            border: `1px solid ${p.borderStrong}`,
            fontSize: TEXT_LABEL,
            fontFamily: FONT_BODY,
            borderRadius: 6,
          },
          arrow: { color: p.surface3 },
        },
      },

      MuiDivider: {
        styleOverrides: {
          root: { borderColor: p.border },
        },
      },

      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: 8,
            border: `1px solid ${p.border}`,
            backgroundColor: p.surface,
            backgroundImage: 'none',
            transition: 'border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease',
            '&:hover': {
              borderColor: p.accentBorder,
            },
          },
        },
      },

      MuiAccordion: {
        defaultProps: { elevation: 0, disableGutters: true },
        styleOverrides: {
          root: {
            backgroundColor: p.surface,
            border: `1px solid ${p.border}`,
            borderRadius: '8px !important',
            '&::before': { display: 'none' },
            '& + &': { marginTop: 8 },
          },
        },
      },
    },
  });
};
