# Feature flags

Runtime feature flags are powered by **PostHog** (already wired for analytics).
They give us instant kill-switches, per-user / per-cohort targeting and gradual
rollouts without shipping a new build.

## Two kinds of flags

| Kind | Where | Use for |
| --- | --- | --- |
| **Static** | `const` in `client/src/utils/featureFlags.ts` | Gated on code/data not ready; flipped via a release. |
| **Remote** | `REMOTE_FLAGS` registry + PostHog dashboard | Rollouts, targeting, kill-switches at runtime. |

## Adding a remote flag

1. **Create the flag in PostHog** (Feature flags → New). Pick a `kebab-case`
   key, e.g. `planner-v2`. Start with release condition *100% disabled* or a
   small rollout %.
2. **Register it** in `client/src/utils/featureFlags.ts`:
   ```ts
   export const REMOTE_FLAGS = {
     'ship-component-blueprints': false,
     'planner-v2': false, // <- default used when PostHog is off/offline
   } as const;
   ```
   The default **must** be a safe fallback: it applies whenever analytics is
   disabled (consent refused) or PostHog is unreachable (offline desktop).
3. **Consume it** in a component:
   ```tsx
   import { useFlag } from '../hooks/useFeatureFlag';

   const plannerV2 = useFlag('planner-v2');
   return plannerV2 ? <PlannerV2 /> : <PlannerV1 />;
   ```
   For A/B/n variants use `useFlagVariant('planner-v2')`.

## Targeting users

Logged-in users are identified to PostHog by `AnalyticsIdentitySync`, which
attaches non-PII person properties usable as release conditions:

- `is_admin`, `rsi_linked`, `has_org`, `org_count`, `onboarded`, `channel` (live/ptu)

Anonymous (logged-out) users still receive percentage rollouts, but only
property-based targeting requires a login.

## Rolling out

In the PostHog flag, ramp the rollout percentage: **5% → 25% → 100%**, watching
metrics between steps. To kill a feature instantly, disable the flag — clients
pick it up on next load (and `reloadFeatureFlags()` runs on login/logout).
