import { Dropdown } from 'primereact/dropdown';
import type { FocusEventHandler, ReactNode } from 'react';
import { useTheme, type SxValue } from '../../../ui/system';
import {
  compilePrimePartClasses,
  compilePrimeRootClass,
  type PrimePartStyles,
} from '../../../ui/prime/passThrough';
import { FieldShell } from './FieldShell';

export interface AppSelectOption<T extends string | number> {
  label: string;
  value: T;
  disabled?: boolean;
}

type AppSelectPart = 'root' | 'input' | 'trigger' | 'panel' | 'wrapper' | 'list' | 'item' | 'emptyMessage';

export interface AppSelectProps<T extends string | number> {
  id?: string;
  label?: ReactNode;
  value: T | null;
  options: readonly AppSelectOption<T>[];
  onValueChange: (value: T | null) => void;
  placeholder?: string;
  helperText?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
  required?: boolean;
  clearable?: boolean;
  filterable?: boolean;
  emptyMessage?: ReactNode;
  name?: string;
  ariaLabel?: string;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  onFocus?: FocusEventHandler<HTMLInputElement>;
  className?: string;
  sx?: SxValue;
  fieldSx?: SxValue;
  partSx?: PrimePartStyles<AppSelectPart>;
}

export function AppSelect<T extends string | number>({
  id,
  label,
  value,
  options,
  onValueChange,
  placeholder,
  helperText,
  error,
  disabled = false,
  required = false,
  clearable = false,
  filterable = false,
  emptyMessage,
  name,
  ariaLabel,
  onBlur,
  onFocus,
  className,
  sx,
  fieldSx,
  partSx,
}: AppSelectProps<T>) {
  const theme = useTheme();

  return (
    <FieldShell
      id={id}
      label={label}
      helperText={helperText}
      error={error}
      required={required}
      disabled={disabled}
      sx={fieldSx}
    >
      {({ inputId, labelId, descriptionId }) => (
        <Dropdown
          inputId={inputId}
          value={value}
          options={[...options]}
          optionLabel="label"
          optionValue="value"
          optionDisabled="disabled"
          onChange={(event) => onValueChange((event.value ?? null) as T | null)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          showClear={clearable}
          filter={filterable}
          emptyMessage={emptyMessage}
          name={name}
          invalid={Boolean(error)}
          aria-label={label ? undefined : ariaLabel}
          aria-labelledby={label ? labelId : undefined}
          aria-describedby={descriptionId}
          onBlur={onBlur}
          onFocus={onFocus}
          className={compilePrimeRootClass(theme, [{ width: '100%' }, sx], className)}
          pt={compilePrimePartClasses(theme, partSx)}
        />
      )}
    </FieldShell>
  );
}
