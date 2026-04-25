import { getPublicOrigin } from '../../shared/discordAuth.mjs';

const DEFAULT_SITE_NAME = 'Item Fabricator';
const DEFAULT_SITE_DESCRIPTION =
  'Star Citizen crafting simulator, mission reward browser, and resource planner.';

export function getSiteOrigin(request, env) {
  return getPublicOrigin(request, env);
}

export function buildHomeLinkHeader(origin) {
  return [
    `</>; rel="alternate"; type="text/markdown"`,
    `</.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"`,
    `</.well-known/mcp/server-card.json>; rel="describedby"; type="application/json"`,
  ].join(', ');
}

export function appendVaryHeader(headers, value) {
  const current = headers.get('Vary');
  if (!current) {
    headers.set('Vary', value);
    return;
  }

  const parts = current
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!parts.includes(value)) {
    parts.push(value);
    headers.set('Vary', parts.join(', '));
  }
}

export function wantsMarkdown(request) {
  const accept = String(request.headers.get('Accept') ?? '').toLowerCase();
  return accept.includes('text/markdown');
}

function estimateMarkdownTokens(markdown) {
  return String(Math.max(1, Math.ceil(markdown.trim().split(/\s+/u).length * 1.3)));
}

function routeHeading(pathname) {
  if (pathname === '/') return 'Item Fabricator';
  if (pathname === '/missions' || pathname.startsWith('/missions/')) return 'Mission Explorer';
  if (pathname === '/resources' || pathname.startsWith('/resources/')) return 'Resource Explorer';
  if (pathname === '/planner' || pathname.startsWith('/planner/')) return 'Resource Planner';
  if (pathname === '/account' || pathname.startsWith('/account/')) return 'Account';
  if (pathname === '/item/' || pathname.startsWith('/item/')) return 'Blueprint Detail';
  return DEFAULT_SITE_NAME;
}

function routeSummary(pathname, origin) {
  if (pathname === '/') {
    return [
      'Browse published Star Citizen blueprints, simulate crafting outcomes, compare materials, and navigate to missions and resources.',
      '',
      `Canonical URL: ${origin}/`,
      '',
      'Useful resources:',
      `- Sitemap: ${origin}/sitemap.xml`,
      `- Agent skills index: ${origin}/.well-known/agent-skills/index.json`,
    ].join('\n');
  }

  if (pathname === '/missions' || pathname.startsWith('/missions/')) {
    return [
      'Inspect faction missions, contract rewards, and route-specific mission pages.',
      '',
      `Canonical URL: ${origin}${pathname}`,
    ].join('\n');
  }

  if (pathname === '/resources' || pathname.startsWith('/resources/')) {
    return [
      'Inspect resources, acquisition methods, and linked mission sources.',
      '',
      `Canonical URL: ${origin}${pathname}`,
    ].join('\n');
  }

  if (pathname === '/planner' || pathname.startsWith('/planner/')) {
    return [
      'Plan material goals and track the resource work needed to craft target items.',
      '',
      `Canonical URL: ${origin}${pathname}`,
    ].join('\n');
  }

  if (pathname === '/account' || pathname.startsWith('/account/')) {
    return [
      'Manage the signed-in account, shared resources, and organization-linked data.',
      '',
      `Canonical URL: ${origin}${pathname}`,
    ].join('\n');
  }

  if (pathname.startsWith('/item/')) {
    return [
      'Blueprint detail route within the crafting simulator.',
      '',
      `Canonical URL: ${origin}${pathname}`,
    ].join('\n');
  }

  return [
    DEFAULT_SITE_DESCRIPTION,
    '',
    `Canonical URL: ${origin}${pathname}`,
  ].join('\n');
}

export function buildMarkdownResponse(request, env) {
  const url = new URL(request.url);
  const origin = getSiteOrigin(request, env);
  const markdown = [
    `# ${routeHeading(url.pathname)}`,
    '',
    routeSummary(url.pathname, origin),
  ].join('\n');

  const headers = new Headers({
    'Content-Type': 'text/markdown; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
    'X-Markdown-Tokens': estimateMarkdownTokens(markdown),
  });
  appendVaryHeader(headers, 'Accept');

  return new Response(markdown, { status: 200, headers });
}

export function buildServerCard(origin) {
  return {
    $schema: 'https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json',
    version: '1.0',
    protocolVersion: '2025-06-18',
    serverInfo: {
      name: 'item-fabricator-webmcp',
      title: DEFAULT_SITE_NAME,
      version: '1.0.0',
    },
    description: DEFAULT_SITE_DESCRIPTION,
    transport: {
      type: 'streamable-http',
      endpoint: `${origin}/`,
    },
    capabilities: {
      tools: {
        listChanged: false,
      },
    },
    tools: [
      {
        name: 'open_blueprints',
        description: 'Open the blueprint explorer route.',
      },
      {
        name: 'open_missions',
        description: 'Open the missions route.',
      },
      {
        name: 'open_resources',
        description: 'Open the resources route.',
      },
    ],
  };
}
