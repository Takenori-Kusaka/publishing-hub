import { test } from 'node:test';
import assert from 'node:assert';
import { convertZennToNote, buildWxrXML } from '../../scripts/build-note.mjs';

test('convertZennToNote should correctly process Zenn-specific Markdown and generate warnings', () => {
  const zennMd = `
## はじめに
:::message
これはZennのメッセージ補足です。
:::
これには、Mermaidの図が含まれます。
\`\`\`mermaid
flowchart TD
  A --> B
\`\`\`
さらに、脚注[^1]もあります。
[^1]: これは注釈です。
`;

  const { cleanMd, htmlText, warnings } = convertZennToNote(zennMd);

  // 1. Check Mermaid removal & warning
  assert.strictEqual(cleanMd.includes('```mermaid'), false);
  assert.strictEqual(cleanMd.includes('Mermaidによる図はスキップされました'), true);
  assert.strictEqual(warnings.some(w => w.code === 'MERMAID_DIAGRAM_SKIPPED'), true);

  // 2. Check Zenn message conversion
  assert.strictEqual(cleanMd.includes('補足メッセージ:'), true);

  // 3. Check Footnote conversion & warning
  assert.strictEqual(cleanMd.includes('*(注1: これは注釈です。)*'), true);
  assert.strictEqual(warnings.some(w => w.code === 'FOOTNOTES_DETECTED'), true);

  // 4. Check basic HTML generation
  assert.strictEqual(htmlText.includes('<h2>はじめに</h2>'), true);
});

test('buildWxrXML should return valid XML containing the article and metadata tags', () => {
  const xml = buildWxrXML({
    title: 'Test Article',
    slug: 'test-slug',
    content: '<p>Hello World</p>',
    tags: ['DevOps', 'CI'],
    dateStr: '2026-09-12T09:00:00+09:00'
  });

  assert.strictEqual(xml.includes('<title>Test Article</title>'), true);
  assert.strictEqual(xml.includes('<wp:post_name><![CDATA[test-slug]]></wp:post_name>'), true);
  assert.strictEqual(xml.includes('<content:encoded><![CDATA[<p>Hello World</p>]]></content:encoded>'), true);
  assert.strictEqual(xml.includes('nicename="DevOps"'), true);
});
