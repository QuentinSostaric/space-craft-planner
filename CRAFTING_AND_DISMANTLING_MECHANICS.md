# Crafting And Dismantling Mechanics

This document explains the current understanding of Star Citizen PTU 4.7 crafting and dismantling for this project.

It separates three things:

1. gameplay observations from playtesting and reports
2. facts proven by extracted game files
3. unresolved areas where the data model is still incomplete

## Scope

The current extraction pipeline covers:

- crafting blueprints
- crafting localizations
- item base stats
- resource images
- dismantling system metadata

The current PTU dismantling export is intentionally conservative. It exports only what is proven in the files.

## 1. Fabricator

The Item Fabricator is the physical machine used for both crafting and dismantling.

### Proven from extracted files

- The standard fabricator record is `basebuilding_interactables_itemfabricator_standard.xml`.
- The fabricator exposes two queue groups:
  - `Create/Repair/Upgrade/Refine`
  - `Dismantle`
- The `Dismantle` queue is separate from the creation queue.
- The localized machine name is `RediMake Item Fabricator`.

### Why it matters for the app

- Crafting and dismantling are not the same process with different buttons.
- They should be modeled as different machine actions with different queue rules and different result shapes.

## 2. Blueprints And Crafting

### Gameplay understanding

- Blueprints are recipe unlocks.
- The player selects a blueprint in the fabricator UI.
- The player then allocates the required materials.
- The machine previews the final stats before the job is confirmed.
- The job enters a queue and later delivers the crafted item to inventory.

### Proven from extracted files

- Each crafting blueprint points to one target entity class.
- Each blueprint tier has:
  - craft time
  - mandatory material inputs
  - optional material inputs if any
  - gameplay property modifiers on specific slots
- Each mandatory slot resolves to one fixed `ResourceType`.

### Important implication

The raw blueprint data says:

- slot -> required material is fixed
- slot -> minimum accepted quality is numeric

It does **not** say:

- the player chooses between different materials for the same slot
- the game defines three separate material tiers such as CMS/CMP/CMR as different resources

## 3. Material Quality

### Gameplay understanding

- Refined materials have a visible quality value.
- Better quality leads to better final crafted stats.
- The player can test different inventory combinations before confirming the craft.

### Proven from extracted files

- Slot `minQuality` is stored as a raw numeric threshold.
- Observed thresholds in PTU 4.7 are `0`, `300`, and `500`.
- Crafting modifiers interpolate from numeric quality values rather than from material names.

### Practical model for the app

The correct long-term model is:

- the blueprint defines the required material per slot
- the player inventory provides one or more stacks of that material
- each stack has a numeric quality value
- the resulting stat bonus depends on the chosen stack quality

## 4. Dismantling

### Gameplay understanding

- The player inserts an item into the fabricator.
- The item is destroyed.
- The machine returns one or more refined materials.
- The UI shows a result list with quantity and quality.

### Proven from extracted files

#### Global dismantle blueprint

There is one global dismantle blueprint:

- `libs/foundry/records/crafting/blueprints/dismantle/globalgenericdismantle.xml`

It currently defines:

- dismantle efficiency: `0.5`
- dismantle time: `15` seconds

#### Global dismantle parameters

Global crafting parameters currently define:

- `defaultCompositionQuality = 500`
- empty dismantle blacklists for resources and entity classes
- a default blueprint whitelist that includes the global dismantle blueprint

#### Fabricator queue

The standard fabricator has a dedicated `Dismantle` queue with its own queue sizing and process availability flags.

#### Gameplay property

The extracted data contains a dedicated GPP:

- `GPP_Crafter_DismantleEfficiency`
- localized as `Dismantle Efficiency`

#### UI result shape

The dismantle list UI expects runtime entries containing:

- `name`
- `categoryName`
- `subCategoryName`
- `quantity`
- `quality`

This is important because it proves that dismantling results are multi-row compositions, not a single scalar reward.

## 5. What We Still Do Not Have

The major unresolved part is the authoritative per-item yield table.

What has been proven so far:

- the game has one global dismantle blueprint
- the UI expects a per-item runtime composition list

What has **not** been proven yet:

- a static table like `entitySlug -> [{ resource, quantity, quality }]`

### Current investigation result

When scanning craftable entity XML files from the extracted PTU dataset:

- many craftable entities have no `ResourceContainerDefaultCompositionEntry`
- some craftable entities do have resource container entries
- those entries are not universal enough to treat as dismantle yields

So the current exporter deliberately outputs:

- `dismantling.perItemYieldModel.resolved = false`

This prevents the app from building a fake dismantle simulator on top of incomplete evidence.

## 6. Exported Data Files

The pipeline now exports:

- `exporter/output/<label>-crafting-blueprints.json`
- `exporter/output/<label>-localizations.json`
- `exporter/output/<label>-item-stats.json`
- `exporter/output/<label>-dismantling.json`
- `exporter/output/<label>-resource-images.json`

The MongoDB dataset also stores the `dismantling` object alongside the normalized crafting data.

## 7. Recommended App Refactor Direction

Based on the extracted data, the app should move toward this model:

### Crafting

- blueprint slots keep a fixed required material
- slot quality requirement remains numeric
- the planner chooses inventory stacks, not fake material tiers

### Dismantling

- show proven system metadata now
- avoid pretending that per-item yields are known unless the extraction finds a real table later
- if the frontend exposes dismantling, mark yield data as partial or unavailable until resolved

## 8. Confidence Summary

High confidence:

- fabricator dual-queue structure
- global dismantle blueprint
- dismantle duration and efficiency
- default composition quality
- dismantle UI runtime fields

Medium confidence:

- gameplay interpretation of how the player combines stack quality with blueprint slots

Low confidence / unresolved:

- exact static per-item dismantle output table
