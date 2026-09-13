import { test } from 'node:test';
import assert from 'node:assert';
import { duplicateRatio, jaccard, shingles, sentenceSet, discoverThemes, checkVariants, sourceFromLinks, headingKeys, sharedHeadingRatio } from '../../scripts/lint/check-variants.mjs';

const SOURCE = `## 設計
本基盤が採用した中核的な設計ポリシーは、同じ本文の複製ではなく同じテーマに基づく個別成果物の管理です。
長文の専門テキストを正本としてGitで一元管理し、そこから媒体別の価値を人間が切り出します。
検証とプレビューと本番公開は GitHub Actions が行います。
`;

test('duplicateRatio counts sentences shared with the source (normalised, min length applied)', () => {
  const copy = SOURCE.replace('## 設計', '# コピー');
  const d = duplicateRatio(copy, SOURCE, 20);
  assert.strictEqual(d.total, 3);
  assert.strictEqual(d.shared.length, 3);
  assert.strictEqual(d.ratio, 1);
  const rewritten = '設計方針は複製ではなく切り出しです。\n正本は Zenn に置きます。\n派生物は短くします。\n';
  assert.strictEqual(duplicateRatio(rewritten, SOURCE, 20).shared.length, 0);
  const partial = '設計方針は複製ではなく切り出しにすると決めました。派生物は短くまとめる方針にしましたので安心です。\n検証とプレビューと本番公開は GitHub Actions が行います。\n';
  const p = duplicateRatio(partial, SOURCE, 20);
  assert.strictEqual(p.shared.length, 1);
  assert.strictEqual(p.total, 3);
  // sentences shorter than the minimum are ignored
  assert.strictEqual(duplicateRatio('短い文。\n' + '検証とプレビューと本番公開は GitHub Actions が行います。\n', SOURCE, 20).total, 1);
});

test('shingles / jaccard measure character-level similarity', () => {
  const a = shingles(SOURCE, 8);
  assert.ok(a.size > 50);
  assert.strictEqual(jaccard(a, a), 1);
  assert.ok(jaccard(a, shingles('まったく別の文章です。', 8)) < 0.01);
  assert.ok(sentenceSet('短い。\n' + '長い文章はここに残ります、句点で終わります。', 10).size === 1);
});

test('sharedHeadingRatio flags a copied section structure but ignores generic headings', () => {
  const generic = ['はじめに', 'まとめ'];
  const source = ['# 正本', '## はじめに', '## 1. 全体構成', '## 2. 承認ゲート（Environment）', '## 3. 公開台帳', '## まとめ'].join('\n\n') + '\n';
  const copy = ['## はじめに', '## 全体構成', '## 承認ゲート', '## 公開台帳', '## まとめ'].join('\n\n') + '\n';
  assert.deepStrictEqual([...headingKeys(source, generic)], ['全体構成', '承認ゲート', '公開台帳']);
  const r = sharedHeadingRatio(copy, source, generic);
  assert.strictEqual(r.total, 3);
  assert.strictEqual(r.ratio, 1);
  const reshaped = ['## はじめに', '## 手で貼り直すのをやめた理由', '## 3 箇所のコアコード', '## 全体構成'].join('\n\n') + '\n';
  const r2 = sharedHeadingRatio(reshaped, source, generic);
  assert.strictEqual(r2.total, 3);
  assert.ok(r2.ratio < 0.5);
  assert.strictEqual(sharedHeadingRatio('本文だけで見出しなし。', source, generic).total, 0);
});

test('discoverThemes maps the shipped variants to their Zenn source', () => {
  const themes = discoverThemes();
  const t = themes.find((x) => x.id === 'multi-platform-publishing-architecture');
  assert.ok(t, 'theme exists');
  assert.strictEqual(t.source, 'articles/multi-platform-publishing-architecture.md');
  assert.strictEqual(t.qiita, 'platforms/qiita/public/multi-platform-publishing-architecture.md');
  assert.strictEqual(t.note, 'platforms/note/public/multi-platform-publishing-architecture.md');
  assert.strictEqual(t.social, 'social/posts/multi-platform-publishing-architecture.yaml');
});

test('sourceFromLinks resolves the Zenn source from article and book-chapter links', () => {
  const policy = { canonical: { zenn_base: 'https://zenn.dev/takenori_kusaka' } };
  assert.deepStrictEqual(sourceFromLinks('正本: https://zenn.dev/takenori_kusaka/books/pit-in-process/viewer/the-structure。', policy), {
    source: 'books/pit-in-process/the-structure.md',
    canonical: 'https://zenn.dev/takenori_kusaka/books/pit-in-process/viewer/the-structure',
  });
  assert.strictEqual(sourceFromLinks('https://zenn.dev/takenori_kusaka/articles/no-such-article', policy), null);
  assert.strictEqual(sourceFromLinks('https://example.com/x', policy), null);
});

test('checkVariants passes on the repository (no copy-paste variants, canonical links present)', () => {
  const r = checkVariants();
  assert.deepStrictEqual(r.errors, [], JSON.stringify(r.errors));
});
