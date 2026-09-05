import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const tag = process.env.RELEASE_TAG ?? '';
const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
function run(command, args) {
  return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
try {
  if (!/^v\d+\.\d+\.\d+$/u.test(tag) || tag !== `v${version}`) throw new Error('Release tag must match the app version.');
  const commit = run('git', ['rev-parse', '--verify', `refs/tags/${tag}^{commit}`]);
  if (run('git', ['rev-parse', 'HEAD']) !== commit) throw new Error('Checkout must match the release tag.');
  for (const branch of ['main', 'production']) {
    run('git', ['merge-base', '--is-ancestor', commit, `refs/remotes/origin/${branch}`]);
  }
  const runs = JSON.parse(run('gh', ['run', 'list', '--commit', commit, '--branch', 'main', '--limit', '100', '--json', 'name,status,conclusion']));
  for (const name of ['CI', 'Secret Scan']) {
    const latest = runs.find((entry) => entry.name === name);
    if (latest?.status !== 'completed' || latest?.conclusion !== 'success') throw new Error(`Release source requires a successful ${name} run on main.`);
  }
  console.log(`Release ${tag} matches the tested commit promoted to production.`);
} catch (error) {
  console.error(`Release source validation failed: ${error.message.split('\n')[0]}`);
  process.exitCode = 1;
}
