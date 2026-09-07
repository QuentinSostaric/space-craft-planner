import { type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  getDiscordBotInviteUrl,
  type AccountInventoryResourceEntry,
  type AccountInventoryResourceQuantityUnit,
} from '../../services/authService';
import { useCraft } from '../../store/CraftContext';

export function readAuthError(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('auth_error');
}

export const ACCOUNT_BLUEPRINT_BATCH_SIZE = 24;

export const RESOURCE_BATCH_SCU_STEP = 0.000001;

export const ALL_RESOURCES_SHARE_OPTION = '__all__';

export type AccountTab = 'overview' | 'inventory' | 'requests' | 'orgs' | 'settings';

export type AccountAssetFilter = 'all' | 'inventory-blueprints' | 'favorite-blueprints' | 'resources';

export type AccountLibraryEntry =
  | {
      key: string;
      kind: 'blueprint';
      blueprint: ReturnType<typeof useCraft>['blueprints'][number];
      searchHaystack: string;
      isFavorite: boolean;
      isInInventory: boolean;
      isShared: boolean;
      sharedOrganizationIds: string[];
    }
  | {
      key: string;
      kind: 'resource';
      resourceEntry: AccountInventoryResourceEntry;
      resource: ReturnType<typeof useCraft>['activeDataset']['resources'][number] | null;
      searchHaystack: string;
      isShared: boolean;
      sharedOrganizationIds: string[];
    };

export type ResourceBatchDraftRow = {
  id: string;
  resourceId: string;
  quantity: string;
  quality: string;
};

export type ResourceBulkShareDraft = {
  organizationSid: string;
  resourceId: string;
  minQuality: string;
  maxQuality: string;
};

export function blurFocusedElement() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

export function formatAbsoluteDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

export function handleAccountTabKeyDown(
  event: ReactKeyboardEvent<HTMLButtonElement>,
  activeId: AccountTab,
  onChange: (id: AccountTab) => void,
) {
  const tabIds: readonly AccountTab[] = ['overview', 'inventory', 'requests', 'orgs', 'settings'];
  const currentIndex = tabIds.indexOf(activeId);
  let nextIndex = currentIndex;

  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % tabIds.length;
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
    nextIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = tabIds.length - 1;
  else return;

  event.preventDefault();
  const nextId = tabIds[nextIndex];
  const tabList = event.currentTarget.closest('[role="tablist"]');
  onChange(nextId);
  requestAnimationFrame(() => {
    tabList?.querySelector<HTMLButtonElement>(`[data-tab-id="${nextId}"]`)?.focus();
  });
}

export function normalizeOrganizationSidInput(value: string): string {
  const input = String(value ?? '').trim();
  if (!input) {
    return '';
  }

  const urlMatch = input.match(/(?:^|\/)orgs\/([^/?#]+)/i);
  if (urlMatch?.[1]) {
    return urlMatch[1].trim().toUpperCase();
  }

  return input.toUpperCase();
}

export function normalizeBatchResourceQuantity(
  value: string,
  quantityUnit: AccountInventoryResourceQuantityUnit,
): number {
  if (!value.trim()) return Number.NaN;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return Number.NaN;
  if (quantityUnit === 'count') return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
  if (parsed < RESOURCE_BATCH_SCU_STEP || parsed > Number.MAX_SAFE_INTEGER / 1_000_000) return Number.NaN;
  return Math.round(parsed * 1_000_000) / 1_000_000;
}

export function openDiscordBotInvite() {
  window.open(getDiscordBotInviteUrl(), '_blank', 'noopener,noreferrer');
}

/** Empty means unspecified; invalid input is never silently clamped. */
export function parseResourceQuality(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1000 ? parsed : Number.NaN;
}

export type AccountAssetSort = 'name-asc' | 'name-desc' | 'recent' | 'quality';
export type AccountSharingFilter = 'all' | 'private' | 'shared';
export function sortAccountLibrary(entries: AccountLibraryEntry[], sort: AccountAssetSort, lang: string) {
  const name = (entry: AccountLibraryEntry) =>
    entry.kind === 'blueprint' ? entry.blueprint.name : entry.resourceEntry.resourceName;
  const quality = (entry: AccountLibraryEntry) =>
    entry.kind === 'resource' ? (entry.resourceEntry.quality ?? -1) : -1;
  const updated = (entry: AccountLibraryEntry) =>
    entry.kind === 'resource' ? Date.parse(entry.resourceEntry.updatedAt ?? '') || 0 : 0;
  return [...entries].sort((a, b) => {
    if (sort === 'quality' && quality(a) !== quality(b)) return quality(b) - quality(a);
    if (sort === 'recent' && updated(a) !== updated(b)) return updated(b) - updated(a);
    return (
      name(a).localeCompare(name(b), lang, { sensitivity: 'base', numeric: true }) *
      (sort === 'name-desc' ? -1 : 1)
    );
  });
}
