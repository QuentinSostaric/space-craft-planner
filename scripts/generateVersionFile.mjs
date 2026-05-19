import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'));

function readGitValue(command) {
  try {
    return execSync(command, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

const version = packageJson.version ?? '0.0.0';
const commit = process.env.GITHUB_SHA ?? readGitValue('git rev-parse --short HEAD') ?? 'unknown';
const buildNumber = process.env.GITHUB_RUN_NUMBER ?? 'local';
const build = process.env.ITEMFABRICATOR_BUILD ?? `${version}+${buildNumber}.${commit.slice(0, 12)}`;

const payload = {
  name: packageJson.name ?? 'item-fabricator',
  productName: 'Item Fabricator',
  version,
  build,
  commit,
  builtAt: new Date().toISOString(),
};

const outputPath = resolve(repoRoot, 'client/public/itemfabricator_version.json');
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(`Wrote ${outputPath}`);
