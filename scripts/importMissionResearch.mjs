import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Import explicitly generated research, never aliases or a different game build.
const sourceDirectory = process.argv[2];
if (!sourceDirectory) throw new Error('Usage: node scripts/importMissionResearch.mjs <exporter/work/mission-intelligence>');
const buildNumber = '12519617';
const destination = resolve('client/public/data');
const intelligence = JSON.parse(await readFile(resolve(sourceDirectory, `mission-intelligence-${buildNumber}.json`), 'utf8'));
const operations = JSON.parse(await readFile(resolve(sourceDirectory, 'mission-operations.json'), 'utf8'));
for (const data of [intelligence, operations]) {
  if (data.schemaVersion !== 1 || String(data.build?.buildNumber) !== buildNumber || data.build?.channel !== 'live') {
    throw new Error('The research snapshot must describe LIVE build 12519617, schema 1.');
  }
}
if (!Array.isArray(intelligence.tracks) || !Array.isArray(intelligence.missions) || !Array.isArray(operations.operations)) throw new Error('Invalid research shape');

const cleanText = (text) => typeof text === 'string' ? text.replace(/<\/?(?:EM\d+|BOLD|ITALIC|FONT)[^>]*>/gi, '').trim() : text;
const displayTitle = (mission) => {
  const title = cleanText(mission.title)?.replace(/~mission\([^)]*\)/gi, '…') ?? '';
  if (/[\p{L}\p{N}]/u.test(title) && !title.startsWith('@')) return title;
  return String(mission.debugName || mission.employer || 'Mission')
    .replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
};
const compactIntelligence = {
  schemaVersion: intelligence.schemaVersion, build: intelligence.build, summary: intelligence.summary,
  tracks: intelligence.tracks,
  missions: intelligence.missions.map((mission) => ({
    ...Object.fromEntries(['id', 'debugName', 'employer', 'sourceFile', 'templateFile', 'systems', 'reputationRewards', 'requirements', 'completionTags', 'requiredCompletionTags', 'excludedCompletionTags', 'onceOnly', 'cooldownSeconds', 'notForRelease', 'workInProgress', 'plannerBlockers', 'evidence', 'generationRefresh'].map((key) => [key, mission[key]])),
    title: displayTitle(mission), titleIsTemplated: /~mission\(/i.test(mission.title ?? ''), description: cleanText(mission.description),
    prerequisites: mission.prerequisites.map(({ type, summary, evidence }) => ({ type, summary, evidence })),
  })),
};
const compactOperations = {
  ...operations,
  operations: operations.operations.map((operation) => ({
    ...operation,
    contracts: operation.contracts.map((contract) => ({ ...contract, description: cleanText(contract.description) })),
  })),
};
await mkdir(destination, { recursive: true });
for (const [kind, data] of [['intelligence', compactIntelligence], ['operations', compactOperations]]) {
  const bytes = `${JSON.stringify(data)}\n`;
  await writeFile(resolve(destination, `mission-${kind}-${buildNumber}.json`), bytes);
  console.log(`${kind}: ${Buffer.byteLength(bytes)} bytes, sha256 ${createHash('sha256').update(bytes).digest('hex')}`);
}
