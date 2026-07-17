import { alpha, useTheme } from '../../ui/system';
import type { SxProps, Theme } from '../../ui/system';
import { Button as MuiButton } from '../../ui/widgets';
import type { ReactNode } from 'react';
import type { ButtonProps as MuiButtonProps } from '../../ui/widgets';

type AppVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gradient';
type AppSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: ReactNode;
  variant?: AppVariant;
  size?: AppSize;
  icon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  'aria-label'?: string;
  title?: string;
  style?: React.CSSProperties;
}

const SIZE_MAP: Record<AppSize, MuiButtonProps['size']> = {
  sm: 'small',
  md: 'medium',
  lg: 'large',
};

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  fullWidth = false,
  className,
  ...rest
}: ButtonProps) {
  const theme = useTheme();

  const VARIANT_MAP: Record<AppVariant, { muiVariant: MuiButtonProps['variant']; sx?: SxProps<Theme> }> = {
    primary: { muiVariant: 'contained' },
    secondary: { muiVariant: 'outlined' },
    ghost: {
      muiVariant: 'outlined',
      sx: {
        color: 'text.secondary',
        borderColor: 'divider',
        '&:hover': {
          color: 'text.primary',
          borderColor: alpha(theme.palette.primary.main, 0.55),
          backgroundColor: 'transparent',
        },
      },
    },
    danger: {
      muiVariant: 'outlined',
      sx: {
        color: 'error.main',
        borderColor: alpha(theme.palette.error.main, 0.25),
        '&:hover': {
          backgroundColor: alpha(theme.palette.error.main, 0.1),
          borderColor: alpha(theme.palette.error.main, 0.4),
        },
      },
    },
    gradient: { muiVariant: 'contained' },
  };

  const { muiVariant, sx } = VARIANT_MAP[variant];

  return (
    <MuiButton
      variant={muiVariant}
      size={SIZE_MAP[size]}
      fullWidth={fullWidth}
      startIcon={icon}
      className={className}
      sx={sx}
      {...rest}
    >
      {children}
    </MuiButton>
  );
}
