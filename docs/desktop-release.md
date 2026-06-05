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

Create one GitHub release per version by pushing a tag:

```bash
git tag v1.11.0
git push origin v1.11.0
```

The `Desktop Release` workflow runs on `v*` tags, manually, and when a GitHub release is published. It builds and uploads release assets for:

- Windows: NSIS installer `.exe`
- Linux: AppImage (direct download + auto-updater) and Debian package `.deb`
- Tauri updater artifacts: `latest.json`, update archives and signatures

Both Linux artifacts are intentional and not redundant: the **AppImage** is the
direct download and the only Linux format the auto-updater supports, while the
**`.deb`** is the source the Flathub buildbot unpacks to build the Flatpak (see
[Flathub distribution](#flathub-distribution)). Tauri does not produce a Flatpak
itself, so do not remove either target.

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

The current updater key has a password, so both secrets are required. The public key is committed in `src-tauri/tauri.conf.json`; the private key and password must never be committed. Local generated values currently exist at `.tmp/tauri-updater-private.key` and `.tmp/tauri-updater-password.txt` for transferring into the GitHub secrets.

## Flathub distribution

The Linux Flatpak is published on Flathub from a separate repository
(`github.com/flathub/space.itemfab.ItemFabricator`), **not** from this repo's CI.
The source files we maintain here live in `flatpak/`:

- `space.itemfab.ItemFabricator.yml` — flatpak-builder manifest
- `space.itemfab.ItemFabricator.metainfo.xml` — AppStream MetaInfo (name, summary,
  screenshots, release history)
- `space.itemfab.ItemFabricator.desktop` — desktop entry

The Flatpak uses a **dedicated app-id** `space.itemfab.ItemFabricator`. The
Windows/AppImage builds keep `space.itemfab.desktop` (Flathub rejects app-ids
ending in `.desktop`), so existing users are unaffected. The manifest builds the
Flatpak by unpacking the released `.deb` (the official Tauri approach).

### Build & validate locally

```bash
flatpak install -y flathub org.gnome.Platform//47 org.gnome.Sdk//47 org.flatpak.Builder
cd flatpak
flatpak run org.flatpak.Builder --force-clean --user --install --repo=repo \
  build-dir space.itemfab.ItemFabricator.yml
flatpak run space.itemfab.ItemFabricator
# Linting / validation expected by Flathub:
flatpak run --command=flatpak-builder-lint org.flatpak.Builder appstream space.itemfab.ItemFabricator.metainfo.xml
flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest space.itemfab.ItemFabricator.yml
flatpak run --command=flatpak-builder-lint org.flatpak.Builder builddir build-dir
```

### Per-release update

1. Publish the GitHub release (the workflow uploads the `.deb`).
2. In `flatpak/space.itemfab.ItemFabricator.yml`, set the `.deb` source `url` to the
   release asset and update `sha256` (`sha256sum <the-deb-file>`).
3. Add a `<release>` entry in `space.itemfab.ItemFabricator.metainfo.xml`.
4. Open a PR in the Flathub app repo with the updated manifest (this can be
   automated later with `flatpak-external-data-checker`).

### Initial submission

Fork `github.com/flathub/flathub`, branch off `new-pr`, add the manifest, and open a
PR against `new-pr`. Domain ownership of `itemfab.space` is verified by Flathub
(website or DNS) to publish under the `space.itemfab.*` namespace.

## API base URL

Desktop builds set:

```text
VITE_API_BASE_URL=https://itemfab.space
```

This makes relative `/api/*` calls target the hosted Cloudflare Pages API. If authenticated desktop sessions are required, the Pages Functions auth endpoints must allow the Tauri app origin and credentialed requests, or the desktop app should be switched to a remote-shell model that opens `https://itemfab.space` directly.
