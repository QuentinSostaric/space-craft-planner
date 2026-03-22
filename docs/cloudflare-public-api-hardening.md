# Cloudflare Public API Hardening

This runbook hardens the public dataset API with minimal application changes.

Goals:

- keep `itemfab.space` public
- reduce scraping/abuse on `/api/game-data/public*`
- protect preview deployments for machine-to-machine testing
- keep the browser app unchanged

## Scope

Public production API paths:

- `/api/game-data/public`
- `/api/game-data/public/:channel`
- `/api/game-data/public/:channel/mission-rewards`
- `/api/game-data/public/by-id/:datasetId`
- `/api/game-data/public/by-id/:datasetId/mission-rewards`

Preview deployment URLs:

- `*.pages.dev` preview deployments for the Pages project

## 1. Production WAF rule

Create a custom WAF rule on the `itemfab.space` zone.

Suggested expression:

```text
http.host eq "itemfab.space"
and starts_with(http.request.uri.path, "/api/game-data/public")
and not http.request.method in {"GET" "HEAD" "OPTIONS"}
```

Action:

- `Block`

This prevents unexpected write or probing methods from reaching the Pages Functions.

## 2. Production rate limiting

Create two rate limiting rules on the `itemfab.space` zone.

### Rule A — heavy mission reward endpoints

Expression:

```text
http.host eq "itemfab.space"
and (
  wildcard_replace(http.request.uri.path, "/api/game-data/public/*/mission-rewards", "/api/game-data/public/*/mission-rewards") eq "/api/game-data/public/*/mission-rewards"
  or wildcard_replace(http.request.uri.path, "/api/game-data/public/by-id/*/mission-rewards", "/api/game-data/public/by-id/*/mission-rewards") eq "/api/game-data/public/by-id/*/mission-rewards"
)
```

Settings:

- threshold: `30`
- period: `60 seconds`
- counting key: `IP`
- action: `Block`
- mitigation timeout: `5 minutes`

### Rule B — all other public dataset endpoints

Expression:

```text
http.host eq "itemfab.space"
and starts_with(http.request.uri.path, "/api/game-data/public")
and not ends_with(http.request.uri.path, "/mission-rewards")
```

Settings:

- threshold: `120`
- period: `60 seconds`
- counting key: `IP`
- action: `Block`
- mitigation timeout: `1 minute`

## 3. Preview deployment protection with Access

Use Cloudflare Access for preview deployment URLs only.

Recommended setup:

- create an Access application covering the Pages preview hostname pattern
- leave the production custom domain public
- require authentication on previews

### Permanent machine credential

Create one service token:

- name: `itemfab-llm-tests`

Use the standard Access headers for test clients:

- `CF-Access-Client-Id`
- `CF-Access-Client-Secret`

Do not embed this credential in the frontend.

## 4. Reduce the production hostname surface

In Cloudflare Pages settings:

- configure the production `*.pages.dev` hostname to redirect to `https://itemfab.space`

Keep preview deployments available on preview URLs.

## 5. App-side hardening already shipped

The public dataset endpoints now emit:

```text
Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=300
```

Error responses emit:

```text
Cache-Control: no-store
```

This reduces repeated origin load without changing payloads or requiring client auth.

## Validation checklist

- production site loads anonymously
- `/api/game-data/public*` responds with the expected `Cache-Control`
- repeated hits to mission reward endpoints trigger Rule A
- repeated hits to other dataset endpoints trigger Rule B
- preview deployments are blocked anonymously
- preview deployments are accessible with the Access service token
- production `*.pages.dev` redirects to `itemfab.space`
