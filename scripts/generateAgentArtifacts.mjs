import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const publicDir = path.join(repoRoot, 'client', 'public');
const siteOrigin = (process.env.SITE_ORIGIN || 'https://itemfab.space').replace(/\/+$/u, '');
const buildDate = new Date().toISOString().slice(0, 10);

const sitemapPaths = ['/', '/missions', '/resources', '/planner', '/account'];

const skillDocs = [
  {
    name: 'browse-blueprints',
    type: 'workflow',
    description: 'Open the blueprint explorer and inspect craftable items by route.',
    filename: 'browse-blueprints.md',
    body: `# Browse Blueprints

Use this skill when you need the main Item Fabricator blueprint explorer.

## Steps

1. Open \`${siteOrigin}/\`.
2. Use the in-page filters to narrow blueprint type, manufacturer, or quality.
3. Open \`/item/{slug}\` routes for blueprint-specific views when available.
`,
  },
  {
    name: 'browse-missions',
    type: 'workflow',
    description: 'Open mission routes and inspect faction contract rewards.',
    filename: 'browse-missions.md',
    body: `# Browse Missions

Use this skill when you need mission reward data from the public site.

## Steps

1. Open \`${siteOrigin}/missions\`.
2. Review the route-level mission listings and filters.
3. Open \`/missions/{slug}\` routes for a specific contract when needed.
`,
  },
  {
    name: 'browse-resources',
    type: 'workflow',
    description: 'Inspect resource routes, source locations, and mission links.',
    filename: 'browse-resources.md',
    body: `# Browse Resources

Use this skill when you need resource acquisition and usage data.

## Steps

1. Open \`${siteOrigin}/resources\`.
2. Filter by family, rarity, and acquisition method.
3. Open \`/resources/{slug}\` routes for a specific resource.
`,
  },
];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function buildSitemapXml() {
  const urls = sitemapPaths
    .map((pathname) => {
      const url = `${siteOrigin}${pathname}`;
      return [
        '  <url>',
        `    <loc>${url}</loc>`,
        `    <lastmod>${buildDate}</lastmod>`,
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n');
}

async function main() {
  const skillDir = path.join(publicDir, '.well-known', 'agent-skills');
  await mkdir(skillDir, { recursive: true });

  for (const skill of skillDocs) {
    await writeFile(path.join(skillDir, skill.filename), skill.body, 'utf8');
  }

  const index = {
    $schema: 'https://agentskills.io/schemas/agent-skills-index-v0.2.0.json',
    version: '0.2.0',
    generatedAt: new Date().toISOString(),
    skills: skillDocs.map((skill) => ({
      name: skill.name,
      type: skill.type,
      description: skill.description,
      url: `${siteOrigin}/.well-known/agent-skills/${skill.filename}`,
      sha256: sha256(skill.body),
    })),
  };

  await writeFile(
    path.join(skillDir, 'index.json'),
    `${JSON.stringify(index, null, 2)}\n`,
    'utf8',
  );

  await writeFile(path.join(publicDir, 'sitemap.xml'), buildSitemapXml(), 'utf8');
}

await main();
