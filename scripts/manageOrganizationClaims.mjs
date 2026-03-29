import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import process from 'node:process';
import {
  createS3AccountStore,
  readAccountRecord,
  saveAccountOrganizations,
} from '../shared/accountStorage.mjs';
import {
  normalizeOrganizationClaimRequestRecord,
  writeOrganizationClaimRequest,
} from '../shared/organizationClaimRequestStorage.mjs';
import {
  readOrganizationRecord,
  writeOrganizationRecord,
} from '../shared/organizationStorage.mjs';
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

function toIsoNow() {
  return new Date().toISOString();
}

function formatDateTime(value) {
  if (!value || Number.isNaN(Date.parse(value))) {
    return 'unknown';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function normalizeDecision(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'approve' || normalized === 'approved' || normalized === 'a') {
    return 'approved';
  }
  if (normalized === 'reject' || normalized === 'rejected' || normalized === 'r') {
    return 'rejected';
  }
  return null;
}

function parseArgs(argv) {
  const args = [...argv];
  const command = args[0] && !args[0].startsWith('--') ? args.shift() : 'review';
  const options = {
    all: false,
    status: null,
    sid: null,
    accountId: null,
    note: null,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--all') {
      options.all = true;
      continue;
    }
    if (arg.startsWith('--status=')) {
      options.status = arg.slice('--status='.length).trim().toLowerCase() || null;
      continue;
    }
    if (arg.startsWith('--sid=')) {
      options.sid = arg.slice('--sid='.length).trim().toUpperCase() || null;
      continue;
    }
    if (arg.startsWith('--account=')) {
      options.accountId = arg.slice('--account='.length).trim() || null;
      continue;
    }
    if (arg.startsWith('--note=')) {
      options.note = arg.slice('--note='.length).trim() || null;
      continue;
    }

    throw new Error(`Unknown argument "${arg}".`);
  }

  return { command, options };
}

function printHelp() {
  console.log(`
Usage:
  node scripts/manageOrganizationClaims.mjs
  node scripts/manageOrganizationClaims.mjs list [--all] [--status=pending]
  node scripts/manageOrganizationClaims.mjs approve --sid=SID --account=ACCOUNT_ID [--note="..."]
  node scripts/manageOrganizationClaims.mjs reject --sid=SID --account=ACCOUNT_ID [--note="..."]

Commands:
  review   Interactive review of pending claim requests (default)
  list     Lists claim requests
  approve  Approves a request and grants org admin ownership in R2
  reject   Rejects a request in R2
`);
}

function describeRequest(request, index = null) {
  const prefix = index === null ? '-' : `[${index + 1}]`;
  return [
    `${prefix} ${request.organizationName} (${request.sid})`,
    `status=${request.status}`,
    `discord=${request.requestedByDiscordDisplayName ?? 'Unknown'} (@${request.requestedByDiscordUsername ?? 'unknown'})`,
    `rsi=${request.requestedByRsiHandle ?? 'Unknown'}`,
    `account=${request.accountId}`,
    `submitted=${formatDateTime(request.submittedAt)}`,
  ].join(' | ');
}

async function loadClaimRequests(client, bucketName, store, { status = null, sid = null, accountId = null } = {}) {
  const keys = await listObjectKeys(client, bucketName, 'organization-claim-requests/');
  const records = [];

  for (const key of keys) {
    const payload = await store.readJson(key);
    const record = normalizeOrganizationClaimRequestRecord(payload);
    if (!record) {
      continue;
    }
    if (status && record.status !== status) {
      continue;
    }
    if (sid && record.sid !== sid) {
      continue;
    }
    if (accountId && record.accountId !== accountId) {
      continue;
    }
    records.push(record);
  }

  return records.sort((left, right) => {
    const leftPending = left.status === 'pending' ? 0 : 1;
    const rightPending = right.status === 'pending' ? 0 : 1;
    if (leftPending !== rightPending) {
      return leftPending - rightPending;
    }

    return Date.parse(right.submittedAt ?? 0) - Date.parse(left.submittedAt ?? 0);
  });
}

function buildApprovedOrganizationRef(existingRef, organizationRecord, request, now) {
  return {
    sid: request.sid,
    source: existingRef?.source ?? (request.organizationSource === 'profile-main' ? 'profile-main' : 'manual'),
    name: organizationRecord.name ?? existingRef?.name ?? request.organizationName ?? request.sid,
    image: organizationRecord.image ?? organizationRecord.logo ?? existingRef?.image ?? null,
    status: 'verified_admin',
    rank: existingRef?.rank ?? null,
    stars: existingRef?.stars ?? null,
    lastSeenAt: now,
    lastVerifiedAt: now,
  };
}

