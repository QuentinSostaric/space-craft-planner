import type { CSSProperties } from 'react';
import { AppButton, type AppButtonProps } from './controls/AppButton';

export interface ButtonProps extends Omit<AppButtonProps, 'ariaLabel' | 'style'> {
  'aria-label'?: string;
  style?: CSSProperties;
}

export function Button({
  'aria-label': ariaLabel,
  style,
  ...props
}: ButtonProps) {
  return (
    <AppButton
      {...props}
      ariaLabel={ariaLabel}
      style={style}
    />
  );
}
