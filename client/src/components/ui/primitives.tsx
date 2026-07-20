/**
 * App-owned semantic layout primitives — plain, accessible HTML atoms built on
 * the design-system `sx` runtime. These carry no interaction contract of their
 * own (no fake events, no MUI-shaped compatibility props); interactive controls
 * live in `components/ui/controls` and `components/ui/overlays`.
 */
import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import {
  Box,
  ButtonBase,
  Collapse,
  Paper,
  Typography,
  useTheme,
} from '../../ui/system';
import type { BoxProps, OmitProps } from '../../ui/system';
import { ExpandMoreIcon } from '../../ui/icons';

// ─── Lists ──────────────────────────────────────────────────────────────────

export function List({ disablePadding, sx, ...rest }: BoxProps & { dense?: boolean; disablePadding?: boolean }) {
  return <Box component="ul" sx={[{ listStyle: 'none', m: 0, p: 0, py: disablePadding ? 0 : 0.5 }, sx]} {...rest} />;
}

export function ListItem({ disablePadding, disableGutters, secondaryAction, sx, children, ...rest }: BoxProps & { disablePadding?: boolean; disableGutters?: boolean; secondaryAction?: ReactNode }) {
  return (
    <Box component="li" sx={[{ display: 'flex', alignItems: 'center', gap: 1, px: disablePadding || disableGutters ? 0 : 2, py: disablePadding ? 0 : 0.75, position: 'relative' }, sx]} {...rest}>
      {children}
      {secondaryAction && <Box sx={{ ml: 'auto', flexShrink: 0 }}>{secondaryAction}</Box>}
    </Box>
  );
}

export function ListItemButton({ selected, sx, ...rest }: BoxProps & { selected?: boolean }) {
  const theme = useTheme();
  return (
    <ButtonBase
      sx={[{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        width: '100%',
        textAlign: 'left',
        px: 2,
        py: 0.9,
        backgroundColor: selected ? theme.palette.brand.accentSoft : 'transparent',
        '&:hover': { backgroundColor: theme.palette.ui.surface2 },
      }, sx]}
      {...rest}
    />
  );
}

export function ListItemIcon({ sx, ...rest }: BoxProps) {
  return <Box sx={[{ display: 'inline-flex', minWidth: 32, color: 'text.secondary' }, sx]} {...rest} />;
}

export function ListItemText({ primary, secondary, primaryTypographyProps, secondaryTypographyProps, sx, ...rest }: BoxProps & {
  primary?: ReactNode;
  secondary?: ReactNode;
  primaryTypographyProps?: Record<string, unknown>;
  secondaryTypographyProps?: Record<string, unknown>;
}) {
  return (
    <Box sx={[{ minWidth: 0, flex: 1 }, sx]} {...rest}>
      {primary != null && <Typography variant="body2" {...primaryTypographyProps}>{primary}</Typography>}
      {secondary != null && <Typography variant="caption" sx={{ color: 'text.disabled' }} {...secondaryTypographyProps}>{secondary}</Typography>}
    </Box>
  );
}

// ─── Cards ──────────────────────────────────────────────────────────────────

export function Card({ sx, ...rest }: BoxProps) {
  return (
    <Paper
      sx={[{
        borderRadius: 1.25,
        transition: 'border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease',
        '&:hover': { borderColor: 'ui.borderAccent' },
        overflow: 'hidden',
      }, sx]}
      {...rest}
    />
  );
}

export function CardActionArea({ sx, ...rest }: BoxProps) {
  return <ButtonBase sx={[{ display: 'block', width: '100%', textAlign: 'left' }, sx]} {...rest} />;
}

export function CardContent({ sx, ...rest }: BoxProps) {
  return <Box sx={[{ p: 2 }, sx]} {...rest} />;
}

export function CardMedia({ component, image, src, alt, sx, ...rest }: BoxProps & { image?: string; src?: string; alt?: string }) {
  return (
    <Box
      component={component ?? 'img'}
      src={src ?? image}
      alt={alt}
      sx={[{ display: 'block', width: '100%', objectFit: 'cover' }, sx]}
      {...rest}
    />
  );
}

