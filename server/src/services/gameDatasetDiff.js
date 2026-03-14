function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function compareResources(ptuResources = [], liveResources = []) {
  const ptuById = new Map(ptuResources.map((resource) => [resource.id, resource]));
  const liveById = new Map(liveResources.map((resource) => [resource.id, resource]));

  const added = [];
  const removed = [];
  const changed = [];
  let unchangedCount = 0;

  for (const [id, ptuResource] of ptuById) {
    const liveResource = liveById.get(id);

    if (!liveResource) {
      added.push({
        id,
        name: ptuResource.name,
      });
      continue;
    }

    const changedFields = [];

    for (const field of ['name', 'description', 'color']) {
      if (ptuResource[field] !== liveResource[field]) {
        changedFields.push(field);
      }
    }

    if (changedFields.length > 0) {
      changed.push({
        id,
        name: ptuResource.name,
        changedFields,
      });
    } else {
      unchangedCount += 1;
    }
  }

  for (const [id, liveResource] of liveById) {
    if (!ptuById.has(id)) {
      removed.push({
        id,
        name: liveResource.name,
      });
    }
  }

  added.sort((left, right) => left.name.localeCompare(right.name));
  removed.sort((left, right) => left.name.localeCompare(right.name));
  changed.sort((left, right) => left.name.localeCompare(right.name));

  return {
    added,
    removed,
    changed,
    unchangedCount,
  };
}

function compareBlueprints(ptuBlueprints = [], liveBlueprints = []) {
  const ptuById = new Map(ptuBlueprints.map((blueprint) => [blueprint.id, blueprint]));
  const liveById = new Map(liveBlueprints.map((blueprint) => [blueprint.id, blueprint]));

  const added = [];
  const removed = [];
  const changed = [];
  let unchangedCount = 0;

  for (const [id, ptuBlueprint] of ptuById) {
    const liveBlueprint = liveById.get(id);

    if (!liveBlueprint) {
      added.push({
        id,
        name: ptuBlueprint.name,
        category: ptuBlueprint.category,
      });
      continue;
    }

    const changedFields = [];

    for (const field of ['name', 'manufacturer', 'category', 'craftTimeSecs']) {
      if (ptuBlueprint[field] !== liveBlueprint[field]) {
        changedFields.push(field);
      }
    }

    if (stableSerialize(ptuBlueprint.baseStats) !== stableSerialize(liveBlueprint.baseStats)) {
      changedFields.push('baseStats');
    }

    if (stableSerialize(ptuBlueprint.slots) !== stableSerialize(liveBlueprint.slots)) {
      changedFields.push('slots');
    }

    if (changedFields.length === 0) {
      unchangedCount += 1;
      continue;
    }

    changed.push({
      id,
      nameBefore: liveBlueprint.name,
      nameAfter: ptuBlueprint.name,
      categoryBefore: liveBlueprint.category,
      categoryAfter: ptuBlueprint.category,
      changedFields,
    });
  }

  for (const [id, liveBlueprint] of liveById) {
    if (!ptuById.has(id)) {
      removed.push({
        id,
        name: liveBlueprint.name,
        category: liveBlueprint.category,
      });
    }
  }

  added.sort((left, right) => left.name.localeCompare(right.name));
  removed.sort((left, right) => left.name.localeCompare(right.name));
  changed.sort((left, right) => left.nameAfter.localeCompare(right.nameAfter));

  return {
    added,
    removed,
    changed,
    unchangedCount,
  };
}

export function buildDatasetChangelog(ptuDataset, liveDataset) {
  if (!ptuDataset || !liveDataset) {
    return null;
  }

  const blueprintDiff = compareBlueprints(ptuDataset.blueprints, liveDataset.blueprints);
  const resourceDiff = compareResources(ptuDataset.resources, liveDataset.resources);

  return {
    comparedAgainstChannel: 'live',
    comparedAgainstDatasetId: liveDataset.datasetId,
    comparedAgainstVersion: liveDataset.version,
    generatedAt: new Date(),
    summary: {
      blueprints: {
        added: blueprintDiff.added.length,
        removed: blueprintDiff.removed.length,
        changed: blueprintDiff.changed.length,
        unchanged: blueprintDiff.unchangedCount,
      },
      resources: {
        added: resourceDiff.added.length,
        removed: resourceDiff.removed.length,
        changed: resourceDiff.changed.length,
        unchanged: resourceDiff.unchangedCount,
      },
    },
    blueprints: blueprintDiff,
    resources: resourceDiff,
  };
}
