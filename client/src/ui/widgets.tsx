/**
 * Widget layer — PrimeReact components (and a few hand-rolled atoms)
 * exposed with prop surfaces close to the ones the app already uses,
 * styled through the design-system engine.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Children,
  Fragment,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { MouseEvent, ReactElement, ReactNode, SyntheticEvent } from 'react';
import { Checkbox as PrimeCheckbox } from 'primereact/checkbox';
import { Dialog as PrimeDialog } from 'primereact/dialog';
import { InputSwitch } from 'primereact/inputswitch';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { ProgressBar } from 'primereact/progressbar';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Rating as PrimeRating } from 'primereact/rating';
import { Slider as PrimeSlider } from 'primereact/slider';
import {
  alphaColor,
  Box,
  FONT_MONO,
  ButtonBase,
  Collapse,
  IconButton,
  Paper,
  sxToClass,
  Typography,
  useTheme,
} from './system';
import type { BoxProps, OmitProps, SxObject, SxValue, Theme } from './system';
import { ExpandMoreIcon } from './icons';

function useSxClass(sx: SxValue): string {
  const theme = useTheme();
  return sxToClass(sx, theme);
}

function joinCls(...parts: Array<string | undefined | false>): string | undefined {
  const joined = parts.filter(Boolean).join(' ');
  return joined || undefined;
}

// ─── Button ───────────────────────────────────────────────────────────────────

export interface ButtonProps {
  variant?: 'contained' | 'outlined' | 'text';
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'success' | 'inherit';
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
  href?: string;
  target?: string;
  rel?: string;
  component?: any;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (event: any) => void;
  sx?: SxValue;
  className?: string;
  children?: ReactNode;
  [key: string]: unknown;
}

export function Button({
  variant = 'text',
  size = 'medium',
  color = 'primary',
  startIcon,
  endIcon,
  fullWidth,
  disabled,
  href,
  component,
  onClick,
  sx,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const paletteEntry = color === 'inherit'
    ? { main: 'currentColor', contrastText: theme.palette.background.default }
    : (theme.palette as any)[color] ?? theme.palette.primary;

  const base: SxObject = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0.75,
    fontFamily: theme.typography.fontFamily,
    fontWeight: 600,
    letterSpacing: 0,
    textTransform: 'none',
    borderRadius: 0.75,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease, transform 120ms ease',
    '&:active': { transform: 'translateY(1px)' },
    fontSize: size === 'small' ? '0.8125rem' : size === 'large' ? '0.9375rem' : '0.875rem',
    px: size === 'small' ? 1.25 : size === 'large' ? 2.75 : 2,
    py: size === 'small' ? 0.5 : size === 'large' ? 1 : 0.75,
    width: fullWidth ? '100%' : undefined,
    ...(disabled ? { opacity: 0.45, pointerEvents: 'none' } : null),
  };

  const look: SxObject = variant === 'contained'
    ? {
        backgroundColor: paletteEntry.main,
        color: paletteEntry.contrastText,
        border: '1px solid transparent',
        '&:hover': { backgroundColor: paletteEntry.light ?? paletteEntry.main },
      }
    : variant === 'outlined'
      ? {
          backgroundColor: 'transparent',
          color: color === 'primary' ? theme.palette.text.primary : paletteEntry.main,
          border: `1px solid ${color === 'primary' ? theme.palette.ui.borderStrong : alphaColor(paletteEntry.main, 0.5)}`,
          '&:hover': {
            borderColor: color === 'primary' ? theme.palette.ui.borderAccent : paletteEntry.main,
            backgroundColor: color === 'primary' ? theme.palette.brand.accentSoft : alphaColor(paletteEntry.main, 0.08),
          },
        }
      : {
          backgroundColor: 'transparent',
          color: color === 'primary' ? theme.palette.text.secondary : paletteEntry.main,
          border: '1px solid transparent',
          '&:hover': { backgroundColor: theme.palette.ui.surface2, color: theme.palette.text.primary },
        };

  return (
    <ButtonBase
      component={component ?? (href ? 'a' : 'button')}
      href={href}
      type={href ? undefined : type}
      onClick={onClick}
      disabled={disabled}
      className={className}
      sx={[base, look, sx]}
      {...rest}
    >
      {startIcon}
      {children}
      {endIcon}
    </ButtonBase>
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

export interface ChipProps extends OmitProps<BoxProps, 'children'> {
  label?: ReactNode;
  icon?: ReactElement;
  size?: 'small' | 'medium';
  variant?: 'filled' | 'outlined';
  color?: 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'success' | 'info';
  onDelete?: () => void;
  onClick?: (event: any) => void;
  clickable?: boolean;
}

export function Chip({
  label,
  icon,
  size = 'medium',
  variant = 'filled',
  color = 'default',
  onDelete,
  onClick,
  sx,
  ...rest
}: ChipProps) {
  const theme = useTheme();
  const main = color === 'default' ? theme.palette.text.secondary : (theme.palette as any)[color]?.main ?? theme.palette.text.secondary;
  const isDefault = color === 'default';
  return (
    <Box
      component={onClick ? 'button' : 'div'}
      onClick={onClick}
      sx={[{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        borderRadius: 0.5,
        fontFamily: theme.typography.fontFamily,
        fontWeight: 600,
        fontSize: size === 'small' ? '0.75rem' : '0.8125rem',
        height: size === 'small' ? 24 : 30,
        px: size === 'small' ? 1 : 1.25,
        border: variant === 'outlined'
          ? `1px solid ${isDefault ? theme.palette.ui.borderStrong : alphaColor(main, 0.5)}`
          : '1px solid transparent',
        backgroundColor: variant === 'outlined'
          ? 'transparent'
          : isDefault ? theme.palette.ui.surface2 : alphaColor(main, 0.16),
        color: isDefault ? theme.palette.text.primary : main,
        cursor: onClick ? 'pointer' : undefined,
        maxWidth: '100%',
      }, sx]}
      {...rest}
    >
      {icon}
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</Box>
      {onDelete && (
        <Box
          component="button"
          type="button"
          aria-label="remove"
          onClick={(e: MouseEvent<HTMLElement>) => { e.stopPropagation(); onDelete(); }}
          sx={{
            border: 'none', background: 'none', cursor: 'pointer', p: 0, ml: 0.25,
            color: 'inherit', opacity: 0.7, lineHeight: 0, '&:hover': { opacity: 1 },
          }}
        >
          <i className="pi pi-times-circle" style={{ fontSize: '0.75rem' }} />
        </Box>
      )}
    </Box>
  );
}

// ─── Inputs ───────────────────────────────────────────────────────────────────

export interface InputAdornmentProps extends BoxProps {
  position?: 'start' | 'end';
}

export function InputAdornment({ position: _position, sx, ...rest }: InputAdornmentProps) {
  return <Box sx={[{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }, sx]} {...rest} />;
}

export interface TextFieldProps {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: any) => void;
  onKeyDown?: (event: any) => void;
  onBlur?: (event: any) => void;
  onFocus?: (event: any) => void;
  placeholder?: string;
  label?: ReactNode;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  multiline?: boolean;
  rows?: number;
  minRows?: number;
  maxRows?: number;
  type?: string;
  disabled?: boolean;
  error?: boolean;
  helperText?: ReactNode;
  autoFocus?: boolean;
  autoComplete?: string;
  inputProps?: Record<string, unknown>;
  InputProps?: {
    startAdornment?: ReactNode;
    endAdornment?: ReactNode;
    [key: string]: unknown;
  };
  inputRef?: any;
  sx?: SxValue;
  className?: string;
  [key: string]: unknown;
}

export function TextField({
  value,
  defaultValue,
  onChange,
  onKeyDown,
  onBlur,
  onFocus,
  placeholder,
  label,
  size = 'medium',
  fullWidth,
  multiline,
  rows,
  minRows,
  type,
  disabled,
  error,
  helperText,
  autoFocus,
  autoComplete,
  inputProps,
  InputProps,
  inputRef,
  sx,
  className,
  ...rest
}: TextFieldProps) {
  const theme = useTheme();
  const wrapperCls = useSxClass([{
    display: 'inline-flex',
    flexDirection: 'column',
    gap: 0.5,
    width: fullWidth ? '100%' : undefined,
    minWidth: 0,
  }, sx]);

  const fieldCls = useSxClass({
    display: 'flex',
    alignItems: multiline ? 'flex-start' : 'center',
    gap: 0.75,
    backgroundColor: 'ui.surface',
    border: `1px solid ${error ? theme.palette.error.main : theme.palette.ui.border}`,
    borderRadius: 0.75,
    px: 1.25,
    py: multiline ? 1 : 0,
    minHeight: size === 'small' ? 34 : 40,
    transition: 'border-color 120ms ease, background-color 120ms ease',
    '&:hover': { borderColor: error ? theme.palette.error.main : theme.palette.ui.borderStrong },
    '&:focus-within': { borderColor: error ? theme.palette.error.main : theme.palette.primary.main },
    '& input, & textarea': {
      border: 'none',
      outline: 'none',
      boxShadow: 'none',
      background: 'transparent',
      color: theme.palette.text.primary,
      fontFamily: theme.typography.fontFamily,
      fontSize: '0.875rem',
      width: '100%',
      padding: 0,
    },
    '& input::placeholder, & textarea::placeholder': { color: theme.palette.text.disabled, opacity: 1 },
  });

  const sharedProps = {
    value: value as any,
    defaultValue: defaultValue as any,
    onChange: onChange as any,
    onKeyDown,
    onBlur,
    onFocus,
    placeholder,
    disabled,
    autoFocus,
    autoComplete,
    type,
    ref: inputRef,
    ...inputProps,
  };

  return (
    <div className={joinCls(wrapperCls, className)} {...rest}>
      {label && (
        <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: theme.typography.fontFamily }}>
          {label}
        </Typography>
      )}
      <div className={fieldCls}>
        {InputProps?.startAdornment}
        {multiline
          ? <InputTextarea unstyled rows={rows ?? minRows ?? 3} {...(sharedProps as any)} />
          : <InputText unstyled {...(sharedProps as any)} />}
        {InputProps?.endAdornment}
      </div>
      {helperText && (
        <Typography variant="caption" sx={{ color: error ? 'error.main' : 'text.disabled' }}>
          {helperText}
        </Typography>
      )}
    </div>
  );
}

export interface CheckboxProps {
  checked?: boolean;
  onChange?: (event: any, checked: boolean) => void;
  disabled?: boolean;
  size?: 'small' | 'medium';
  disableRipple?: boolean;
  sx?: SxValue;
  [key: string]: unknown;
}

export function Checkbox({ checked = false, onChange, disabled, size, disableRipple: _dr, sx, ...rest }: CheckboxProps) {
  const cls = useSxClass([{ display: 'inline-flex', '& .p-checkbox-box': size === 'small' ? { width: 16, height: 16 } : undefined }, sx]);
  return (
    <PrimeCheckbox
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange?.({ target: { checked: Boolean(e.checked) } }, Boolean(e.checked))}
      className={cls}
      {...rest}
    />
  );
}

export interface SwitchProps {
  checked?: boolean;
  onChange?: (event: any, checked: boolean) => void;
  disabled?: boolean;
  size?: 'small' | 'medium';
  sx?: SxValue;
}

export function Switch({ checked = false, onChange, disabled, size: _size, sx }: SwitchProps) {
  const cls = useSxClass(sx);
  return (
    <InputSwitch
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange?.({ target: { checked: Boolean(e.value) } }, Boolean(e.value))}
      className={cls}
    />
  );
}

export interface SliderProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange?: (event: any, value: number) => void;
  onChangeCommitted?: (event: any, value: number) => void;
  marks?: any;
  valueLabelDisplay?: string;
  valueLabelFormat?: (value: number) => ReactNode;
  getAriaValueText?: (value: number) => string;
  size?: string;
  sx?: SxValue;
  [key: string]: unknown;
}

export function Slider({
  value = 0,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  onChange,
  onChangeCommitted,
  marks: _marks,
  valueLabelDisplay: _vld,
  valueLabelFormat: _vlf,
  getAriaValueText: _gavt,
  size: _size,
  sx,
  ...rest
}: SliderProps) {
  const cls = useSxClass([{ width: '100%' }, sx]);
  return (
    <PrimeSlider
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => onChange?.(e.originalEvent, Number(e.value))}
      onSlideEnd={(e) => onChangeCommitted?.(e.originalEvent, Number(e.value))}
      className={cls}
      {...rest}
    />
  );
}

export interface RatingProps {
  value?: number | null;
  max?: number;
  readOnly?: boolean;
  onChange?: (event: any, value: number | null) => void;
  size?: string;
  name?: string;
  getLabelText?: (value: number) => string;
  sx?: SxValue;
}

export function Rating({ value, max = 5, readOnly, onChange, size: _size, name: _name, getLabelText: _glt, sx }: RatingProps) {
  const cls = useSxClass(sx);
  return (
    <PrimeRating
      value={value ?? 0}
      stars={max}
      readOnly={readOnly}
      cancel={false}
      onChange={(e) => onChange?.(e.originalEvent, e.value ?? null)}
      className={cls}
    />
  );
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export interface LinearProgressProps extends BoxProps {
  variant?: 'indeterminate' | 'determinate';
  value?: number;
  color?: string;
}

export function LinearProgress({ variant = 'indeterminate', value, color: _color, sx, ...rest }: LinearProgressProps) {
  const cls = useSxClass([{ height: 4, '& .p-progressbar-label': { display: 'none' } }, sx]);
  return (
    <ProgressBar
      mode={variant === 'determinate' ? 'determinate' : 'indeterminate'}
      value={value}
      showValue={false}
      className={cls}
      {...(rest as any)}
    />
  );
}

export interface CircularProgressProps {
  size?: number;
  thickness?: number;
  color?: string;
  sx?: SxValue;
}

export function CircularProgress({ size = 40, sx }: CircularProgressProps) {
  const cls = useSxClass(sx);
  return <ProgressSpinner style={{ width: size, height: size }} strokeWidth="4" className={cls} />;
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

const DIALOG_WIDTHS: Record<string, string> = {
  xs: '420px', sm: '560px', md: '760px', lg: '1000px', xl: '1240px',
};

export interface DialogProps {
  open: boolean;
  onClose?: (event?: any, reason?: string) => void;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  fullWidth?: boolean;
  fullScreen?: boolean;
  children?: ReactNode;
  sx?: SxValue;
  [key: string]: unknown;
}

export function Dialog({ open, onClose, maxWidth = 'sm', fullWidth, fullScreen, children, sx, ...rest }: DialogProps) {
  const theme = useTheme();
  const cls = useSxClass([{
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.ui.borderStrong}`,
    borderRadius: 1.25,
    color: theme.palette.text.primary,
    maxWidth: maxWidth ? DIALOG_WIDTHS[maxWidth] : '96vw',
    width: fullWidth ? '96vw' : undefined,
    '& .p-dialog-content': { background: 'transparent', color: 'inherit', padding: 0, borderRadius: 'inherit' },
  }, sx]);
  return (
    <PrimeDialog
      visible={open}
      onHide={() => onClose?.(undefined, 'backdropClick')}
      dismissableMask
      draggable={false}
      resizable={false}
      closable={false}
      showHeader={false}
      maximized={fullScreen}
      className={cls}
      contentStyle={{ overflow: 'visible' }}
      {...rest}
    >
      {children}
    </PrimeDialog>
  );
}

export function DialogTitle({ sx, ...rest }: BoxProps) {
  return <Typography variant="h6" component="div" sx={[{ px: 3, pt: 2.5, pb: 1.5 }, sx]} {...rest} />;
}

export function DialogContent({ sx, dividers: _dividers, ...rest }: BoxProps & { dividers?: boolean }) {
  return <Box sx={[{ px: 3, py: 1, overflowY: 'auto' }, sx]} {...rest} />;
}

export function DialogActions({ sx, ...rest }: BoxProps) {
  return <Box sx={[{ display: 'flex', justifyContent: 'flex-end', gap: 1, px: 3, py: 2 }, sx]} {...rest} />;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

interface TabsContextValue {
  value: unknown;
  onChange?: (event: any, value: any) => void;
}

const TabsContext = createContext<TabsContextValue>({ value: undefined });

export interface TabsProps extends OmitProps<BoxProps, 'onChange'> {
  value: unknown;
  onChange?: (event: any, value: any) => void;
  variant?: string;
  scrollButtons?: unknown;
  allowScrollButtonsMobile?: boolean;
}

export function Tabs({ value, onChange, variant: _v, scrollButtons: _sb, allowScrollButtonsMobile: _asbm, sx, children, ...rest }: TabsProps) {
  const ctx = useMemo(() => ({ value, onChange }), [value, onChange]);
  return (
    <TabsContext.Provider value={ctx}>
      <Box
        role="tablist"
        sx={[{ display: 'flex', alignItems: 'stretch', gap: 0.5, minHeight: 46, overflowX: 'auto' }, sx]}
        {...rest}
      >
        {children}
      </Box>
    </TabsContext.Provider>
  );
}

export interface TabProps extends BoxProps {
  label?: ReactNode;
  value?: unknown;
  icon?: ReactElement;
  iconPosition?: 'start' | 'end' | 'top';
  disabled?: boolean;
}

export function Tab({ label, value, icon, iconPosition = 'start', disabled, sx, ...rest }: TabProps) {
  const theme = useTheme();
  const ctx = useContext(TabsContext);
  const selected = ctx.value === value;
  return (
    <ButtonBase
      role="tab"
      aria-selected={selected}
      disabled={disabled}
      onClick={(e: SyntheticEvent) => ctx.onChange?.(e, value)}
      sx={[{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        flexDirection: iconPosition === 'top' ? 'column' : 'row',
        px: 2,
        py: 1.25,
        minHeight: 46,
        fontFamily: theme.typography.fontFamily,
        fontWeight: selected ? 600 : 550,
        fontSize: '0.8438rem',
        color: selected ? theme.palette.primary.main : theme.palette.text.secondary,
        borderBottom: `2px solid ${selected ? theme.palette.primary.main : 'transparent'}`,
        transition: 'color 120ms ease, border-color 120ms ease',
        '&:hover': { color: selected ? theme.palette.primary.main : theme.palette.text.primary },
        ...(disabled ? { opacity: 0.4, pointerEvents: 'none' } : null),
      }, sx]}
      {...rest}
    >
      {iconPosition !== 'end' && icon}
      {label}
      {iconPosition === 'end' && icon}
    </ButtonBase>
  );
}

// ─── ToggleButton ─────────────────────────────────────────────────────────────

interface ToggleGroupContextValue {
  value: unknown;
  exclusive?: boolean;
  onChange?: (event: any, value: any) => void;
  size?: 'small' | 'medium';
}

const ToggleGroupContext = createContext<ToggleGroupContextValue>({ value: undefined });

export interface ToggleButtonGroupProps extends OmitProps<BoxProps, 'onChange'> {
  value: unknown;
  exclusive?: boolean;
  onChange?: (event: any, value: any) => void;
  size?: 'small' | 'medium';
}

export function ToggleButtonGroup({ value, exclusive, onChange, size, sx, children, ...rest }: ToggleButtonGroupProps) {
  const theme = useTheme();
  const ctx = useMemo(() => ({ value, exclusive, onChange, size }), [value, exclusive, onChange, size]);
  return (
    <ToggleGroupContext.Provider value={ctx}>
      <Box
        sx={[{
          display: 'inline-flex',
          border: `1px solid ${theme.palette.ui.border}`,
          borderRadius: 0.75,
          overflow: 'hidden',
          '& > *:not(:last-child)': { borderRight: `1px solid ${theme.palette.ui.border}` },
        }, sx]}
        {...rest}
      >
        {children}
      </Box>
    </ToggleGroupContext.Provider>
  );
}

export interface ToggleButtonProps extends BoxProps {
  value: unknown;
  selected?: boolean;
  disabled?: boolean;
  size?: 'small' | 'medium';
}

export function ToggleButton({ value, selected: selectedProp, disabled, size, sx, children, ...rest }: ToggleButtonProps) {
  const theme = useTheme();
  const ctx = useContext(ToggleGroupContext);
  const selected = selectedProp ?? (Array.isArray(ctx.value) ? ctx.value.includes(value) : ctx.value === value);
  const effSize = size ?? ctx.size ?? 'medium';
  return (
    <ButtonBase
      disabled={disabled}
      aria-pressed={selected}
      onClick={(e: SyntheticEvent) => ctx.onChange?.(e, value)}
      sx={[{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.75,
        fontFamily: theme.typography.fontFamily,
        fontWeight: 600,
        fontSize: effSize === 'small' ? '0.75rem' : '0.8125rem',
        px: effSize === 'small' ? 1.25 : 1.75,
        py: effSize === 'small' ? 0.5 : 0.75,
        color: selected ? theme.palette.primary.main : theme.palette.text.secondary,
        backgroundColor: selected ? theme.palette.brand.accentSoft : 'transparent',
        transition: 'background-color 120ms ease, color 120ms ease',
        '&:hover': { backgroundColor: selected ? alphaColor(theme.palette.primary.main, 0.22) : theme.palette.ui.surface2, color: selected ? theme.palette.primary.main : theme.palette.text.primary },
        ...(disabled ? { opacity: 0.4, pointerEvents: 'none' } : null),
      }, sx]}
      {...rest}
    >
      {children}
    </ButtonBase>
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
  onChange?: (event: any, expanded: boolean) => void;
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

// ─── Menu ─────────────────────────────────────────────────────────────────────

export interface MenuProps {
  anchorEl?: HTMLElement | null;
  open: boolean;
  onClose?: () => void;
  children?: ReactNode;
  anchorOrigin?: unknown;
  transformOrigin?: unknown;
  slotProps?: { paper?: { sx?: SxValue } };
  sx?: SxValue;
}

export function Menu({ anchorEl, open, onClose, children, slotProps, sx }: MenuProps) {
  const theme = useTheme();
  const backdropRef = useRef<HTMLDivElement | null>(null);
  if (!open || !anchorEl) return null;
  const rect = anchorEl.getBoundingClientRect();
  const menuMaxHeight = Math.min(window.innerHeight - rect.bottom - 16, 420);
  const openUp = menuMaxHeight < 180;
  const paperCls = sxToClass([{
    position: 'fixed',
    left: Math.min(rect.left, Math.max(8, window.innerWidth - 348)),
    ...(openUp
      ? { bottom: window.innerHeight - rect.top + 4 }
      : { top: rect.bottom + 4 }),
    zIndex: theme.zIndex.modal,
    minWidth: rect.width,
    maxHeight: openUp ? rect.top - 16 : menuMaxHeight,
    overflowY: 'auto',
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.ui.borderStrong}`,
    borderRadius: 1,
    boxShadow: '0 10px 28px rgba(0,0,0,0.4)',
    py: 0.5,
  }, slotProps?.paper?.sx, sx], theme);
  return (
    <div
      ref={backdropRef}
      style={{ position: 'fixed', inset: 0, zIndex: theme.zIndex.modal - 1 }}
      onClick={(e) => { if (e.target === backdropRef.current) onClose?.(); }}
      onContextMenu={(e) => { e.preventDefault(); onClose?.(); }}
    >
      <ul role="menu" className={paperCls} style={{ listStyle: 'none', margin: 0 }}>
        {children}
      </ul>
    </div>
  );
}

export interface MenuItemProps extends BoxProps {
  onClick?: (event: any) => void;
  selected?: boolean;
  disabled?: boolean;
  dense?: boolean;
  value?: unknown;
}

export function MenuItem({ onClick, selected, disabled, dense, sx, children, ...rest }: MenuItemProps) {
  const theme = useTheme();
  return (
    <Box
      component="li"
      role="menuitem"
      onClick={disabled ? undefined : onClick}
      sx={[{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: dense ? 0.6 : 1,
        cursor: 'pointer',
        fontFamily: theme.typography.fontFamily,
        fontSize: '0.875rem',
        color: theme.palette.text.primary,
        backgroundColor: selected ? theme.palette.brand.accentSoft : 'transparent',
        '&:hover': { backgroundColor: selected ? alphaColor(theme.palette.primary.main, 0.2) : theme.palette.ui.surface2 },
        ...(disabled ? { opacity: 0.45, pointerEvents: 'none' } : null),
      }, sx]}
      {...rest}
    >
      {children}
    </Box>
  );
}

// ─── Structure atoms ──────────────────────────────────────────────────────────

export function List({ dense: _d, disablePadding, sx, ...rest }: BoxProps & { dense?: boolean; disablePadding?: boolean }) {
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

export function Toolbar({ sx, ...rest }: BoxProps & { disableGutters?: boolean }) {
  return <Box sx={[{ display: 'flex', alignItems: 'center', minHeight: 56, px: 2 }, sx]} {...rest} />;
}

export function AppBar({ position: _p, sx, ...rest }: BoxProps & { position?: string; color?: string; elevation?: number }) {
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

export function Breadcrumbs({ separator = '/', sx, children, ...rest }: BoxProps & { separator?: ReactNode; 'aria-label'?: string }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <Box component="nav" sx={[{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }, sx]} {...rest}>
      {items.map((child, index) => (
        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
          {index > 0 && <Box component="span" sx={{ color: 'text.disabled', fontSize: '0.8125rem' }}>{separator}</Box>}
          {child}
        </Box>
      ))}
    </Box>
  );
}

// ─── Tables ───────────────────────────────────────────────────────────────────

export function TableContainer({ component: Component = 'div', sx, ...rest }: BoxProps) {
  return <Box component={Component} sx={[{ overflowX: 'auto', width: '100%' }, sx]} {...rest} />;
}

export function Table({ size: _s, sx, ...rest }: BoxProps & { size?: string; stickyHeader?: boolean }) {
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

export function TableCell({ align, component, colSpan, sx, ...rest }: BoxProps & { align?: string; colSpan?: number; component?: any }) {
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

// ─── Misc feedback ────────────────────────────────────────────────────────────

export interface AlertProps extends BoxProps {
  severity?: 'error' | 'warning' | 'info' | 'success';
  variant?: string;
  onClose?: () => void;
  icon?: ReactNode | false;
  action?: ReactNode;
}

export function Alert({ severity = 'info', variant: _v, onClose, icon, action, sx, children, ...rest }: AlertProps) {
  const theme = useTheme();
  const main = (theme.palette as any)[severity === 'info' ? 'info' : severity].main;
  const defaultIcon = {
    error: 'pi-times-circle',
    warning: 'pi-exclamation-triangle',
    info: 'pi-info-circle',
    success: 'pi-check-circle',
  }[severity];
  return (
    <Box
      role="alert"
      sx={[{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        px: 1.75,
        py: 1.25,
        borderRadius: 1,
        border: `1px solid ${alphaColor(main, 0.4)}`,
        backgroundColor: alphaColor(main, 0.1),
        color: theme.palette.text.primary,
        fontFamily: theme.typography.fontFamily,
        fontSize: '0.8438rem',
      }, sx]}
      {...rest}
    >
      {icon !== false && (icon ?? <i className={`pi ${defaultIcon}`} style={{ color: main, fontSize: '1rem', marginTop: 2 }} />)}
      <Box sx={{ minWidth: 0, flex: 1 }}>{children}</Box>
      {action}
      {onClose && (
        <IconButton size="small" aria-label="close" onClick={onClose} sx={{ mt: -0.25 }}>
          <i className="pi pi-times" style={{ fontSize: '0.75rem' }} />
        </IconButton>
      )}
    </Box>
  );
}

export interface SnackbarProps {
  open: boolean;
  onClose?: (event?: any, reason?: string) => void;
  autoHideDuration?: number | null;
  anchorOrigin?: { vertical: 'top' | 'bottom'; horizontal: 'left' | 'center' | 'right' };
  children?: ReactElement;
  message?: ReactNode;
  sx?: SxValue;
}

export function Snackbar({ open, onClose, autoHideDuration, anchorOrigin, children, message, sx }: SnackbarProps) {
  const timer = useRef<number | null>(null);
  if (open && autoHideDuration && onClose) {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onClose(undefined, 'timeout'), autoHideDuration);
  }
  if (!open) return null;
  const vertical = anchorOrigin?.vertical ?? 'bottom';
  const horizontal = anchorOrigin?.horizontal ?? 'left';
  return (
    <Box
      sx={[{
        position: 'fixed',
        zIndex: (t: Theme) => t.zIndex.snackbar,
        [vertical]: 24,
        ...(horizontal === 'center' ? { left: '50%', transform: 'translateX(-50%)' } : { [horizontal]: 24 }),
      }, sx]}
    >
      {children ?? <Paper sx={{ px: 2, py: 1.25 }}>{message}</Paper>}
    </Box>
  );
}

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
  const main = color === 'default' ? theme.palette.text.secondary : (theme.palette as any)[color]?.main ?? theme.palette.primary.main;
  const contrast = color === 'default' ? theme.palette.background.default : (theme.palette as any)[color]?.contrastText ?? '#fff';
  const shown = !invisible && (variant === 'dot' || (badgeContent != null && badgeContent !== 0));
  const content = typeof badgeContent === 'number' && badgeContent > max ? `${max}+` : badgeContent;
  return (
    <Box sx={[{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle', flexShrink: 0 }, sx]} {...rest}>
      {children}
      {shown && (
        <Box
          component="span"
          className="MuiBadge-badge"
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

// ─── Tooltip ──────────────────────────────────────────────────────────────────

export interface TooltipProps {
  title?: ReactNode;
  children: ReactElement;
  placement?: string;
  arrow?: boolean;
  enterDelay?: number;
  disableHoverListener?: boolean;
  componentsProps?: unknown;
  slotProps?: unknown;
}

export function Tooltip({ title, children, placement = 'bottom', disableHoverListener }: TooltipProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  if (!title || disableHoverListener) return children;

  const show = (event: SyntheticEvent) => {
    const target = event.currentTarget as HTMLElement;
    anchorRef.current = target;
    const rect = target.getBoundingClientRect();
    const top = placement.startsWith('top') ? rect.top - 8 : rect.bottom + 8;
    setPos({ left: rect.left + rect.width / 2, top });
    setOpen(true);
  };
  const hide = () => setOpen(false);

  const child = Children.only(children);
  const cloned = isValidElement(child)
    ? cloneElement(child as ReactElement<any>, {
        onMouseEnter: (e: SyntheticEvent) => { (child.props as any).onMouseEnter?.(e); show(e); },
        onMouseLeave: (e: SyntheticEvent) => { (child.props as any).onMouseLeave?.(e); hide(); },
        onFocus: (e: SyntheticEvent) => { (child.props as any).onFocus?.(e); show(e); },
        onBlur: (e: SyntheticEvent) => { (child.props as any).onBlur?.(e); hide(); },
      })
    : children;

  return (
    <>
      {cloned}
      {open && pos && (
        <Box
          role="tooltip"
          sx={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            transform: `translate(-50%, ${placement.startsWith('top') ? '-100%' : '0'})`,
            zIndex: theme.zIndex.tooltip,
            backgroundColor: theme.palette.ui.surface3,
            color: theme.palette.text.primary,
            border: `1px solid ${theme.palette.ui.borderStrong}`,
            borderRadius: 0.75,
            px: 1.25,
            py: 0.6,
            fontSize: '0.75rem',
            fontFamily: theme.typography.fontFamily,
            maxWidth: 320,
            pointerEvents: 'none',
            boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
          }}
        >
          {title}
        </Box>
      )}
    </>
  );
}

// ─── Forms ────────────────────────────────────────────────────────────────────

export function FormControl({ fullWidth, size: _s, sx, ...rest }: BoxProps & { fullWidth?: boolean; size?: string }) {
  return <Box sx={[{ display: 'inline-flex', flexDirection: 'column', gap: 0.5, width: fullWidth ? '100%' : undefined }, sx]} {...rest} />;
}

export function FormControlLabel({ control, label, labelPlacement: _lp, sx, ...rest }: BoxProps & { control: ReactElement; label: ReactNode; labelPlacement?: string }) {
  return (
    <Box component="label" sx={[{ display: 'inline-flex', alignItems: 'center', gap: 1, cursor: 'pointer' }, sx]} {...rest}>
      {control}
      <Typography variant="body2" component="span">{label}</Typography>
    </Box>
  );
}

// ─── Autocomplete ─────────────────────────────────────────────────────────────

export interface AutocompleteRenderInputParams {
  InputProps: { startAdornment?: ReactNode; endAdornment?: ReactNode };
  inputProps: Record<string, unknown>;
  placeholder?: string;
  size?: 'small' | 'medium';
}

export interface AutocompleteProps<T> {
  options: T[];
  value?: T | null;
  onChange?: (event: any, value: T | null) => void;
  getOptionLabel?: (option: T) => string;
  getOptionKey?: (option: T) => string | number;
  isOptionEqualToValue?: (option: T, value: T) => boolean;
  renderInput: (params: AutocompleteRenderInputParams) => ReactNode;
  renderOption?: (props: Record<string, unknown> & { key?: string | number }, option: T) => ReactNode;
  groupBy?: (option: T) => string;
  filterOptions?: (options: T[], state: { inputValue: string }) => T[];
  blurOnSelect?: boolean;
  clearOnBlur?: boolean;
  disableClearable?: boolean;
  disabled?: boolean;
  loading?: boolean;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  sx?: SxValue;
  className?: string;
  noOptionsText?: ReactNode;
  [key: string]: unknown;
}

export function Autocomplete<T>({
  options,
  value = null,
  onChange,
  getOptionLabel = (o: T) => String(o),
  getOptionKey,
  isOptionEqualToValue = (a: T, b: T) => a === b,
  renderInput,
  renderOption,
  groupBy,
  filterOptions,
  blurOnSelect,
  clearOnBlur: _clearOnBlur,
  disableClearable,
  disabled,
  loading: _loading,
  size,
  fullWidth,
  sx,
  className,
  noOptionsText,
  ...rest
}: AutocompleteProps<T>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [editing, setEditing] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputElRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const displayValue = editing ? inputValue : value ? getOptionLabel(value) : '';

  const filtered = useMemo(() => {
    const state = { inputValue: editing ? inputValue : '' };
    if (filterOptions) return filterOptions(options, state);
    const q = state.inputValue.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => getOptionLabel(option).toLowerCase().includes(q));
  }, [options, inputValue, editing, filterOptions, getOptionLabel]);

  const select = (event: SyntheticEvent, option: T | null) => {
    onChange?.(event, option);
    setEditing(false);
    setInputValue('');
    setOpen(false);
    if (blurOnSelect) inputElRef.current?.blur();
  };

  const rootCls = sxToClass([{ position: 'relative', display: 'inline-block', width: fullWidth ? '100%' : undefined, minWidth: 0 }, sx], theme);
  const listCls = sxToClass({
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    zIndex: theme.zIndex.modal,
    maxHeight: 340,
    overflowY: 'auto',
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.ui.borderStrong}`,
    borderRadius: 1,
    boxShadow: '0 10px 28px rgba(0,0,0,0.4)',
    py: 0.5,
    m: 0,
    listStyle: 'none',
  }, theme);
  const groupCls = sxToClass({
    px: 1.5,
    py: 0.5,
    fontFamily: FONT_MONO,
    fontSize: '0.6875rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: theme.palette.text.disabled,
  }, theme);
  const optionCls = sxToClass({
    px: 1.5,
    py: 0.75,
    cursor: 'pointer',
    fontFamily: theme.typography.fontFamily,
    fontSize: '0.875rem',
    color: theme.palette.text.primary,
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    '&[data-highlighted="true"], &:hover': { backgroundColor: theme.palette.ui.surface2 },
  }, theme);

  const inputProps: Record<string, unknown> = {
    ref: inputElRef,
    value: displayValue,
    disabled,
    role: 'combobox',
    'aria-expanded': open,
    autoComplete: 'off',
    onChange: (e: { target: { value: string } }) => {
      setEditing(true);
      setInputValue(e.target.value);
      setOpen(true);
      setHighlight(0);
    },
    onFocus: () => setOpen(true),
    onBlur: () => {
      window.setTimeout(() => {
        setOpen(false);
        setEditing(false);
        setInputValue('');
      }, 120);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
      else if (e.key === 'Enter') {
        if (open && filtered[highlight]) { e.preventDefault(); select(e, filtered[highlight]); }
      } else if (e.key === 'Escape') { setOpen(false); setEditing(false); setInputValue(''); }
    },
  };

  const endAdornment = (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
      {!disableClearable && value != null && (
        <IconButton size="small" aria-label="clear" onMouseDown={(e: MouseEvent<HTMLElement>) => { e.preventDefault(); select(e, null); }} sx={{ p: 0.25 }}>
          <i className="pi pi-times" style={{ fontSize: '0.7rem' }} />
        </IconButton>
      )}
      <IconButton
        size="small"
        aria-label="open"
        onMouseDown={(e: MouseEvent<HTMLElement>) => { e.preventDefault(); setOpen((o) => !o); inputElRef.current?.focus(); }}
        sx={{ p: 0.25 }}
      >
        <i className="pi pi-chevron-down" style={{ fontSize: '0.7rem', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 150ms ease' }} />
      </IconButton>
    </Box>
  );

  let lastGroup: string | null = null;

  return (
    <div ref={rootRef} className={joinCls(rootCls, className)} {...rest}>
      {renderInput({ InputProps: { endAdornment }, inputProps, size })}
      {open && (
        <ul role="listbox" className={listCls}>
          {filtered.length === 0 && (
            <li className={optionCls} style={{ cursor: 'default', opacity: 0.6 }}>
              {noOptionsText ?? 'No options'}
            </li>
          )}
          {filtered.map((option, index) => {
            const key = getOptionKey ? getOptionKey(option) : getOptionLabel(option) + index;
            const group = groupBy ? groupBy(option) : null;
            const showGroup = group !== null && group !== lastGroup;
            lastGroup = group;
            const optionProps = {
              key,
              className: optionCls,
              'data-highlighted': index === highlight ? 'true' : undefined,
              role: 'option',
              'aria-selected': value != null && isOptionEqualToValue(option, value),
              onMouseDown: (e: MouseEvent<HTMLElement>) => { e.preventDefault(); select(e, option); },
              onMouseEnter: () => setHighlight(index),
            };
            return (
              <Fragment key={key}>
                {showGroup && <li className={groupCls}>{group}</li>}
                {renderOption
                  ? renderOption(optionProps, option)
                  : <li {...optionProps}>{getOptionLabel(option)}</li>}
              </Fragment>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────

export interface SelectProps {
  value: unknown;
  onChange?: (event: any) => void;
  children?: ReactNode;
  size?: 'small' | 'medium';
  displayEmpty?: boolean;
  renderValue?: (value: unknown) => ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
  sx?: SxValue;
  className?: string;
  [key: string]: unknown;
}

export function Select({
  value,
  onChange,
  children,
  size = 'medium',
  displayEmpty: _de,
  renderValue,
  disabled,
  fullWidth,
  sx,
  className,
  ...rest
}: SelectProps) {
  const theme = useTheme();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const items = Children.toArray(children).filter(isValidElement) as ReactElement<any>[];
  const selectedItem = items.find((item) => item.props.value === value);
  const label = renderValue
    ? renderValue(value)
    : selectedItem?.props.children ?? String(value ?? '');

  const rootCls = sxToClass([{
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 1,
    backgroundColor: theme.palette.ui.surface,
    border: `1px solid ${theme.palette.ui.border}`,
    borderRadius: 0.75,
    px: 1.25,
    minHeight: size === 'small' ? 34 : 40,
    fontFamily: theme.typography.fontFamily,
    fontSize: '0.875rem',
    color: theme.palette.text.primary,
    cursor: disabled ? 'default' : 'pointer',
    width: fullWidth ? '100%' : undefined,
    minWidth: 0,
    '&:hover': { borderColor: theme.palette.ui.borderStrong },
    ...(disabled ? { opacity: 0.5, pointerEvents: 'none' } : null),
  }, sx], theme);

  return (
    <>
      <button
        type="button"
        className={joinCls(rootCls, className)}
        onClick={(e) => setAnchor(e.currentTarget)}
        disabled={disabled}
        {...rest}
      >
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {label}
        </Box>
        <i className="pi pi-chevron-down" style={{ fontSize: '0.7rem', flexShrink: 0, opacity: 0.7 }} />
      </button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {items.map((item, index) => cloneElement(item, {
          key: item.key ?? index,
          selected: item.props.value === value,
          onClick: (e: MouseEvent<HTMLElement>) => {
            item.props.onClick?.(e);
            onChange?.({ target: { value: item.props.value } });
            setAnchor(null);
          },
        }))}
      </Menu>
    </>
  );
}

// ─── Steppers ─────────────────────────────────────────────────────────────────

export function Stepper({ activeStep = 0, alternativeLabel: _al, sx, children, ...rest }: BoxProps & { activeStep?: number; alternativeLabel?: boolean }) {
  const theme = useTheme();
  const steps = Children.toArray(children).filter(isValidElement) as ReactElement<any>[];
  return (
    <Box sx={[{ display: 'flex', alignItems: 'flex-start', gap: 1 }, sx]} {...rest}>
      {steps.map((step, index) => (
        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.6875rem',
              fontWeight: 700,
              fontFamily: theme.typography.fontFamily,
              flexShrink: 0,
              backgroundColor: index <= activeStep ? theme.palette.primary.main : theme.palette.ui.surface3,
              color: index <= activeStep ? theme.palette.primary.contrastText : theme.palette.text.disabled,
            }}
          >
            {index < activeStep ? <i className="pi pi-check" style={{ fontSize: '0.6rem' }} /> : index + 1}
          </Box>
          <Box sx={{ minWidth: 0, color: index === activeStep ? 'text.primary' : 'text.disabled' }}>{step}</Box>
          {index < steps.length - 1 && (
            <Box sx={{ flex: 1, height: 1, backgroundColor: theme.palette.ui.border, minWidth: 12 }} />
          )}
        </Box>
      ))}
    </Box>
  );
}

export function Step({ children, completed: _c, active: _a, ...rest }: BoxProps & { completed?: boolean; active?: boolean }) {
  return <Box {...rest}>{children}</Box>;
}

export function StepLabel({ children, sx, ...rest }: BoxProps) {
  return (
    <Typography variant="caption" sx={[{ color: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, sx]} {...rest}>
      {children}
    </Typography>
  );
}

export function MobileStepper({ steps, activeStep = 0, backButton, nextButton, position: _p, variant: _v, sx, ...rest }: BoxProps & {
  steps: number;
  activeStep?: number;
  backButton?: ReactNode;
  nextButton?: ReactNode;
  position?: string;
  variant?: string;
}) {
  const theme = useTheme();
  return (
    <Box sx={[{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, p: 1 }, sx]} {...rest}>
      {backButton}
      <Box sx={{ display: 'flex', gap: 0.75 }}>
        {Array.from({ length: steps }).map((_, index) => (
          <Box
            key={index}
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: index === activeStep ? theme.palette.primary.main : theme.palette.ui.surface3,
            }}
          />
        ))}
      </Box>
      {nextButton}
    </Box>
  );
}
