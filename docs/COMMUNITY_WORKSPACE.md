# Organizations and community marketplace

The community area provides two separate places to coordinate crafts: organization catalogues at `/organizations` and an app-wide marketplace at `/marketplace`. Both show the provider’s public RSI identity and a visible craft request action. There are no prices, payments, stock reservations or automatic delivery promises.

## Organizations

The directory has search, sorting and explicit locked membership states. Detail links retain the organization and section in the URL, support browser history and keyboard navigation, and distinguish blueprints, resource lots and contributors. Contributors are the players who share stock, not a complete membership roster.

Blueprint and resource catalogues load independently. Failure in one does not discard the other; each can be retried. Resources remain individual lots, with their owner, unit, quantity and optional quality. Filters cover names, providers, blueprint category/manufacturer and resource quality. Totals never add incompatible units together.

Each blueprint offer shows its provider without requiring hover. Requests identify the provider and blueprint, accept a comment of up to 1,000 characters and an exclusive resource arrangement, retain the draft after an API error and show existing request/self states. Replies and closure remain in Account → Craft requests. Organization membership and the actual shared blueprint are still checked by the server.

## Marketplace publication

Viewing offers requires an authenticated, verified RSI identity. A guest can read the introduction without loading private catalogues. The three member sections are Browse offers, My listings and Safety & privacy; administrators also have Moderation.

Publication is private by default. The user selects owned blueprints and current resource lots and explicitly enables publication. Organization shares are never promoted into community offers. LIVE and PTU have independent selections, and copying LIVE data to PTU does not copy publication consent. Publishing at most 400 offers in total (blueprints and lots combined) per environment bounds indexing work. Withdrawing does not remove inventory. A user who loses RSI verification can still withdraw and manage blocks.

The publication limit also leaves room for replacing a previous selection under the documented [Cloudflare Workers internal-service request limits](https://developers.cloudflare.com/workers/platform/limits/). Conditional writes use the [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/#conditional-operations) and the supported [S3 conditional operations](https://developers.cloudflare.com/r2/api/s3/api/).

The listing projection contains the provider’s public RSI handle/name/profile URL, chosen blueprint IDs, selected lot quantities/qualities and an update timestamp. It does not expose Discord identities, organization memberships, unselected stock or private account data. The internal consent is tied to the verified RSI identity; changing that identity cannot reuse an earlier publication choice.

Search can select an exact dataset item and/or RSI handle. The directory reads dedicated indexes with bounded cursor pagination, not a full scan of accounts. Counts in the UI describe loaded offers, not an invented total. A listing is rechecked against the current account, inventory, verification, publication and suspension/block state before being returned or used for a craft request. Stale index entries therefore cannot reveal withdrawn stock.

## Requests, blocking and moderation

Community requests use the existing request lifecycle with `source: 'community'` and no organization SID/name. Only the participant’s own account ID remains visible; the other participant’s private account ID is projected as an opaque reference. Server records retain real participant IDs for authorization. Community requests remain inside the app and do not introduce automatic Discord messages. Resource offers expose an RSI profile contact link; resource negotiation is not modeled as a blueprint craft request.

Creation rejects self requests, unavailable offers, blocked or suspended accounts, duplicate open requests and invalid input. The server limits community creation to 10 requests per hour and 30 pending requests. These are explicit online operations; the browser never silently replays a failed community request from an offline queue.

Blocks are private, reversible and apply across LIVE/PTU. They hide each player’s offers from the other and prevent new community requests in either direction; existing requests remain manageable in Account. Reporting uses three fixed reasons: spam, misleading offer or abuse, with deduplication and a limit of five reports per day. Reports are available only to app administrators. A report does not itself prove misconduct or automatically suspend a player.

Administrators can review paginated reports, dismiss them, suspend marketplace access or restore it. Suspension and restoration require a UI confirmation. Restoration does not republish earlier listings; the owner must opt in again. Account deletion removes listings, safety references and identifying report data. An anonymized report submitted about another account may remain for moderation, without the deleted reporter’s identity.

## Implementation and verification

- `client/src/components/OrganizationsPage.tsx` and `organizations/`: directory, independently loaded catalogues, shared offer cards, provider identity, request dialog and URL navigation.
- `client/src/components/MarketplacePage.tsx` and `marketplace/`: browsing, publication selection, blocks/reports, moderation and scoped request state.
- `client/src/services/marketplaceService.ts` and `auth/AuthContext.tsx`: authenticated web/desktop transport, explicit online actions and response application that preserves newer inventory edits and rejects stale account/scope responses.
- `shared/marketplaceService.mjs`, `marketplaceStorage.mjs`, `accountStorage.mjs`: authorization, minimal projections, consent, indexes, atomic storage updates, rate limits, cleanup and request persistence.
- `functions/api/auth/marketplace*`, `functions/api/auth/account/marketplace.js`: authenticated endpoints. The local API server routes account/community operations through the same handlers as production to keep validation and LIVE/PTU behavior aligned.

Run from the repository root:

```sh
npm run test --workspace client
npm test
npm run build --workspace client
npm run ui:guard
npm run test:e2e --workspace client -- e2e/organizations.spec.ts e2e/marketplace.spec.ts e2e/account.spec.ts e2e/rsi-security.spec.ts
```

Browser tests use deterministic accounts and API fixtures, never real publications or messages. Server tests exercise real service and handler boundaries with in-memory storage, including consent races, private projections, scoping, authorization and moderation. Native desktop execution, real Citizen iD/RSI/Discord services and deployed R2 behavior need a deployment-environment check; local tests do not establish those external results. This work does not deploy the app or publish any user listing or game dataset.
