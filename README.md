# Item Fabricator

**[itemfab.space](https://itemfab.space)**

React + TypeScript app for Star Citizen crafting, dismantling analysis, mission reward browsing, resource planning, account sync, organizations, and Discord-assisted craft requests.

## Features

- **Account Layer** - Discord sign-in, cloud-synced favorites / inventory / planner state, and local blueprint import after login.
- **RSI Linking** - verify an RSI handle from the account page and unlock organization-aware features.
- **Blueprint Library** - search, segmented control, category accordions, advanced filters, and responsive blueprint cards.
- **Item Workspace** - sticky identity / acquisition column plus craft simulator, material sources, and dismantling panels.
- **Mission Directory** - faction accordions, contract cards, standing / location filters, and blueprint reward navigation.
- **Resources** - resource explorer with filters, detail panel, mission demand, and blueprint usage.
- **Planner** - full-page crafting plan with goals, aggregated resources, collection progress, and export actions.
- **Organizations** - link organizations from RSI profile or by SID / URL, browse shared blueprints per org, and request manual org claim review.
- **Craft Requests** - request a craft from another organization member and track `Pending`, `Accepted`, `Denied`, and `Closed`.
- **Discord Bot** - dedicated Cloudflare Worker that DMs blueprint owners with `Accept`, `Deny`, and `Get in touch`.
- **Comparison** - compare up to 4 blueprints side by side.
- **Dataset Changelog** - PTU vs LIVE diff from the header.

## Architecture

Production data and account flow are runtime-driven:

1. A private exporter pipeline publishes normalized dataset chunks to Cloudflare R2.
2. Cloudflare Pages Functions read dataset chunks from the `GAME_DATA` binding.
3. The browser fetches `/api/game-data/public*`.
4. `/api/auth/*` handles Discord OAuth, account state, RSI link, organizations, sharing, and craft requests backed by R2 records.
5. Craft request notifications are relayed to a dedicated Discord bot Worker. Only the bot Worker stores the Discord bot token.

Dataset extraction and R2 publication tooling are intentionally kept outside this public repository. The public contract is documented in [docs/dataset-contract.md](./docs/dataset-contract.md).

Production URL: [itemfab.space](https://itemfab.space)

## Runtime Endpoints

### Public dataset endpoints

```text
GET /api/game-data/public
GET /api/game-data/public/:channel
GET /api/game-data/public/:channel/resource-data
GET /api/game-data/public/:channel/ship-components
GET /api/game-data/public/:channel/mission-rewards
GET /api/game-data/public/:channel/mission-rewards/factions/:factionId
GET /api/game-data/public/:channel/changelog
GET /api/game-data/public/by-id/:datasetId
GET /api/game-data/public/by-id/:datasetId/resource-data
GET /api/game-data/public/by-id/:datasetId/ship-components
GET /api/game-data/public/by-id/:datasetId/mission-rewards
GET /api/game-data/public/by-id/:datasetId/mission-rewards/factions/:factionId
GET /api/game-data/public/by-id/:datasetId/changelog
GET /api/game-data/public/by-id/:datasetId/blueprints/:id
```

### Auth / account endpoints

```text
GET /api/auth/session
GET /api/auth/discord/login?returnTo=/path
GET /api/auth/discord/callback
POST /api/auth/logout

GET /api/auth/account
PUT /api/auth/account
DELETE /api/auth/account

POST /api/auth/account/rsi-link
DELETE /api/auth/account/rsi-link

POST /api/auth/account/organizations
DELETE /api/auth/account/organizations/:sid

PUT /api/auth/account/shared-blueprints

POST /api/auth/organizations/:sid/claim
POST /api/auth/organizations/:sid/refresh
GET /api/auth/organizations/:sid/shared-blueprints
POST /api/auth/organizations/:sid/craft-requests

POST /api/auth/craft-requests/:requestId
```

## Auth and Account Model

- Provider: Discord OAuth 2
- Default scope: `identify`
- Session storage: signed stateless HttpOnly cookie
- RSI link: optional verified handle stored on the account
- Account persistence: favorites, inventory, planner state, linked orgs, per-org blueprint shares, craft requests
- Organization persistence: metadata, member snapshot, admin state, review requests

## Discord Bot Worker

The bot lives in [`workers/discord-bot`](./workers/discord-bot).

- Runtime: separate Cloudflare Worker
- Slash commands: `/ping`, `/open`, `/dataset`, `/help`
- Craft request flow:
  - owner receives a DM with a rich embed
  - actions: `Accept`, `Deny`, `Get in touch`
  - owner can answer without opening the app
- Security model:
  - the main site does not need `DISCORD_BOT_TOKEN`
  - the site calls the bot through a signed internal endpoint
  - only the bot Worker stores the Discord bot token

## Quick Start

### Prerequisites

- Node.js 24+
- Cloudflare R2 credentials for account features and local API development

### Install

```bash
npm install
```

### Local Dev

Create a root `.dev.vars` file:

```bash
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key-id>
R2_SECRET_ACCESS_KEY=<r2-secret-access-key>
R2_BUCKET_NAME=sc-craft-game-data-dev
R2_BUCKET_REGION=auto

DISCORD_CLIENT_ID=<discord-client-id>
DISCORD_CLIENT_SECRET=<discord-client-secret>
AUTH_SESSION_SECRET=<long-random-secret>
AUTH_PUBLIC_ORIGIN=http://localhost:5173

DISCORD_BOT_WORKER_URL=https://sc-craft-discord-bot.<your-subdomain>.workers.dev
DISCORD_BOT_INTERNAL_TOKEN=<shared-secret-between-site-and-bot-worker>

STARCITIZEN_API_KEY=<starcitizen-api-key>
```

Create `workers/discord-bot/.dev.vars`:

```bash
DISCORD_APPLICATION_ID=<discord-application-id>
DISCORD_PUBLIC_KEY=<discord-interactions-public-key>
DISCORD_BOT_TOKEN=<discord-bot-token>
DISCORD_BOT_INTERNAL_TOKEN=<same-shared-secret-as-root-dev-vars>
APP_BASE_URL=http://localhost:5173
```

Run the app:

```bash
npm run dev
```

This starts:

- Vite on `http://localhost:5173`
- Local API on `http://127.0.0.1:8788`

Run the bot locally if needed:

```bash
npm run discord:bot:dev
```

### Build

```bash
npm run build
```

### Deploy

```bash
npm run deploy
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server plus local API server |
| `npm run build` | Type-check and build the client |
| `npm run deploy` | Build and deploy the Pages app |
| `npm run claims:org` | Review manual organization claim requests from R2 |
| `npm run discord:bot:dev` | Run the Discord bot Worker locally |
| `npm run discord:bot:deploy` | Deploy the Discord bot Worker |
| `npm run discord:bot:register:guild` | Register slash commands in one Discord guild |
| `npm run discord:bot:register:global` | Register slash commands globally |

## Key Files

| File | Purpose |
| --- | --- |
| `client/src/App.tsx` | App shell, top-level routing, lazy views |
| `client/src/auth/AuthContext.tsx` | Authenticated client state and `/api/auth/*` actions |
| `client/src/components/AccountPage.tsx` | Account identity, organizations, shares, craft requests |
| `client/src/components/OrganizationsPage.tsx` | Shared blueprint explorer per organization |
| `client/src/components/BlueprintExplorer.tsx` | Blueprint filters and explorer sidebar |
| `client/src/components/BlueprintGrid.tsx` | Responsive blueprint grid and card actions |
| `client/src/components/MissionsPanel.tsx` | Mission directory |
| `client/src/components/ResourcesPage.tsx` | Resource explorer |
| `client/src/components/NavRail.tsx` | Fixed-height side navigation |
| `client/src/store/CraftContext.tsx` | Central dataset and UI state |
| `client/src/services/authService.ts` | Typed auth/account/organization client |
| `functions/_shared/auth.js` | Shared Pages auth/account/organization handlers |
| `functions/api/auth/` | Pages auth/account endpoints |
| `scripts/devApiServer.mjs` | Local API server backed by R2 |
| `scripts/manageOrganizationClaims.mjs` | CLI reviewer for org claim requests |
| `shared/accountStorage.mjs` | Normalized account storage in R2 |
| `shared/organizationService.mjs` | Org sync, decoration, sharing, access rules |
| `shared/craftRequestService.mjs` | Craft request create / update logic |
| `shared/discordBotRelay.mjs` | Signed site-to-bot relay |
| `shared/discordBot.mjs` | Discord DM payload builders and API helpers |
| `shared/rsiLink.mjs` | StarCitizen API integration |
| `workers/discord-bot/` | Dedicated Discord bot Worker |

## Game Data Rules

### Crafting

- Each crafting slot resolves to one fixed required material.
- `minQuality` is a raw numeric threshold from game data.
- Material quality is a numeric stack value on a `0-1000` scale.

### Dismantling

- Dismantling metadata must come from extracted game files.
- The dataset currently proves one global dismantle process.
- Do not invent per-item dismantle yields when extraction does not prove them.

### Mission Rewards

- Grouping, standing requirements, and location scope come from extracted contracts.
- Current extraction proves blueprint reward contracts.
- Current extraction does not prove explicit craft-resource reward contracts in contract XML.

Detailed reference: [CRAFTING_AND_DISMANTLING_MECHANICS.md](./CRAFTING_AND_DISMANTLING_MECHANICS.md)
