import { useCallback, useEffect, useState } from 'react';
import type {
  AccountAssetFilter,
  AccountAssetSort,
  AccountSharingFilter,
  AccountTab,
} from './accountHelpers';

const SECTIONS: readonly AccountTab[] = ['overview', 'inventory', 'requests', 'orgs', 'settings'];
const SECTION_KEY = 'sc-craft-account-section';
const LIBRARY_KEY = 'sc-craft-account-library';
function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Preferences remain usable in memory. */
  }
}
function readSection(): AccountTab {
  const requested = new URLSearchParams(window.location.search).get('section');
  const value = requested === 'organizations' ? 'orgs' : (requested ?? readStorage(SECTION_KEY));
  return SECTIONS.includes(value as AccountTab) ? (value as AccountTab) : 'overview';
}
export function useAccountNavigation() {
  const [activeTab, setTab] = useState(readSection);
  useEffect(() => {
    // Give the first history entry an explicit section before preferences change.
    const url = new URL(window.location.href);
    if (url.pathname.startsWith('/account') && !url.searchParams.has('section')) {
      url.searchParams.set('section', readSection());
      window.history.replaceState(window.history.state, '', url);
    }
    const onPopState = () => setTab(readSection());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const setActiveTab = useCallback((section: AccountTab) => {
    setTab(section);
    writeStorage(SECTION_KEY, section);
    const url = new URL(window.location.href);
    if (url.searchParams.get('section') !== section) {
      url.searchParams.set('section', section);
      window.history.pushState(window.history.state, '', url);
    }
  }, []);
  return { activeTab, setActiveTab };
}

export interface AccountLibraryPreferences {
  filter: AccountAssetFilter;
  search: string;
  sort: AccountAssetSort;
  sharing: AccountSharingFilter;
  view: 'cards' | 'list';
}
const defaults: AccountLibraryPreferences = {
  filter: 'all',
  search: '',
  sort: 'name-asc',
  sharing: 'all',
  view: 'cards',
};
function readPreferences(): AccountLibraryPreferences {
  try {
    const value = JSON.parse(readStorage(LIBRARY_KEY) ?? '{}');
    return {
      filter: ['all', 'inventory-blueprints', 'favorite-blueprints', 'resources'].includes(value.filter)
        ? value.filter
        : defaults.filter,
      search: typeof value.search === 'string' ? value.search : '',
      sort: ['name-asc', 'name-desc', 'recent', 'quality'].includes(value.sort) ? value.sort : defaults.sort,
      sharing: ['all', 'private', 'shared'].includes(value.sharing) ? value.sharing : defaults.sharing,
      view: value.view === 'list' ? 'list' : 'cards',
    };
  } catch {
    return defaults;
  }
}
export function useAccountLibraryPreferences() {
  const [preferences, setPreferences] = useState(readPreferences);
  const updatePreferences = useCallback((updates: Partial<AccountLibraryPreferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...updates };
      writeStorage(LIBRARY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  return { preferences, updatePreferences };
}
