import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPostFile } from '../../scripts/social/load.mjs';
import { validatePost } from '../../scripts/social/validate.mjs';
import { countGraphemes } from '../../scripts/social/graphemes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('grapheme counting handles emojis and multi-byte chars correctly', () => {
  assert.strictEqual(countGraphemes('a'), 1);
  assert.strictEqual(countGraphemes('こんにちは'), 5);
  assert.strictEqual(countGraphemes('👋'), 1);
  assert.strictEqual(countGraphemes('👨‍👩‍👧‍👦'), 1); // Family ZWJ emoji is 1 user-perceived character
});

test('validatePost on valid-single.yaml should be valid', () => {
  const filePath = path.resolve(__dirname, '../../social/fixtures/valid-single.yaml');
  const loaded = loadPostFile(filePath);
  const result = validatePost(loaded);
  assert.strictEqual(result.valid, true, JSON.stringify(result.errors));
});

test('validatePost on valid-thread.yaml should be valid', () => {
  const filePath = path.resolve(__dirname, '../../social/fixtures/valid-thread.yaml');
  const loaded = loadPostFile(filePath);
  const result = validatePost(loaded);
  assert.strictEqual(result.valid, true, JSON.stringify(result.errors));
});

test('validatePost on invalid-char-count.yaml should detect length error', () => {
  const filePath = path.resolve(__dirname, '../../social/fixtures/invalid/invalid-char-count.yaml');
  const loaded = loadPostFile(filePath);
  const result = validatePost(loaded);
  assert.strictEqual(result.valid, false);
  const hasTextLimitErr = result.errors.some(err => err.code === 'BLUESKY_TEXT_EXCEEDS_MAX');
  assert.strictEqual(hasTextLimitErr, true);
});
