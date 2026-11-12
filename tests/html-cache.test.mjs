import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../functions/_middleware.js';

test('HTML SPA and fallback responses never inherit immutable asset caching', async () => {
  for (const path of ['/blueprints','/assets/missing.js']) {
    const response=await onRequest({request:new Request('https://itemfab.space'+path),env:{},next:async()=>new Response('<html></html>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=31536000, immutable'}})});
    assert.equal(response.headers.get('Cache-Control'),'no-store');
    assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
  }
});

test('real immutable JavaScript assets retain their caching policy', async () => {
  const response=await onRequest({request:new Request('https://itemfab.space/assets/2.6.4/main.js'),env:{},next:async()=>new Response('export {}',{headers:{'Content-Type':'application/javascript','Cache-Control':'public, max-age=31536000, immutable'}})});
  assert.equal(response.headers.get('Cache-Control'),'public, max-age=31536000, immutable');
});
