const MAX_LIMIT = 120;
const DEFAULT_LIMIT = 60;

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function getCraftTimeBucket(craftTimeSecs) {
  if (craftTimeSecs <= 60) return '<=60';
  if (craftTimeSecs <= 120) return '61-120';
  if (craftTimeSecs <= 180) return '121-180';
  return '180+';
}

function getRarityRank(rarity) {
  if (rarity === 'legendary') return 3;
  if (rarity === 'rare') return 2;
  if (rarity === 'common') return 1;
  return 0;
}

function compareText(left, right) {
  return String(left ?? '').localeCompare(String(right ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function compareNumberDesc(left, right) {
  const leftValue = left ?? Number.NEGATIVE_INFINITY;
  const rightValue = right ?? Number.NEGATIVE_INFINITY;
  if (leftValue === rightValue) return 0;
  return rightValue - leftValue;
}

function getSearchHaystack(blueprint) {
  const factText = (blueprint.identity?.descriptionFacts ?? [])
    .flatMap((fact) => [fact.label, fact.value])
    .filter(Boolean)
    .join(' ');

  return [
    blueprint.name,
    blueprint.manufacturer,
    blueprint.category,
    blueprint.identity?.shortName,
    blueprint.identity?.descriptionBody,
    factText,
    blueprint.baseStats?.weaponType,
    blueprint.baseStats?.ammoType,
    blueprint.baseStats?.ammoFlavor,
    blueprint.baseStats?.armorType,
    blueprint.baseStats?.armorSlot,
    ...(blueprint.requiredResourceIds ?? []),
    ...(blueprint.slots ?? []).map((slot) => slot.requirementName || slot.requiredResource),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getLimit(url) {
  const value = Number(url.searchParams.get('limit'));
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(value)));
}

function getOffset(url) {
  const value = Number(url.searchParams.get('cursor') ?? 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

function sortBlueprints(blueprints, sort) {
  return [...blueprints].sort((left, right) => {
    switch (sort) {
      case 'manufacturer-asc':
        return compareText(left.manufacturer, right.manufacturer) || compareText(left.name, right.name);
      case 'craft-time-asc':
        return (left.craftTimeSecs ?? 0) - (right.craftTimeSecs ?? 0) || compareText(left.name, right.name);
      case 'craft-time-desc':
        return (right.craftTimeSecs ?? 0) - (left.craftTimeSecs ?? 0) || compareText(left.name, right.name);
      case 'slot-count-desc':
        return (right.slots?.length ?? right.slotCount ?? 0) - (left.slots?.length ?? left.slotCount ?? 0) || compareText(left.name, right.name);
      case 'rarity-desc':
        return getRarityRank(right.rarity) - getRarityRank(left.rarity) || compareText(left.name, right.name);
      case 'damage-desc':
        return compareNumberDesc(left.baseStats?.damage, right.baseStats?.damage) || compareText(left.name, right.name);
      case 'range-desc':
        return compareNumberDesc(left.baseStats?.effectiveRange, right.baseStats?.effectiveRange) || compareText(left.name, right.name);
      case 'rate-of-fire-desc':
        return compareNumberDesc(left.baseStats?.rateOfFire, right.baseStats?.rateOfFire) || compareText(left.name, right.name);
      case 'magazine-desc':
        return compareNumberDesc(left.baseStats?.magazineSize, right.baseStats?.magazineSize) || compareText(left.name, right.name);
      case 'kinetic-desc':
        return compareNumberDesc(left.baseStats?.damageResistanceKinetic, right.baseStats?.damageResistanceKinetic) || compareText(left.name, right.name);
      case 'energy-desc':
        return compareNumberDesc(left.baseStats?.damageResistanceEnergy, right.baseStats?.damageResistanceEnergy) || compareText(left.name, right.name);
      case 'temp-max-desc':
        return compareNumberDesc(left.baseStats?.temperatureMax, right.baseStats?.temperatureMax) || compareText(left.name, right.name);
      case 'name-asc':
      default:
        return compareText(left.name, right.name);
    }
  });
}

export function buildBlueprintCatalogPage(catalogPayload, requestUrl) {
  const url = new URL(requestUrl);
  const limit = getLimit(url);
  const offset = getOffset(url);
  const search = normalizeLower(url.searchParams.get('search'));
  const category = normalizeText(url.searchParams.get('category'));
  const manufacturer = normalizeText(url.searchParams.get('manufacturer'));
  const rarity = normalizeText(url.searchParams.get('rarity'));
  const material = normalizeText(url.searchParams.get('material'));
  const slotCount = normalizeText(url.searchParams.get('slotCount'));
  const craftTime = normalizeText(url.searchParams.get('craftTime'));
  const weaponType = normalizeText(url.searchParams.get('weaponType'));
  const ammoType = normalizeText(url.searchParams.get('ammoType'));
  const ammoFlavor = normalizeText(url.searchParams.get('ammoFlavor'));
  const armorType = normalizeText(url.searchParams.get('armorType'));
  const armorSlot = normalizeText(url.searchParams.get('armorSlot'));
  const sort = normalizeText(url.searchParams.get('sort')) || 'name-asc';

  let blueprints = Array.isArray(catalogPayload?.blueprints) ? catalogPayload.blueprints : [];

  if (category && category !== 'all') {
    blueprints = blueprints.filter((blueprint) => blueprint.category === category);
  }
  if (manufacturer) {
    blueprints = blueprints.filter((blueprint) => blueprint.manufacturer === manufacturer);
  }
  if (rarity && rarity !== 'all') {
    blueprints = blueprints.filter((blueprint) =>
      rarity === 'unknown' ? !blueprint.rarity : blueprint.rarity === rarity,
    );
  }
  if (material) {
    blueprints = blueprints.filter((blueprint) =>
      (blueprint.requiredResourceIds?.includes(material) ?? false) ||
      (blueprint.slots ?? []).some((slot) => slot.requiredResource === material),
    );
  }
  if (slotCount && slotCount !== 'all') {
    blueprints = blueprints.filter((blueprint) =>
      String(blueprint.slots?.length ?? blueprint.slotCount ?? 0) === slotCount,
    );
  }
  if (craftTime && craftTime !== 'all') {
    blueprints = blueprints.filter((blueprint) => getCraftTimeBucket(blueprint.craftTimeSecs ?? 0) === craftTime);
  }
  if (weaponType) {
    blueprints = blueprints.filter((blueprint) => blueprint.baseStats?.weaponType === weaponType);
  }
  if (ammoType) {
    blueprints = blueprints.filter((blueprint) => blueprint.baseStats?.ammoType === ammoType);
  }
  if (ammoFlavor) {
    blueprints = blueprints.filter((blueprint) => blueprint.baseStats?.ammoFlavor === ammoFlavor);
  }
  if (armorType) {
    blueprints = blueprints.filter((blueprint) => blueprint.baseStats?.armorType === armorType);
  }
  if (armorSlot) {
    blueprints = blueprints.filter((blueprint) => blueprint.baseStats?.armorSlot === armorSlot);
  }
  if (search) {
    blueprints = blueprints.filter((blueprint) => getSearchHaystack(blueprint).includes(search));
  }

  const sorted = sortBlueprints(blueprints, sort);
  const items = sorted.slice(offset, offset + limit);
  const nextOffset = offset + items.length;

  return {
    datasetId: catalogPayload?.datasetId ?? null,
    total: sorted.length,
    limit,
    cursor: String(offset),
    nextCursor: nextOffset < sorted.length ? String(nextOffset) : null,
    blueprints: items,
  };
}
