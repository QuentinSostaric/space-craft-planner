# Supply-chain and CI controls

This project keeps deployment inputs reproducible and limits CI credentials to the smallest
scope used by each job.

## Reproducible dependency inputs

- `package-lock.json` is the single npm lockfile for both the repository root and the `client`
  workspace. A second `client/package-lock.json` is intentionally not generated because npm
  workspaces are installed atomically from the root with `npm ci`.
- `src-tauri/Cargo.lock` is committed and Rust checks use the locked graph.
- Wrangler is an exact development dependency. Deployment scripts invoke the lockfile-pinned
  executable instead of downloading a mutable CLI with `npx` at execution time.
- Dependabot checks npm, Cargo and GitHub Actions weekly. Pull requests also run dependency review,
  `npm audit --audit-level=high`, and `cargo audit`.

The July 2026 lockfile refresh moved every package covered by the open Dependabot alerts to a
patched version or removed it from the graph. This includes the critical `shell-quote` advisory,
the high-severity Vite advisory, and the reported Babel, DOMPurify, esbuild, OpenTelemetry,
protobufjs and Vite transitive advisories. `npm audit` is the executable acceptance check rather
than this point-in-time list.

## Immutable CI inputs and permissions

All third-party GitHub Actions use full commit SHAs with a human-readable release comment. The
Gitleaks container uses both a release tag and an OCI digest; it runs with no network, no Linux
capabilities, no privilege escalation and a read-only repository mount.

Workflows default `GITHUB_TOKEN` to `contents: read`, and checkout does not persist credentials.
Only the desktop release job receives `contents: write`, because it uploads assets to a GitHub
release. No unused OIDC or attestation permission is granted.

Artifact attestations are deferred until the release job exposes a stable, explicit list of final
Tauri assets to attest. Granting `id-token: write` and `attestations: write` before that integration
would increase privilege without producing verifiable provenance.

## Configuration and secret boundaries

`npm run config:check` validates lockfiles, immutable action references, public Wrangler variables,
R2 binding names and least-privilege workflow defaults. It never reads `.env` or `.dev.vars` and
never prints environment values. `npm run cloudflare:check` bundles both Cloudflare applications
without authenticating or deploying.

The Discord Worker does not embed an account ID. Operators select the account with
`CLOUDFLARE_ACCOUNT_ID` or a Wrangler login. Cloudflare API tokens remain outside the repository
and should be restricted to the target account and Worker deployment; Pages continues to deploy
through its Git integration, so CI has no Cloudflare token.

Updater signing fails closed if either required Tauri signing secret is absent. Authenticode remains
optional, but its certificate and password must be configured as a pair. Gitleaks adds focused
rules for Cloudflare tokens, R2 credentials and signing material on top of its default rules.

## Breaking changes deliberately avoided

- Checkout, setup-node and dependency review move to their Node 24 action releases; their existing
  inputs remain compatible with GitHub-hosted runners. The Tauri action stays on its current v0
  line instead of taking the newer v1 release semantics in a security-only change.
- The Cloudflare Pages `compatibility_date` is not advanced automatically; that can alter runtime
  semantics and requires application regression testing.
- Tauri and its Linux WebKit/GTK stack are not force-upgraded. `cargo audit` currently reports 17
  allowed upstream warnings: unmaintained GTK3-family crates and one `glib` unsoundness advisory,
  but no deny-by-default vulnerability. Warnings stay visible without failing CI until Tauri
  provides a compatible migration path.
- No separate client lockfile is introduced because it would compete with the root workspace lock.
