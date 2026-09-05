import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Exercise the publication gate with real git refs and controlled CI responses.
// The test never invokes GitHub or changes the working repository.
test('release gate requires the tagged checkout, both promotion branches, and green CI', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'itemfab-release-gate-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'bin'));
  copyFileSync(new URL('../scripts/validateReleaseSource.mjs', import.meta.url), join(root, 'scripts/validateReleaseSource.mjs'));
  writeFileSync(join(root, 'package.json'), '{"version":"2.4.4"}');
  writeFileSync(join(root, 'bin/gh'), `#!${process.execPath}\nprocess.stdout.write(process.env.TEST_CI_RUNS);\n`, { mode: 0o700 });
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q');
  git('-c', 'user.name=Release Gate Test', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-m', 'fixture');
  git('tag', 'v2.4.4');
  const commit = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/origin/main', commit);
  git('update-ref', 'refs/remotes/origin/production', commit);
  const runs = ['CI', 'Secret Scan'].map((name) => ({ name, status: 'completed', conclusion: 'success' }));
  const run = (changes = {}) => spawnSync(process.execPath, ['scripts/validateReleaseSource.mjs'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}`, RELEASE_TAG: 'v2.4.4', TEST_CI_RUNS: JSON.stringify(runs), ...changes },
  });
  assert.equal(run().status, 0);
  assert.equal(run({ RELEASE_TAG: 'v2.4.3' }).status, 1);
  assert.equal(run({ TEST_CI_RUNS: '[]' }).status, 1);
  assert.equal(run({ TEST_CI_RUNS: JSON.stringify([{ ...runs[0], conclusion: 'failure' }, runs[1]]) }).status, 1);
  assert.equal(run({ TEST_CI_RUNS: JSON.stringify([{ ...runs[0], status: 'in_progress' }, runs[1]]) }).status, 1);
  git('update-ref', '-d', 'refs/remotes/origin/production');
  assert.equal(run().status, 1);
  git('update-ref', 'refs/remotes/origin/production', commit);
  git('-c', 'user.name=Release Gate Test', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-m', 'untested');
  assert.equal(run().status, 1);
  git('tag', '-f', 'v2.4.4');
  assert.equal(run().status, 1);
});
