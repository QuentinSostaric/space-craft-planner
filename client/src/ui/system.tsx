/**
 * Design system runtime — replaces the MUI styling layer.
 *
 * Layout primitives (Box, Stack, Typography, Paper…) render plain HTML
 * elements styled through a tiny sx→CSS engine (responsive objects,
 * pseudo-selectors, theme tokens, spacing scale). Widgets (buttons,
 * dialogs, inputs…) come from PrimeReact; this module only covers what
 * PrimeReact deliberately leaves to the host app.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createElement,
  forwardRef,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { CSSProperties, ElementType, ForwardedRef, ReactElement, ReactNode, Ref } from 'react';

/**
 * forwardRef wrapper that keeps the exact props type. React's own
 * `PropsWithoutRef` runs an `Omit` over props; on interfaces with an index
 * signature that collapses every named member to `unknown`, killing sx and
 * event-handler contextual typing at call sites.
 */
function fixedForwardRef<P>(
  render: (props: P, ref: ForwardedRef<HTMLElement>) => ReactElement | null,
  displayName: string,
): (props: P & { ref?: Ref<HTMLElement> }) => ReactElement | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component = forwardRef(render as any) as any;
  component.displayName = displayName;
  return component;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark';

export const FONT_DISPLAY = "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
export const FONT_BODY    = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
export const FONT_MONO    = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
export const FONT_HEADING = FONT_DISPLAY;

// 11px floor for micro-text (audit rule)
export const TEXT_LABEL_SM = '0.6875rem';
export const TEXT_LABEL    = '0.75rem';
export const TEXT_LABEL_LG = '0.8125rem';

/**
 * Functional category hues — five real categories, validated (lightness band,
 * chroma floor, CVD ≥8, normal-vision ≥15, contrast ≥3:1) against each mode's
 * surface with the dataviz palette validator:
 *   green   = materials & resources
 *   cyan    = geography (systems, localities, providers)
 *   blue    = missions & contracts
 *   magenta = reputation & factions (social)
 *   orange  = dismantling / salvage (industrial teardown — NOT danger red)
 * red / yellow / violet are compatibility aliases onto the reserved status &
 * brand colors: status semantics (danger, gold star) and the brand accent must
 * never be re-used as category identities.
 */
const DOMAIN_DARK = {
  green:   '#358A2E',
  cyan:    '#10A5BC',
  blue:    '#2F6FE4',
  magenta: '#C94F9E',
  orange:  '#B85917',
  red:     '#F87171',
  yellow:  '#F4B740',
  violet:  '#818CF8',
};

const DOMAIN_LIGHT = {
  green:   '#1E7A2C',
  cyan:    '#0089A8',
  blue:    '#2456C4',
  magenta: '#A63583',
  orange:  '#8F5410',
  red:     '#C8362E',
  yellow:  '#C77700',
  violet:  '#4F46E5',
};

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
  accent: '#818CF8',
  accentHover: '#A5B4FC',
  accentSoft: 'rgba(129, 140, 248, 0.16)',
  accentBorder: 'rgba(129, 140, 248, 0.45)',
  success: '#2FCB8A',
  warn:    '#F4B740',
  danger:  '#F87171',
  domain: DOMAIN_DARK,
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
  accent: '#4F46E5',
  accentHover: '#4338CA',
  accentSoft: 'rgba(79, 70, 229, 0.10)',
  accentBorder: 'rgba(79, 70, 229, 0.35)',
  success: '#0E9F6E',
  warn:    '#C77700',
  danger:  '#C8362E',
  domain: DOMAIN_LIGHT,
};

const BREAKPOINTS = { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 } as const;
type BreakpointKey = keyof typeof BREAKPOINTS;
const BP_KEYS = Object.keys(BREAKPOINTS) as BreakpointKey[];

