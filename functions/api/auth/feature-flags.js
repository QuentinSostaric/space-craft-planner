import { jsonResponse } from '../../_shared/gameData.js';
import { resolveServerFlagMap } from '../../_shared/featureFlags.js';
import { readSessionFromRequest } from '../../../shared/discordAuth.mjs';

// Blocker-proof feature-flag source for the client. Served from a first-party
// `/api/...` path so tracker blockers don't drop it (unlike PostHog's /flags
// endpoint). Evaluated with distinct_id = user.id to match the client identify,
// so rollout buckets are consistent. Anonymous callers get the safe defaults.
export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const session = await readSessionFromRequest(request, env);
    const distinctId = session?.user?.id ?? null;

    // Only return authoritative values when we can evaluate against a real
    // distinct id. Anonymous callers get an empty map so the client keeps using
    // its own PostHog/default resolution (no targeting context server-side).
    const flags = distinctId ? await resolveServerFlagMap(env, { distinctId }) : {};

    return jsonResponse({ flags }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // Never fail the app over flags: let the client fall back to its defaults.
    return jsonResponse({ flags: {} }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
