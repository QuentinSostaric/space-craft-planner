# Dataset Contract

Item Fabricator reads normalized Star Citizen datasets from Cloudflare R2 through Pages Functions.

The extraction and publishing pipeline lives outside this public repository. The public app only depends on the R2 object layout and JSON shapes described here.

## R2 Layout

```text
indexes/public.json
indexes/all.json
datasets/{datasetId}/core.json
datasets/{datasetId}/resource-data.json
datasets/{datasetId}/ship-components.json
datasets/{datasetId}/mission-rewards.json
datasets/{datasetId}/mission-rewards/factions/{factionId}.json
datasets/{datasetId}/changelog.json
datasets/{datasetId}/blueprints/{id}.json
aliases/public/{channel}/...
aliases/all/{channel}/...
```

`public` aliases contain browser-safe data. `all` aliases may include fields reserved for authenticated server-side flows.

## Runtime Access

The browser fetches data through `/api/game-data/public*`. It does not read R2 directly.

Pages Functions resolve aliases, load immutable dataset chunks, and return only the payload required by each route.
