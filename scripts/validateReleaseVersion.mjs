import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, '..');
const releaseTag = (process.argv[2] ?? process.env.RELEASE_TAG)?.trim();

if (!releaseTag) {
  console.error('Release version validation requires a tag such as v2.4.3.');
  process.exit(1);
}

const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'));
const expectedTag = `v${packageJson.version}`;

if (releaseTag !== expectedTag) {
  console.error(
    `Release tag ${releaseTag} does not match package.json version ${packageJson.version}; expected ${expectedTag}.`,
  );
  process.exit(1);
}

console.log(`Release tag ${releaseTag} matches package.json version ${packageJson.version}.`);
