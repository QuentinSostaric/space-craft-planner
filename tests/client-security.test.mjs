import test from 'node:test';
import assert from 'node:assert/strict';

import {
  requireInternalPath,
  sanitizeAppReturnTo,
  sanitizeExternalHttpsUrl,
} from '../client/src/utils/urlSafety.ts';
import { normalizeBooleanRecord } from '../client/src/utils/dataValidation.ts';

test('internal API paths reject absolute, protocol-relative and traversal targets', () => {
  assert.equal(requireInternalPath('/api/game-data/public?channel=live'), '/api/game-data/public?channel=live');

  for (const unsafePath of [
    'https://attacker.example/steal',
    '//attacker.example/steal',
    '/api/../admin',
    '/api/%2e%2e/admin',
    '/api\\admin',
    '/api/%00admin',
    '/api/%E0%A4%A',
  ]) {
    assert.throws(() => requireInternalPath(unsafePath), TypeError, unsafePath);
  }
});

test('OAuth return targets remain inside the application', () => {
  assert.equal(sanitizeAppReturnTo('/account?tab=organizations'), '/account?tab=organizations');
  assert.equal(sanitizeAppReturnTo('https://attacker.example'), '/');
  assert.equal(sanitizeAppReturnTo('//attacker.example'), '/');
  assert.equal(sanitizeAppReturnTo('/safe/../admin'), '/');
});

test('API-provided external links allow credential-free HTTPS only', () => {
  assert.equal(
    sanitizeExternalHttpsUrl('https://robertsspaceindustries.com/orgs/TEST'),
    'https://robertsspaceindustries.com/orgs/TEST',
  );
  assert.equal(sanitizeExternalHttpsUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeExternalHttpsUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(sanitizeExternalHttpsUrl('http://example.com/insecure'), null);
  assert.equal(sanitizeExternalHttpsUrl('https://user:pass@example.com/private'), null);
  assert.equal(sanitizeExternalHttpsUrl('not a URL'), null);
});

test('feature-flag payloads retain only actual booleans', () => {
  assert.deepEqual(
    normalizeBooleanRecord({ enabled: true, disabled: false, stringTrue: 'true', one: 1 }),
    { enabled: true, disabled: false },
  );
  assert.deepEqual(normalizeBooleanRecord(null), {});
  assert.deepEqual(normalizeBooleanRecord([]), {});
});

test('persisted mutation writes tolerate unavailable browser storage', async () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    location: { origin: 'https://itemfab.space' },
    localStorage: {
      getItem() {
        throw new Error('storage unavailable');
      },
      setItem() {
        throw new Error('storage unavailable');
      },
      removeItem() {
        throw new Error('storage unavailable');
      },
    },
  };

  try {
    const { readPersistedAccountMutations, writePersistedAccountMutations } =
      await import('../client/src/auth/accountMutations.ts');
    assert.doesNotThrow(() => writePersistedAccountMutations('test-key', []));
    assert.doesNotThrow(() => writePersistedAccountMutations('test-key', [{ id: 'queued' }]));
    assert.deepEqual(readPersistedAccountMutations('test-key'), []);
  } finally {
    globalThis.window = originalWindow;
  }
});
