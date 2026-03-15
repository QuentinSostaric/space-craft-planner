/**
 * Dev helper: generate client/public/data/ from exporter/output/
 * without requiring a MongoDB connection.
 *
 * Usage: node scripts/devData.mjs
 * Prerequisite: run exporter/extract-game-data.ps1 first.
 */
import { buildClientDataset } from '../exporter/dataset-builder.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '../client/public/data');

console.log('[devData] Building dataset from exporter/output/ ...');
const data = await buildClientDataset();

const now = new Date().toISOString();
const datasetId = `dev-${Date.now()}`;

const dataset = {
  channel: 'ptu',
  datasetId,
  label: 'Local Dev (exporter output)',
  version: '4.7-dev',
  branch: 'ptu',
  buildNumber: null,
  published: true,
  blueprints: data.blueprints,
  resources: data.resources,
  dismantling: data.dismantling ?? null,
  missionRewards: data.missionRewards ?? null,
  changelog: null,
  importedAt: now,
  updatedAt: now,
};

const summary = {
  channel: 'ptu',
  datasetId,
  label: dataset.label,
  version: dataset.version,
  branch: dataset.branch,
  buildNumber: null,
  published: true,
  blueprintCount: data.blueprints.length,
  resourceCount: data.resources.length,
  hasDismantling: Boolean(data.dismantling),
  hasMissionRewards: Boolean(data.missionRewards?.summary?.blueprintRewardContractCount),
  missionRewardContractCount: data.missionRewards?.summary?.blueprintRewardContractCount ?? 0,
  missionRewardFactionGroupCount: data.missionRewards?.summary?.factionGroupCount ?? 0,
  importedAt: now,
  updatedAt: now,
  hasChangelog: false,
};

mkdirSync(OUT, { recursive: true });

writeFileSync(
  join(OUT, 'index.json'),
  JSON.stringify({ datasets: [summary], defaultChannel: 'ptu' }, null, 2),
);
writeFileSync(join(OUT, 'ptu.json'), JSON.stringify({ dataset }, null, 2));
writeFileSync(join(OUT, 'live.json'), JSON.stringify({ dataset: null }, null, 2));

console.log(
  `[devData] built ${data.blueprints.length} blueprints, ${data.resources.length} resources, dismantling=${Boolean(data.dismantling)}, missionRewards=${data.missionRewards?.summary?.blueprintRewardContractCount ?? 0} -> ${OUT}`,
);
console.log('[devData] Restart your dev server to pick up the new data.');
