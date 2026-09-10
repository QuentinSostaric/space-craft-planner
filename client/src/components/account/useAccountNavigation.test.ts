import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useAccountLibraryPreferences, useAccountNavigation } from './useAccountNavigation';

afterEach(() => {
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});
it('restores the first section on Back even after updating the stored preference', async () => {
  window.history.replaceState(null, '', '/account');
  const { result } = renderHook(useAccountNavigation);
  expect(window.location.search).toBe('?section=overview');
  act(() => result.current.setActiveTab('inventory'));
  expect(result.current.activeTab).toBe('inventory');
  act(() => window.history.back());
  await waitFor(() => expect(result.current.activeTab).toBe('overview'));
});
it('prefers a direct link and accepts the organizations alias', () => {
  localStorage.setItem('sc-craft-account-section', 'settings');
  window.history.replaceState(null, '', '/account?section=organizations');
  expect(renderHook(useAccountNavigation).result.current.activeTab).toBe('orgs');
});
it('ignores corrupted preferences and keeps working when browser storage is full', () => {
  localStorage.setItem('sc-craft-account-library', '{broken');
  const { result } = renderHook(useAccountLibraryPreferences);
  expect(result.current.preferences).toMatchObject({ search: '', filter: 'all', view: 'cards' });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Quota exceeded');
  });
  act(() => result.current.updatePreferences({ search: 'Iron', view: 'list' }));
  expect(result.current.preferences).toMatchObject({ search: 'Iron', view: 'list' });
});
