import { useId, type ReactNode } from 'react';
import { sxToClass, useTheme, type SxValue } from '../../../ui/system';

interface FieldShellProps {
  id?: string;
  label?: ReactNode;
  helperText?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  sx?: SxValue;
  children: (ids: {
    inputId: string;
    labelId: string;
    descriptionId?: string;
  }) => ReactNode;
}

export function FieldShell({
  id,
  label,
  helperText,
  error,
  required = false,
  disabled = false,
  sx,
  children,
}: FieldShellProps) {
  const generatedId = useId();
  const theme = useTheme();
  const inputId = id ?? `app-field-${generatedId}`;
  const labelId = `${inputId}-label`;
  const description = error ?? helperText;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const className = sxToClass([
    {
      display: 'flex',
      flexDirection: 'column',
      gap: 0.75,
      minWidth: 0,
    },
    sx,
  ], theme);
  const labelClassName = sxToClass({
    color: disabled ? 'text.disabled' : 'text.secondary',
    fontSize: '0.75rem',
    fontWeight: 700,
    lineHeight: 1.35,
  }, theme);
  const descriptionClassName = sxToClass({
    color: error ? 'error.main' : 'text.secondary',
    fontSize: '0.75rem',
    lineHeight: 1.4,
  }, theme);

  return (
    <div className={className}>
      {label ? (
        <label id={labelId} htmlFor={inputId} className={labelClassName}>
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
        </label>
      ) : null}
      {children({ inputId, labelId, descriptionId })}
      {description ? (
        <div id={descriptionId} className={descriptionClassName}>
          {description}
        </div>
      ) : null}
    </div>
  );
}
