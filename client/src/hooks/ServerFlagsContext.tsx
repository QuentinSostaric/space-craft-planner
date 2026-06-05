import { createContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { fetchServerFlags } from '../services/featureFlagsService';

// Blocker-proof feature-flag values resolved on the server for the current
// user. Empty until loaded / for anonymous users, in which case consumers fall
// back to the PostHog client SDK and static defaults (see `useFlag`).
export const ServerFlagsContext = createContext<Record<string, boolean>>({});

export function ServerFlagsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  // Re-fetch whenever the identity changes (login/logout): server targeting is
  // keyed on the user id.
  useEffect(() => {
    let cancelled = false;
    void fetchServerFlags().then((next) => {
      if (!cancelled) {
        setFlags(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return <ServerFlagsContext.Provider value={flags}>{children}</ServerFlagsContext.Provider>;
}
