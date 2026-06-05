// Server-side feature-flag evaluation (Cloudflare Pages Functions).
//
// Unlike the client SDK, this runs on the edge so the decision can't be blocked
// by a user's tracker blocker and can't be spoofed by the client — use it to
// gate beta API endpoints. Flags are resolved through PostHog's public decide
// endpoint with the project token (no personal API key needed).
//
// For logged-in users pass `distinctId = session.user.id`: this matches the
// `posthog.identify(user.id)` call on the client, so percentage rollouts bucket
// users identically on both sides.

const DEFAULT_HOST = 'https://eu.i.posthog.com';

// Safe fallbacks used whenever PostHog is disabled or unreachable. Keep keys in
// sync with the client `REMOTE_FLAGS` registry and the PostHog dashboard.
export const SERVER_FLAG_DEFAULTS = {
  'ship-component-blueprints': false,
};

function getPosthogConfig(env) {
  const token = env.POSTHOG_TOKEN ?? env.VITE_POSTHOG_TOKEN ?? '';
  const host = env.POSTHOG_HOST ?? env.VITE_POSTHOG_HOST ?? DEFAULT_HOST;
  const rawEnabled = env.POSTHOG_ENABLED ?? env.VITE_POSTHOG_ENABLED ?? 'false';
  const enabled = rawEnabled === 'true' && Boolean(token);
  return { enabled, token, host };
}

// Normalise the two response shapes PostHog has shipped: the legacy
// `featureFlags` map (decide v3) and the newer `flags` map of objects (v2).
function normaliseFlags(payload) {
  if (payload && typeof payload.flags === 'object' && payload.flags) {
    return Object.fromEntries(
      Object.entries(payload.flags).map(([key, value]) => [
        key,
        value && typeof value === 'object' ? (value.variant ?? value.enabled ?? false) : value,
      ]),
    );
  }
  if (payload && typeof payload.featureFlags === 'object' && payload.featureFlags) {
    return payload.featureFlags;
  }
  return {};
}

// Resolve every flag for a distinct id. Returns a `{ key: boolean | string }`
// map; on any failure returns `{}` so callers fall back to defaults.
export async function evaluateServerFlags(env, distinctId, personProperties = {}) {
  const { enabled, token, host } = getPosthogConfig(env);
  if (!enabled || !distinctId) {
    return {};
  }

  try {
    const response = await fetch(`${host}/flags/?v=2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: token,
        distinct_id: distinctId,
        person_properties: personProperties,
      }),
    });
    if (!response.ok) {
      return {};
    }
    return normaliseFlags(await response.json());
  } catch {
    return {};
  }
}

function coerceEnabled(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  // A non-empty multivariate variant string counts as enabled.
  if (typeof value === 'string') return value.length > 0 && value !== 'false';
  return Boolean(value);
}

// Convenience single-flag check with a safe default. Prefer
// `evaluateServerFlags` when checking several flags for the same user.
export async function isServerFlagEnabled(env, key, { distinctId, personProperties } = {}) {
  const fallback = SERVER_FLAG_DEFAULTS[key] ?? false;
  const flags = await evaluateServerFlags(env, distinctId, personProperties);
  return coerceEnabled(flags[key], fallback);
}

// Resolve only the known server flags into a plain `{ key: boolean }` map,
// applying defaults for anything PostHog didn't return. Safe to ship to the
// client as a blocker-proof flag source.
export async function resolveServerFlagMap(env, { distinctId, personProperties } = {}) {
  const flags = await evaluateServerFlags(env, distinctId, personProperties);
  return Object.fromEntries(
    Object.entries(SERVER_FLAG_DEFAULTS).map(([key, fallback]) => [
      key,
      coerceEnabled(flags[key], fallback),
    ]),
  );
}
