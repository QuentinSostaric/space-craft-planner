import { InputSwitch } from 'primereact/inputswitch';
import { useId, type ReactNode } from 'react';
import { sxToClass, useTheme, type SxValue } from '../../../ui/system';
import {
  compilePrimePartClasses,
  compilePrimeRootClass,
  type PrimePartStyles,
} from '../../../ui/prime/passThrough';

type AppSwitchPart = 'root' | 'slider' | 'input';

export interface AppSwitchProps {
  id?: string;
  label: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  description?: ReactNode;
  disabled?: boolean;
  name?: string;
  className?: string;
  sx?: SxValue;
  partSx?: PrimePartStyles<AppSwitchPart>;
}

export function AppSwitch({
  id,
  label,
  checked,
  onCheckedChange,
  description,
  disabled = false,
  name,
  className,
  sx,
  partSx,
}: AppSwitchProps) {
  const generatedId = useId();
  const theme = useTheme();
  const inputId = id ?? `app-switch-${generatedId}`;
  const labelId = `${inputId}-label`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const rootClassName = sxToClass([
    {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 1,
      color: disabled ? 'text.disabled' : 'text.primary',
      cursor: disabled ? 'not-allowed' : 'pointer',
    },
    sx,
  ], theme);
  const textClassName = sxToClass({ display: 'grid', gap: 0.25, lineHeight: 1.4 }, theme);
  const descriptionClassName = sxToClass({ color: 'text.secondary', fontSize: '0.75rem' }, theme);

  return (
    <label className={rootClassName}>
      <InputSwitch
        inputId={inputId}
        checked={checked}
        onChange={(event) => onCheckedChange(Boolean(event.value))}
        disabled={disabled}
        name={name}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        className={compilePrimeRootClass(theme, undefined, className)}
        pt={compilePrimePartClasses(theme, partSx)}
      />
      <span className={textClassName}>
        <span id={labelId}>{label}</span>
        {description ? <span id={descriptionId} className={descriptionClassName}>{description}</span> : null}
      </span>
    </label>
  );
}
