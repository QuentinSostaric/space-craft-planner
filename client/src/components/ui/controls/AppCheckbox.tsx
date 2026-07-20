import { Checkbox } from 'primereact/checkbox';
import type { ReactNode } from 'react';
import { sxToClass, useTheme, type SxValue } from '../../../ui/system';
import {
  compilePrimePartClasses,
  compilePrimeRootClass,
  type PrimePartStyles,
} from '../../../ui/prime/passThrough';

type AppCheckboxPart = 'root' | 'input' | 'box' | 'icon';

export interface AppCheckboxProps {
  id?: string;
  /** Visible label. Omit and pass `ariaLabel` for a standalone box next to external text. */
  label?: ReactNode;
  /** Accessible name when no visible `label` is rendered. */
  ariaLabel?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  description?: ReactNode;
  disabled?: boolean;
  required?: boolean;
  readOnly?: boolean;
  name?: string;
  value?: string;
  className?: string;
  sx?: SxValue;
  partSx?: PrimePartStyles<AppCheckboxPart>;
}

export function AppCheckbox({
  id,
  label,
  ariaLabel,
  checked,
  onCheckedChange,
  description,
  disabled = false,
  required = false,
  readOnly = false,
  name,
  value,
  className,
  sx,
  partSx,
}: AppCheckboxProps) {
  const theme = useTheme();
  const inputId = id ?? `app-checkbox-${useStableId()}`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const rootClassName = sxToClass([
    {
      display: 'inline-flex',
      alignItems: description ? 'flex-start' : 'center',
      gap: 1,
      color: disabled ? 'text.disabled' : 'text.primary',
      cursor: disabled ? 'not-allowed' : 'pointer',
    },
    sx,
  ], theme);
  const textClassName = sxToClass({ display: 'grid', gap: 0.25, lineHeight: 1.4 }, theme);
  const descriptionClassName = sxToClass({ color: 'text.secondary', fontSize: '0.75rem' }, theme);

  const checkbox = (
    <Checkbox
      inputId={inputId}
      checked={checked}
      onChange={(event) => onCheckedChange(Boolean(event.checked))}
      disabled={disabled}
      required={required}
      readOnly={readOnly}
      name={name}
      value={value}
      aria-label={label == null ? ariaLabel : undefined}
      aria-describedby={descriptionId}
      className={compilePrimeRootClass(theme, undefined, className)}
      pt={compilePrimePartClasses(theme, partSx)}
    />
  );

  if (label == null) {
    return checkbox;
  }

  return (
    <label className={rootClassName}>
      {checkbox}
      <span className={textClassName}>
        <span>
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
        </span>
        {description ? <span id={descriptionId} className={descriptionClassName}>{description}</span> : null}
      </span>
    </label>
  );
}

import { useId } from 'react';

function useStableId() {
  return useId();
}
