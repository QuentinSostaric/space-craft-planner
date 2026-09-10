import { useCallback, useEffect, useRef, useState } from 'react';
export interface AccountConfirmation {
  message: string;
  title?: string;
  label?: string;
}
export function useAccountConfirmation() {
  const [confirmation, setConfirmation] = useState<AccountConfirmation | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);
  const requestConfirmation = useCallback(
    (message: string, options: Omit<AccountConfirmation, 'message'> = {}) => {
      resolver.current?.(false);
      setConfirmation({ message, ...options });
      return new Promise<boolean>((resolve) => {
        resolver.current = resolve;
      });
    },
    [],
  );
  const resolveConfirmation = useCallback((confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setConfirmation(null);
  }, []);
  useEffect(() => () => resolver.current?.(false), []);
  return { confirmation, requestConfirmation, resolveConfirmation };
}
