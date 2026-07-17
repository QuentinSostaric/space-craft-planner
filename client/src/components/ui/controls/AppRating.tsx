import { Rating } from 'primereact/rating';
import { useTheme, type SxValue } from '../../../ui/system';
import { compilePrimeRootClass } from '../../../ui/prime/passThrough';

export interface AppRatingProps {
  value: number;
  max?: number;
  readOnly?: boolean;
  disabled?: boolean;
  onValueChange?: (value: number | null) => void;
  ariaLabel?: string;
  className?: string;
  sx?: SxValue;
}

export function AppRating({
  value,
  max = 5,
  readOnly = false,
  disabled = false,
  onValueChange,
  ariaLabel,
  className,
  sx,
}: AppRatingProps) {
  const theme = useTheme();
  return (
    <Rating
      value={value}
      stars={max}
      readOnly={readOnly}
      disabled={disabled}
      cancel={false}
      onChange={(event) => onValueChange?.(event.value ?? null)}
      aria-label={ariaLabel}
      className={compilePrimeRootClass(theme, sx, className)}
    />
  );
}
