# Star Citizen Crafting & Dismantling Mechanics

Reference document for the Item Fabricator crafting system introduced in Star Citizen Alpha 4.0.
Based on extracted game data (PTU 4.7) and official gameplay descriptions.

Source: [Star Citizen Crafting System Tutorial](https://www.youtube.com/watch?v=ePkkezTtIUY)

---

## Table of Contents

1. [Overview](#overview)
2. [The Item Fabricator](#the-item-fabricator)
3. [Blueprints](#blueprints)
4. [Materials & Resources](#materials--resources)
5. [Quality System (0-1000)](#quality-system-0-1000)
6. [GPP Modifiers & Stat Scaling](#gpp-modifiers--stat-scaling)
7. [Item Stats](#item-stats)
8. [Dismantling](#dismantling)
9. [Blueprint Acquisition via Missions](#blueprint-acquisition-via-missions)
10. [Extraction Confidence](#extraction-confidence)

---

## Overview

The crafting system allows players to manufacture FPS gear (weapons, magazines, armor, helmets, undersuits, backpacks) using a physical machine called the **Item Fabricator**. Players collect **blueprints** to unlock recipes, gather **resources** of varying **quality**, and craft items whose final stats depend on the quality of materials used.

**Core loop:**

1. Acquire a blueprint (mission reward or loot)
2. Gather the required resources via mining or trading
3. Load materials into the fabricator
4. Select quality level for each material slot
5. Preview projected stats and confirm crafting
6. Wait for craft time, collect the finished item

---

## The Item Fabricator

- **Name**: RediMake Item Fabricator
- **Inventory capacity**: 16 SCU
- **Location**: Player habs and bases

### Queues

The fabricator has two independent queue groups:

| Queue | Max Active Jobs | Max Waiting | Operations |
|-------|----------------|-------------|------------|
| Create / Repair / Upgrade / Refine | 2 | 4 | Crafting, repair, upgrade, refining |
| Dismantle | 4 | 4 | Dismantling only |

Crafting and dismantling are not the same process with different buttons. They are modeled as different machine actions with different queue rules and different result shapes.

---

## Blueprints

A blueprint is a recipe that defines:

- **Target item**: the specific entity to craft
- **Category**: one of 6 types (see below)
- **Craft time**: duration in seconds
- **Material slots**: each with a fixed required resource, quantity, min quality threshold, and stat modifiers

### Blueprint Categories

| Category | Description |
|----------|------------|
| `fps-weapon` | FPS weapons (rifles, pistols, SMGs, etc.) |
| `fps-magazine` | Ammunition magazines |
| `fps-armor` | Chest / body armor |
| `fps-helmet` | Helmets |
| `fps-undersuit` | Undersuits worn beneath armor |
| `fps-backpack` | Backpacks |

PTU 4.7 contains approximately **419 unique blueprints** across these categories after deduplication of cosmetic variants.

### Important implication

The raw blueprint data says:

- slot -> required material is **fixed**
- slot -> minimum accepted quality is **numeric**

It does **not** say:

- the player chooses between different materials for the same slot
- the game defines three separate material tiers such as CMS/CMP/CMR as different resources

---

## Materials & Resources

Each material slot in a blueprint requires a **fixed resource** — the player cannot substitute one resource for another. The only player choice per slot is the **quality** of the material stack to allocate.

### Resource List (22 resources in PTU 4.7)

| Resource | Color | Notes |
|----------|-------|-------|
| Agricium | #64c3b3 | Rare silvery metal |
| Aluminum | #b7c6d1 | Lightweight, corrosion resistant |
| Aslarite | #5f916d | Thermal insulation properties |
| Beryl | #8fcda5 | Hexagonal crystals |
| Copper | #b87333 | High conductivity |
| Corundum | #c9598d | Crystalline aluminum oxide |
| Gold | #f5c842 | Conductive precious metal |
| Hephaestanite | #7b5e4a | Thermal insulator |
| Iron | #8c7e6e | Strong, common metal |
| Laranite | #ff8c4a | Radioactive gemstone |
| Lindinium | #7bb8ff | Versatile alloyed metal |
| Ouratite | #8d89a8 | Kinetic impact resistant |
| Quartz | #d9e3ea | Silicon/oxygen crystals |
| Riccite | #77d6c8 | Flexible, self-healing |
| Savrilium | #a4d26f | Alloyed metal |
| Silicon | #9eb8cc | Brittle, conductive |
| Stileron | #9abc6c | Physical warfare resilient |
| Taranite | #e05f4f | Extremely conductive |
| Tin | #c3c7d0 | Soft, conductive metal |
| Titanium | #8ca7c8 | Strong, lightweight alloys |
| Torite | #839a70 | Common Nyx system metal |
| Tungsten | #5c6570 | Hard, malleable alloys |

Resources are obtained through mining, trading, and mission rewards. Each resource stack has a quality value.

### Material Slot Structure

Each slot defines:

- **Required resource**: fixed (e.g., "Iron")
- **Quantity**: in SCU (e.g., 0.03 SCU)
- **Min quality**: threshold for slot activation (observed values: 0, 300, 500, or none)
- **Modifiers**: zero or more GPP modifiers that scale item stats

---

## Quality System (0-1000)

Quality is a **numeric value on a 0-1000 linear scale** attached to every resource stack and crafted item.

### Key Quality Points

| Quality | Meaning | Stat Effect |
|---------|---------|-------------|
| 0 | Lowest quality | Maximum penalty (e.g., +30% recoil) |
| 500 | **Neutral midpoint** | **Exactly 0% stat modification** |
| 1000 | Maximum quality | Maximum bonus (e.g., -30% recoil) |

**Quality 500 is the baseline.** At this value, the crafted item has identical stats to the base item with no modification applied. Below 500, stats are penalized. Above 500, stats are improved.

### Min Quality Thresholds

Some material slots require a minimum quality to activate their modifiers:

- `null` or `0`: no restriction, any quality accepted
- `300`: moderate threshold
- `500`: neutral-or-better required

If the assigned quality is below the slot's `minQuality`, the slot's modifiers are **not applied** (the material is consumed but contributes no stat bonus or penalty).

---

## GPP Modifiers & Stat Scaling

**GPP** (Gameplay Property) modifiers are the mechanism through which material quality translates into stat changes on the crafted item.

### How Modifiers Work

Each modifier defines two values from the game XML:

```xml
<CraftingGameplayPropertyModifierValueRange_Linear
  startQuality="0"
  endQuality="1000"
  modifierAtStart="1.3"
  modifierAtEnd="0.7" />
```

- `modifierAtStart` (`modAtMin`): the multiplier applied at quality 0
- `modifierAtEnd` (`modAtMax`): the multiplier applied at quality 1000

### Formula

```
modifier(quality) = modAtMin + (modAtMax - modAtMin) x (quality / 1000)
```

The result is a **multiplier** applied to the base stat. A multiplier of `1.0` means no change.

### Worked Example: Recoil Modifier

Given `modAtMin = 1.3`, `modAtMax = 0.7` (lower recoil is better):

| Quality | t = Q/1000 | Modifier | Effect |
|---------|-----------|----------|--------|
| 0 | 0.0 | 1.30 | +30% recoil (penalty) |
| 250 | 0.25 | 1.15 | +15% recoil |
| **500** | **0.5** | **1.00** | **0% change (neutral)** |
| 750 | 0.75 | 0.85 | -15% recoil (bonus) |
| 1000 | 1.0 | 0.70 | -30% recoil (max bonus) |

### Worked Example: Damage Modifier

Given `modAtMin = 0.9`, `modAtMax = 1.1`:

| Quality | Modifier | Base Damage 20 | Projected |
|---------|----------|---------------|-----------|
| 0 | 0.90 | 20 | 18.0 (-10%) |
| **500** | **1.00** | **20** | **20.0 (0%)** |
| 1000 | 1.10 | 20 | 22.0 (+10%) |

### Modifier Stacking

When multiple slots have modifiers targeting the same stat, they are applied **multiplicatively**:

```
finalStat = baseStat x modifier_slot1 x modifier_slot2 x ...
```

### GPP Modifier Types

**Weapon modifiers:**

| GPP ID | Stat Affected | Typical Range | Direction |
|--------|--------------|---------------|-----------|
| `GPP_Weapon_Damage` | Damage | 0.9 - 1.1 | Higher is better |
| `GPP_Weapon_FireRate` | Rate of Fire | varies | Higher is better |
| `GPP_Weapon_Recoil_Smoothness` | Recoil Smoothness | 1.3 - 0.7 | Lower is better |
| `GPP_Weapon_Recoil_Handling` | Recoil Handling | 1.3 - 0.7 | Lower is better |
| `GPP_Weapon_Recoil_Kick` | Recoil Kick | 1.3 - 0.7 | Lower is better |

**Armor modifiers:**

| GPP ID | Stat Affected | Typical Range | Direction |
|--------|--------------|---------------|-----------|
| `GPP_Armor_DamageMitigation` | All 6 damage resistances | varies | Higher is better |
| `GPP_Armor_TemperatureMin` | Min Temperature | varies | Context-dependent |
| `GPP_Armor_TemperatureMax` | Max Temperature | varies | Context-dependent |
| `GPP_Armor_RadiationDissipation` | Radiation Dissipation | varies | Higher is better |

Note: `GPP_Armor_DamageMitigation` is special — it applies to **all six** damage resistance stats (kinetic, energy, thermal, distortion, biochemical, stun) present on the item.

---

## Item Stats

### Weapon Stats

| Stat | Unit | Affected by Crafting |
|------|------|---------------------|
| Damage | dmg | Yes (GPP_Weapon_Damage) |
| Rate of Fire | rpm | Yes (GPP_Weapon_FireRate) |
| Magazine Size | rds | No |
| Effective Range | m | No |
| Recoil Smoothness | x | Yes (GPP_Weapon_Recoil_Smoothness) |
| Recoil Handling | x | Yes (GPP_Weapon_Recoil_Handling) |
| Recoil Kick | x | Yes (GPP_Weapon_Recoil_Kick) |

### Armor Stats

| Stat | Unit | Affected by Crafting |
|------|------|---------------------|
| Kinetic Resistance | % | Yes (GPP_Armor_DamageMitigation) |
| Energy Resistance | % | Yes (GPP_Armor_DamageMitigation) |
| Thermal Resistance | % | Yes (GPP_Armor_DamageMitigation) |
| Distortion Resistance | % | Yes (GPP_Armor_DamageMitigation) |
| Biochemical Resistance | % | Yes (GPP_Armor_DamageMitigation) |
| Stun Resistance | % | Yes (GPP_Armor_DamageMitigation) |
| Min Temperature | C | Yes (GPP_Armor_TemperatureMin) |
| Max Temperature | C | Yes (GPP_Armor_TemperatureMax) |
| Radiation Dissipation | mRem/s | Yes (GPP_Armor_RadiationDissipation) |

---

## Dismantling

Dismantling breaks down crafted or looted items into raw materials using the same Item Fabricator.

### Global Dismantle Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| Efficiency | 50% | Percentage of materials recovered |
| Dismantle Time | 15 seconds | Per item |
| Default Composition Quality | 500 | Quality of returned materials |
| Refining Quality Unit Multiplier | 2x | Scales quality units in calculations |

### How Dismantling Works

1. Place an item in the fabricator
2. Select "Dismantle" operation
3. The fabricator uses the **Dismantle queue** (separate from crafting)
4. After 15 seconds, materials are returned at 50% efficiency
5. Returned materials have quality 500 (neutral) by default

### Dismantle Blueprint

There is one global dismantle blueprint:

- `libs/foundry/records/crafting/blueprints/dismantle/globalgenericdismantle.xml`

This single blueprint handles all item types. There are no item-specific dismantle recipes.

### Gameplay Property

The extracted data contains a dedicated GPP:

- `GPP_Crafter_DismantleEfficiency`
- Localized as `Dismantle Efficiency`

### UI Result Shape

The dismantle list UI expects runtime entries containing:

- `name` — material/item name
- `categoryName` — category (e.g., "Refined Material")
- `subCategoryName` — subcategory
- `quantity` — amount returned
- `quality` — quality of returned material

This proves that dismantling results are multi-row compositions, not a single scalar reward.

### Per-Item Yield Model (Unresolved)

The current game data does **not** provide a static per-item yield table mapping each item to specific resource outputs. The dismantling result is calculated at runtime by the game server.

- No authoritative static table `entitySlug -> [resource, quantity, quality]` was found
- Only 239 of 1,040 craftable entities had resource container entries
- Current status: `perItemYieldModel.resolved = false`
- The app avoids building a fake dismantle simulator on incomplete evidence

---

## Blueprint Acquisition via Missions

Blueprints are obtained as **mission contract rewards**. They cannot be purchased directly from shops.

### Mission Structure (PTU 4.7)

- **394 blueprint reward contracts** across 30 contract files
- **40 unique blueprint pools**
- **15 faction groups** offering contracts

### Contract Availability Scales

| Scale | Meaning |
|-------|---------|
| `system` | Available throughout the Stanton system |
| `planetary-cluster` | Available at a specific planet and its moons |
| `regional-sector` | Available in a regional area |
| `specific-location` | Available at a specific landing zone or station |

### Standing Requirements

Some contracts require minimum reputation with a faction:

- **Faction**: which group tracks the reputation (e.g., "Bit Zeros", "UEE")
- **Scope**: reputation category (e.g., "FactionReputation")
- **Standing level**: minimum threshold (e.g., "Neutral" = 0.0, "Friendly" = higher)

### Key Findings

- Blueprint rewards are **proven** in extracted contract data
- Explicit craft-resource rewards (getting materials directly from missions) are **not proven** in current contract XML
- Mining/hauling missions exist but do not guarantee specific resource rewards in their contract definitions

---

## Extraction Confidence

### High confidence

- Fabricator dual-queue structure
- Global dismantle blueprint (efficiency, duration)
- Default composition quality
- Dismantle UI runtime fields
- GPP modifier interpolation range (0-1000)
- Blueprint slot structure (fixed resource, numeric quality)

### Medium confidence

- Gameplay interpretation of how the player combines stack quality with blueprint slots
- Modifier stacking behavior (multiplicative)

### Low confidence / unresolved

- Exact static per-item dismantle output table
- Whether modifier ranges other than 0-1000 exist in future content

---

## Quality Decision Framework

| Strategy | Quality Target | Trade-off |
|----------|---------------|-----------|
| **Economy craft** | 0-499 | Stats below baseline; cheapest materials |
| **Neutral craft** | 500 | Identical to base item; moderate cost |
| **Optimized craft** | 501-999 | Progressively better stats; higher-quality materials needed |
| **Maximum craft** | 1000 | Best possible stats; requires top-quality materials |

The quality system is symmetrical around 500: the penalty at quality 0 mirrors the bonus at quality 1000. There is always a meaningful choice between using cheap low-quality materials (accepting a penalty) versus investing in high-quality materials (gaining a bonus).
