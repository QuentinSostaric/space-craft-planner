import { useFeatureFlagEnabled, useFeatureFlagVariantKey } from '@posthog/react';
import { remoteFlagDefault, type RemoteFlagKey } from '../utils/featureFlags';

/**
 * Reactive boolean feature flag backed by PostHog.
 *
 * Falls back to the registry default in `REMOTE_FLAGS` whenever PostHog is
 * disabled (analytics consent refused) or its definitions haven't loaded yet
 * (e.g. offline desktop boot), so the result is always deterministic.
 */
export function useFlag(key: RemoteFlagKey): boolean {
  const value = useFeatureFlagEnabled(key);
  return value ?? remoteFlagDefault(key);
}

/**
 * Reactive multivariate flag value (A/B/n testing). Returns `undefined` until
 * PostHog resolves the flag — callers should treat `undefined`/`false` as
 * "control".
 */
export function useFlagVariant(key: RemoteFlagKey): string | boolean | undefined {
  return useFeatureFlagVariantKey(key);
}