async function approveClaimRequest(store, request, note = null) {
  const account = await readAccountRecord(store, request.accountId);
  if (!account) {
    throw new Error(`Account "${request.accountId}" not found.`);
  }

  const organizationRecord = await readOrganizationRecord(store, request.sid);
  if (!organizationRecord) {
    throw new Error(`Organization record "${request.sid}" not found.`);
  }
  if (organizationRecord.claimed && organizationRecord.claimedByAccountId !== request.accountId) {
    throw new Error(
      `Organization "${request.sid}" is already claimed by "${organizationRecord.claimedByAccountId}".`,
    );
  }

  const now = toIsoNow();
  await writeOrganizationRecord(store, {
    ...organizationRecord,
    claimed: true,
    claimedByAccountId: request.accountId,
    adminAccountIds: Array.from(
      new Set([...(organizationRecord.adminAccountIds ?? []), request.accountId]),
    ),
    updatedAt: now,
  });

  const existingRef = account.organizations.find((organization) => organization.sid === request.sid) ?? null;
  const nextOrganizations = [
    ...account.organizations.filter((organization) => organization.sid !== request.sid),
    buildApprovedOrganizationRef(existingRef, organizationRecord, request, now),
  ];
  await saveAccountOrganizations(store, account.accountId, nextOrganizations, account.profile);

  return writeOrganizationClaimRequest(store, {
    ...request,
    status: 'approved',
    note: note ?? request.note ?? null,
    updatedAt: now,
  });
}

async function rejectClaimRequest(store, request, note = null) {
  return writeOrganizationClaimRequest(store, {
    ...request,
    status: 'rejected',
    note: note ?? request.note ?? null,
    updatedAt: toIsoNow(),
  });
}

async function applyDecision(store, request, decision, note = null) {
  if (decision === 'approved') {
    return approveClaimRequest(store, request, note);
  }
  if (decision === 'rejected') {
    return rejectClaimRequest(store, request, note);
  }

  throw new Error(`Unsupported decision "${decision}".`);
}

async function runInteractiveReview(client, bucketName, store) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    while (true) {
      const requests = await loadClaimRequests(client, bucketName, store, { status: 'pending' });
      if (requests.length === 0) {
        console.log('No pending organization claim requests.');
        return;
      }

      console.log('\nPending organization claim requests:\n');
      requests.forEach((request, index) => {
        console.log(describeRequest(request, index));
      });
      console.log('');

      const rawSelection = (await rl.question('Pick a request number to review (Enter/q to quit): ')).trim();
      if (!rawSelection || rawSelection.toLowerCase() === 'q') {
        return;
      }

      const index = Number(rawSelection) - 1;
      if (!Number.isInteger(index) || index < 0 || index >= requests.length) {
        console.log('Invalid selection.\n');
        continue;
      }

      const request = requests[index];
      console.log(`\n${describeRequest(request)}\n`);
      const rawDecision = (await rl.question('Action: [a]pprove / [r]eject / [s]kip ? ')).trim().toLowerCase();
      if (!rawDecision || rawDecision === 's') {
        console.log('');
        continue;
      }

      const decision = normalizeDecision(rawDecision);
      if (!decision) {
        console.log('Unknown action.\n');
        continue;
      }

      const note = (await rl.question('Optional note (Enter to skip): ')).trim() || null;
      const updatedRequest = await applyDecision(store, request, decision, note);
      console.log(`Request updated: ${updatedRequest.sid} / ${updatedRequest.accountId} -> ${updatedRequest.status}\n`);
    }
  } finally {
    rl.close();
  }
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  loadDevVars();

  const r2Config = getR2Config(process.env);
  const client = createR2Client(process.env);
  const store = createS3AccountStore(client, r2Config.bucketName);

  if (command === 'review') {
    await runInteractiveReview(client, r2Config.bucketName, store);
    return;
  }

  if (command === 'list') {
    const status = options.all ? null : (options.status ?? 'pending');
    const requests = await loadClaimRequests(client, r2Config.bucketName, store, {
      status,
      sid: options.sid,
      accountId: options.accountId,
    });
    if (requests.length === 0) {
      console.log('No organization claim requests found.');
      return;
    }

    requests.forEach((request, index) => {
      console.log(describeRequest(request, index));
    });
    return;
  }

  const decision = normalizeDecision(command);
  if (!decision) {
    throw new Error(`Unknown command "${command}".`);
  }
  if (!options.sid || !options.accountId) {
    throw new Error(`"${command}" requires both --sid and --account.`);
  }

  const requests = await loadClaimRequests(client, r2Config.bucketName, store, {
    sid: options.sid,
    accountId: options.accountId,
  });
  const request = requests[0] ?? null;
  if (!request) {
    throw new Error(
      `Claim request not found for "${options.sid}" / "${options.accountId}".`,
    );
  }

  const updatedRequest = await applyDecision(store, request, decision, options.note);
  console.log(
    `Updated ${updatedRequest.sid} / ${updatedRequest.accountId}: ${updatedRequest.status}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
