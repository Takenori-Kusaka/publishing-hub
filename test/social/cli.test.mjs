import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const cliPath = path.join(ROOT, 'scripts/social/cli.mjs');

test('CLI validate should succeed on valid post and fail on invalid post', () => {
  // 1. Valid single post
  const res1 = spawnSync('node', [cliPath, 'validate', '--id', 'valid-single'], { encoding: 'utf8' });
  assert.strictEqual(res1.status, 0);
  assert.strictEqual(res1.stdout.replace(/\\/g, '/').includes('✅ Validation Passed: social/fixtures/valid-single.yaml'), true);

  // 2. Invalid char count post
  const res2 = spawnSync('node', [cliPath, 'validate', '--id', 'invalid-char-count'], { encoding: 'utf8' });
  assert.strictEqual(res2.status, 1);
  assert.strictEqual(res2.stderr.replace(/\\/g, '/').includes('❌ Validation Failed: social/fixtures/invalid/invalid-char-count.yaml'), true);
});

test('CLI publish without --dry-run locally should block and fail with SAFETY ERROR', () => {
  const res = spawnSync('node', [
    cliPath, 'publish',
    '--id', 'valid-single',
    '--platform', 'linkedin',
    '--source-sha', '2cad9b46617fa729c1598f45610fb83fc6e4b999'
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      CI: undefined,
      GITHUB_ACTIONS: undefined,
      ALLOW_SOCIAL_PUBLISH: undefined
    }
  });

  assert.strictEqual(res.status, 1);
  assert.strictEqual(res.stderr.includes('❌ SAFETY ERROR: Actual social publishing is blocked locally.'), true);
});

test('CLI publish with --dry-run locally should bypass safety blocks and render payload successfully', () => {
  const res = spawnSync('node', [
    cliPath, 'publish',
    '--id', 'valid-single',
    '--platform', 'linkedin',
    '--source-sha', '2cad9b46617fa729c1598f45610fb83fc6e4b999',
    '--dry-run'
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      CI: undefined,
      GITHUB_ACTIONS: undefined,
      ALLOW_SOCIAL_PUBLISH: undefined
    }
  });

  assert.strictEqual(res.status, 0);
  assert.strictEqual(res.stdout.includes('🏁 --- DRY RUN SIMULATION ---'), true);
  assert.strictEqual(res.stdout.includes('1人から始める'), true);
});
