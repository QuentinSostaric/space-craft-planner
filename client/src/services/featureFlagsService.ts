import { fetchTauriApiJson, getApiCredentials, getApiUrl } from './apiBaseUrl';
import { normalizeBooleanRecord } from '../utils/dataValidation';

const FEATURE_FLAGS_PATH = '/api/auth/feature-flags';

interface FeatureFlagsResponse {
  flags?: Record<string, boolean>;
}

// Fetch server-evaluated feature flags. This first-party endpoint is immune to
// tracker blockers (unlike PostHog's /flags), so it acts as a reliable source
// for logged-in users. Returns {} on any failure — callers fall back to the
// client SDK / static defaults.
export async function fetchServerFlags(): Promise<Record<string, boolean>> {
  try {
    const tauriPayload = await fetchTauriApiJson<FeatureFlagsResponse>(FEATURE_FLAGS_PATH);
    if (tauriPayload) {
      return normalizeBooleanRecord(tauriPayload.flags);
    }

    const response = await fetch(getApiUrl(FEATURE_FLAGS_PATH), {
      credentials: getApiCredentials(),
      cache: 'no-store',
    });
    if (!response.ok) {
      return {};
    }

    const payload = (await response.json()) as FeatureFlagsResponse;
    return normalizeBooleanRecord(payload.flags);
  } catch {
    return {};
  }
}
