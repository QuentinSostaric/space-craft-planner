// Feature flags come in two flavours:
//
//  - Static (build-time): compiled into the bundle, flipped via a release.
//    Use these for things that are gated on code/data that simply isn't ready.
//
//  - Remote (PostHog): evaluated at runtime per user, so they support gradual
//    rollouts, per-user / per-cohort targeting and instant kill-switches from
//    the PostHog dashboard. See `hooks/useFeatureFlag.ts` for consumption and
//    `docs/feature-flags.md` for the workflow.

// ── Remote flags (PostHog) ───────────────────────────────────────────────
//
// The keys MUST match the flag key created in the PostHog dashboard exactly.
// The value is the *default* used whenever PostHog is disabled (analytics
// consent refused) or unreachable (offline desktop) — pick a safe fallback so
// behaviour stays deterministic without a backend.

export const REMOTE_FLAGS = {
  // Ship component blueprints are prepared ahead of in-game support. Default
  // OFF keeps all related UI hidden until the game exposes real component
  // blueprints; flip the rollout in PostHog to release without shipping a build.
  'ship-component-blueprints': false,
} as const;

export type RemoteFlagKey = keyof typeof REMOTE_FLAGS;

export function remoteFlagDefault(key: RemoteFlagKey): boolean {
  return REMOTE_FLAGS[key];
}
