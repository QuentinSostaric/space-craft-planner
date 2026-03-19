# Item Fabricator

**[itemfab.space](https://itemfab.space)**

React + TypeScript app for Star Citizen crafting, dismantling analysis, mission reward browsing, and resource planning.

## Features

- **Blueprint Library** — filter bar with search, segmented control (All / Inventory / Favorites / Obtainable), category chips, manufacturer/legality/location filters. Compact horizontal cards with item thumbnails (wiki images), manufacturer logos, and category icon fallbacks
- **Item Workspace** — tabbed item view (Overview / Craft / Acquisition / Dismantle) centered on the selected blueprint
- **Craft Simulator** — horizontal grid of slot cards with quality sliders (+/− controls), per-slot modifier chips, side-by-side combined modifiers table and resource summary
- **Acquisition Sources** — per-blueprint mission contracts with faction, standing, location, and scale details
- **Dismantling** — contextual dismantling metadata (efficiency, queues, global parameters) as an item tab
- **Mission Directory** — flat grid of contract cards with search, contractor, location, scale, and legality filters. Lawful/unlawful color indicators, blueprint reward chips
- **Left Navigation** — collapsible sidebar (140px expanded / 36px collapsed) for Blueprints and Missions views, state persisted in localStorage
- **Resource Planner** — collapsible drawer with crafting goals, aggregated materials, blueprint sources, and plan export
- **Comparison** — compare up to 4 builds side-by-side with projected stat deltas
- **Dataset Changelog** — PTU vs LIVE diff accessible via header button
- **External Media** — blueprint images and manufacturer logos resolved from starcitizen.tools wiki (93% coverage)

## Architecture

Production data is runtime-driven:

- Browser
- Cloudflare Pages Functions
- MongoDB Atlas

The frontend must not read local dataset snapshots. The published MongoDB dataset is the source of truth.

Production URL: [itemfab.space](https://itemfab.space) (Cloudflare Pages + custom domain)

Runtime endpoints:

- `GET /api/game-data/public`
- `GET /api/game-data/public/:channel`
- `GET /api/game-data/public/:channel/mission-rewards`

`/api/game-data/public/:channel` returns the core dataset used by the app:

- `resources`
- `blueprints`
- `dismantling`
- `changelog`
- dataset metadata and counters

`missionRewards` is loaded separately on demand to avoid downloading the heaviest block on initial load.

## Quick Start

### Prerequisites

- Node.js 22+
- a published dataset in MongoDB Atlas
- copied Star Citizen files in `exporter/source-game-files/PTU` or `exporter/source-game-files/LIVE` only if you want to re-extract data

### Install

```bash
npm install
```

### Local dev

Create a root `.dev.vars` file for Cloudflare Pages local functions:

```bash
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?appName=<AppName>
```

Then run:

```bash
npm run dev
```

The app is served through `wrangler pages dev`, so local dev uses the same runtime API shape as production.

### Build

```bash
npm run build
```

### Deploy

```bash
npm run deploy
```

This builds the client and deploys `client/dist` to Cloudflare Pages. It does not generate or bundle local JSON dataset files.

## Game Data Rules

These rules are important when changing the app or the exporter.

### Crafting

- Each crafting slot resolves to one fixed required material.
- `minQuality` is a raw numeric threshold from game data.
- Material quality is a numeric stack value on a `0-1000` scale.
- Do not model quality as source-of-truth tiers like `CMS`, `CMP`, `CMR`, `chunks`, `scraps`, or `powder`.

### Dismantling

- The dataset proves one global dismantle process.
- Dismantling metadata such as efficiency, time, queues, and default composition quality must come from extracted game files.
- The current extraction does not prove a complete per-item dismantle yield table.
- `dismantling.perItemYieldModel.resolved` must remain authoritative.

### Mission rewards

- Mission giver / faction grouping comes from extracted contract data.
- Reputation scopes, minimum standings, and availability scale come from extracted mission records.
- Current PTU 4.7 extraction proves blueprint reward contracts.
- Current PTU 4.7 extraction does not prove explicit craft-resource reward contracts in contract XML.

Detailed reference: [CRAFTING_AND_DISMANTLING_MECHANICS.md](./CRAFTING_AND_DISMANTLING_MECHANICS.md)

## Extraction Pipeline

The extractor works from copied game files only. It must not touch a live game installation.

### Required copied files

Place a copied dataset under `exporter/source-game-files/PTU` or `exporter/source-game-files/LIVE`:

- `Data.p4k` required
- `build_manifest.id` recommended
- `Game.log` optional fallback

### Main extraction command

```powershell
powershell -ExecutionPolicy Bypass -File .\exporter\extract-game-data.ps1 -SourcePath .\exporter\source-game-files\PTU
```

The script detects:

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
6. optional MongoDB publication prompt

### Main exported files

- `exporter/output/<label>-crafting-blueprints.json`
- `exporter/output/<label>-localizations.json`
- `exporter/output/<label>-item-stats.json`
- `exporter/output/<label>-mission-rewards.json`
- `exporter/output/<label>-dismantling.json`
- `exporter/output/<label>-resource-images.json`

### Publish to MongoDB

The normal path is to publish from the extractor prompt. You can also import manually:

```bash
npm run import:ptu
npm run import:live
```

## App Data Contract

### Dataset index

`GET /api/game-data/public` returns lightweight summaries:

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

### Core dataset

`GET /api/game-data/public/:channel` returns:

- `resources`
- `blueprints`
- `dismantling`
- `changelog`
- dataset metadata

### Mission rewards dataset

`GET /api/game-data/public/:channel/mission-rewards` returns:

- `summary`
- `conclusions`
- `factionGroups`

Useful frontend fields:

- `factionGroups[].contractorDisplayName`
- `factionGroups[].faction`
- `factionGroups[].reputationScopes`
- `factionGroups[].contractCount`
- `factionGroups[].contracts[]`

Useful contract fields:

- `availability.derivedScale`
- `availability.localities`
- `availability.explicitLocations`
- `minimumRequiredStandings`
- `rewardedBlueprints`

Observed availability scales in PTU 4.7:

- `system`
- `planetary-cluster`
- `regional-sector`
- `specific-location`

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server plus Cloudflare Pages local proxy |
| `npm run build` | Type-check and build the client |
| `npm run deploy` | Build the client and deploy to Cloudflare Pages |
| `npm run import:ptu` | Import the PTU dataset into MongoDB |
| `npm run import:live` | Import the LIVE dataset into MongoDB |

## Key Files

| File | Purpose |
| --- | --- |
| `client/src/store/CraftContext.tsx` | central frontend state and dataset loading |
| `client/src/services/mongoDbService.ts` | runtime fetch client for published datasets |
| `client/src/theme.ts` | MUI theme and design tokens |
| `client/src/components/NavRail.tsx` | collapsible left sidebar navigation (Blueprints / Missions) |
| `client/src/components/BlueprintGrid.tsx` | blueprint card grid with media thumbnails |
| `client/src/components/BlueprintExplorer.tsx` | blueprint filter bar (search, segments, categories) |
| `client/src/components/ItemWorkspace.tsx` | tabbed item workspace (Overview, Craft, Acquisition, Dismantle) |
| `client/src/components/item-workspace/CraftTab.tsx` | craft simulator with horizontal slot grid |
| `client/src/components/MissionsPanel.tsx` | mission contract grid with filters |
| `client/src/components/PlannerPanel.tsx` | goals, materials, mission sources, export |
| `client/src/components/PlannerDrawer.tsx` | collapsible planner drawer shell |
| `functions/_shared/mongoClient.js` | Cloudflare Pages MongoDB client |
| `functions/api/game-data/public.js` | dataset index endpoint |
| `functions/api/game-data/public/[channel].js` | core dataset endpoint |
| `functions/api/game-data/public/[channel]/mission-rewards.js` | mission rewards endpoint |
| `exporter/extract-game-data.ps1` | main extraction entry point |
| `exporter/dataset-builder.mjs` | normalized dataset builder |
| `exporter/importToMongo.mjs` | Atlas import pipeline |
