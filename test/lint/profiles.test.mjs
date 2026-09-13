import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { createLinter, loadTextlintrc } from 'textlint';
import { loadChannels, collectSocialTexts, channelFiles } from '../../scripts/lint/run-textlint.mjs';
import { abs } from '../../scripts/lint/lib.mjs';
import { renderMarkdown, STAGES } from '../../scripts/lint/check-all.mjs';

const channels = loadChannels();

test('every channel declares a textlint profile file and policy that exist', () => {
  for (const [id, ch] of Object.entries(channels)) {
    assert.ok(fs.existsSync(abs(ch.textlint)), `${id}: ${ch.textlint} exists`);
    if (ch.policy) assert.ok(fs.existsSync(abs(ch.policy)), `${id}: ${ch.policy} exists`);
    assert.ok(['markdown', 'social-yaml'].includes(ch.kind));
    assert.ok(Array.isArray(ch.include) && ch.include.length > 0);
  }
});

test('every textlint profile loads and lints Japanese text with channel-specific strictness', async () => {
  const sample = 'これはテストです！\n\n私は、とても、長い、文を、書き、ます。\n\nご説明申し上げます。\n\nこれは常体の文である。\n';
  const results = {};
  for (const [id, ch] of Object.entries(channels)) {
    const descriptor = await loadTextlintrc({ configFilePath: abs(ch.textlint) });
    const linter = createLinter({ descriptor });
    const r = await linter.lintText(sample, abs('x.md'));
    results[id] = r.messages.map((m) => `${m.ruleId}:${m.severity}`);
  }
  // Zenn allows "！" (readable prose) but forbids 申し上げます; Qiita forbids "！" as an error; social makes it a warning
  assert.ok(!results.zenn.some((m) => m.startsWith('ja-technical-writing/no-exclamation-question-mark')));
  assert.ok(results.zenn.some((m) => m.startsWith('@textlint-rule/pattern')));
  assert.ok(results.qiita.includes('ja-technical-writing/no-exclamation-question-mark:2'));
  assert.ok(results.social.includes('ja-technical-writing/no-exclamation-question-mark:1'));
  assert.ok(results.docs.every((m) => !m.startsWith('ja-technical-writing/no-mix-dearu-desumasu')));
  assert.ok(results.zenn.some((m) => m.startsWith('ja-technical-writing/no-mix-dearu-desumasu')), 'zenn enforces ですます');
  for (const id of Object.keys(channels)) assert.ok(results[id].some((m) => m.startsWith('ja-technical-writing/max-ten')), `${id}: max-ten applies`);
});

test('collectSocialTexts extracts the prose fields of a post', () => {
  const units = collectSocialTexts({ linkedin: { text: 'a', article: { description: 'b' } }, bluesky: { posts: [{ text: 'c', external: { description: 'd' } }] } });
  assert.deepStrictEqual(units.map((u) => u.label), ['linkedin.text', 'linkedin.article.description', 'bluesky.posts[0].text', 'bluesky.posts[0].external.description']);
});

test('channelFiles skips legacy Qiita articles and README placeholders', () => {
  const qiita = channelFiles(channels.qiita);
  assert.ok(qiita.every((f) => !/[0-9a-f]{20}\.md$/.test(f)));
  assert.ok(!channelFiles(channels.note).includes('platforms/note/public/README.md'));
  assert.ok(!channelFiles(channels.zenn).includes('articles/README.md'));
});

test('check-all renders a Markdown summary with one row per stage and lists failures', () => {
  const results = STAGES.slice(0, 2).map((s, i) => ({
    id: s.id,
    title: s.title,
    ok: i === 0,
    counts: { errors: i, warnings: 0 },
    out: 'x',
    details: i ? { errors: [{ severity: 'error', file: 'a.md', line: 3, code: 'X', message: 'boom' }], warnings: [] } : null,
  }));
  const md = renderMarkdown(results);
  assert.match(md, /\| textlint \| ✅ \| 0 \| 0 \|/);
  assert.match(md, /\| books \| ❌ \| 1 \| 0 \|/);
  assert.match(md, /1 段階が失敗/);
  assert.match(md, /`a\.md:3` \[X\] boom/);
});
