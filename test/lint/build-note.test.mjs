import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { markdownToNoteHtml, buildNotePackage, manuscriptPath } from '../../scripts/build-note.mjs';

test('markdownToNoteHtml emits h2/h3, paragraphs, lists, quotes and links only', () => {
  const html = markdownToNoteHtml('## 見出し\n本文 **強調** と [リンク](https://example.com/a)。\n\n- 一つ\n- 二つ\n\n> 引用\n\n### 小見出し\n\n1. 順序\n2. 付き\n');
  assert.ok(html.includes('<h2>見出し</h2>'));
  assert.ok(html.includes('<p>本文 <strong>強調</strong> と <a href="https://example.com/a">リンク</a>。</p>'));
  assert.ok(html.includes('<ul><li>一つ</li><li>二つ</li></ul>'));
  assert.ok(html.includes('<blockquote>引用</blockquote>'));
  assert.ok(html.includes('<h3>小見出し</h3>'));
  assert.ok(html.includes('<ol><li>順序</li><li>付き</li></ol>'));
  assert.ok(!html.includes('<h1>'));
});

test('buildNotePackage refuses a missing manuscript instead of copying the Zenn source', () => {
  assert.throws(() => buildNotePackage('no-such-manuscript'), /platforms\/note\/public\/no-such-manuscript\.md/);
});

test('buildNotePackage builds the shipped draft and records status/source/canonical in the manifest', () => {
  const id = 'multi-platform-publishing-architecture';
  assert.ok(fs.existsSync(manuscriptPath(id)));
  const { manifest, exportDir } = buildNotePackage(id, { now: new Date('2026-09-13T00:00:00Z') });
  assert.strictEqual(manifest.status, 'draft');
  assert.strictEqual(manifest.source, 'articles/multi-platform-publishing-architecture.md');
  assert.match(manifest.canonical_url, /^https:\/\/zenn\.dev\//);
  assert.strictEqual(manifest.checks.errors, 0);
  for (const f of ['import.wxr', 'article.md', 'article.html', 'article.txt', 'manifest.json']) assert.ok(fs.existsSync(path.join(exportDir, f)), f);
  const html = fs.readFileSync(path.join(exportDir, 'article.html'), 'utf8');
  assert.ok(html.includes('<h2>'));
  assert.ok(!html.includes('```'));
  const wxr = fs.readFileSync(path.join(exportDir, 'import.wxr'), 'utf8');
  assert.ok(wxr.includes(`<wp:post_name><![CDATA[${id}]]></wp:post_name>`));
  // deterministic post id
  const again = buildNotePackage(id, { now: new Date('2026-09-13T00:00:00Z') });
  assert.strictEqual(fs.readFileSync(path.join(again.exportDir, 'import.wxr'), 'utf8'), wxr);
});
