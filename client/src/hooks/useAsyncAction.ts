import { useCallback, useState } from 'react';

export function extractErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Manages the busy/error state for an async action.
 *
 * Usage:
 * ```ts
 * const deleteAction = useAsyncAction();
 * // ...
 * deleteAction.run(async () => { await deleteAccount(); });
 * // in JSX: deleteAction.busy, deleteAction.error
 * ```
 */
export function useAsyncAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (action: () => Promise<void>, fallbackError?: string) => {
      setBusy(true);
      setError(null);
      try {
        await action();
      } catch (e) {
        setError(extractErrorMessage(e, fallbackError ?? 'An unexpected error occurred.'));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);

  return { busy, error, run, clearError } as const;
}
