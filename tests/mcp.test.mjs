import assert from 'node:assert/strict';
import test from 'node:test';

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

import { buildServerCard } from '../functions/_shared/agentMetadata.js';
import { onRequest as middlewareOnRequest } from '../functions/_middleware.js';
import { mcpHandler } from '../functions/mcp.js';

const ENDPOINT = new URL('https://itemfab.space/mcp');
const EXPECTED_TOOLS = [
  'open_blueprints',
  'open_missions',
  'open_resources',
];

function inProcessFetch(input, init) {
  return mcpHandler.fetch(new Request(input, init));
}

async function connectClient(versionNegotiation) {
  const client = new Client(
    { name: 'item-fabricator-test', version: '1.0.0' },
    versionNegotiation ? { versionNegotiation } : undefined,
  );
  const transport = new StreamableHTTPClientTransport(ENDPOINT, {
    fetch: inProcessFetch,
  });
  await client.connect(transport);
  return client;
}

test('server card advertises the 2026-07-28 Streamable HTTP endpoint', () => {
  const card = buildServerCard('https://itemfab.space');

  assert.equal(card.protocolVersion, '2026-07-28');
  assert.deepEqual(card.transport, {
    type: 'streamable-http',
    endpoint: 'https://itemfab.space/mcp',
  });
  assert.deepEqual(
    card.tools.map(tool => tool.name).sort(),
    EXPECTED_TOOLS,
  );
  assert.equal('$schema' in card, false);
});

test('MCP traffic bypasses markdown content negotiation', async () => {
  let forwarded = false;
  const response = await middlewareOnRequest({
    request: new Request(ENDPOINT, { headers: { Accept: 'text/markdown' } }),
    env: {},
    next: async () => {
      forwarded = true;
      return new Response('mcp-handler');
    },
  });

  assert.equal(forwarded, true);
  assert.equal(await response.text(), 'mcp-handler');
});

test('modern MCP client discovers and calls the navigation tools', async () => {
  const client = await connectClient({ mode: { pin: '2026-07-28' } });

  try {
    const listed = await client.listTools();
    assert.deepEqual(
      listed.tools.map(tool => tool.name).sort(),
      EXPECTED_TOOLS,
    );
    assert.equal(listed.ttlMs, 300_000);
    assert.equal(listed.cacheScope, 'public');

    const result = await client.callTool({ name: 'open_blueprints', arguments: {} });
    assert.equal(result.isError, undefined);
    assert.deepEqual(result.structuredContent, {
      path: '/',
      url: 'https://itemfab.space/',
      description: 'Open the Item Fabricator blueprint explorer.',
    });
  } finally {
    await client.close();
  }
});

test('legacy MCP clients retain stateless initialize and tool access', async () => {
  const client = await connectClient();

  try {
    const listed = await client.listTools();
    assert.deepEqual(
      listed.tools.map(tool => tool.name).sort(),
      EXPECTED_TOOLS,
    );
    assert.equal(listed.ttlMs, undefined);
    assert.equal(listed.cacheScope, undefined);
  } finally {
    await client.close();
  }
});
