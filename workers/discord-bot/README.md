# ItemFab Discord Bot Worker

Dedicated Discord bot runtime for ItemFab, designed to run on a separate Cloudflare Worker from the main Pages app.

## What is included

- Discord interaction signature verification
- Slash commands:
  - `/ping`
  - `/open page:<...>`
  - `/dataset channel:<LIVE|PTU>`
  - `/help`
- Local Wrangler dev config
- Command registration script

## Why a separate Worker

The site currently runs as Cloudflare Pages + Functions. A Discord bot has its own request model:

- Discord sends signed interaction `POST` requests to one endpoint
- the endpoint must answer quickly
- bot secrets should stay isolated from the frontend app

Keeping the bot in its own Worker avoids mixing Discord-specific runtime concerns into the main app deploy.

## Required Discord values

Create a Discord application and bot in the Discord developer portal, then collect:

- `DISCORD_APPLICATION_ID`
- `DISCORD_PUBLIC_KEY`
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID` for fast guild-scoped command registration during development

## Local setup

1. Copy `workers/discord-bot/.dev.vars.example` to `workers/discord-bot/.dev.vars`
2. Fill the Discord values
3. Set `APP_BASE_URL=http://localhost:5173` if you want `/dataset` and `/open` to target the local site

## Commands

```bash
npm run discord:bot:dev
npm run discord:bot:register:guild
npm run discord:bot:register:global
npm run discord:bot:deploy
```

## Deploy flow

1. Deploy the worker with `npm run discord:bot:deploy`
2. Copy the deployed Worker URL
3. In the Discord developer portal, set the Interactions Endpoint URL to that Worker URL
4. Register commands with either:
   - `npm run discord:bot:register:guild` for near-instant dev iteration
   - `npm run discord:bot:register:global` for production rollout

## Notes

- `/dataset` reads the public dataset summary from `APP_BASE_URL/api/game-data/public/{channel}`
- the current scaffold does not need the main app's R2 binding yet
- if you later want org/craft notifications or richer app-native reads, you can add R2 or service bindings to this Worker
