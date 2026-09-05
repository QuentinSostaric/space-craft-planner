# Desktop releases

Item Fabricator desktop builds are packaged with Tauri.

## Local commands

```bash
npm run build
npm run desktop:dev
npm run desktop:build
```

`npm run build` generates `client/public/itemfabricator_version.json` before the Vite build. The file is ignored by Git because it contains build metadata, but it is included in `client/dist` and therefore in desktop bundles.

Example payload:

```json
{
  "name": "item-fabricator",
  "productName": "Item Fabricator",
  "version": "1.11.0",
  "build": "1.11.0+123.abcdef123456",
  "commit": "abcdef123456...",
  "builtAt": "2026-05-18T15:25:55.068Z"
}
```

## Release flow

Create one GitHub release per version and publish it. For example:

```bash
git tag v1.11.0
git push origin v1.11.0
# Then publish a GitHub Release for v1.11.0 in GitHub.
```

The release tag must exactly match the root `package.json` version with a `v` prefix. The
desktop workflow checks this before building, so a tag such as `v2.4.2` cannot accidentally
publish binaries that still identify themselves as `2.4.1`.

For a manual workflow run, provide that existing tag in the required `release_tag` input. Manual
runs check out the selected tag and use the same validation as release-triggered runs.
The tagged commit must have successful CI and Secret Scan runs on main and be included
in both main and production before any build starts.

The `Desktop Release` workflow runs when a GitHub release is published or when an authorized
maintainer starts it manually. It builds and uploads release assets for:

- Windows: NSIS installer `.exe`
- Linux: AppImage
- Tauri updater artifacts: `latest.json`, update archives and signatures

The release asset names use:

```text
[name]-[version]-[platform]-[arch]-[bundle][setup][ext]
```

The launcher can compare GitHub release tags such as `v1.11.0` and read `itemfabricator_version.json` after installation/extraction to verify the installed version/build.

## In-app updates

The installed Tauri app exposes two desktop-only controls in the header:

- `Check` detects whether `latest.json` in the latest GitHub release contains a newer signed build for the current platform.
- `Update` downloads, installs and relaunches the app when an update is available.

The updater endpoint is:

```text
https://github.com/QuentinSostaric/space-craft-planner/releases/latest/download/latest.json
```

GitHub Actions must have these repository secrets:

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

The private key is required. Set the password secret only when that key is encrypted;
an unencrypted key works with an absent or empty password. The public key is committed in `src-tauri/tauri.conf.json`; the private key and password must never be committed. Transfer signing material using a secure secret-management workflow.

The release workflow fails closed when the updater signing key is absent. Windows
Authenticode signing remains optional, but `WINDOWS_CERTIFICATE` and
`WINDOWS_CERTIFICATE_PASSWORD` must either both be configured or both be absent. GitHub Actions
are pinned to immutable commits; see [`supply-chain.md`](./supply-chain.md) for the upgrade policy.

## API base URL

Desktop builds set:

```text
VITE_API_BASE_URL=https://itemfab.space
```

This makes relative `/api/*` calls target the hosted Cloudflare Pages API. If authenticated desktop sessions are required, the Pages Functions auth endpoints must allow the Tauri app origin and credentialed requests, or the desktop app should be switched to a remote-shell model that opens `https://itemfab.space` directly.

## Security update v2.4.4

Desktop sign-in requires the native PKCE flow shipped in v2.4.4. Existing sessions
remain valid; older desktop versions must update before starting a new sign-in.
RSI profile links created before this release require server-challenge revalidation
before organization sharing can be used; CitizenID-verified links remain trusted.
Account data and inventories are retained.

For a controlled rollout, publish the release with `--latest=false`, wait for both
desktop jobs, verify installer signatures and both platform entries in latest.json,
then mark it latest. This keeps automatic updaters on the previous complete release
while the new assets are being built.
