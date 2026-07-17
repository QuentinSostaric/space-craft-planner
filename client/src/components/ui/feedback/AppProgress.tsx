import { ProgressBar } from 'primereact/progressbar';
import { ProgressSpinner } from 'primereact/progressspinner';
import { useTheme, type SxValue } from '../../../ui/system';
import { compilePrimeRootClass } from '../../../ui/prime/passThrough';

export interface AppProgressBarProps {
  value?: number;
  indeterminate?: boolean;
  label?: string;
  className?: string;
  sx?: SxValue;
}

export function AppProgressBar({
  value,
  indeterminate = value == null,
  label,
  className,
  sx,
}: AppProgressBarProps) {
  const theme = useTheme();
  return (
    <ProgressBar
      value={value}
      mode={indeterminate ? 'indeterminate' : 'determinate'}
      showValue={false}
      aria-label={label}
      className={compilePrimeRootClass(theme, sx, className)}
    />
  );
}

export interface AppProgressSpinnerProps {
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
  sx?: SxValue;
}

export function AppProgressSpinner({
  size = 40,
  strokeWidth = 3,
  label,
  className,
  sx,
}: AppProgressSpinnerProps) {
  const theme = useTheme();
  return (
    <ProgressSpinner
      style={{ width: size, height: size }}
      strokeWidth={String(strokeWidth)}
      aria-label={label}
      className={compilePrimeRootClass(theme, sx, className)}
    />
  );
}
