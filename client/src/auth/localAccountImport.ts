import type {
  AccountInventoryResourceEntry,
  AccountInventoryResourceQuantityUnit,
  StoredAccount,
} from '../services/authService';
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

function readJsonValue<T>(key: string, fallbackValue: T): T {
  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue == null ? fallbackValue : (JSON.parse(rawValue) as T);
  } catch {
    return fallbackValue;
  }
}

function writeJsonValue<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota failures and private mode restrictions.
  }
}

function normalizeQuantityUnit(value: unknown): AccountInventoryResourceQuantityUnit {
  return String(value ?? '').trim().toLowerCase() === 'count' ? 'count' : 'scu';
}

function normalizeResourceQuantity(
  value: unknown,
  quantityUnit: AccountInventoryResourceQuantityUnit,
): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  if (quantityUnit === 'count') {
    return Math.max(1, Math.round(parsed));
  }

  return Math.max(0.000001, Math.round(parsed * 1_000_000) / 1_000_000);
}

function normalizeQuality(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.min(1000, Math.max(0, Math.round(parsed)));
}

function normalizeIsoString(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return null;
  }

  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function normalizeLocalInventoryResourceEntry(
  value: unknown,
): AccountInventoryResourceEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<AccountInventoryResourceEntry>;
  const resourceId = String(candidate.resourceId ?? '').trim();
  const resourceName = String(candidate.resourceName ?? '').trim();
  const quantityUnit = normalizeQuantityUnit(candidate.quantityUnit);
  const quantity = normalizeResourceQuantity(candidate.quantity, quantityUnit);

  if (!resourceId || !resourceName || quantity == null) {
    return null;
  }

  return {
    id: String(candidate.id ?? '').trim() || globalThis.crypto.randomUUID(),
    resourceId,
    resourceName,
    quantity,
    quantityUnit,
    quality: normalizeQuality(candidate.quality),
    createdAt: normalizeIsoString(candidate.createdAt) ?? new Date().toISOString(),
    updatedAt: normalizeIsoString(candidate.updatedAt) ?? new Date().toISOString(),
  };
}

function normalizeInventoryResourceEntries(value: unknown): AccountInventoryResourceEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeLocalInventoryResourceEntry(entry))
    .filter((entry): entry is AccountInventoryResourceEntry => Boolean(entry));
}

function createResourceImportSignature(
  resourceEntry: Pick<
    AccountInventoryResourceEntry,
    'resourceId' | 'quantity' | 'quantityUnit' | 'quality'
  >,
): string {
  const quantity =
    resourceEntry.quantityUnit === 'count'
      ? String(Math.max(1, Math.round(resourceEntry.quantity)))
      : (Math.round(resourceEntry.quantity * 1_000_000) / 1_000_000).toFixed(6);
  return [
    String(resourceEntry.resourceId ?? '').trim().toLowerCase(),
    resourceEntry.quantityUnit,
    quantity,
    resourceEntry.quality == null ? 'none' : String(Math.round(resourceEntry.quality)),
  ].join('|');
}

function buildSignatureCounts(
  entries: AccountInventoryResourceEntry[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const signature = createResourceImportSignature(entry);
    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  }
  return counts;
}

export interface LocalBlueprintCollections {
  favoriteBlueprintIds: string[];
  inventoryBlueprintIds: string[];
}

export interface LocalAccountCollections extends LocalBlueprintCollections {
  inventoryResources: AccountInventoryResourceEntry[];
}

export interface LocalBlueprintImportPlan extends LocalBlueprintCollections {
  missingFavoriteBlueprintIds: string[];
  missingInventoryBlueprintIds: string[];
  hasPendingImport: boolean;
}

export interface LocalAccountImportPlan extends LocalAccountCollections {
  missingFavoriteBlueprintIds: string[];
  missingInventoryBlueprintIds: string[];
  missingInventoryResources: AccountInventoryResourceEntry[];
  hasPendingImport: boolean;
}

export function readLocalBlueprintCollections(): LocalBlueprintCollections {
  return {
    favoriteBlueprintIds: normalizeStringArray(readJsonValue(LS_KEYS.FAVORITES, [])),
    inventoryBlueprintIds: normalizeStringArray(readJsonValue(LS_KEYS.INVENTORY, [])),
  };
}

export function readLocalInventoryResources(): AccountInventoryResourceEntry[] {
  return normalizeInventoryResourceEntries(
    readJsonValue<AccountInventoryResourceEntry[]>(LS_KEYS.INVENTORY_RESOURCES, []),
  );
}

export function writeLocalInventoryResources(
  inventoryResources: AccountInventoryResourceEntry[],
): AccountInventoryResourceEntry[] {
  const normalized = normalizeInventoryResourceEntries(inventoryResources);
  writeJsonValue(LS_KEYS.INVENTORY_RESOURCES, normalized);
  return normalized;
}

export function readLocalAccountCollections(): LocalAccountCollections {
  return {
    ...readLocalBlueprintCollections(),
    inventoryResources: readLocalInventoryResources(),
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

export function computeLocalAccountImportPlan(
  account: StoredAccount | null,
  localCollections: LocalAccountCollections = readLocalAccountCollections(),
): LocalAccountImportPlan {
  const blueprintPlan = computeLocalBlueprintImportPlan(account, localCollections);
  const inventoryResources = normalizeInventoryResourceEntries(localCollections.inventoryResources);

  if (!account) {
    return {
      ...blueprintPlan,
      inventoryResources,
      missingInventoryResources: [],
      hasPendingImport: false,
    };
  }

  const accountSignatureCounts = buildSignatureCounts(account.inventoryResources ?? []);
  const missingInventoryResources: AccountInventoryResourceEntry[] = [];
  for (const resourceEntry of inventoryResources) {
    const signature = createResourceImportSignature(resourceEntry);
    const remainingMatches = accountSignatureCounts.get(signature) ?? 0;
    if (remainingMatches > 0) {
      accountSignatureCounts.set(signature, remainingMatches - 1);
      continue;
    }

    missingInventoryResources.push(resourceEntry);
  }

  return {
    ...blueprintPlan,
    inventoryResources,
    missingInventoryResources,
    hasPendingImport:
      blueprintPlan.hasPendingImport || missingInventoryResources.length > 0,
  };
}
