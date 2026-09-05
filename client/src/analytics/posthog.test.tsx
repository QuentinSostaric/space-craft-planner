import type { ReactNode } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import posthog from 'posthog-js';
import { AnalyticsProvider, setAnalyticsConsent, trackEvent } from './posthog';

vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    opt_out_capturing: vi.fn(),
    opt_in_capturing: vi.fn(),
    reset: vi.fn(),
  },
}));
vi.mock('@posthog/react', () => ({
  PostHogProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('../services/apiBaseUrl', () => ({
  getApiUrl: (path: string) => path,
  isTauriRuntime: () => false,
}));

afterEach(() => vi.unstubAllEnvs());

it('gates analytics on consent and filters automatic events and person attribution before ingestion', async () => {
  vi.stubEnv('VITE_POSTHOG_ENABLED', 'true');
  vi.stubEnv('VITE_POSTHOG_TOKEN', 'public-project-key');
  render(<AnalyticsProvider><div>App</div></AnalyticsProvider>);
  expect(posthog.init).not.toHaveBeenCalled();

  act(() => setAnalyticsConsent('granted'));
  await waitFor(() => expect(posthog.init).toHaveBeenCalledOnce());
  const options = vi.mocked(posthog.init).mock.calls[0][1]!;
  expect(options).toMatchObject({
    capture_exceptions: false,
    disable_session_recording: true,
    disable_external_dependency_loading: true,
    save_referrer: false,
    save_campaign_params: false,
    disable_capture_url_hashes: true,
  });
  const beforeSend = options.before_send;
  if (typeof beforeSend !== 'function') throw new Error('Missing analytics privacy filter');
  expect(beforeSend({
    uuid: 'event-id',
    event: '$identify',
    properties: {
      distinct_id: 'account-id',
      token: 'private-event-token',
      $current_url: 'https://itemfab.space/account?code=private#private',
      error_message: 'API token=private /home/private-user/Game.log',
    },
    $set: { is_admin: false, password: 'private' },
    $set_once: { $initial_current_url: 'https://itemfab.space/?code=private' },
  })).toEqual({
    uuid: 'event-id',
    event: '$identify',
    properties: {
      distinct_id: 'account-id',
      token: 'public-project-key',
      $current_url: 'https://itemfab.space/account',
    },
    $set: { is_admin: false },
    $set_once: { $initial_current_url: 'https://itemfab.space/' },
  });

  act(() => setAnalyticsConsent('denied'));
  expect(posthog.opt_out_capturing).toHaveBeenCalled();
  vi.mocked(posthog.capture).mockClear();
  trackEvent('test_event');
  expect(posthog.capture).not.toHaveBeenCalled();
  expect(beforeSend({ uuid: 'id', event: 'test_event', properties: {} })).toBeNull();
});
