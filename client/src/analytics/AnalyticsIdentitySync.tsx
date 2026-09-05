import { useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { identifyUser, resetIdentity, type AnalyticsProperties } from './posthog';

// Mirrors the authenticated session into PostHog so feature flags can target
// individual users / cohorts (admins, RSI-linked, org members, channel…).
// Person properties are intentionally non-PII: ids and booleans/counts only.
export function AnalyticsIdentitySync() {
  const { user, account, accountDatasetScope } = useAuth();
  const identifiedIdRef = useRef<string | null>(null);

  const personProperties: AnalyticsProperties = {
    is_admin: account?.isAdmin ?? false,
    rsi_linked: Boolean(account?.rsi) && !account?.rsi?.verificationRequired,
    has_org: (account?.organizations?.length ?? 0) > 0,
    org_count: account?.organizations?.length ?? 0,
    channel: accountDatasetScope,
    onboarded: Boolean(account?.onboardingCompletedAt),
  };
  // Re-run identify whenever a targetable property changes.
  const fingerprint = JSON.stringify(personProperties);

  useEffect(() => {
    if (user?.id) {
      identifyUser(user.id, personProperties);
      identifiedIdRef.current = user.id;
      return;
    }

    // Transitioned to logged-out: clear the previously identified person.
    if (identifiedIdRef.current) {
      resetIdentity();
      identifiedIdRef.current = null;
    }
    // personProperties is captured via `fingerprint` to avoid re-identifying
    // on unrelated re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, fingerprint]);

  return null;
}