function buildTheme(mode: ThemeMode) {
  const p = mode === 'dark' ? PALETTE_DARK : PALETTE_LIGHT;
  const isDark = mode === 'dark';
  const blue = isDark ? '#6BB6FF' : '#1E6FE3';
  const blueLight = isDark ? '#93C5FD' : '#60A5FA';
  return {
    mode,
    palette: {
      mode,
      primary: {
        main: p.accent,
        light: p.accentHover,
        dark: isDark ? '#6366F1' : '#4338CA',
        contrastText: isDark ? '#0B0F1E' : '#FFFFFF',
      },
      secondary: { main: blue, light: blueLight, dark: blue, contrastText: '#FFFFFF' },
      error:   { main: p.danger, light: p.danger, dark: p.danger, contrastText: '#FFFFFF' },
      warning: { main: p.warn, light: p.warn, dark: p.warn, contrastText: isDark ? '#0B0F1E' : '#FFFFFF' },
      success: { main: p.success, light: p.success, dark: p.success, contrastText: isDark ? '#0B0F1E' : '#FFFFFF' },
      info:    { main: blue, light: blueLight, dark: blue, contrastText: '#FFFFFF' },
      text: { primary: p.text, secondary: p.textSecondary, disabled: p.textTertiary },
      background: { default: p.bg, paper: p.bgElev },
      divider: p.border,
      common: { white: '#FFFFFF', black: '#000000' },
      action: { hover: alphaColor(p.text, 0.04), selected: alphaColor(p.accent, 0.12), disabled: p.textTertiary },
      brand: {
        accent: p.accent,
        accentHover: p.accentHover,
        accentSoft: p.accentSoft,
        accentBorder: p.accentBorder,
        blue,
        blueLight,
      },
      brand_legacy: { violet: p.accent, violetLight: p.accentHover, blue, blueLight },
      ui: {
        border: p.border,
        borderStrong: p.borderStrong,
        borderAccent: p.borderAccent,
        surface: p.surface,
        surface1: p.surface,
        surface2: p.surface2,
        surface3: p.surface3,
        bgElev: p.bgElev,
      },
      domain: p.domain,
    },
    breakpoints: {
      values: BREAKPOINTS,
      up: (key: BreakpointKey | number) =>
        `(min-width:${typeof key === 'number' ? key : BREAKPOINTS[key]}px)`,
      down: (key: BreakpointKey | number) =>
        `(max-width:${(typeof key === 'number' ? key : BREAKPOINTS[key]) - 0.05}px)`,
    },
    spacing: (...args: number[]) => args.map((n) => `${n * 8}px`).join(' '),
    shape: { borderRadius: 8 },
    zIndex: { appBar: 1100, drawer: 1200, modal: 1300, snackbar: 1400, tooltip: 1500 },
    typography: { fontFamily: FONT_BODY, fontDisplay: FONT_DISPLAY, fontMono: FONT_MONO },
    transitions: {
      create: (props: string | string[] = 'all', options: { duration?: number; easing?: string } = {}) => {
        const list = Array.isArray(props) ? props : [props];
        return list.map((prop) => `${prop} ${options.duration ?? 200}ms ${options.easing ?? 'ease'}`).join(', ');
      },
    },
  };
}

export type Theme = ReturnType<typeof buildTheme>;

/**
 * sx entry type — recursive union so inline `(theme) => …` callbacks get a
 * typed parameter through contextual typing, without constraining CSS keys.
 */
export interface SxObject { [key: string]: SxEntry }
export type SxEntry =
  | string
  | number
  | boolean
  | null
  | undefined
  | SxObject
  | ((theme: Theme) => SxEntry);
export type SxValue =
  | SxEntry
  | Array<SxValue>
  | ((theme: Theme) => SxObject);
export type SxProps<_T = Theme> = SxValue;

/** Type of the theme palette (handy for keyof lookups in components). */
export type Palette = Theme['palette'];

/**
 * Index-signature-safe Omit: the built-in `Omit` collapses every named
 * member of an indexed interface to `unknown`; this keeps them intact.
 */
export type OmitProps<T, K extends PropertyKey> = { [P in keyof T as Exclude<P, K>]: T[P] };

const THEMES: Record<ThemeMode, Theme> = { dark: buildTheme('dark'), light: buildTheme('light') };

// ─── Mode store ───────────────────────────────────────────────────────────────

let currentMode: ThemeMode = 'dark';
const modeListeners = new Set<() => void>();

export function setSystemMode(mode: ThemeMode) {
  if (mode === currentMode) return;
  currentMode = mode;
  for (const listener of modeListeners) listener();
}

export function getSystemMode(): ThemeMode {
  return currentMode;
}

function subscribeMode(listener: () => void) {
  modeListeners.add(listener);
  return () => modeListeners.delete(listener);
}

export function useTheme(): Theme {
  const mode = useSyncExternalStore(subscribeMode, () => currentMode, () => currentMode);
  return THEMES[mode];
}

