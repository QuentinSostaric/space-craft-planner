# Security review — 2026-09-05 / v2.4.4

Scope: Cloudflare Pages APIs, account/organization authorization, OAuth and session
storage, web telemetry, Tauri IPC/local files, Discord relay, and desktop delivery.
The deployed workspace redesign is preserved while reconciling main and production.

## Corrected boundaries

- **RSI identity and organization access:** client-selected profile proof allowed a
  public biography string to stand in for ownership. Challenges are now random,
  server-issued, bound to account and handle, and expire after 15 minutes. Legacy
  profile links lose sharing authority until reverified; CitizenID proof remains
  valid. Inventories and account data are preserved.
- **OAuth and sessions:** return URLs reject ambiguous separators; malformed
  cookies/tokens fail safely. Desktop authorization uses native S256 PKCE and
  atomic conditional R2/S3 consumption to reject replay. Revocation lookup fails
  closed and account deletion revokes sessions before removing data. Auth mutation
  requests enforce origin checks; responses are private/no-store.
- **Desktop privileges and files:** OAuth callback parsing is bounded and checks
  its host/path/state; only one login runs at a time. Log reads use bounded file
  descriptors and reject symlinks/non-regular files. Windows autostart quotes paths.
  Tauri capabilities are limited to commands in use. Credential tests use isolated
  test services and do not expose tokens or touch the real user session.
- **Web and telemetry:** script/frame/base policies are tightened. Event filtering
  removes URL query/fragment credentials and raw error text. The analytics proxy
  forwards a small header allowlist, rejects upstream redirects, uses fixed EU/US
  hosts, and bounds bodies and upstream time. CORS responses vary by Origin.
- **Environment and Discord:** missing prod/dev buckets cannot cross-fallback;
  Discord relay scope matches API scope (main is preview/dev), and notification
  links ignore caller Origin/Referer. The separate Discord Worker bounds requests,
  rejects stale/future signatures and malformed hex, and refreshes cached keys.
- **Delivery:** release jobs check out the exact tag, require green main CI and
  Secret Scan plus promotion to production, require the updater signing key,
  and build with the Rust lockfile. Node is pinned to 24.20.0 to satisfy current
  dependency engine requirements. No dependency advisories were reported by npm
  audit or the repository's open Dependabot-alert query during this review.

## Validation and deployment boundaries

Regression coverage exercises RSI ownership/revalidation, CSRF, malformed sessions,
revocation, OAuth PKCE and concurrent replay, credential forwarding, environment
isolation, Discord signatures, release provenance, native callback parsing and files.
The standard typecheck, UI guard, client tests, browser scenarios, Cloudflare dry-run,
web build, Rust tests/audit, and GitHub CI are used for publication acceptance.

Pages deploys through its existing Git integration from production. The Discord
Worker is a separate deployment; its changes require the configured Worker deploy
command and Cloudflare credentials. WAF/Access policy settings are not changed by
this source release. Rust dependency warnings are recorded by cargo audit and kept
visible in CI; a green check is not a claim that no future or unknown flaws exist.

References: [Tauri updater signing](https://v2.tauri.app/plugin/updater/),
[Tauri GitHub workflow](https://v2.tauri.app/distribute/pipelines/github/),
[Cloudflare R2 conditional operations](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).
