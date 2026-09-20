import { test } from 'node:test';
import assert from 'node:assert';
import { checkArticle, checkMetadiscourse } from '../../scripts/lint/check-zenn.mjs';
import { checkQiitaArticle } from '../../scripts/lint/check-qiita.mjs';
import { checkNoteManuscript } from '../../scripts/lint/check-note.mjs';
import { readJson, Report } from '../../scripts/lint/lib.mjs';

const policyZenn = readJson('lint/policies/zenn.json');
const policyQiita = readJson('lint/policies/qiita.json');
const policyNote = readJson('lint/policies/note.json');
const expressions = readJson('lint/policies/expressions.json');

const BASE_ARTICLE = `---
title: "動くコードと図を備えた技術記事"
emoji: "📚"
type: "tech"
topics: ["nodejs"]
published: false
---

:::message
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。
:::

## 設計

\`\`\`js
const a = 1;
\`\`\`

## 生成AIの利用について

この記事の作成には、生成AIの Claude を使いました。本文の下書きに使っています。筆者が内容を確認しました。公開した内容の責任は筆者が負います。
`;

test('Zenn: metadiscourse patterns are validated and reported under Z13', () => {
  // (a) 「読者が知りたいのは〜でしょう」「先に答えます」が warning で報告される
  const textWithMeta = BASE_ARTICLE + `
読者が知りたいのは何でしょうか。
先に答えを言いますと、それは〇〇です。
`;
  const r = checkArticle('articles/a-valid-slug-name.md', textWithMeta, policyZenn, expressions);
  const z13Warnings = r.warnings.filter((e) => e.code === 'Z13');
  assert.strictEqual(z13Warnings.length, 2, JSON.stringify(z13Warnings));
  assert.ok(z13Warnings.some((w) => mHas(w, '読者')));
  assert.ok(z13Warnings.some((w) => mHas(w, '先に答え')));

  // (b) 「読者のリポジトリでは」は報告されない
  const textSafe = BASE_ARTICLE + `
読者のリポジトリでは設定を確認してください。
`;
  const rSafe = checkArticle('articles/a-valid-slug-name.md', textSafe, policyZenn, expressions);
  assert.strictEqual(rSafe.warnings.filter((e) => e.code === 'Z13').length, 0);

  // (c) 引用ブロック内とコードブロック内は報告されない
  const textInBlock = BASE_ARTICLE + `
> 読者が知りたいのは、それでしょうか。

\`\`\`
読者が知りたいのは何でしょうか。
先に答えを言いますと。
\`\`\`
`;
  const rInBlock = checkArticle('articles/a-valid-slug-name.md', textInBlock, policyZenn, expressions);
  assert.strictEqual(rInBlock.warnings.filter((e) => e.code === 'Z13').length, 0);
});

test('Zenn opt-in: metadiscourse default off patterns are reported with opt-in severity', () => {
  // (d) opt-in `error` の本では「この章では〜を扱います」が error になり、opt-in の無い本では報告されない

  // opt-in なしの場合：default off パターンは報告されない
  const report1 = new Report('zenn');
  checkMetadiscourse(report1, 'dummy.md', 'この章では設計を扱います。', 1, expressions, null);
  assert.strictEqual(report1.warnings.length, 0);
  assert.strictEqual(report1.errors.length, 0);

  // opt-in が "error" の場合：default off パターンが error で報告される
  const report2 = new Report('zenn');
  checkMetadiscourse(report2, 'dummy.md', 'この章では設計を扱います。', 1, expressions, 'error');
  assert.strictEqual(report2.errors.length, 1);
  assert.ok(report2.errors[0].message.includes('この章では'));

  // opt-in が "warning" の場合：default off パターンが warning で報告される
  const report3 = new Report('zenn');
  checkMetadiscourse(report3, 'dummy.md', '本章では設計を説明します。', 1, expressions, 'warning');
  assert.strictEqual(report3.warnings.length, 1);
  assert.ok(report3.warnings[0].message.includes('本章では'));
});

test('Qiita and Note: metadiscourse patterns are reported', () => {
  // (e) Qiita と note でも同じパターンが報告される
  const fmQiita = `---
title: "テスト記事"
tags: [Node.js]
private: true
---
`;
  const textQiita = fmQiita + `
読者が知りたいのは何でしょうか。
先に答えを言いますと、それは〇〇です。
`;
  const rQiita = checkQiitaArticle('platforms/qiita/public/x.md', textQiita, policyQiita, expressions);
  const q18Warnings = rQiita.warnings.filter((e) => e.code === 'Q18');
  assert.strictEqual(q18Warnings.length, 2, JSON.stringify(q18Warnings));

  const fmNote = `---
title: "note 向けの別タイトル"
status: draft
source: articles/some-article.md
canonical_url: https://zenn.dev/takenori-Kusaka/articles/some-article
tags: ["個人開発"]
---
`;
  const textNote = fmNote + `
読者が知りたいのは何でしょうか。
先に答えを言いますと、それは〇〇です。
`;
  const rNote = checkNoteManuscript('platforms/note/public/x.md', textNote, policyNote, expressions);
  const n14Warnings = rNote.warnings.filter((e) => e.code === 'N14');
  assert.strictEqual(n14Warnings.length, 2, JSON.stringify(n14Warnings));
});

function mHas(item, str) {
  return item.message.includes(str);
}