// ─── Shell layout ─────────────────────────────────────────────────────────────

export function Toolbar({ sx, ...rest }: BoxProps & { disableGutters?: boolean }) {
  return <Box sx={[{ display: 'flex', alignItems: 'center', minHeight: 56, px: 2 }, sx]} {...rest} />;
}

export function AppBar({ position: _position, sx, ...rest }: BoxProps & { position?: string; color?: string; elevation?: number }) {
  const theme = useTheme();
  return (
    <Box
      component="header"
      sx={[{
        position: 'relative',
        backgroundColor: theme.palette.background.paper,
        borderBottom: `1px solid ${theme.palette.ui.border}`,
        color: theme.palette.text.primary,
        zIndex: theme.zIndex.appBar,
      }, sx]}
      {...rest}
    />
  );
}

export function Link({ underline = 'hover', sx, ...rest }: BoxProps & { underline?: 'none' | 'hover' | 'always'; href?: string; target?: string; rel?: string }) {
  return (
    <Box
      component="a"
      sx={[{
        color: 'brand.blue',
        textDecoration: underline === 'always' ? 'underline' : 'none',
        '&:hover': underline !== 'none' ? { textDecoration: 'underline' } : undefined,
        cursor: 'pointer',
      }, sx]}
      {...rest}
    />
  );
}

// ─── Tables ───────────────────────────────────────────────────────────────────

export function TableContainer({ component: Component = 'div', sx, ...rest }: BoxProps) {
  return <Box component={Component} sx={[{ overflowX: 'auto', width: '100%' }, sx]} {...rest} />;
}

export function Table({ sx, ...rest }: BoxProps & { size?: string; stickyHeader?: boolean }) {
  return <Box component="table" sx={[{ width: '100%', borderCollapse: 'collapse' }, sx]} {...rest} />;
}

export function TableHead({ sx, ...rest }: BoxProps) {
  return <Box component="thead" sx={sx} {...rest} />;
}

export function TableBody({ sx, ...rest }: BoxProps) {
  return <Box component="tbody" sx={sx} {...rest} />;
}

export function TableRow({ hover, sx, ...rest }: BoxProps & { hover?: boolean }) {
  const theme = useTheme();
  return (
    <Box
      component="tr"
      sx={[{
        '&:hover': hover ? { backgroundColor: theme.palette.ui.surface2 } : undefined,
      }, sx]}
      {...rest}
    />
  );
}

export function TableCell({ align, component, colSpan, sx, ...rest }: BoxProps & { align?: string; colSpan?: number }) {
  const theme = useTheme();
  return (
    <Box
      component={component ?? 'td'}
      colSpan={colSpan}
      sx={[{
        textAlign: align ?? 'left',
        px: 1.5,
        py: 1,
        borderBottom: `1px solid ${theme.palette.ui.border}`,
        fontFamily: theme.typography.fontFamily,
        fontSize: '0.8125rem',
        color: theme.palette.text.primary,
      }, sx]}
      {...rest}
    />
  );
}

// ─── Accordion ────────────────────────────────────────────────────────────────

interface AccordionContextValue {
  expanded: boolean;
  toggle: () => void;
}

const AccordionContext = createContext<AccordionContextValue>({ expanded: false, toggle: () => {} });

export interface AccordionProps extends OmitProps<BoxProps, 'onChange'> {
  expanded?: boolean;
  defaultExpanded?: boolean;
  onChange?: (event: SyntheticEvent, expanded: boolean) => void;
  disableGutters?: boolean;
  elevation?: number;
}

export function Accordion({ expanded: expandedProp, defaultExpanded, onChange, disableGutters: _dg, elevation: _el, sx, children, ...rest }: AccordionProps) {
  const [internal, setInternal] = useState(Boolean(defaultExpanded));
  const expanded = expandedProp ?? internal;
  const ctx = useMemo(() => ({
    expanded,
    toggle: () => {
      const next = !expanded;
      if (expandedProp === undefined) setInternal(next);
      onChange?.({} as SyntheticEvent, next);
    },
  }), [expanded, expandedProp, onChange]);
  return (
    <AccordionContext.Provider value={ctx}>
      <Paper sx={[{ overflow: 'hidden' }, sx]} {...rest}>{children}</Paper>
    </AccordionContext.Provider>
  );
}

