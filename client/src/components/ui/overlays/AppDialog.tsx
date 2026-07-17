import { Dialog } from 'primereact/dialog';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTheme, type SxValue } from '../../../ui/system';
import {
  compilePrimePartClasses,
  compilePrimeRootClass,
  type PrimePartStyles,
} from '../../../ui/prime/passThrough';

type AppDialogPart = 'root' | 'header' | 'headerTitle' | 'headerIcons' | 'closeButton' | 'content' | 'footer' | 'mask';

export interface AppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  dismissable?: boolean;
  modal?: boolean;
  width?: string;
  className?: string;
  sx?: SxValue;
  partSx?: PrimePartStyles<AppDialogPart>;
}

export function AppDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  closeLabel = 'Close',
  dismissable = true,
  modal = true,
  width = 'min(36rem, calc(100vw - 2rem))',
  className,
  sx,
  partSx,
}: AppDialogProps) {
  const generatedId = useId();
  const theme = useTheme();
  const titleId = `app-dialog-${generatedId}-title`;
  const descriptionId = description ? `app-dialog-${generatedId}-description` : undefined;
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      restoreFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    }
    if (!open && wasOpenRef.current) {
      const element = restoreFocusRef.current;
      window.setTimeout(() => {
        if (element?.isConnected) element.focus();
      }, 0);
    }
    wasOpenRef.current = open;
  }, [open]);

  const compiledParts = compilePrimePartClasses(theme, partSx);

  return (
    <Dialog
      visible={open}
      onHide={() => onOpenChange(false)}
      header={<span id={titleId}>{title}</span>}
      footer={footer}
      modal={modal}
      closable={dismissable}
      closeOnEscape={dismissable}
      dismissableMask={dismissable}
      draggable={false}
      resizable={false}
      blockScroll={modal}
      focusOnShow
      ariaCloseIconLabel={closeLabel}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={compilePrimeRootClass(theme, sx, className)}
      style={{ width }}
      pt={compiledParts}
    >
      {description ? <p id={descriptionId}>{description}</p> : null}
      {children}
    </Dialog>
  );
}
