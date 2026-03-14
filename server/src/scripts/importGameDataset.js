import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_SOURCE_FILES,
  buildClientDataset,
} from '../../../exporter/dataset-builder.mjs';
import { connectToDatabase } from '../config/db.js';
import { upsertGameDataset } from '../services/gameDatasetService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..', '..');

dotenv.config({
  path: path.join(serverRoot, '.env'),
});

function parseArgs(argv) {
  const options = new Map();

  for (const rawArg of argv) {
    if (!rawArg.startsWith('--')) {
      continue;
    }

    const [key, ...valueParts] = rawArg.slice(2).split('=');
    options.set(key, valueParts.length > 0 ? valueParts.join('=') : 'true');
  }

  return options;
}

function toBoolean(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'y', 'oui', 'o'].includes(String(value).toLowerCase());
}

function toNullableString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

const args = parseArgs(process.argv.slice(2));
const channel = args.get('channel') ?? 'ptu';

if (channel !== 'live' && channel !== 'ptu') {
  console.error('Channel must be "live" or "ptu".');
  process.exit(1);
}

const sourceFiles = {
  craftingBlueprints: args.get('craftingBlueprints') ?? DEFAULT_SOURCE_FILES.craftingBlueprints,
  localizations: args.get('localizations') ?? DEFAULT_SOURCE_FILES.localizations,
  itemStats: args.get('itemStats') ?? DEFAULT_SOURCE_FILES.itemStats,
};

const datasetId = args.get('datasetId') ?? `${channel}-dataset`;
const version = args.get('version') ?? 'unknown';
const label = args.get('label') ?? `Star Citizen ${channel.toUpperCase()}`;
const branch = toNullableString(args.get('branch'));
const buildNumber = toNullableString(args.get('buildNumber'));
const buildId = toNullableString(args.get('buildId'));
const buildDateStamp = toNullableString(args.get('buildDateStamp'));
const buildTimeStamp = toNullableString(args.get('buildTimeStamp'));
const requestedP4ChangeNum = toNullableString(args.get('requestedP4ChangeNum'));
const shelvedChange = toNullableString(args.get('shelvedChange'));
const installPath = toNullableString(args.get('installPath'));
const outputLabel = toNullableString(args.get('outputLabel'));
const published = toBoolean(args.get('published'), false);

try {
  const dbState = await connectToDatabase();

  if (!dbState.connected) {
    console.error(dbState.reason);
    process.exitCode = 1;
  } else {
    const dataset = await buildClientDataset(sourceFiles);
    const document = await upsertGameDataset({
      channel,
      datasetId,
      label,
      version,
      branch,
      buildNumber,
      buildId,
      buildDateStamp,
      buildTimeStamp,
      requestedP4ChangeNum,
      shelvedChange,
      installPath,
      outputLabel,
      published,
      resources: dataset.resources,
      blueprints: dataset.blueprints,
      metrics: dataset.meta,
      sourceFiles: dataset.meta.sourceFiles,
      importedAt: new Date(),
    });

    console.log(
      `Imported ${channel.toUpperCase()} dataset ${document.datasetId} with ${document.blueprints.length} blueprints and ${document.resources.length} resources. Published=${document.published}`,
    );

    if (document.changelog?.summary?.blueprints) {
      console.log(
        `PTU changelog vs LIVE: +${document.changelog.summary.blueprints.added} / ~${document.changelog.summary.blueprints.changed} / -${document.changelog.summary.blueprints.removed}`,
      );
    }
  }
} finally {
  await mongoose.disconnect();
}
