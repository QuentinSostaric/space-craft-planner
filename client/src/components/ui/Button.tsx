import type { ReactNode } from 'react';
import MuiButton from '@mui/material/Button';
import type { ButtonProps as MuiButtonProps } from '@mui/material/Button';
import type { SxProps, Theme } from '@mui/material/styles';

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

const VARIANT_MAP: Record<AppVariant, { muiVariant: MuiButtonProps['variant']; sx?: SxProps<Theme> }> = {
  primary: { muiVariant: 'text' },
  secondary: { muiVariant: 'outlined' },
  ghost: {
    muiVariant: 'outlined',
    sx: {
      color: 'text.secondary',
      borderColor: 'divider',
      '&::after': {
        content: '""',
        position: 'absolute',
        bottom: 0, left: '50%', right: '50%',
        height: 1,
        background: 'primary.main',
        transition: 'left 150ms, right 150ms',
      },
      '&:hover': {
        color: 'text.primary',
        borderColor: 'rgba(139, 92, 246, 0.55)',
        backgroundColor: 'transparent',
      },
      '&:hover::after': { left: 0, right: 0 },
    },
  },
  danger: {
    muiVariant: 'outlined',
    sx: {
      color: 'error.main',
      borderColor: 'rgba(248,113,113,.25)',
      '&:hover': {
        backgroundColor: 'rgba(248,113,113,.1)',
        borderColor: 'rgba(248,113,113,.4)',
      },
    },
  },
  gradient: { muiVariant: 'contained' },
};

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
