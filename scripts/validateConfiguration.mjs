import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, '..');
const failures = [];

function readRepoFile(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

function reportFailure(message) {
  failures.push(message);
}

function parseToml(relativePath) {
  const assignments = [];
  let section = '';

  for (const rawLine of readRepoFile(relativePath).split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const arraySection = line.match(/^\[\[([^\]]+)\]\]$/u);
    const tableSection = line.match(/^\[([^\]]+)\]$/u);
    if (arraySection || tableSection) {
      section = (arraySection ?? tableSection)[1].trim();
      continue;
    }

    const assignment = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/u);
    if (assignment) {
      assignments.push({ section, key: assignment[1], rawValue: assignment[2].trim() });
    }
  }

  return assignments;
}

function decodeTomlString(rawValue) {
  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    try {
      return JSON.parse(rawValue);
    } catch {
      return null;
    }
  }

  if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
    return rawValue.slice(1, -1);
  }

  return rawValue;
}

function findAssignment(assignments, section, key) {
  return assignments.find((entry) => entry.section === section && entry.key === key);
}

function requireAssignment(assignments, section, key, relativePath) {
  const assignment = findAssignment(assignments, section, key);
  if (!assignment) {
    reportFailure(`${relativePath} must declare ${section ? `${section}.` : ''}${key}.`);
  }
  return assignment;
}

function validateHttpsVariable(assignments, key, relativePath) {
  const assignment = requireAssignment(assignments, 'vars', key, relativePath);
  if (!assignment) {
    return;
  }

  const value = decodeTomlString(assignment.rawValue);
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new Error('not an uncredentialed HTTPS URL');
    }
  } catch {
    reportFailure(`${relativePath} must configure ${key} as an uncredentialed HTTPS URL.`);
  }
}

function validateCompatibilityDate(assignments, relativePath) {
  const assignment = requireAssignment(assignments, '', 'compatibility_date', relativePath);
  if (!assignment) {
    return null;
  }

  const value = decodeTomlString(assignment.rawValue);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    reportFailure(`${relativePath} must use a valid YYYY-MM-DD compatibility_date.`);
    return null;
  }
  return value;
}

function validateWranglerConfig(relativePath, requiredBindings) {
  const assignments = parseToml(relativePath);
  const compatibilityDate = validateCompatibilityDate(assignments, relativePath);

  for (const assignment of assignments) {
    if (assignment.key === 'account_id') {
      reportFailure(`${relativePath} must obtain account_id from CLOUDFLARE_ACCOUNT_ID or Wrangler authentication.`);
    }
    if (
      assignment.section === 'vars' &&
      /(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|ACCESS_KEY|CERTIFICATE)/iu.test(assignment.key)
    ) {
      reportFailure(`${relativePath} must not place secret-like variable ${assignment.key} in [vars].`);
    }
  }

  const bindings = new Set(
    assignments
      .filter((entry) => entry.section === 'r2_buckets' && entry.key === 'binding')
      .map((entry) => decodeTomlString(entry.rawValue)),
  );
  for (const binding of requiredBindings) {
    if (!bindings.has(binding)) {
      reportFailure(`${relativePath} must declare the ${binding} R2 binding.`);
    }
  }

  return { assignments, compatibilityDate };
}

const packageJson = JSON.parse(readRepoFile('package.json'));
const packageLock = JSON.parse(readRepoFile('package-lock.json'));
const rootLockEntry = packageLock.packages?.[''];

if (packageLock.lockfileVersion !== 3) {
  reportFailure('package-lock.json must use lockfileVersion 3.');
}
if (!Array.isArray(rootLockEntry?.workspaces) || !rootLockEntry.workspaces.includes('client')) {
  reportFailure('package-lock.json must cover the client npm workspace.');
}

const wranglerVersion = packageJson.devDependencies?.wrangler;
if (!/^\d+\.\d+\.\d+$/u.test(wranglerVersion ?? '')) {
  reportFailure('package.json must pin Wrangler to an exact version.');
}
if (rootLockEntry?.devDependencies?.wrangler !== wranglerVersion) {
  reportFailure('package.json and package-lock.json must agree on the Wrangler version.');
}
if (packageLock.packages?.['node_modules/wrangler']?.version !== wranglerVersion) {
  reportFailure('package-lock.json must resolve the exact declared Wrangler version.');
}
for (const scriptName of ['discord:bot:dev', 'discord:bot:deploy']) {
  const command = packageJson.scripts?.[scriptName] ?? '';
  if (!command.startsWith('wrangler ') || command.includes('npx')) {
    reportFailure(`${scriptName} must use the lockfile-pinned Wrangler executable.`);
  }
}

