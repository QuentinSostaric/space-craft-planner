import { SelectButton } from 'primereact/selectbutton';
import type { ReactNode } from 'react';
import { useTheme, type SxValue } from '../../../ui/system';
import {
  compilePrimePartClasses,
  compilePrimeRootClass,
  type PrimePartStyles,
} from '../../../ui/prime/passThrough';

type AppToggleGroupPart = 'root' | 'button' | 'label';

export interface AppToggleOption<T extends string> {
  label: ReactNode;
  value: T;
  disabled?: boolean;
}

export interface AppToggleGroupProps<T extends string> {
  value: T;
  options: readonly AppToggleOption<T>[];
  onValueChange: (value: T) => void;
  /** Allow deselecting the active option (empty selection). Defaults to false. */
  allowEmpty?: boolean;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  sx?: SxValue;
  partSx?: PrimePartStyles<AppToggleGroupPart>;
}

export function AppToggleGroup<T extends string>({
  value,
  options,
  onValueChange,
  allowEmpty = false,
  ariaLabel,
  disabled = false,
  className,
  sx,
  partSx,
}: AppToggleGroupProps<T>) {
  const theme = useTheme();

  return (
    <SelectButton
      value={value}
      options={options.map((option) => ({
        label: option.label,
        value: option.value,
        disabled: option.disabled,
      }))}
      optionLabel="label"
      optionValue="value"
      optionDisabled="disabled"
      onChange={(event) => {
        const next = event.value as T | null;
        if (next != null) onValueChange(next);
        else if (allowEmpty) onValueChange(value);
      }}
      allowEmpty={allowEmpty}
      disabled={disabled}
      aria-label={ariaLabel}
      itemTemplate={(option: { label: ReactNode }) => option.label}
      className={compilePrimeRootClass(theme, sx, className)}
      pt={compilePrimePartClasses(theme, partSx)}
    />
  );
}
