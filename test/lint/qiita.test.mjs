import { test } from 'node:test';
import assert from 'node:assert';
import { checkQiitaArticle, checkQiita } from '../../scripts/lint/check-qiita.mjs';

const FM = `---
title: "テスト記事"
tags:
  - Node.js
private: true
updated_at: ''
---
`;
const CODE = (n) => Array.from({ length: n }, (_, i) => `\n\`\`\`js\nconst v${i} = ${i};\n\`\`\`\n`).join('');
const LONG = 'この文章は本文の分量を満たすための説明です。'.repeat(80);

function good() {
  return `${FM}
:::note info
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。
:::

# はじめに

正本はこちら: [Zenn](https://zenn.dev/takenori_kusaka/articles/some-article) / [GitHub](https://github.com/Takenori-Kusaka/publishing-hub)

## 技術選定理由

[Playwright](https://playwright.dev/) と [AT Protocol](https://atproto.com/) を採用しました。

${LONG}
${CODE(3)}

## 生成AIの利用について

この記事の作成には、生成AIの Claude を使いました。本文の下書きに使っています。筆者が内容を確認しました。公開した内容の責任は筆者が負います。
`;
}

test('a well-formed Qiita variant passes all Q rules', () => {
  const r = checkQiitaArticle('platforms/qiita/public/x.md', good());
  assert.deepStrictEqual(r.errors, []);
});

test('Q1/Q2/Q3/Q4/Q5/Q6 fire on a thin copy-paste article', () => {
  const text = `${FM}
# はじめに

短い本文です。

## 手順

\`\`\`sh
npm i
\`\`\`
`;
  const r = checkQiitaArticle('platforms/qiita/public/x.md', text);
  const codes = new Set(r.errors.map((e) => e.code));
  for (const c of ['Q2', 'Q3', 'Q4', 'Q6']) assert.ok(codes.has(c), `${c} expected`);
  // Q1(長さの下限)と Q18(但し書きの数)は 2026-09-16 に削除した。長さと定型文の数で質は測れない
  assert.ok(!codes.has('Q1'), 'Q1 is gone');
});

test('Q6 requires the canonical link near the top, not anywhere', () => {
  const text = good().replace('正本はこちら: [Zenn](https://zenn.dev/takenori_kusaka/articles/some-article) / [GitHub](https://github.com/Takenori-Kusaka/publishing-hub)', '') + '\n\n' + '補足の段落です。\n\n'.repeat(30) + '末尾: [GitHub](https://github.com/Takenori-Kusaka/publishing-hub)\n';
  const r = checkQiitaArticle('platforms/qiita/public/x.md', text);
  assert.ok(r.errors.some((e) => e.code === 'Q6'));
  assert.ok(!r.errors.some((e) => e.code === 'Q3'), 'GitHub link anywhere satisfies Q3');
});

test('Q7 validates frontmatter tags and title length, Q5b warns on oversized blocks, Q8 warns on hype, Q9 rejects Zenn-only syntax', () => {
  const many = `---\ntitle: "${'長'.repeat(120)}"\ntags: [a, b, c, d, e, f]\nprivate: true\n---\n` + good().slice(FM.length) + `\n:::message\nZenn だけの記法\n:::\n\n![img](/images/x.png)\n\n絶対に読んでください。\n\n\`\`\`js\n${'x\n'.repeat(100)}\`\`\`\n`;
  const r = checkQiitaArticle('platforms/qiita/public/x.md', many);
  assert.ok(r.errors.some((e) => e.code === 'Q7' && e.message.includes('tags')));
  assert.ok(r.warnings.some((w) => w.code === 'Q7' && w.message.includes('title')));
  assert.ok(r.warnings.some((w) => w.code === 'Q5b'));
  assert.ok(r.warnings.some((w) => w.code === 'Q8'));
  assert.strictEqual(r.errors.filter((e) => e.code === 'Q9').length, 2);
});

test('Q5 ignores text and unlabeled fences, and Q4 ignores images and badge hosts', () => {
  const codeOnly = `${FM}\n# はじめに\n\n[Zenn](https://zenn.dev/takenori_kusaka/articles/a) [GitHub](https://github.com/Takenori-Kusaka/x)\n\n## 技術選定理由\n\n短い。\n\n\`\`\`js\n${'const x = 1;\n'.repeat(120)}\`\`\`\n\n\`\`\`text\nout\n\`\`\`\n\n\`\`\`\nplain\n\`\`\`\n\n![b](https://img.shields.io/badge.svg) ![c](https://raw.githubusercontent.com/x/y.png)\n`;
  const r = checkQiitaArticle('platforms/qiita/public/x.md', codeOnly);
  const codes = new Set(r.errors.map((e) => e.code));
  assert.ok(codes.has('Q4'), 'badges and raw images are not reference links');
  assert.ok(!codes.has('Q5'), 'one labeled block is enough now (min: 1)');
});

test('Q10: an unsynced article must be private or ignorePublish; a synced public article passes', () => {
  const unsyncedPublic = good().replace('private: true', 'private: false');
  assert.ok(checkQiitaArticle('platforms/qiita/public/x.md', unsyncedPublic).errors.some((e) => e.code === 'Q10'));
  assert.ok(!checkQiitaArticle('platforms/qiita/public/x.md', good()).errors.some((e) => e.code === 'Q10'), 'private: true passes');
  const ignore = unsyncedPublic.replace('private: false', 'private: false\nignorePublish: true');
  assert.ok(!checkQiitaArticle('platforms/qiita/public/x.md', ignore).errors.some((e) => e.code === 'Q10'));
  const synced = unsyncedPublic.replace('private: false', 'private: false\nid: 2cbb8255e84e97dc150d');
  assert.ok(!checkQiitaArticle('platforms/qiita/public/x.md', synced).errors.some((e) => e.code === 'Q10'));
});

test('Q9 ignores Zenn syntax shown inside code blocks', () => {
  const text = good() + '\n```md\n:::message\nZenn の記法例\n:::\n![x](/images/a.png)\n```\n';
  assert.ok(!checkQiitaArticle('platforms/qiita/public/x.md', text).errors.some((e) => e.code === 'Q9'));
});

test('checkQiita skips legacy synced articles and passes the current repository', () => {
  const r = checkQiita();
  assert.deepStrictEqual(r.errors, [], JSON.stringify(r.errors));
  assert.ok(r.notes.some((n) => n.includes('過去記事')));
});
