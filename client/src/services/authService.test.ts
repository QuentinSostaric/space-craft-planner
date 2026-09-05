import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestRsiLinkChallenge, verifyAndLinkRsiAccount } from './authService';
import { fetchTauriApi } from './apiBaseUrl';

vi.mock('./apiBaseUrl', () => ({
  fetchTauriApi: vi.fn(),
  getApiCredentials: () => 'same-origin',
  getApiUrl: (path: string) => path,
}));

describe('RSI verification', () => {
  const challenge = {
    handle: 'TestCitizen',
    code: 'SC-server-issued-proof',
    expiresAt: '2026-09-05T12:15:00.000Z',
  };

  beforeEach(() => {
    vi.mocked(fetchTauriApi).mockReset().mockResolvedValue(null);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('requests a challenge for the handle, then submits the server proof with the session credentials', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ challenge }))
      .mockResolvedValueOnce(Response.json({ account: { id: 'current-account' } }));
    vi.stubGlobal('fetch', fetchMock);

    const issuedChallenge = await requestRsiLinkChallenge('TestCitizen');
    expect(issuedChallenge).toEqual(challenge);
    expect(fetchMock.mock.calls[0]).toEqual(['/api/auth/account/rsi-link/challenge', {
      credentials: 'same-origin',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: 'TestCitizen' }),
    }]);

    await expect(verifyAndLinkRsiAccount(issuedChallenge.handle, issuedChallenge.code))
      .resolves.toEqual({ id: 'current-account' });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      handle: 'TestCitizen', code: 'SC-server-issued-proof',
    });
  });

  it('uses the native authenticated bridge for desktop challenges without browser fetch', async () => {
    vi.mocked(fetchTauriApi).mockResolvedValue({ challenge });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(requestRsiLinkChallenge('TestCitizen')).resolves.toEqual(challenge);
    expect(fetchTauriApi).toHaveBeenCalledWith('/api/auth/account/rsi-link/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: 'TestCitizen' }),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('propagates an expired or missing server challenge and does not invent a replacement proof', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(
      { message: 'Request a new verification code.' }, { status: 403 },
    )));
    await expect(verifyAndLinkRsiAccount('TestCitizen', 'expired-proof'))
      .rejects.toMatchObject({ status: 403, message: 'Request a new verification code.' });
  });
});
