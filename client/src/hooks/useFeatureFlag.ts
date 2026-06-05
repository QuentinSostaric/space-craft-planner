import { useContext } from 'react';
import { useFeatureFlagEnabled, useFeatureFlagVariantKey } from '@posthog/react';
import { remoteFlagDefault, type RemoteFlagKey } from '../utils/featureFlags';
import { ServerFlagsContext } from './ServerFlagsContext';

/**
 * Reactive boolean feature flag.
 *
 * Resolution order, most to least authoritative:
 *  1. Server-evaluated value (blocker-proof, set for logged-in users).
 *  2. PostHog client SDK value (may be blocked by trackers / not yet loaded).
 *  3. The registry default in `REMOTE_FLAGS`.
 *
 * This guarantees a deterministic result even when analytics is disabled
 * (consent refused) or PostHog is unreachable (offline desktop, adblocker).
 */
export function useFlag(key: RemoteFlagKey): boolean {
  const serverFlags = useContext(ServerFlagsContext);
  const clientValue = useFeatureFlagEnabled(key);

  if (key in serverFlags) {
    return serverFlags[key];
  }
  return clientValue ?? remoteFlagDefault(key);
}

/**
 * Reactive multivariate flag value (A/B/n testing). Returns `undefined` until
 * PostHog resolves the flag — callers should treat `undefined`/`false` as
 * "control".
 */
export function useFlagVariant(key: RemoteFlagKey): string | boolean | undefined {
  return useFeatureFlagVariantKey(key);
}
