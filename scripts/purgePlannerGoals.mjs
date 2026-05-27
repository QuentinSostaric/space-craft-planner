import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import {
  createS3AccountStore,
  readAccountRecord,
  writeAccountRecord,
} from '../shared/accountStorage.mjs';
import {
  createR2Client,
  getR2Config,
  listObjectKeys,
} from '../shared/r2Storage.mjs';

function loadDevVars() {
  const envPath = resolve('.dev.vars');
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const options = { dryRun: false, help: false };
  for (const arg of argv) {
    if (arg === '--dry-run') { options.dryRun = true; }
    else if (arg === '--help' || arg === '-h') { options.help = true; }
    else { throw new Error(`Unknown argument "${arg}".`); }
  }
  return options;
}

function printHelp() {
  console.log(`
Usage: node scripts/purgePlannerGoals.mjs [--dry-run]

Clears planner.goals for all accounts in the R2 bucket.
Goals are stale after a planner rework and cause phantom badge counts.

Options:
  --dry-run   Preview which accounts would be modified without writing
  --help      Show this help

Environment variables (or .dev.vars):
  R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  loadDevVars();

  const r2Config = getR2Config(process.env);
  const client = createR2Client(process.env);
  const store = createS3AccountStore(client, r2Config.bucketName);

  console.log(`Scanning accounts in bucket "${r2Config.bucketName}"…`);
  const keys = await listObjectKeys(client, r2Config.bucketName, 'accounts/');
  console.log(`Found ${keys.length} account key(s).`);

  let modified = 0;
  let skipped = 0;
  let errors = 0;

  for (const key of keys) {
    const accountId = key.replace(/^accounts\//, '').replace(/\.json$/, '');
    try {
      const account = await readAccountRecord(store, accountId);
      if (!account) {
        skipped++;
        continue;
      }

      const goalCount = account.planner?.goals?.length ?? 0;
      if (goalCount === 0) {
        skipped++;
        continue;
      }

      console.log(`${options.dryRun ? '[dry-run] ' : ''}${accountId}: clearing ${goalCount} goal(s)`);

      if (!options.dryRun) {
        await writeAccountRecord(store, {
          ...account,
          planner: {
            ...account.planner,
            goals: [],
          },
        });
      }

      modified++;
    } catch (error) {
      console.error(`Error processing ${accountId}: ${error?.message ?? error}`);
      errors++;
    }
  }

  console.log(`\nDone. Modified: ${modified}, Skipped (no goals): ${skipped}, Errors: ${errors}`);
  if (options.dryRun && modified > 0) {
    console.log('Re-run without --dry-run to apply changes.');
  }
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