const { assignments: pagesConfig, compatibilityDate: pagesDate } = validateWranglerConfig(
  'wrangler.toml',
  ['GAME_DATA_PROD', 'GAME_DATA_DEV'],
);
const { assignments: botConfig } = validateWranglerConfig('workers/discord-bot/wrangler.toml', [
  'GAME_DATA',
  'GAME_DATA_DEV',
]);

const posthogEnabled = requireAssignment(pagesConfig, 'vars', 'VITE_POSTHOG_ENABLED', 'wrangler.toml');
if (posthogEnabled && !['true', 'false'].includes(decodeTomlString(posthogEnabled.rawValue))) {
  reportFailure('wrangler.toml must configure VITE_POSTHOG_ENABLED as true or false.');
}
validateHttpsVariable(pagesConfig, 'VITE_POSTHOG_HOST', 'wrangler.toml');
validateHttpsVariable(botConfig, 'APP_BASE_URL', 'workers/discord-bot/wrangler.toml');

const cloudflareCheck = packageJson.scripts?.['cloudflare:check'] ?? '';
if (pagesDate && !cloudflareCheck.includes(`--compatibility-date ${pagesDate}`)) {
  reportFailure('cloudflare:check must compile Pages Functions with the configured compatibility_date.');
}

if (!existsSync(resolve(repoRoot, 'src-tauri/Cargo.lock'))) {
  reportFailure('src-tauri/Cargo.lock must be present for reproducible desktop builds.');
}
if (/^\/src-tauri\/Cargo\.lock$/mu.test(readRepoFile('.gitignore'))) {
  reportFailure('src-tauri/Cargo.lock must not be ignored.');
}

for (const workflowPath of [
  '.github/workflows/ci.yml',
  '.github/workflows/desktop-release.yml',
  '.github/workflows/secrets-scan.yml',
]) {
  const workflow = readRepoFile(workflowPath);
  for (const match of workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gmu)) {
    const reference = match[1];
    if (!reference.startsWith('./') && !/@[0-9a-f]{40}$/u.test(reference)) {
      reportFailure(`${workflowPath} contains a non-immutable action reference.`);
    }
  }
  if (!/^permissions:\s*\n\s+contents: read\s*$/mu.test(workflow)) {
    reportFailure(`${workflowPath} must default GITHUB_TOKEN to contents: read.`);
  }
  if (/permissions:\s*write-all/u.test(workflow)) {
    reportFailure(`${workflowPath} must not grant write-all permissions.`);
  }
}

const releaseWorkflow = readRepoFile('.github/workflows/desktop-release.yml');
if (!/build-desktop:\s*\n\s+permissions:\s*\n\s+contents: write/mu.test(releaseWorkflow)) {
  reportFailure('desktop-release.yml must scope contents: write to the release job only.');
}
if (
  !/name: Validate release tag matches app version[\s\S]*?RELEASE_TAG:.*github\.event\.release\.tag_name.*inputs\.release_tag[\s\S]*?npm run release:check-version/u.test(
    releaseWorkflow,
  )
) {
  reportFailure('desktop-release.yml must reject release tags that do not match package.json.');
}

const secretWorkflow = readRepoFile('.github/workflows/secrets-scan.yml');
if (!/gitleaks:v\d+\.\d+\.\d+@sha256:[0-9a-f]{64}/u.test(secretWorkflow)) {
  reportFailure('secrets-scan.yml must pin the Gitleaks image by digest.');
}
const dependabotPath = resolve(repoRoot, '.github/dependabot.yml');
if (!existsSync(dependabotPath)) {
  reportFailure('.github/dependabot.yml must monitor npm, Cargo and GitHub Actions updates.');
} else {
  const dependabotConfig = readRepoFile('.github/dependabot.yml');
  for (const ecosystem of ['npm', 'cargo', 'github-actions']) {
    if (!new RegExp(`package-ecosystem: ${ecosystem}(?:\\s|$)`, 'u').test(dependabotConfig)) {
      reportFailure(`.github/dependabot.yml must monitor the ${ecosystem} ecosystem.`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`configuration error: ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log('Configuration validation passed without loading local secret files.');
}
