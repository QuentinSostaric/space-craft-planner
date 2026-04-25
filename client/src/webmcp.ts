import { navigateToPath } from './utils/slug';

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
};

type ModelContext = {
  provideContext: (context: { tools: ToolDefinition[] }) => void | Promise<void>;
};

declare global {
  interface Navigator {
    modelContext?: ModelContext;
  }

  interface Window {
    __ITEMFAB_WEBMCP_REGISTERED__?: boolean;
  }
}

function textResult(text: string, isError = false): ToolResult {
  return { content: [{ type: 'text', text }], isError };
}

export async function registerWebMcpTools() {
  if (typeof window === 'undefined' || window.__ITEMFAB_WEBMCP_REGISTERED__) {
    return;
  }

  const modelContext = navigator.modelContext;
  if (!modelContext?.provideContext) {
    return;
  }

  const tools: ToolDefinition[] = [
    {
      name: 'open_blueprints',
      description: 'Open the Item Fabricator blueprint explorer.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        navigateToPath('/');
        return textResult('Opened the blueprint explorer.');
      },
    },
    {
      name: 'open_missions',
      description: 'Open the missions route.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        navigateToPath('/missions');
        return textResult('Opened the missions route.');
      },
    },
    {
      name: 'open_resources',
      description: 'Open the resources route.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        navigateToPath('/resources');
        return textResult('Opened the resources route.');
      },
    },
  ];

  await modelContext.provideContext({ tools });
  window.__ITEMFAB_WEBMCP_REGISTERED__ = true;
}
