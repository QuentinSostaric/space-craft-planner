import { Tooltip } from 'primereact/tooltip';
import { cloneElement, useId, useMemo, type AriaAttributes, type ReactElement, type ReactNode } from 'react';
import { useTheme, type SxValue } from '../../../ui/system';
import {
  compilePrimePartClasses,
  compilePrimeRootClass,
  type PrimePartStyles,
} from '../../../ui/prime/passThrough';

type AppTooltipPart = 'root' | 'arrow' | 'text';

export interface AppTooltipProps {
  content: ReactNode;
  children: ReactElement<{ className?: string } & AriaAttributes>;
  position?: 'top' | 'bottom' | 'left' | 'right';
  showDelay?: number;
  hideDelay?: number;
  disabled?: boolean;
  className?: string;
  sx?: SxValue;
  partSx?: PrimePartStyles<AppTooltipPart>;
}

export function AppTooltip({
  content,
  children,
  position = 'top',
  showDelay = 250,
  hideDelay = 0,
  disabled = false,
  className,
  sx,
  partSx,
}: AppTooltipProps) {
  const generatedId = useId().replace(/:/g, '');
  const theme = useTheme();
  const targetClassName = `app-tooltip-target-${generatedId}`;
  const tooltipId = `app-tooltip-${generatedId}`;
  const target = useMemo(() => `.${targetClassName}`, [targetClassName]);
  const childClassName = [children.props.className, targetClassName].filter(Boolean).join(' ');
  const describedBy = [children.props['aria-describedby'], tooltipId].filter(Boolean).join(' ');

  return (
    <>
      {cloneElement(children, { className: childClassName, 'aria-describedby': describedBy })}
      <Tooltip
        id={tooltipId}
        target={target}
        content={content}
        position={position}
        event="both"
        showDelay={showDelay}
        hideDelay={hideDelay}
        closeOnEscape
        disabled={disabled || content == null || content === ''}
        className={compilePrimeRootClass(theme, sx, className)}
        pt={compilePrimePartClasses(theme, partSx)}
      />
    </>
  );
}