export function getTheme(mode?: ThemeMode): Theme {
  return THEMES[mode ?? currentMode];
}

// ─── Color helpers ────────────────────────────────────────────────────────────

export function alphaColor(color: string, opacity: number): string {
  if (!color) return color;
  const c = color.trim();
  if (c.startsWith('#')) {
    let hex = c.slice(1);
    if (hex.length === 3) hex = hex.split('').map((ch) => ch + ch).join('');
    const num = parseInt(hex.slice(0, 6), 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  const rgbMatch = c.match(/^rgba?\(([^)]+)\)$/);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map((s) => s.trim());
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${opacity})`;
  }
  return `color-mix(in srgb, ${c} ${Math.round(opacity * 100)}%, transparent)`;
}

export const alpha = alphaColor;

// ─── sx → CSS engine ──────────────────────────────────────────────────────────


/** Props whose numeric values follow the 8px spacing scale. */
const SPACING_PROPS = new Set([
  'margin','marginTop','marginRight','marginBottom','marginLeft','marginX','marginY',
  'm','mt','mr','mb','ml','mx','my',
  'padding','paddingTop','paddingRight','paddingBottom','paddingLeft','paddingX','paddingY',
  'p','pt','pr','pb','pl','px','py',
  'gap','rowGap','columnGap','scrollMarginTop',
]);

/** sx shorthand → real CSS property (or several). */
const PROP_ALIASES: Record<string, string[]> = {
  m: ['margin'], mt: ['margin-top'], mr: ['margin-right'], mb: ['margin-bottom'], ml: ['margin-left'],
  mx: ['margin-left', 'margin-right'], my: ['margin-top', 'margin-bottom'],
  marginX: ['margin-left', 'margin-right'], marginY: ['margin-top', 'margin-bottom'],
  p: ['padding'], pt: ['padding-top'], pr: ['padding-right'], pb: ['padding-bottom'], pl: ['padding-left'],
  px: ['padding-left', 'padding-right'], py: ['padding-top', 'padding-bottom'],
  paddingX: ['padding-left', 'padding-right'], paddingY: ['padding-top', 'padding-bottom'],
  bgcolor: ['background-color'],
  typography: [],
};

/** CSS props that keep raw numbers (no px suffix). */
const UNITLESS = new Set([
  'opacity','z-index','font-weight','line-height','flex','flex-grow','flex-shrink','order',
  '-webkit-line-clamp','zoom','aspect-ratio','scale','flex-basis',
]);

/** Props whose string values may be palette token paths. */
const COLOR_PROPS = new Set([
  'color','background-color','border-color','outline-color','fill','stroke',
  'border-top-color','border-right-color','border-bottom-color','border-left-color',
  'caret-color','text-decoration-color',
]);

function camelToKebab(key: string): string {
  const kebab = key.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
  return /^(webkit|moz|ms)-/.test(kebab) ? `-${kebab}` : kebab;
}

function resolvePaletteToken(theme: Theme, value: string): string {
  if (value === 'divider') return theme.palette.divider;
  if (value === 'transparent' || value === 'inherit' || value === 'currentColor') return value;
  if (!/^[a-zA-Z_]+(\.[a-zA-Z0-9_]+)+$/.test(value)) return value;
  const segments = value.split('.');
  let node: any = theme.palette;
  for (const segment of segments) {
    if (node == null || typeof node !== 'object' || !(segment in node)) return value;
    node = node[segment];
  }
  return typeof node === 'string' ? node : value;
}

function formatValue(cssProp: string, value: unknown, theme: Theme, sxKey: string): string {
  if (typeof value === 'number') {
    if (SPACING_PROPS.has(sxKey)) return `${value * 8}px`;
    if (sxKey === 'borderRadius') return `${value * theme.shape.borderRadius}px`;
    if (UNITLESS.has(cssProp)) return String(value);
    return `${value}px`;
  }
  const str = String(value);
  if (COLOR_PROPS.has(cssProp)) return resolvePaletteToken(theme, str);
  return str;
}

interface RuleBucket {
  /** declarations per media query ('' = base) */
  decls: Map<string, string[]>;
  /** nested selector → declarations per media query */
  nested: Map<string, Map<string, string[]>>;
}

function isResponsiveObject(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((key) => (BP_KEYS as readonly string[]).includes(key));
}

function pushDecl(bucket: Map<string, string[]>, media: string, decl: string) {
  const list = bucket.get(media);
  if (list) list.push(decl);
  else bucket.set(media, [decl]);
}

function serializeLevel(
  sx: Record<string, unknown>,
  theme: Theme,
  bucket: RuleBucket,
  selector: string | null,
) {
  for (const [rawKey, rawValue] of Object.entries(sx)) {
    if (rawValue == null || rawValue === false) continue;
    let value: unknown = typeof rawValue === 'function' ? (rawValue as (t: Theme) => unknown)(theme) : rawValue;
    if (value == null || value === false) continue;

    // Nested selector / at-rule
    if (
      typeof value === 'object' && !Array.isArray(value)
      && (rawKey.includes('&') || rawKey.startsWith(':') || rawKey.startsWith('@') || rawKey.startsWith('.')
        || rawKey.startsWith('>') || rawKey.startsWith(' ') || rawKey.startsWith('*'))
      && !isResponsiveObject(value)
    ) {
      if (rawKey.startsWith('@media')) {
        const media = rawKey.slice(6).trim();
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          emitDeclaration(k, v, theme, bucket, selector, media);
        }
        continue;
      }
      const childSelector = rawKey.includes('&')
        ? rawKey
        : `&${rawKey.startsWith(':') || rawKey.startsWith('.') ? '' : ' '}${rawKey}`;
      const merged = selector ? childSelector.replace(/&/g, selector) : childSelector;
      serializeLevel(value as Record<string, unknown>, theme, bucket, merged);
      continue;
    }

    emitDeclaration(rawKey, value, theme, bucket, selector, '');
  }
}

function emitDeclaration(
  sxKey: string,
  value: unknown,
  theme: Theme,
  bucket: RuleBucket,
  selector: string | null,
  media: string,
) {
  if (typeof value === 'function') value = (value as (t: Theme) => unknown)(theme);
  if (value == null || value === false) return;

  const cssProps = PROP_ALIASES[sxKey] ?? [camelToKebab(sxKey)];
  if (cssProps.length === 0) return;

  const target = selector
    ? (bucket.nested.get(selector) ?? (() => { const m = new Map<string, string[]>(); bucket.nested.set(selector, m); return m; })())
    : bucket.decls;

  if (isResponsiveObject(value)) {
    for (const [bp, bpValue] of Object.entries(value as Record<string, unknown>)) {
      if (bpValue == null) continue;
      const resolved = typeof bpValue === 'function' ? (bpValue as (t: Theme) => unknown)(theme) : bpValue;
      if (resolved == null) continue;
      const bpMedia = BREAKPOINTS[bp as BreakpointKey] === 0
        ? media
        : `(min-width:${BREAKPOINTS[bp as BreakpointKey]}px)`;
      for (const cssProp of cssProps) {
        pushDecl(target, bpMedia, `${cssProp}:${formatValue(cssProp, resolved, theme, sxKey)}`);
      }
    }
    return;
  }

  for (const cssProp of cssProps) {
    pushDecl(target, media, `${cssProp}:${formatValue(cssProp, value, theme, sxKey)}`);
  }
}

function flattenSx(sx: SxValue, theme: Theme): Record<string, unknown> {
  if (!sx) return {};
  if (Array.isArray(sx)) {
    const merged: Record<string, unknown> = {};
    for (const part of sx) Object.assign(merged, flattenSx(part, theme));
    return merged;
  }
  if (typeof sx === 'function') return flattenSx(sx(theme), theme);
  return sx as Record<string, unknown>;
}

let styleEl: HTMLStyleElement | null = null;
const classCache = new Map<string, string>();
let classCounter = 0;

function injectCss(cssText: string) {
  if (typeof document === 'undefined') return;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.setAttribute('data-if-system', '');
    document.head.appendChild(styleEl);
  }
  styleEl.appendChild(document.createTextNode(cssText));
}

function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

export function sxToClass(sx: SxValue, theme: Theme): string {
  if (!sx) return '';
  const flat = flattenSx(sx, theme);
  if (Object.keys(flat).length === 0) return '';

  const bucket: RuleBucket = { decls: new Map(), nested: new Map() };
  serializeLevel(flat, theme, bucket, null);

  let body = '';
  const emitRules = (fullSelector: string, declsByMedia: Map<string, string[]>) => {
    for (const [media, decls] of declsByMedia) {
      const rule = `${fullSelector}{${decls.join(';')}}`;
      body += media ? `@media ${media}{${rule}}` : rule;
    }
  };
  emitRules('SELF', bucket.decls);
  for (const [selector, declsByMedia] of bucket.nested) {
    emitRules(selector.replace(/&/g, 'SELF'), declsByMedia);
  }

  const cacheKey = `${theme.mode}|${body}`;
  const cached = classCache.get(cacheKey);
  if (cached) return cached;

  const className = `ifx-${hashString(cacheKey)}-${(classCounter++).toString(36)}`;
  injectCss(body.replace(/SELF/g, `.${className}`));
  classCache.set(cacheKey, className);
  return className;
}

// ─── Primitive components ─────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface BoxProps {
  component?: ElementType;
  sx?: SxValue;
  className?: string;
  children?: ReactNode;
  style?: CSSProperties;
  // Typed loosely so inline `(event) => …` callbacks don't trip noImplicitAny
  // while still accepting narrowed React event parameter annotations.
  onClick?: (event: any) => void;
  onDoubleClick?: (event: any) => void;
  onMouseDown?: (event: any) => void;
  onMouseUp?: (event: any) => void;
  onMouseEnter?: (event: any) => void;
  onMouseLeave?: (event: any) => void;
  onMouseMove?: (event: any) => void;
  onContextMenu?: (event: any) => void;
  onKeyDown?: (event: any) => void;
  onKeyUp?: (event: any) => void;
  onFocus?: (event: any) => void;
  onBlur?: (event: any) => void;
  onChange?: (event: any) => void;
  onInput?: (event: any) => void;
  onSubmit?: (event: any) => void;
  onScroll?: (event: any) => void;
  onDragStart?: (event: any) => void;
  onDragOver?: (event: any) => void;
  onDragEnd?: (event: any) => void;
  onDragLeave?: (event: any) => void;
  onDrop?: (event: any) => void;
  onTouchStart?: (event: any) => void;
  onTouchEnd?: (event: any) => void;
  [key: string]: unknown;
}

function createSxComponent(defaultTag: ElementType, baseSx?: SxValue, displayName = 'SxComponent') {
  return fixedForwardRef<BoxProps>(function SxComponent(
    { component, sx, className, ...rest },
    ref,
  ) {
    const theme = useTheme();
    const cls = sxToClass(baseSx ? [baseSx, sx] : sx, theme);
    const merged = [className, cls].filter(Boolean).join(' ') || undefined;
    return createElement(component ?? defaultTag, { ...rest, className: merged, ref });
  }, displayName);
}

export const Box = createSxComponent('div', undefined, 'Box');

type Responsive<T> = T | Partial<Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', T>>;

export interface StackProps extends BoxProps {
  direction?: Responsive<'row' | 'column' | 'row-reverse' | 'column-reverse'>;
  spacing?: Responsive<number>;
  alignItems?: Responsive<string>;
  justifyContent?: Responsive<string>;
  flexWrap?: Responsive<string>;
  useFlexGap?: boolean;
}

export const Stack = fixedForwardRef<StackProps>(function Stack(
  { direction = 'column', spacing = 0, alignItems, justifyContent, flexWrap, useFlexGap: _useFlexGap, sx, ...rest },
  ref,
) {
  const stackSx: SxObject = {
    display: 'flex',
    flexDirection: direction as SxEntry,
    gap: spacing as SxEntry,
  };
  if (alignItems) stackSx.alignItems = alignItems as SxEntry;
  if (justifyContent) stackSx.justifyContent = justifyContent as SxEntry;
  if (flexWrap) stackSx.flexWrap = flexWrap as SxEntry;
  return <Box ref={ref} sx={[stackSx, sx]} {...rest} />;
}, 'Stack');

const TYPOGRAPHY_VARIANTS: Record<string, { tag: ElementType; sx: SxObject }> = {
  h1: { tag: 'h1', sx: { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: '2.5rem', letterSpacing: '-0.022em', lineHeight: 1.1, margin: 0 } },
  h2: { tag: 'h2', sx: { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: '2rem', letterSpacing: '-0.018em', lineHeight: 1.15, margin: 0 } },
  h3: { tag: 'h3', sx: { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.012em', lineHeight: 1.2, margin: 0 } },
  h4: { tag: 'h4', sx: { fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: '1.375rem', letterSpacing: '-0.008em', lineHeight: 1.25, margin: 0 } },
  h5: { tag: 'h5', sx: { fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: '1.1875rem', lineHeight: 1.3, margin: 0 } },
  h6: { tag: 'h6', sx: { fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: '1.0625rem', lineHeight: 1.35, margin: 0 } },
  subtitle1: { tag: 'p', sx: { fontFamily: FONT_BODY, fontWeight: 500, fontSize: '0.9375rem', margin: 0 } },
  subtitle2: { tag: 'p', sx: { fontFamily: FONT_BODY, fontWeight: 500, fontSize: '0.875rem', margin: 0 } },
  body1: { tag: 'p', sx: { fontFamily: FONT_BODY, fontSize: '0.9063rem', lineHeight: 1.55, margin: 0 } },
  body2: { tag: 'p', sx: { fontFamily: FONT_BODY, fontSize: '0.8125rem', lineHeight: 1.5, margin: 0 } },
  button: { tag: 'span', sx: { fontFamily: FONT_BODY, fontWeight: 600, letterSpacing: '0.01em' } },
  caption: { tag: 'span', sx: { fontFamily: FONT_MONO, fontSize: TEXT_LABEL, letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums', display: 'inline-block' } },
  overline: { tag: 'span', sx: { fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, letterSpacing: '0.06em', textTransform: 'uppercase', fontVariantNumeric: 'tabular-nums', display: 'inline-block' } },
  inherit: { tag: 'span', sx: {} },
};

export interface TypographyProps extends BoxProps {
  variant?: keyof typeof TYPOGRAPHY_VARIANTS;
  noWrap?: boolean;
  gutterBottom?: boolean;
  align?: string;
  color?: string;
}

export const Typography = fixedForwardRef<TypographyProps>(function Typography(
  { variant = 'body1', component, noWrap, gutterBottom, align, color, sx, ...rest },
  ref,
) {
  const def = TYPOGRAPHY_VARIANTS[variant] ?? TYPOGRAPHY_VARIANTS.body1;
  const extra: SxObject = { color: color ?? 'text.primary' };
  if (noWrap) Object.assign(extra, { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' });
  if (gutterBottom) extra.marginBottom = '0.35em';
  if (align) extra.textAlign = align;
  return <Box ref={ref} component={component ?? def.tag} sx={[def.sx, extra, sx]} {...rest} />;
}, 'Typography');

export const Paper = createSxComponent('div', {
  backgroundColor: 'ui.surface',
  border: (t: Theme) => `1px solid ${t.palette.ui.border}`,
  borderRadius: 1,
  backgroundImage: 'none',
}, 'Paper');

export interface DividerProps extends BoxProps {
  orientation?: 'horizontal' | 'vertical';
  flexItem?: boolean;
}

export const Divider = fixedForwardRef<DividerProps>(function Divider(
  { orientation = 'horizontal', flexItem, sx, ...rest },
  ref,
) {
  const base: SxObject = orientation === 'vertical'
    ? { borderLeft: (t: Theme) => `1px solid ${t.palette.divider}`, width: 0, margin: 0, alignSelf: flexItem ? 'stretch' : undefined }
    : { borderBottom: (t: Theme) => `1px solid ${t.palette.divider}`, height: 0, margin: 0 };
  return <Box ref={ref} component="hr" sx={[{ border: 'none', flexShrink: 0 }, base, sx]} {...rest} />;
}, 'Divider');

export const ButtonBase = createSxComponent('button', {
  border: 'none',
  background: 'none',
  padding: 0,
  margin: 0,
  font: 'inherit',
  color: 'inherit',
  cursor: 'pointer',
  outline: 'none',
  textDecoration: 'none',
  '&:focus-visible': (t: Theme) => ({ boxShadow: `0 0 0 2px ${t.palette.background.default}, 0 0 0 4px ${t.palette.primary.main}` }),
}, 'ButtonBase');

export interface IconButtonProps extends BoxProps {
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}

export const IconButton = fixedForwardRef<IconButtonProps>(function IconButton(
  { size = 'medium', disabled, sx, component, ...rest },
  ref,
) {
  const pad = size === 'small' ? 0.625 : size === 'large' ? 1.5 : 1;
  return (
    <ButtonBase
      ref={ref}
      component={component ?? 'button'}
      disabled={disabled}
      sx={[{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: pad,
        borderRadius: 0.75,
        color: 'text.secondary',
        transition: 'background-color 120ms ease, color 120ms ease',
        '&:hover': { backgroundColor: 'ui.surface2', color: 'text.primary' },
        ...(disabled ? { opacity: 0.4, pointerEvents: 'none' } : null),
      }, sx]}
      {...rest}
    />
  );
}, 'IconButton');

// ─── Transitions ──────────────────────────────────────────────────────────────

export function Collapse({ in: open, children, timeout = 200, unmountOnExit = false }: {
  in: boolean;
  children?: ReactNode;
  timeout?: number;
  unmountOnExit?: boolean;
}) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
    else if (unmountOnExit) {
      const id = window.setTimeout(() => setMounted(false), timeout);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open, timeout, unmountOnExit]);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: `grid-template-rows ${timeout}ms ease`,
      }}
    >
      <div style={{ overflow: 'hidden', minHeight: 0 }}>
        {(mounted || !unmountOnExit) ? children : null}
      </div>
    </div>
  );
}

export function Fade({ in: open = true, children, timeout = 200 }: {
  in?: boolean;
  children?: ReactNode;
  timeout?: number;
}) {
  return (
    <div
      style={{
        opacity: open ? 1 : 0,
        transition: `opacity ${timeout}ms ease`,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {children}
    </div>
  );
}

export interface SkeletonProps extends BoxProps {
  variant?: 'text' | 'rectangular' | 'rounded' | 'circular';
  width?: number | string;
  height?: number | string;
  animation?: 'pulse' | 'wave' | false;
}

let skeletonKeyframesInjected = false;

export const Skeleton = fixedForwardRef<SkeletonProps>(function Skeleton(
  { variant = 'text', width, height, animation: _animation, sx, ...rest },
  ref,
) {
  if (!skeletonKeyframesInjected) {
    skeletonKeyframesInjected = true;
    injectCss('@keyframes if-skeleton-pulse{0%{opacity:1}50%{opacity:0.45}100%{opacity:1}}');
  }
  const radius = variant === 'circular' ? '50%' : variant === 'rounded' ? 1 : variant === 'text' ? 0.5 : 0.5;
  return (
    <Box
      ref={ref}
      sx={[{
        backgroundColor: (t: Theme) => alphaColor(t.palette.text.primary, 0.08),
        borderRadius: radius,
        width: width ?? '100%',
        height: height ?? (variant === 'text' ? '1.2em' : 'auto'),
        animation: 'if-skeleton-pulse 1.6s ease-in-out infinite',
        display: 'block',
      }, sx]}
      {...rest}
    />
  );
}, 'Skeleton');

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useMediaQuery(query: string): boolean {
  const normalized = query.startsWith('@media') ? query.slice(6).trim() : query;
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(normalized).matches : false,
  );
  const queryRef = useRef(normalized);
  queryRef.current = normalized;
  useEffect(() => {
    const mql = window.matchMedia(queryRef.current);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [normalized]);
  return matches;
}

// ─── styled-lite ──────────────────────────────────────────────────────────────

/** Tagged template registering a @keyframes block; returns the animation name. */
export function keyframes(strings: TemplateStringsArray, ...values: unknown[]): string {
  const body = strings.reduce((acc, part, index) => acc + part + String(values[index] ?? ''), '');
  const name = `ifkf-${hashString(body)}`;
  injectGlobalCss(`@keyframes ${name}{${body}}`);
  return name;
}

/**
 * Minimal `styled(tag, { shouldForwardProp })(factory)` replacement: the
 * factory receives the props plus `theme` and returns an sx object.
 */
export function styled(tag: ElementType, options?: { shouldForwardProp?: (prop: string) => boolean }) {
  return function create<P extends object>(factory: (props: P & { theme: Theme }) => SxObject) {
    function StyledComponent(props: P & BoxProps) {
      const theme = useTheme();
      const styleObj = factory({ ...(props as P), theme });
      const forwarded: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(props)) {
        if (key === 'sx') continue;
        if (options?.shouldForwardProp && !options.shouldForwardProp(key)) continue;
        forwarded[key] = value;
      }
      return <Box component={tag} {...forwarded} sx={[styleObj as SxValue, (props as BoxProps).sx]} />;
    }
    return StyledComponent;
  };
}

// ─── Global styles helper ─────────────────────────────────────────────────────

const injectedGlobals = new Set<string>();

export function injectGlobalCss(cssText: string) {
  const key = hashString(cssText);
  if (injectedGlobals.has(key)) return;
  injectedGlobals.add(key);
  injectCss(cssText);
}
