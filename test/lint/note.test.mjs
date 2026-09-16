import { test } from 'node:test';
import assert from 'node:assert';
import { checkNoteManuscript, checkNote } from '../../scripts/lint/check-note.mjs';

const FM = `---
title: "note 向けの別タイトル"
status: draft
source: articles/multi-platform-publishing-architecture.md
canonical_url: https://zenn.dev/takenori_kusaka/articles/multi-platform-publishing-architecture
tags: ["個人開発"]
---
`;
const ESSAY = `
> この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。

## なぜそう決めたのか

私は迷いました。理由は単純で、失敗した経験があったからです。判断の材料を整理します。

${'この段落は分量を満たすための文章です。私の判断と学びを語ります。'.repeat(55)}

正本はこちらです。[記事](https://zenn.dev/takenori_kusaka/articles/multi-platform-publishing-architecture)

## 生成AIの利用について

この記事の作成には、生成AIの Claude を使いました。本文の下書きに使っています。筆者が内容を確認しました。公開した内容の責任は筆者が負います。
`;

test('a narrative manuscript with a canonical link passes', () => {
  const r = checkNoteManuscript('platforms/note/public/x.md', FM + ESSAY);
  assert.deepStrictEqual(r.errors, [], JSON.stringify(r.errors));
  assert.deepStrictEqual(r.warnings, [], JSON.stringify(r.warnings));
});

test('N2/N3: raw code, mermaid, tables, footnotes, containers, html and deep headings are rejected', () => {
  const bad = FM + ESSAY + `
#### 深い見出し

| a | b |
| --- | --- |
| 1 | 2 |

\`\`\`js
const x = 1;
\`\`\`

\`\`\`mermaid
flowchart TD
  A --> B
\`\`\`

インライン \`npm run check\` と脚注[^1] と <b>タグ</b>。

:::message
コンテナ
:::

[^1]: 注
`;
  const r = checkNoteManuscript('platforms/note/public/x.md', bad);
  const msgs = r.errors.map((e) => `${e.code}:${e.message.slice(0, 12)}`);
  assert.ok(r.errors.some((e) => e.code === 'N2' && e.message.includes('コードブロック')), msgs.join('\n'));
  assert.ok(r.errors.some((e) => e.code === 'N2' && e.message.includes('Mermaid')));
  assert.ok(r.errors.some((e) => e.code === 'N2' && e.message.includes('インラインコード')));
  assert.ok(r.errors.some((e) => e.code === 'N3' && e.message.includes('表')));
  assert.ok(r.errors.some((e) => e.code === 'N3' && e.message.includes('脚注')));
  assert.ok(r.errors.some((e) => e.code === 'N3' && e.message.includes('Zenn 固有')));
  assert.ok(r.errors.some((e) => e.code === 'N3' && e.message.includes('HTML')));
  assert.ok(r.errors.some((e) => e.code === 'N3' && e.message.includes('h4')));
});

test('N3/N4/N6 edge cases: pipe-less GFM tables, autolinks, URL followed by Japanese, first-person substrings', () => {
  const gfm = checkNoteManuscript('platforms/note/public/x.md', FM + ESSAY + '\n列1 | 列2\n--- | ---\n1 | 2\n');
  assert.ok(gfm.errors.some((e) => e.code === 'N3' && e.message.includes('表')));
  const auto = checkNoteManuscript('platforms/note/public/x.md', FM + ESSAY + '\n自動リンク <https://example.com/x> です。\n');
  assert.ok(!auto.errors.some((e) => e.code === 'N3' && e.message.includes('HTML')));
  const glued = checkNoteManuscript('platforms/note/public/x.md', FM + ESSAY.replace(/\[記事\]\([^)]+\)/, '') + '\n正本はhttps://zenn.dev/takenori_kusaka/articles/multi-platform-publishing-architectureに書きました。\n');
  assert.ok(!glued.errors.some((e) => e.code === 'N4'), 'URL directly followed by Japanese still counts as the canonical link');
  const fake = checkNoteManuscript('platforms/note/public/x.md', FM + ESSAY.replace(/私は迷いました。/, '私企業の話です。').replace(/私の判断と学びを語ります。/g, '判断と学びを語ります。'));
  assert.ok(fake.warnings.some((w) => w.code === 'N6' && w.message.includes('一人称')), '私企業 is not first person');
});

test('N1/N4/N6/N8: frontmatter, canonical link, narrative and title rules', () => {
  const noFm = checkNoteManuscript('platforms/note/public/x.md', '本文だけ');
  assert.ok(noFm.errors.some((e) => e.code === 'N1'));

  const badFm = `---\ntitle: "Gitで管理し、CIで検証する「マルチプラットフォーム個人出版」の設計と実装"\nstatus: live\nsource: articles/none.md\ncanonical_url: https://example.com/x?utm_source=a\n---\n` + '短い。';
  const r = checkNoteManuscript('platforms/note/public/x.md', badFm);
  const n1 = r.errors.filter((e) => e.code === 'N1').map((e) => e.message);
  assert.ok(n1.some((m) => m.includes('status')));
  assert.ok(n1.some((m) => m.includes('存在しません')));
  assert.ok(n1.some((m) => m.includes('ホスト')));
  assert.ok(n1.some((m) => m.includes('utm_')));
  assert.ok(r.errors.some((e) => e.code === 'N4'));
  assert.ok(r.warnings.some((w) => w.code === 'N6'));

  // N5 の下限は 2026-09-16 に外した。上限だけが残る(網羅は正本に任せる)
  const huge = FM + 'あ。'.repeat(6000);
  assert.ok(checkNoteManuscript('platforms/note/public/x.md', huge).errors.some((e) => e.code === 'N5'));
  assert.ok(!checkNoteManuscript('platforms/note/public/x.md', FM + ESSAY).errors.some((e) => e.code === 'N5'), '短い原稿でも N5 は出ない');

  const sameTitle = FM.replace('note 向けの別タイトル', 'Gitで管理し、CIで検証する「マルチプラットフォーム個人出版」の設計と実装') + ESSAY;
  assert.ok(checkNoteManuscript('platforms/note/public/x.md', sameTitle).errors.some((e) => e.code === 'N8'));
});

test('the shipped note manuscript passes', () => {
  const r = checkNote();
  assert.deepStrictEqual(r.errors, [], JSON.stringify(r.errors));
});
