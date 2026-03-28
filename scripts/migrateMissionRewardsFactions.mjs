#!/usr/bin/env node
/**
 * migrateMissionRewardsFactions.mjs
 *
 * One-time migration: splits existing mission-rewards.json chunks in R2 into:
 *   - Slim mission-rewards.json  (factionGroups without contracts, + id + resourceObjectiveIndex)
 *   - Per-faction contracts       datasets/{id}/mission-rewards/factions/{factionId}.json
 *   - Updated aliases for both namespaces (all / public)
 *
 * Defaults to the dev bucket (reads root .dev.vars).
 * Pass --prod to target the production bucket (reads exporter/.env).
 *
 * Usage:
 *   node scripts/migrateMissionRewardsFactions.mjs          # dev bucket
 *   node scripts/migrateMissionRewardsFactions.mjs --prod   # prod bucket
 */

import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createR2Client, getJsonObject, getR2Config, putJsonObject } from '../shared/r2Storage.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot  = path.resolve(__dirname, '..');

const isProd = process.argv.includes('--prod');

// ── Load env ────────────────────────────────────────────────────────────────
if (isProd) {
  const envPath = path.join(repoRoot, 'exporter', '.env');
  if (!existsSync(envPath)) {
    console.error(`Missing ${envPath}. Create it with prod R2 credentials before running with --prod.`);
    process.exit(1);
  }
  dotenv.config({ path: envPath, override: true });
} else {
  const devVarsPath = path.join(repoRoot, '.dev.vars');
  if (!existsSync(devVarsPath)) {
    console.error(`Missing ${devVarsPath}. Create it with dev R2 credentials.`);
    process.exit(1);
  }
  dotenv.config({ path: devVarsPath, override: true });
}

const config     = getR2Config();
const bucketName = config.bucketName;

if (!isProd && !bucketName.endsWith('-dev')) {
  console.error(`Refusing to run without --prod on non-dev bucket "${bucketName}".`);
  process.exit(1);
}

const client = createR2Client();

const CACHE_CONTROL_IMMUTABLE = 'public, max-age=31536000, s-maxage=31536000, immutable';
const CACHE_CONTROL_MUTABLE   = 'public, max-age=60, s-maxage=300, stale-while-revalidate=300';

// ── Helpers ──────────────────────────────────────────────────────────────────

