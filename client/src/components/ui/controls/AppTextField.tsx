import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import type { ChangeEventHandler, FocusEventHandler, KeyboardEventHandler, ReactNode } from 'react';
import { useTheme, type SxValue } from '../../../ui/system';
import { compilePrimeRootClass } from '../../../ui/prime/passThrough';
import { FieldShell } from './FieldShell';

interface CommonFieldProps {
  id?: string;
  label?: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  helperText?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  name?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  maxLength?: number;
  ariaLabel?: string;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  onFocus?: FocusEventHandler<HTMLInputElement>;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  className?: string;
  sx?: SxValue;
  fieldSx?: SxValue;
}

export interface AppTextFieldProps extends CommonFieldProps {
  type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number';
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  /** Native numeric bounds — only meaningful when type="number". */
  min?: number;
  max?: number;
  step?: number;
}

export interface AppTextAreaProps extends Omit<CommonFieldProps, 'onBlur' | 'onFocus'> {
  rows?: number;
  autoResize?: boolean;
  onBlur?: FocusEventHandler<HTMLTextAreaElement>;
  onFocus?: FocusEventHandler<HTMLTextAreaElement>;
}

export function AppTextField({
  id,
  label,
  value,
  onValueChange,
  type = 'text',
  inputMode,
  min,
  max,
  step,
  placeholder,
  helperText,
  error,
  disabled = false,
  readOnly = false,
  required = false,
  name,
  autoComplete,
  autoFocus = false,
  maxLength,
  ariaLabel,
  onBlur,
  onFocus,
  onKeyDown,
  className,
  sx,
  fieldSx,
}: AppTextFieldProps) {
  const theme = useTheme();
  const onChange: ChangeEventHandler<HTMLInputElement> = (event) => onValueChange(event.currentTarget.value);

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
        <InputText
          id={inputId}
          value={value}
          onChange={onChange}
          type={type}
          inputMode={inputMode}
          min={type === 'number' ? min : undefined}
          max={type === 'number' ? max : undefined}
          step={type === 'number' ? step : undefined}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          name={name}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          maxLength={maxLength}
          invalid={Boolean(error)}
          aria-label={label ? undefined : ariaLabel}
          aria-labelledby={label ? labelId : undefined}
          aria-describedby={descriptionId}
          aria-invalid={error ? true : undefined}
          onBlur={onBlur}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          className={compilePrimeRootClass(theme, [{ width: '100%' }, sx], className)}
        />
      )}
    </FieldShell>
  );
}

export function AppTextArea({
  id,
  label,
  value,
  onValueChange,
  rows = 4,
  autoResize = false,
  placeholder,
  helperText,
  error,
  disabled = false,
  readOnly = false,
  required = false,
  name,
  autoComplete,
  autoFocus = false,
  maxLength,
  ariaLabel,
  onBlur,
  onFocus,
  className,
  sx,
  fieldSx,
}: AppTextAreaProps) {
  const theme = useTheme();
  const onChange: ChangeEventHandler<HTMLTextAreaElement> = (event) => onValueChange(event.currentTarget.value);

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
        <InputTextarea
          id={inputId}
          value={value}
          onChange={onChange}
          rows={rows}
          autoResize={autoResize}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          name={name}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          maxLength={maxLength}
          invalid={Boolean(error)}
          aria-label={label ? undefined : ariaLabel}
          aria-labelledby={label ? labelId : undefined}
          aria-describedby={descriptionId}
          aria-invalid={error ? true : undefined}
          onBlur={onBlur}
          onFocus={onFocus}
          className={compilePrimeRootClass(theme, [{ width: '100%' }, sx], className)}
        />
      )}
    </FieldShell>
  );
}
