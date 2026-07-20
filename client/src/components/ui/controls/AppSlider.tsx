import { Slider } from 'primereact/slider';
import { useId, type ReactNode } from 'react';
import { sxToClass, useTheme, type SxValue } from '../../../ui/system';
import {
  compilePrimePartClasses,
  compilePrimeRootClass,
  type PrimePartStyles,
} from '../../../ui/prime/passThrough';

type AppSliderPart = 'root' | 'range' | 'handle';

export interface AppSliderMark {
  value: number;
  label: ReactNode;
}

export interface AppSliderProps {
  id?: string;
  label: ReactNode;
  value: number;
  onValueChange: (value: number) => void;
  onValueCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  formatValue?: (value: number) => string;
  marks?: readonly AppSliderMark[];
  className?: string;
  sx?: SxValue;
  partSx?: PrimePartStyles<AppSliderPart>;
}

export function AppSlider({
  id,
  label,
  value,
  onValueChange,
  onValueCommit,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  formatValue = String,
  marks = [],
  className,
  sx,
  partSx,
}: AppSliderProps) {
  const generatedId = useId();
  const theme = useTheme();
  const labelId = `${id ?? `app-slider-${generatedId}`}-label`;
  const markClassName = sxToClass({
    position: 'relative',
    height: 2.5,
    color: 'text.secondary',
    fontSize: '0.6875rem',
  }, theme);
  const valueClassName = sxToClass({ marginLeft: 'auto', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }, theme);
  const headingClassName = sxToClass({ display: 'flex', alignItems: 'baseline', gap: 1, marginBottom: 1 }, theme);
  const userPartSx = partSx ?? {};
  const mergedParts: PrimePartStyles<AppSliderPart> = {
    ...userPartSx,
    handle: [
      userPartSx.handle,
      {
        '&::after': { content: 'none' },
      },
    ],
  };

  return (
    <div className={compilePrimeRootClass(theme, sx, className)}>
      <div className={headingClassName}>
        <span id={labelId}>{label}</span>
        <span className={valueClassName}>{formatValue(value)}</span>
      </div>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-labelledby={labelId}
        onChange={(event) => {
          if (typeof event.value === 'number') onValueChange(event.value);
        }}
        onSlideEnd={(event) => {
          if (typeof event.value === 'number') onValueCommit?.(event.value);
        }}
        pt={{
          ...compilePrimePartClasses(theme, mergedParts),
          handle: {
            ...compilePrimePartClasses(theme, mergedParts).handle,
            'aria-valuetext': formatValue(value),
          },
        }}
      />
      {marks.length > 0 ? (
        <div className={markClassName} aria-hidden="true">
          {marks.map((mark) => {
            const left = ((mark.value - min) / (max - min)) * 100;
            return (
              <span
                key={`${mark.value}`}
                style={{ position: 'absolute', left: `${left}%`, transform: 'translateX(-50%)' }}
              >
                {mark.label}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