function toFactionId(contractorDisplayName) {
  return String(contractorDisplayName ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

/**
 * Splits an existing mission-rewards payload (old or new format) into:
 *   { slimPayload, factionChunks: { [factionId]: payload } }
 *
 * Idempotent: if factionGroups already have no contracts, factionChunks will be empty.
 */
function splitMissionRewards(missionRewardsPayload) {
  const missionRewards = missionRewardsPayload?.missionRewards;
  if (!missionRewards) {
    return { slimPayload: missionRewardsPayload, factionChunks: {} };
  }

  const factionGroups = missionRewards.factionGroups ?? [];
  const factionChunks = {};
  const resourceObjectiveIndex = {};

  const slimGroups = factionGroups.map((group) => {
    const id = group.id ?? toFactionId(group.contractorDisplayName);
    const contracts = group.contracts ?? [];

    // Build per-faction chunk only when contracts are present (old format).
    if (contracts.length > 0) {
      factionChunks[id] = {
        datasetId: missionRewardsPayload.datasetId,
        factionId: id,
        contracts,
      };
    }

    // Build resourceObjectiveIndex regardless of whether contracts are embedded.
    for (const contract of contracts) {
      for (const objective of contract.resourceObjectives ?? []) {
        if (!objective.resourceId) continue;
        if (!resourceObjectiveIndex[objective.resourceId]) {
          resourceObjectiveIndex[objective.resourceId] = [];
        }
        if (!resourceObjectiveIndex[objective.resourceId].includes(id)) {
          resourceObjectiveIndex[objective.resourceId].push(id);
        }
      }
    }

    // Return slim group: add id, drop contracts.
    const { contracts: _contracts, ...rest } = group;
    return { ...rest, id };
  });

  const slimPayload = {
    ...missionRewardsPayload,
    missionRewards: {
      ...missionRewards,
      factionGroups: slimGroups,
      resourceObjectiveIndex,
    },
  };

  return { slimPayload, factionChunks };
}

// ── Migrate a single dataset ──────────────────────────────────────────────────

async function migrateDataset(datasetId) {
  const key = `datasets/${datasetId}/mission-rewards.json`;
  const existing = await getJsonObject(client, bucketName, key);

  if (!existing) {
    console.log(`  [skip] no mission-rewards for ${datasetId}`);
    return { factionIds: [] };
  }

  const { slimPayload, factionChunks } = splitMissionRewards(existing);
  const factionIds = Object.keys(factionChunks);

  if (factionIds.length === 0 && (existing.missionRewards?.factionGroups ?? []).every((g) => g.id)) {
    console.log(`  [skip] already migrated — ${datasetId}`);
    return { factionIds: (existing.missionRewards?.factionGroups ?? []).map((g) => g.id).filter(Boolean) };
  }

  // Write slim chunk back.
  await putJsonObject(client, bucketName, key, slimPayload, { cacheControl: CACHE_CONTROL_IMMUTABLE });
  console.log(`  [slim] ${key} (${factionIds.length} factions)`);

  // Write per-faction chunks.
  await Promise.all(
    Object.entries(factionChunks).map(([factionId, payload]) => {
      const factionKey = `datasets/${datasetId}/mission-rewards/factions/${factionId}.json`;
      console.log(`  [faction] ${factionKey} (${payload.contracts.length} contracts)`);
      return putJsonObject(client, bucketName, factionKey, payload, { cacheControl: CACHE_CONTROL_IMMUTABLE });
    }),
  );

  return { factionIds: slimPayload.missionRewards?.factionGroups?.map((g) => g.id).filter(Boolean) ?? [] };
}

// ── Migrate aliases for one namespace ────────────────────────────────────────

async function migrateAliases(namespace, latestByChannel) {
  for (const channel of ['live', 'ptu']) {
    const datasetId = latestByChannel?.[channel];
    if (!datasetId) continue;

    const aliasKey = `aliases/${namespace}/${channel}/mission-rewards.json`;
    const existing  = await getJsonObject(client, bucketName, aliasKey);
    if (!existing) continue;

    const { slimPayload, factionChunks } = splitMissionRewards(existing);
    const factionIds = Object.keys(factionChunks);

    // Write slim alias.
    await putJsonObject(client, bucketName, aliasKey, slimPayload, { cacheControl: CACHE_CONTROL_MUTABLE });
    console.log(`  [alias slim] ${aliasKey}`);

    // Write per-faction aliases.
    await Promise.all(
      Object.entries(factionChunks).map(([factionId, payload]) => {
        const factionAliasKey = `aliases/${namespace}/${channel}/mission-rewards/factions/${factionId}.json`;
        console.log(`  [alias faction] ${factionAliasKey}`);
        return putJsonObject(client, bucketName, factionAliasKey, payload, { cacheControl: CACHE_CONTROL_MUTABLE });
      }),
    );

    // Also copy faction chunks for factions that were already migrated (no contracts in alias).
    if (factionIds.length === 0) {
      const slimGroups = slimPayload.missionRewards?.factionGroups ?? [];
      for (const group of slimGroups) {
        const factionId = group.id;
        if (!factionId) continue;
        const datasetFactionKey = `datasets/${datasetId}/mission-rewards/factions/${factionId}.json`;
        const payload = await getJsonObject(client, bucketName, datasetFactionKey);
        if (!payload) continue;
        const factionAliasKey = `aliases/${namespace}/${channel}/mission-rewards/factions/${factionId}.json`;
        await putJsonObject(client, bucketName, factionAliasKey, payload, { cacheControl: CACHE_CONTROL_MUTABLE });
        console.log(`  [alias faction copy] ${factionAliasKey}`);
      }
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log(`\nMigrating mission-rewards factions on bucket: ${bucketName}`);
console.log(isProd ? '  ⚠  PRODUCTION RUN' : '  dev run');
console.log('');

// Read indexes.
const allIndex    = await getJsonObject(client, bucketName, 'indexes/all.json');
const publicIndex = await getJsonObject(client, bucketName, 'indexes/public.json');

if (!allIndex) {
  console.error('indexes/all.json not found — is the bucket correct?');
  process.exit(1);
}

const allDatasets = allIndex.datasets ?? [];
console.log(`Found ${allDatasets.length} datasets in indexes/all.json\n`);

// Migrate each dataset.
for (const summary of allDatasets) {
  console.log(`Dataset: ${summary.datasetId}`);
  if (!summary.hasMissionRewards) {
    console.log('  [skip] hasMissionRewards=false');
    continue;
  }
  await migrateDataset(summary.datasetId);
}

// Migrate aliases.
console.log('\nMigrating aliases...');
await migrateAliases('all', allIndex.latestByChannel);
if (publicIndex) {
  await migrateAliases('public', publicIndex.latestByChannel);
}

console.log('\nDone.');
