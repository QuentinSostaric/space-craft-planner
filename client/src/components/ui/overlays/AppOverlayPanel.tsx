import { OverlayPanel } from 'primereact/overlaypanel';
import { cloneElement, useId, useRef, type MouseEvent, type ReactElement, type ReactNode } from 'react';
import { useTheme, type SxValue } from '../../../ui/system';
import {
  compilePrimePartClasses,
  compilePrimeRootClass,
  type PrimePartStyles,
} from '../../../ui/prime/passThrough';

type AppOverlayPanelPart = 'root' | 'content';

export interface AppOverlayPanelProps {
  /** The control that toggles the panel (its onClick is preserved and augmented). */
  trigger: ReactElement<{
    id?: string;
    onClick?: (event: MouseEvent<HTMLElement>) => void;
    'aria-controls'?: string;
    'aria-haspopup'?: 'dialog';
    'aria-expanded'?: boolean;
  }>;
  children: ReactNode;
  ariaLabel?: string;
  dismissable?: boolean;
  /**
   * Where the panel is mounted. Pass `document.body` when the trigger sits in a
   * container that clips (`overflow: hidden` / a scroll region) — rendered in
   * place, the panel would be cut off at that container's edge.
   */
  appendTo?: 'self' | HTMLElement | null;
  className?: string;
  sx?: SxValue;
  partSx?: PrimePartStyles<AppOverlayPanelPart>;
}

/**
 * A lightweight, persistent overlay anchored to a trigger — used for rich,
 * stay-open content such as multi-select checklists (unlike a command menu,
 * it does not close when an item inside it is activated).
 */
export function AppOverlayPanel({
  trigger,
  children,
  ariaLabel,
  dismissable = true,
  appendTo,
  className,
  sx,
  partSx,
}: AppOverlayPanelProps) {
  const panelRef = useRef<OverlayPanel>(null);
  const generatedId = useId().replace(/:/g, '');
  const panelId = `app-overlay-${generatedId}`;
  const theme = useTheme();

  return (
    <>
      {cloneElement(trigger, {
        id: trigger.props.id ?? `${panelId}-trigger`,
        'aria-controls': panelId,
        'aria-haspopup': 'dialog',
        onClick: (event: MouseEvent<HTMLElement>) => {
          trigger.props.onClick?.(event);
          panelRef.current?.toggle(event);
        },
      })}
      <OverlayPanel
        ref={panelRef}
        id={panelId}
        aria-label={ariaLabel}
        dismissable={dismissable}
        appendTo={appendTo}
        showCloseIcon={false}
        className={compilePrimeRootClass(theme, sx, className)}
        pt={compilePrimePartClasses(theme, partSx)}
      >
        {children}
      </OverlayPanel>
    </>
  );
}
