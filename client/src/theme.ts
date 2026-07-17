/**
 * Design tokens & global styles.
 *
 * The MUI theme lives on in `ui/system.tsx` as plain tokens + a tiny sx
 * engine; this module keeps the historical import surface (fonts, text
 * sizes) and owns the global CSS that CssBaseline used to provide.
 */
import { alphaColor, getTheme, injectGlobalCss } from './ui/system';
import type { Theme, ThemeMode } from './ui/system';

export {
  FONT_DISPLAY,
  FONT_BODY,
  FONT_MONO,
  FONT_HEADING,
  TEXT_LABEL,
  TEXT_LABEL_SM,
  TEXT_LABEL_LG,
} from './ui/system';
export type { ThemeMode } from './ui/system';

/** Legacy alias — components now read the theme through ui/system.useTheme. */
export function createAppTheme(mode: ThemeMode): Theme {
  return getTheme(mode);
}

/** Body / scrollbar / focus baseline, formerly MuiCssBaseline. */
export function installGlobalStyles(theme: Theme) {
  const p = theme.palette;
  injectGlobalCss(`
    *, *::before, *::after { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    .if-skip-link {
      position: fixed;
      top: 8px;
      left: 8px;
      z-index: 2000;
      transform: translateY(-160%);
      padding: 10px 14px;
      border-radius: 8px;
      background: ${p.primary.main};
      color: ${p.primary.contrastText};
      font-weight: 700;
      text-decoration: none;
    }
    .if-skip-link:focus { transform: translateY(0); }
    .if-visually-hidden {
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    }
    body {
      margin: 0;
      font-size: 14.5px;
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      transition: background-color 180ms ease, color 180ms ease;
    }
    html[data-theme='dark'] body { background-color: #07121F; color: #ECF2FA; }
    html[data-theme='light'] body { background-color: #ECEDF6; color: #14112E; }
    a { color: ${p.brand.blue}; }
    @keyframes if-fade-in {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes if-slide-right {
      from { opacity: 0; transform: translateX(8px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes if-pulse-ring {
      0%   { box-shadow: 0 0 0 0 ${alphaColor(p.primary.main, 0.4)}; }
      100% { box-shadow: 0 0 0 6px transparent; }
    }
    .if-appear { animation: if-fade-in 240ms cubic-bezier(0.22,1,0.36,1) both; }
    @media (pointer: coarse) {
      button, [role='button'], a[data-touch-target='true'] {
        min-width: 44px;
        min-height: 44px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
      .if-appear { animation: none !important; }
    }
  `);
  injectGlobalCss(`
    html[data-theme='${theme.mode}'] ::selection { background: ${alphaColor(p.primary.main, 0.25)}; }
    html[data-theme='${theme.mode}'] :focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px ${p.background.default}, 0 0 0 4px ${p.primary.main};
      border-radius: 4px;
    }
    html[data-theme='${theme.mode}'] *::-webkit-scrollbar { width: 10px; height: 10px; }
    html[data-theme='${theme.mode}'] *::-webkit-scrollbar-track { background: transparent; }
    html[data-theme='${theme.mode}'] *::-webkit-scrollbar-thumb {
      background: ${p.ui.borderStrong};
      border-radius: 6px;
      border: 2px solid ${p.background.default};
    }
    html[data-theme='${theme.mode}'] *::-webkit-scrollbar-thumb:hover { background: ${p.ui.borderAccent}; }
  `);
}
