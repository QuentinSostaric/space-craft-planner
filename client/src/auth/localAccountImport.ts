import type { StoredAccount } from '../services/authService';
import { LS_KEYS } from '../types';

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const entry of value) {
    const next = String(entry ?? '').trim();
    if (!next || seen.has(next)) {
      continue;
    }

    seen.add(next);
    normalized.push(next);
  }

  return normalized;
}

function readJsonArray(key: string): string[] {
  try {
    const rawValue = window.localStorage.getItem(key);
    if (rawValue == null) {
      return [];
    }

    return normalizeStringArray(JSON.parse(rawValue));
  } catch {
    return [];
  }
}

export interface LocalBlueprintCollections {
  favoriteBlueprintIds: string[];
  inventoryBlueprintIds: string[];
}

export interface LocalBlueprintImportPlan extends LocalBlueprintCollections {
  missingFavoriteBlueprintIds: string[];
  missingInventoryBlueprintIds: string[];
  hasPendingImport: boolean;
}

export function readLocalBlueprintCollections(): LocalBlueprintCollections {
  return {
    favoriteBlueprintIds: readJsonArray(LS_KEYS.FAVORITES),
    inventoryBlueprintIds: readJsonArray(LS_KEYS.INVENTORY),
  };
}

export function computeLocalBlueprintImportPlan(
  account: StoredAccount | null,
  localCollections: LocalBlueprintCollections = readLocalBlueprintCollections(),
): LocalBlueprintImportPlan {
  const favoriteBlueprintIds = normalizeStringArray(localCollections.favoriteBlueprintIds);
  const inventoryBlueprintIds = normalizeStringArray(localCollections.inventoryBlueprintIds);

  if (!account) {
    return {
      favoriteBlueprintIds,
      inventoryBlueprintIds,
      missingFavoriteBlueprintIds: [],
      missingInventoryBlueprintIds: [],
      hasPendingImport: false,
    };
  }

  const accountFavoriteIds = new Set(account.favoriteBlueprintIds);
  const accountInventoryIds = new Set(account.inventoryBlueprintIds);
  const missingFavoriteBlueprintIds = favoriteBlueprintIds.filter((blueprintId) => !accountFavoriteIds.has(blueprintId));
  const missingInventoryBlueprintIds = inventoryBlueprintIds.filter((blueprintId) => !accountInventoryIds.has(blueprintId));

  return {
    favoriteBlueprintIds,
    inventoryBlueprintIds,
    missingFavoriteBlueprintIds,
    missingInventoryBlueprintIds,
    hasPendingImport:
      missingFavoriteBlueprintIds.length > 0 || missingInventoryBlueprintIds.length > 0,
  };
}
