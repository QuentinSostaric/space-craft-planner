# Account workspace

The Account page groups personal data, collaboration and preferences into five sections: overview, inventory, craft requests, organizations and settings. The redesign remains within the existing design system and supports English, French and German, light and dark themes, and mobile layouts.

## Navigation and inventory

Sections have direct links such as `/account?section=inventory`. The current section is preserved across reloads and browser history. Arrow keys, Home and End move focus between tabs. Library search, type, sharing filter, sorting and card/list view are retained locally, with validated defaults if browser storage is unavailable or corrupted.

Blueprints can be added from a searchable picker without replacing existing ownership or favorites. Resource lots can be added in batches or edited individually. Editing preserves the lot ID, creation date and organization shares; an entry that was removed elsewhere cannot be silently recreated. Quantities must be positive; item quantities must be whole numbers and SCU quantities support six decimal places. Quality is optional, with an explicit range of 0–1000. Invalid input stays in the editor with a validation message.

Resource removal requires confirmation and removes associated shares. The operation applies to the current inventory, so changes arriving while the confirmation is open are preserved. Blueprint favorites and ownership also use updates against the latest account state.

## Connections, collaboration and data

Citizen iD sign-in, manual RSI challenge verification, re-verification, organization synchronization, claims and administrative actions remain available. Organization cards emphasize role, sharing and actions; source and verification details are expandable. Craft requests provide direction, status, search and sort controls, with relevant actions per request state. Removing a request explains that it removes the history for both participants.

Settings expose language, appearance, RSI connections, local import review, current-scope JSON export, LIVE-to-PTU copying and account deletion. Export format `sc-craft-account-export`, version 1, includes the selected dataset scope and an export timestamp. It is a download, not a restore/import endpoint. The LIVE-to-PTU action explicitly replaces PTU data and requires confirmation.

Desktop installation paths, log watching and startup controls remain available only in the desktop runtime. Custom paths participate in LIVE watcher detection; corrupted storage and persistence failures produce visible errors.

## Synchronization

Pending mutations are acknowledged by ID, preserving edits queued while a network request is in flight. The in-memory queue remains usable when browser storage is full. Late responses from another dataset scope cannot overwrite the active scope. RSI and onboarding responses request the selected account scope. Resource normalization uses the server's six-decimal SCU precision.

Sign-out first attempts to flush pending changes and prevents new queued mutations during session revocation. It refuses to finish when changes remain pending. Account deletion clears local pending queues for both LIVE and PTU. The header distinguishes pending, saving, error and connected states.

## Code organization

- `AccountPage.tsx`: session presentation and section navigation.
- `account/useAccountController.ts`: account state, derived library data and domain actions.
- `account/Account*Panel.tsx`: overview, inventory, organizations and settings.
- `account/AccountResourceCard.tsx`: inventory-focused quantity, quality and sharing presentation.
- `account/CraftRequestsPanel.tsx` and `AccountGuestView.tsx`: requests and visitor experience.
- `account/AccountResourceEditor.tsx` and `AccountDialogs.tsx`: editing, sharing, confirmations, import and RSI challenges.
- `account/accountHelpers.ts`, `useAccountNavigation.ts` and `useAccountConfirmation.ts`: validation, sorting, preferences, history and confirmation state.

The unused `ResourceInventoryPanel.tsx` implementation was removed. No generated datasets, game files or build output are committed.

## Validation

Run from the repository root:

```sh
npm run test --workspace client
npm test
npm run build --workspace client
npm run ui:guard
npm run test:e2e --workspace client -- e2e/account.spec.ts e2e/rsi-security.spec.ts
```

Account browser tests use deterministic API fixtures. They cover keyboard navigation/history, inventory search and sharing filters, resource validation/edit/removal, blueprint addition, request actions, exports and preferences, and unavailable guest sign-in in four viewport/theme projects. Existing manual RSI security coverage remains enabled. Component tests include automated accessibility checks for the guest and request views; authentication tests cover mutation races and sign-out failures.

Real external Citizen iD/RSI/Discord services and native Windows startup/log watching were not exercised during this local validation. Their existing integration paths and boundaries are retained. This change does not deploy or publish a dataset.
