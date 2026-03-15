# Item Fabricator

React + TypeScript tool for Star Citizen crafting simulation, dismantling analysis, mission reward browsing, and resource planning.

The site is deployed as a static Cloudflare Pages app. Game data is extracted offline from copied Star Citizen files, normalized, stored in MongoDB Atlas, then fetched at build time into static JSON files.

## Quick Start

### Prerequisites

- Node.js 22+
- A copied Star Citizen dataset in `exporter/source-game-files/PTU` or `exporter/source-game-files/LIVE` if you want to re-extract game data
- MongoDB Atlas access only if you want to publish datasets

### Install

```bash
npm install
```

### Run with MongoDB Atlas data

```bash
$env:MONGODB_URI="mongodb+srv://..."
node scripts/fetchGameData.mjs
npm run dev
```

This is the default frontend data source. The app should consume the published dataset coming from MongoDB, not read files from `exporter/output/`.

## Important Data Notes

- Crafting slots in the extracted game data require a fixed material per slot via `requiredResource`.
- Material quality in game is a numeric inventory-stack value on a 0-1000 scale.
- `minQuality` is also a raw numeric threshold from the game data. Observed values in PTU 4.7 are `0`, `300`, and `500`.
- Dismantling is now exported too, but only the parts proven in the extracted files are treated as truth:
  - one global dismantle blueprint
  - fabricator queue configuration
  - dismantle efficiency gameplay property
  - UI/runtime result shape (`name`, `quantity`, `quality`, `categoryName`, `subCategoryName`)
- The project does **not** currently have a proven per-item dismantle yield table. That remains unresolved and is exported as such.
- Mission reward data is now exported from game files too:
  - grouped by mission giver / faction
  - with explicit reputation scopes
  - with minimum required standings when present
  - with availability scale derived from location prerequisites
  - with resolved blueprint reward pools

Detailed reference: [CRAFTING_AND_DISMANTLING_MECHANICS.md](./CRAFTING_AND_DISMANTLING_MECHANICS.md)

## Extraction Pipeline

### Required copied game files

Place a copied dataset under `exporter/source-game-files/PTU` or `exporter/source-game-files/LIVE`:

- `Data.p4k` required
- `build_manifest.id` recommended
- `Game.log` optional fallback for metadata detection

### Main extraction command

```powershell
powershell -ExecutionPolicy Bypass -File .\exporter\extract-game-data.ps1 -SourcePath .\exporter\source-game-files\PTU
```

The script automatically detects:

- channel (`PTU` or `LIVE`)
- version
- build number
- output label

It then runs:

1. blueprint extraction
2. localization and item stat extraction
3. mission reward extraction
4. dismantling extraction
5. resource image extraction
6. optional MongoDB import and publication prompt

### Main exported files

- `exporter/output/<label>-crafting-blueprints.json`
- `exporter/output/<label>-localizations.json`
- `exporter/output/<label>-item-stats.json`
- `exporter/output/<label>-mission-rewards.json`
- `exporter/output/<label>-dismantling.json`
- `exporter/output/<label>-resource-images.json`

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server plus Cloudflare Pages local proxy |
| `npm run devdata` | Optional offline helper: build static data from `exporter/output/` |
| `npm run build` | Type-check and build the client |
| `npm run deploy` | Fetch published Atlas data, build, deploy to Cloudflare Pages |
| `npm run import:ptu` | Import the PTU dataset into MongoDB |
| `npm run import:live` | Import the LIVE dataset into MongoDB |

## Architecture

### Static site flow

At build time:

1. `scripts/fetchGameData.mjs` reads the latest published MongoDB dataset
2. it writes `client/public/data/index.json`, `ptu.json`, and `live.json`
3. Vite builds the static site

At runtime:

- the browser fetches `/data/index.json`
- then it fetches `/data/{channel}.json`

There is no runtime backend in production.

### Dataset shape

The published full dataset (`/data/ptu.json` or `/data/live.json`) currently contains:

- `resources`
- `blueprints`
- `missionRewards`
- `dismantling`
- `changelog`
- dataset metadata (`datasetId`, `channel`, `version`, `buildNumber`, `published`, timestamps)
- summary counters stored on the dataset document:
  - `blueprintCount`
  - `resourceCount`
  - `dismantlingAvailable`
  - `missionRewardContractCount`
  - `missionRewardFactionGroupCount`

The published dataset summary (`/data/index.json`) currently contains:

- `channel`
- `datasetId`
- `label`
- `version`
- `branch`
- `buildNumber`
- `published`
- `blueprintCount`
- `resourceCount`
- `hasDismantling`
- `hasMissionRewards`
- `missionRewardContractCount`
- `missionRewardFactionGroupCount`
- `importedAt`
- `updatedAt`
- `hasChangelog`

### missionRewards shape

`missionRewards` is the main new block intended for frontend mission browsing.

Top-level keys:

- `summary`
- `conclusions`
- `factionGroups`
- `blueprintRewardContracts`
- `craftResourceRewardContracts`
- `explicitItemRewardContracts`

Important frontend fields:

- `missionRewards.factionGroups[]`
  - grouped by mission giver / faction
  - `contractorDisplayName`
  - `faction`
  - `reputationScopes`
  - `contractCount`
  - `contractFiles`
  - `contracts[]`
- `missionRewards.factionGroups[].contracts[]`
  - `contractDebugName`
  - `contractType`
  - `availability`
  - `minimumRequiredStandings`
  - `blueprintRewards`
- `availability`
  - `derivedScale`
  - `locationPropertyRules`
  - `localities`
  - `explicitLocations`
  - `hasHandlerAvailabilityRules`
- `minimumRequiredStandings[]`
  - `faction`
  - `scope`
  - `standing`

Observed availability scale values in the current PTU export:

- `system`
- `planetary-cluster`
- `regional-sector`
- `specific-location`

### Data Source Rule

For frontend work, treat MongoDB-published datasets as the source of truth.

- Do not read `exporter/output/*.json` from the app.
- Do not hardcode mission giver lists, reputation tiers, or mission scales if they already exist in `missionRewards`.
- Use `index.json` only for channel/dataset selection and lightweight badges.
- Use `ptu.json` / `live.json` for full mission, crafting, and dismantling data.

### App modes

The frontend currently has two modes toggled from the header:

- **Craft** — crafting simulator with quality sliders, stat projection, and resource planner
- **Dismantle** — dismantling calculator showing per-item yield estimates based on global efficiency

Selection is shared between modes: a single blueprint is active across the entire app. In dismantle mode, only inventory items are shown in the explorer.

## Current Limitation

The frontend still contains legacy quality abstractions that do not fully match the extracted game model. Treat the MongoDB-published dataset as the source of truth, not older UI assumptions.
