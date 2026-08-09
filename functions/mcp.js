import { createMcpHandler, McpServer, preloadSchemas } from '@modelcontextprotocol/server';
import { z } from 'zod';

const EMPTY_INPUT = z.object({});
const NAVIGATION_OUTPUT = z.object({
  path: z.string(),
  url: z.string().url(),
  description: z.string(),
});

const TOOLS = [
  {
    name: 'open_blueprints',
    title: 'Open blueprints',
    description: 'Open the Item Fabricator blueprint explorer.',
    path: '/',
  },
  {
    name: 'open_missions',
    title: 'Open missions',
    description: 'Open the missions route.',
    path: '/missions',
  },
  {
    name: 'open_resources',
    title: 'Open resources',
    description: 'Open the resources route.',
    path: '/resources',
  },
];

preloadSchemas();

export function createItemFabricatorMcpServer(requestUrl = 'https://itemfab.space/mcp') {
  const origin = new URL(requestUrl).origin;
  const server = new McpServer(
    {
      name: 'item-fabricator',
      title: 'Item Fabricator',
      version: '2.4.0',
      description: 'Star Citizen crafting, dismantling, and resource-planning tools.',
    },
    {
      instructions: 'Use these read-only tools to direct users to the relevant Item Fabricator workflow.',
      cacheHints: {
        'tools/list': { ttlMs: 300_000, cacheScope: 'public' },
        'server/discover': { ttlMs: 300_000, cacheScope: 'public' },
      },
    },
  );

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: EMPTY_INPUT,
        outputSchema: NAVIGATION_OUTPUT,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async () => {
        const output = {
          path: tool.path,
          url: new URL(tool.path, origin).href,
          description: tool.description,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(output) }],
          structuredContent: output,
        };
      },
    );
  }

  return server;
}

export const mcpHandler = createMcpHandler(
  ({ requestInfo }) => createItemFabricatorMcpServer(requestInfo?.url),
  {
    legacy: 'stateless',
  },
);

export function onRequest(context) {
  return mcpHandler.fetch(context.request);
}