export interface AccordionSummaryProps extends BoxProps {
  expandIcon?: ReactNode;
}

export function AccordionSummary({ expandIcon, sx, children, ...rest }: AccordionSummaryProps) {
  const theme = useTheme();
  const { expanded, toggle } = useContext(AccordionContext);
  return (
    <ButtonBase
      onClick={toggle}
      aria-expanded={expanded}
      sx={[{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        gap: 1,
        px: 2,
        py: 1,
        textAlign: 'left',
        borderBottom: expanded ? `1px solid ${theme.palette.ui.border}` : 'none',
      }, sx]}
      {...rest}
    >
      <Box sx={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>{children}</Box>
      <Box
        sx={{
          display: 'inline-flex',
          transition: 'transform 180ms ease',
          transform: expanded ? 'rotate(180deg)' : 'none',
          color: 'text.secondary',
          flexShrink: 0,
        }}
      >
        {expandIcon ?? <ExpandMoreIcon sx={{ fontSize: 16 }} />}
      </Box>
    </ButtonBase>
  );
}

export function AccordionDetails({ sx, children, ...rest }: BoxProps) {
  const { expanded } = useContext(AccordionContext);
  return (
    <Collapse in={expanded} timeout={180}>
      <Box sx={[{ px: 2, py: 1.5 }, sx]} {...rest}>{children}</Box>
    </Collapse>
  );
}

// ─── Identity ─────────────────────────────────────────────────────────────────

export interface BadgeProps extends BoxProps {
  badgeContent?: ReactNode;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'success' | 'info' | 'default';
  invisible?: boolean;
  overlap?: string;
  variant?: 'standard' | 'dot';
  max?: number;
}

export function Badge({ badgeContent, color = 'primary', invisible, overlap: _o, variant, max = 99, sx, children, ...rest }: BadgeProps) {
  const theme = useTheme();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const palette = theme.palette as any;
  const main = color === 'default' ? theme.palette.text.secondary : palette[color]?.main ?? theme.palette.primary.main;
  const contrast = color === 'default' ? theme.palette.background.default : palette[color]?.contrastText ?? '#fff';
  const shown = !invisible && (variant === 'dot' || (badgeContent != null && badgeContent !== 0));
  const content = typeof badgeContent === 'number' && badgeContent > max ? `${max}+` : badgeContent;
  return (
    <Box sx={[{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle', flexShrink: 0 }, sx]} {...rest}>
      {children}
      {shown && (
        <Box
          component="span"
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            transform: 'translate(50%, -50%)',
            backgroundColor: main,
            color: contrast,
            borderRadius: 10,
            minWidth: variant === 'dot' ? 8 : 18,
            height: variant === 'dot' ? 8 : 18,
            px: variant === 'dot' ? 0 : 0.5,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.65rem',
            fontWeight: 700,
            fontFamily: theme.typography.fontFamily,
            lineHeight: 1,
          }}
        >
          {variant === 'dot' ? null : content}
        </Box>
      )}
    </Box>
  );
}

export interface AvatarProps extends BoxProps {
  src?: string;
  alt?: string;
  variant?: 'circular' | 'rounded' | 'square';
}

export function Avatar({ src, alt, variant = 'circular', sx, children, ...rest }: AvatarProps) {
  const theme = useTheme();
  return (
    <Box
      sx={[{
        width: 40,
        height: 40,
        borderRadius: variant === 'circular' ? '50%' : variant === 'rounded' ? 1 : 0,
        overflow: 'hidden',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.palette.ui.surface3,
        color: theme.palette.text.primary,
        fontFamily: theme.typography.fontFamily,
        fontWeight: 600,
        flexShrink: 0,
      }, sx]}
      {...rest}
    >
      {src
        ? <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : children ?? (alt ? alt.charAt(0).toUpperCase() : null)}
    </Box>
  );
}
