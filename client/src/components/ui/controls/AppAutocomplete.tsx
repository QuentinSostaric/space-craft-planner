import { AutoComplete } from 'primereact/autocomplete';
import type { AutoCompleteProps as PrimeAutoCompleteProps } from 'primereact/autocomplete';
import { useCallback, useRef, type FocusEventHandler, type ReactNode } from 'react';
import { useTheme, type SxValue } from '../../../ui/system';
import {
  compilePrimePartClasses,
  compilePrimeRootClass,
  type PrimePartStyles,
} from '../../../ui/prime/passThrough';
import { FieldShell } from './FieldShell';

type AppAutocompletePart = 'root' | 'panel' | 'list' | 'item' | 'emptyMessage';

export interface AppAutocompleteProps<T extends object> {
  id?: string;
  label?: ReactNode;
  value: T | string | null;
  suggestions: readonly T[];
  getOptionLabel: (option: T) => string;
  itemTemplate?: (option: T, selectOption: () => void) => ReactNode;
  selectedItemTemplate?: (option: T) => ReactNode;
  onValueChange: (value: T | string | null) => void;
  onQueryChange: (query: string) => void;
  placeholder?: string;
  helperText?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  forceSelection?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  name?: string;
  ariaLabel?: string;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  onFocus?: FocusEventHandler<HTMLInputElement>;
  className?: string;
  sx?: SxValue;
  fieldSx?: SxValue;
  inputSx?: SxValue;
  partSx?: PrimePartStyles<AppAutocompletePart>;
}

export function AppAutocomplete<T extends object>({
  id,
  label,
  value,
  suggestions,
  getOptionLabel,
  itemTemplate,
  selectedItemTemplate,
  onValueChange,
  onQueryChange,
  placeholder,
  helperText,
  error,
  disabled = false,
  readOnly = false,
  required = false,
  forceSelection = false,
  loading = false,
  emptyMessage,
  name,
  ariaLabel,
  onBlur,
  onFocus,
  className,
  sx,
  fieldSx,
  inputSx,
  partSx,
}: AppAutocompleteProps<T>) {
  const theme = useTheme();
  const autocompleteRef = useRef<AutoComplete<T>>(null);
  const selectOption = useCallback((option: T) => {
    autocompleteRef.current?.hide();
    onValueChange(option);
  }, [onValueChange]);

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
        <AutoComplete<T>
          ref={autocompleteRef}
          inputId={inputId}
          value={value ?? ''}
          suggestions={[...suggestions] as PrimeAutoCompleteProps<T>['suggestions']}
          field={undefined}
          itemTemplate={(option) => itemTemplate?.(option, () => selectOption(option)) ?? getOptionLabel(option)}
          selectedItemTemplate={(option) => selectedItemTemplate?.(option) ?? getOptionLabel(option)}
          onChange={(event) => onValueChange((event.value ?? null) as T | string | null)}
          completeMethod={(event) => onQueryChange(event.query)}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          forceSelection={forceSelection}
          loadingIcon={loading ? 'pi pi-spinner pi-spin' : undefined}
          emptyMessage={emptyMessage}
          showEmptyMessage={Boolean(emptyMessage)}
          name={name}
          invalid={Boolean(error)}
          aria-label={label ? undefined : ariaLabel}
          aria-labelledby={label ? labelId : undefined}
          aria-describedby={descriptionId}
          onBlur={onBlur}
          onFocus={onFocus}
          className={compilePrimeRootClass(theme, [{ width: '100%' }, sx], className)}
          inputClassName={compilePrimeRootClass(theme, [{ width: '100%' }, inputSx])}
          pt={compilePrimePartClasses(theme, partSx) as PrimeAutoCompleteProps<T>['pt']}
        />
      )}
    </FieldShell>
  );
}
