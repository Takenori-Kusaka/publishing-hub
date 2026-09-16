import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectUTM } from '../../scripts/social/urls.mjs';
import { renderPost, writeRedactedPreview } from '../../scripts/social/render.mjs';
import { loadPostFile } from '../../scripts/social/load.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('injectUTM should correctly append UTM parameters and keep fragments', () => {
  const url = 'https://zenn.dev/path?foo=bar#my-hash';
  const injected = injectUTM(url, {
    source: 'linkedin',
    medium: 'social',
    campaign: 'camp123',
    content: 'post-id-123'
  });

  const parsed = new URL(injected);
  assert.strictEqual(parsed.searchParams.get('foo'), 'bar');
  assert.strictEqual(parsed.searchParams.get('utm_source'), 'linkedin');
  assert.strictEqual(parsed.searchParams.get('utm_medium'), 'social');
  assert.strictEqual(parsed.searchParams.get('utm_campaign'), 'camp123');
  assert.strictEqual(parsed.searchParams.get('utm_content'), 'post-id-123');
  assert.strictEqual(parsed.hash, '#my-hash');
});

test('injectUTM should throw an error if duplicate UTM parameter is already present', () => {
  const url = 'https://zenn.dev/path?utm_source=existing';
  assert.throws(() => {
    injectUTM(url, { source: 'new_source' });
  }, /Duplicate UTM parameter detected/);
});

test('renderPost should render valid-single.yaml correctly with UTM', () => {
  const filePath = path.resolve(__dirname, '../../social/fixtures/valid-single.yaml');
  const loaded = loadPostFile(filePath);
  const rendered = renderPost(loaded.data);

  // Validate LinkedIn rendering
  assert.ok(rendered.linkedin);
  assert.strictEqual(rendered.linkedin.text.includes('1人から始める「ピットイン方式」の解説です。'), true);
  assert.ok(rendered.linkedin.article);
  const parsedLiUrl = new URL(rendered.linkedin.article.url);
  assert.strictEqual(parsedLiUrl.searchParams.get('utm_source'), 'linkedin');
  assert.strictEqual(parsedLiUrl.searchParams.get('utm_campaign'), 'valid_single_campaign');

  // Validate Bluesky rendering
  assert.ok(rendered.bluesky);
  assert.strictEqual(rendered.bluesky.posts.length, 1);
  const post = rendered.bluesky.posts[0];
  assert.ok(post.external);
  const parsedBsUrl = new URL(post.external.url);
  assert.strictEqual(parsedBsUrl.searchParams.get('utm_source'), 'bluesky');
  assert.strictEqual(parsedBsUrl.searchParams.get('utm_campaign'), 'valid_single_campaign');
});

test('writeRedactedPreview should output correct markdown preview file', () => {
  const filePath = path.resolve(__dirname, '../../social/fixtures/valid-single.yaml');
  const loaded = loadPostFile(filePath);
  const rendered = renderPost(loaded.data);

  const tmpDir = path.resolve(__dirname, '../../.tmp/test-render');
  writeRedactedPreview(rendered, loaded.data, tmpDir);

  const previewFilePath = path.join(tmpDir, 'valid-single-preview.md');
  assert.strictEqual(fs.existsSync(previewFilePath), true);

  const previewContent = fs.readFileSync(previewFilePath, 'utf8');
  assert.strictEqual(previewContent.includes('# SNS 配信プレビュー (ID: valid-single)'), true);
  assert.strictEqual(previewContent.includes('[REDACTED_LINKEDIN_AUTHOR_URN]'), true);

  // Clean up
  fs.unlinkSync(previewFilePath);
  fs.rmdirSync(tmpDir);
});
