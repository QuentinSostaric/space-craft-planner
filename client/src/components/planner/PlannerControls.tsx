import { Box, type SxValue, useTheme } from '../../ui/system';
import { FONT_HEADING } from '../../theme';

interface PlannerSegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  ariaLabel?: string;
}

interface PlannerSegmentedControlProps<T extends string> {
  value: T | null;
  options: readonly PlannerSegmentOption<T>[];
  onValueChange: (value: T) => void;
  ariaLabel: string;
  compact?: boolean;
  sx?: SxValue;
}

export function PlannerSegmentedControl<T extends string>({
  value,
  options,
  onValueChange,
  ariaLabel,
  compact = false,
  sx,
}: PlannerSegmentedControlProps<T>) {
  const theme = useTheme();

  return (
    <Box
      role="group"
      aria-label={ariaLabel}
      sx={[
        {
          display: 'inline-flex',
          alignItems: 'stretch',
          maxWidth: '100%',
          overflowX: 'auto',
          border: `1px solid ${theme.palette.ui.border}`,
          borderRadius: 1,
          backgroundColor: 'ui.surface1',
        },
        sx,
      ]}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <Box
            component="button"
            type="button"
            key={option.value}
            aria-label={option.ariaLabel}
            aria-pressed={selected}
            onClick={() => onValueChange(option.value)}
            sx={{
              minWidth: compact ? 40 : 44,
              minHeight: 44,
              px: compact ? 1 : 1.25,
              py: 0.625,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
              flexShrink: 0,
              border: 0,
              borderLeft: index === 0 ? 0 : `1px solid ${theme.palette.ui.border}`,
              backgroundColor: selected ? 'primary.main' : 'transparent',
              color: selected ? 'primary.contrastText' : 'text.secondary',
              font: 'inherit',
              fontFamily: FONT_HEADING,
              fontSize: compact ? '0.6875rem' : '0.75rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: selected ? 'primary.dark' : 'ui.surface2',
                color: selected ? 'primary.contrastText' : 'text.primary',
              },
              '&:focus-visible': {
                position: 'relative',
                zIndex: 1,
                outline: `2px solid ${theme.palette.primary.main}`,
                outlineOffset: -2,
              },
            }}
          >
            {option.label}
          </Box>
        );
      })}
    </Box>
  );
}

interface PlannerNumberInputProps {
  value: number | '';
  onValueChange: (value: number | '') => void;
  onBlur?: (value: number | '') => void;
  min: number;
  max: number;
  step?: number;
  ariaLabel: string;
  sx?: SxValue;
}

export function PlannerNumberInput({
  value,
  onValueChange,
  onBlur,
  min,
  max,
  step = 1,
  ariaLabel,
  sx,
}: PlannerNumberInputProps) {
  return (
    <Box
      component="input"
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      inputMode={step < 1 ? 'decimal' : 'numeric'}
      aria-label={ariaLabel}
      onChange={(event) => {
        const next = event.currentTarget.value;
        onValueChange(next === '' ? '' : Number(next));
      }}
      onBlur={(event) => {
        if (!onBlur) return;
        const next = event.currentTarget.value;
        onBlur(next === '' ? '' : Number(next));
      }}
      sx={[
        {
          width: 72,
          minHeight: 44,
          boxSizing: 'border-box',
          border: '1px solid',
          borderColor: 'ui.border',
          borderRadius: 1,
          backgroundColor: 'ui.surface1',
          color: 'text.primary',
          px: 1,
          textAlign: 'right',
          font: 'inherit',
          fontVariantNumeric: 'tabular-nums',
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: 1,
          },
        },
        sx,
      ]}
    />
  );
}
