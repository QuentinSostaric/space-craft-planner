import { Button as PrimeButton } from 'primereact/button';
import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';
import { Box, alpha, useTheme, type SxValue } from '../../../ui/system';
import {
  compilePrimePartClasses,
  compilePrimeRootClass,
  type PrimePartStyles,
} from '../../../ui/prime/passThrough';

export type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gradient';
export type AppButtonSize = 'sm' | 'md' | 'lg';
type AppButtonPart = 'root' | 'icon' | 'label' | 'loadingIcon' | 'badge';

export interface AppButtonProps {
  children: ReactNode;
  variant?: AppButtonVariant | 'contained' | 'outlined' | 'text';
  outlined?: boolean;
  size?: AppButtonSize | 'small' | 'medium' | 'large';
  icon?: ReactNode;
  /** Leading icon (rendered before the label). */
  startIcon?: ReactNode;
  /** Trailing icon (rendered after the label). */
  endIcon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  name?: string;
  value?: string;
  form?: string;
  className?: string;
  title?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  ariaPressed?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  /** Render as an anchor (button-styled link) when set. */
  href?: string;
  target?: string;
  rel?: string;
  sx?: SxValue;
  partSx?: PrimePartStyles<AppButtonPart>;
}

const BASE_ANCHOR_SIZE: Record<AppButtonSize, SxValue> = {
  sm: { px: 1.25, py: 0.5, fontSize: '0.8125rem' },
  md: { px: 2, py: 0.75, fontSize: '0.875rem' },
  lg: { px: 2.75, py: 1, fontSize: '0.9375rem' },
};

const SIZE_MAP: Record<AppButtonSize, 'small' | 'large' | undefined> = {
  sm: 'small',
  md: undefined,
  lg: 'large',
};

const LEGACY_SIZE: Record<'small' | 'medium' | 'large', AppButtonSize> = {
  small: 'sm',
  medium: 'md',
  large: 'lg',
};

export function AppButton({
  children,
  variant = 'secondary',
  outlined = false,
  size = 'md',
  icon,
  startIcon,
  endIcon,
  iconPosition = 'left',
  fullWidth = false,
  loading = false,
  disabled = false,
  type = 'button',
  name,
  value,
  form,
  className,
  title,
  style,
  ariaLabel,
  ariaPressed,
  onClick,
  href,
  target,
  rel,
  sx,
  partSx,
}: AppButtonProps) {
  const theme = useTheme();
  const resolvedSize: AppButtonSize = size === 'small' || size === 'medium' || size === 'large'
    ? LEGACY_SIZE[size]
    : size;
  const resolvedIcon = icon ?? startIcon ?? endIcon;
  const resolvedIconPos: 'left' | 'right' = endIcon && !startIcon && !icon ? 'right' : iconPosition;
  const resolvedVariant: AppButtonVariant = outlined || variant === 'outlined'
    ? 'secondary'
    : variant === 'contained'
      ? 'primary'
      : variant === 'text'
        ? 'ghost'
        : variant;
  const variantSx: SxValue = resolvedVariant === 'ghost'
    ? {
        color: 'text.secondary',
        borderColor: 'divider',
        background: 'transparent',
        '&:hover': {
          color: 'text.primary',
          borderColor: alpha(theme.palette.primary.main, 0.55),
          background: 'transparent',
        },
      }
    : resolvedVariant === 'danger'
      ? {
          color: 'error.main',
          borderColor: alpha(theme.palette.error.main, 0.35),
          background: 'transparent',
          '&:hover': {
            color: 'error.main',
            borderColor: alpha(theme.palette.error.main, 0.55),
            background: alpha(theme.palette.error.main, 0.1),
          },
        }
      : resolvedVariant === 'gradient'
        ? {
            border: 0,
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            color: theme.palette.primary.contrastText,
          }
        : undefined;

  if (href) {
    const solid = resolvedVariant === 'primary' || resolvedVariant === 'gradient';
    const anchorSx: SxValue = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 0.5,
      borderRadius: 1,
      fontWeight: 600,
      lineHeight: 1.2,
      textDecoration: 'none',
      cursor: 'pointer',
      border: '1px solid',
      borderColor: solid ? 'transparent' : 'ui.borderStrong',
      backgroundColor: solid ? 'primary.main' : 'transparent',
      color: solid ? 'primary.contrastText' : 'text.secondary',
      transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease',
      '&:hover': solid
        ? { backgroundColor: 'primary.light' }
        : { borderColor: 'primary.main', color: 'text.primary', backgroundColor: 'ui.surface2' },
      ...(disabled ? { opacity: 0.45, pointerEvents: 'none' } : null),
    };
    return (
      <Box
        component="a"
        href={href}
        target={target}
        rel={rel}
        onClick={onClick}
        aria-label={ariaLabel}
        title={title}
        className={className}
        style={style}
        sx={[anchorSx, BASE_ANCHOR_SIZE[resolvedSize], fullWidth ? { width: '100%' } : undefined, variantSx, sx]}
      >
        {resolvedIcon && resolvedIconPos === 'left' && resolvedIcon}
        {children}
        {resolvedIcon && resolvedIconPos === 'right' && resolvedIcon}
      </Box>
    );
  }

  return (
    <PrimeButton
      type={type}
      label={typeof children === 'string' ? children : undefined}
      icon={resolvedIcon}
      iconPos={resolvedIconPos}
      size={SIZE_MAP[resolvedSize]}
      outlined={resolvedVariant === 'secondary' || resolvedVariant === 'ghost' || resolvedVariant === 'danger'}
      text={resolvedVariant === 'ghost'}
      loading={loading}
      disabled={disabled}
      name={name}
      value={value}
      form={form}
      title={title}
      style={style}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      onClick={onClick}
      className={compilePrimeRootClass(theme, [
        fullWidth ? { width: '100%' } : undefined,
        variantSx,
        sx,
      ], className)}
      pt={compilePrimePartClasses(theme, partSx)}
    >
      {typeof children === 'string' ? undefined : children}
    </PrimeButton>
  );
}
