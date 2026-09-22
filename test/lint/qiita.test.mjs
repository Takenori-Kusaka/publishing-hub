import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { checkQiitaArticle, checkQiita, checkQiitaFile, qiitaCliFrontmatterProblems } from '../../scripts/lint/check-qiita.mjs';
import { Report } from '../../scripts/lint/lib.mjs';

const require = createRequire(import.meta.url);

// Qiita CLI が同期に求めるキー(id / organization_url_name / slide。Q19)を含めた、未同期の記事の frontmatter
const FM = `---
title: "テスト記事"
tags:
  - Node.js
private: true
updated_at: ''
id: null
organization_url_name: null
slide: false
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

test('Q10: off in the repository policy, so an unsynced article is created public (owner decision 2026-09-22)', () => {
  const policy = JSON.parse(fs.readFileSync('lint/policies/qiita.json', 'utf8'));
  assert.strictEqual(policy.publish_gate.unsynced_must_be_private, false, 'Q10 is off: articles are created public');
  const unsyncedPublic = good().replace('private: true', 'private: false');
  assert.notStrictEqual(unsyncedPublic, good(), 'the fixture carries private: true to replace');
  assert.ok(!checkQiitaArticle('platforms/qiita/public/x.md', unsyncedPublic).errors.some((e) => e.code === 'Q10'), 'an unsynced public article passes');
});

test('Q10: turning the policy value back to true stops an unsynced public article again', () => {
  const on = JSON.parse(fs.readFileSync('lint/policies/qiita.json', 'utf8'));
  on.publish_gate.unsynced_must_be_private = true;
  const unsyncedPublic = good().replace('private: true', 'private: false');
  assert.ok(checkQiitaArticle('platforms/qiita/public/x.md', unsyncedPublic, on).errors.some((e) => e.code === 'Q10'));
  assert.ok(!checkQiitaArticle('platforms/qiita/public/x.md', good(), on).errors.some((e) => e.code === 'Q10'), 'private: true passes');
  const ignore = unsyncedPublic.replace('private: false', 'private: false\nignorePublish: true');
  assert.ok(!checkQiitaArticle('platforms/qiita/public/x.md', ignore, on).errors.some((e) => e.code === 'Q10'));
  const synced = unsyncedPublic.replace('id: null', 'id: 2cbb8255e84e97dc150d');
  assert.notStrictEqual(synced, unsyncedPublic, 'the fixture carries id: null to replace');
  assert.ok(!checkQiitaArticle('platforms/qiita/public/x.md', synced, on).errors.some((e) => e.code === 'Q10'));
});

test('Q11: a declaration left at the end is an error (Qiita requires only the top notice)', () => {
  assert.ok(!checkQiitaArticle('platforms/qiita/public/x.md', good()).errors.some((e) => e.code === 'Q11'));
  const leftover = good() + '\n## 生成AIの利用について\n\nこの記事の作成には、生成AIの Claude を使いました。筆者が内容を確認しました。\n';
  const q11 = checkQiitaArticle('platforms/qiita/public/x.md', leftover).errors.filter((e) => e.code === 'Q11');
  assert.strictEqual(q11.length, 1, JSON.stringify(q11));
  assert.ok(q11[0].message.includes('残っています'));
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

test('Q19: an article missing the keys the Qiita CLI requires is an error (the d2-tala sync failure)', () => {
  // PR #44 の Qiita 版は title / tags / private / updated_at だけを書き、Qiita CLI の同期が 2 回続けて全件止まった
  const bare = good().replace('id: null\norganization_url_name: null\nslide: false\n', '');
  assert.notStrictEqual(bare, good(), 'the keys were removed');
  const q19 = checkQiitaArticle('platforms/qiita/public/x.md', bare).errors.filter((e) => e.code === 'Q19');
  assert.deepStrictEqual(
    q19.map((e) => e.message.match(/frontmatter の (\S+?) が/)[1]),
    ['id', 'organization_url_name', 'slide'],
  );
  assert.ok(q19.some((e) => e.message.includes('idは文字列で入力してください')), 'the message quotes the CLI error');
});

test('Q19: ignorePublish: true is not synced by the CLI, so its frontmatter is not checked', () => {
  const bare = good().replace('id: null\norganization_url_name: null\nslide: false\n', 'ignorePublish: true\n');
  assert.ok(!checkQiitaArticle('platforms/qiita/public/x.md', bare).errors.some((e) => e.code === 'Q19'));
  const notIgnored = bare.replace('ignorePublish: true', 'ignorePublish: false');
  assert.ok(checkQiitaArticle('platforms/qiita/public/x.md', notIgnored).errors.some((e) => e.code === 'Q19'), 'ignorePublish: false is synced');
});

test('Q19: a complete frontmatter passes, and an unquoted timestamp is read as a date as the CLI reads it', () => {
  assert.ok(!checkQiitaArticle('platforms/qiita/public/x.md', good()).errors.some((e) => e.code === 'Q19'));
  const dated = good().replace("updated_at: ''", 'updated_at: 2026-09-21T23:27:31+09:00');
  const e = checkQiitaArticle('platforms/qiita/public/x.md', dated).errors.filter((x) => x.code === 'Q19');
  assert.strictEqual(e.length, 1, JSON.stringify(e));
  assert.ok(e[0].message.includes('updated_at') && e[0].message.includes('日付'));
});

test('Q19 reports exactly what the Qiita CLI reports for the same file', async () => {
  // 条件を写した check-qiita.mjs と、node_modules の Qiita CLI そのもの(記事の読み込みと型の検査)を突き合わせる。
  // CLI を上げて条件が変わったら、ここで食い違いが出る
  const { checkFrontmatterType } = require('@qiita/qiita-cli/dist/lib/check-frontmatter-type.js');
  const { FileSystemRepo } = require('@qiita/qiita-cli/dist/lib/file-system-repo.js');
  const base = ['title: "t"', 'tags:\n  - Node.js', 'private: true', "updated_at: ''", 'id: null', 'organization_url_name: null', 'slide: false'];
  const without = (...keys) => base.filter((l) => !keys.some((k) => l.startsWith(`${k}:`)));
  const cases = {
    complete: base,
    synced: [...without('id', 'private'), 'id: 2cbb8255e84e97dc150d', 'private: false'],
    missingCliKeys: without('id', 'organization_url_name', 'slide'),
    nothing: ['title: "t"'],
    unquotedDate: [...without('updated_at'), 'updated_at: 2026-09-21T23:27:31+09:00'],
    wrongTypes: [...without('title', 'tags', 'private', 'id', 'slide'), 'title: 1', 'tags: Node.js', 'private: "false"', 'id: 12345', 'slide: "false"'],
    campaign: [...base, 'posting_campaign_uuid: 1', 'agreed_posting_campaign_term: "yes"'],
    campaignOk: [...base, 'posting_campaign_uuid: null', 'agreed_posting_campaign_term: false'],
    ignored: [...without('id', 'organization_url_name', 'slide'), 'ignorePublish: true'],
    notIgnored: [...without('id', 'organization_url_name', 'slide'), 'ignorePublish: false'],
  };
  const reported = {};
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qiita-q19-'));
  try {
    const repo = await FileSystemRepo.build({ dataRootDir: dir });
    for (const [name, lines] of Object.entries(cases)) {
      const text = `---\n${lines.join('\n')}\n---\n本文\n`;
      fs.writeFileSync(path.join(dir, 'public', `${name}.md`), text);
      const item = await repo.loadItemByBasename(name);
      assert.ok(item, `${name}: the CLI loads the file`);
      // qiita publish --all は ignorePublish === true の記事を対象から外してから型を調べる(dist/commands/publish.js)
      const cli = item.ignorePublish === true ? [] : checkFrontmatterType(item);
      const ours = qiitaCliFrontmatterProblems(text);
      assert.ok(Array.isArray(ours), `${name}: ${JSON.stringify(ours)}`);
      assert.deepStrictEqual(ours.map((p) => p.cli), cli, name);
      reported[name] = cli.length;
    }
    // 突き合わせが空振りしていないこと(CLI が実際にエラーを出す場合を含む)
    assert.strictEqual(reported.complete, 0);
    assert.strictEqual(reported.missingCliKeys, 3);
    assert.strictEqual(reported.nothing, 6);
    assert.strictEqual(reported.ignored, 0);
    assert.strictEqual(reported.notIgnored, 3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Q19 also applies to a synced article (id is 20 hex), including a legacy file that is otherwise not checked', () => {
  // 同期済みの記事でも、Qiita 上の記事から変更すれば CLI は型を調べる。Q19 はリモートの状態を知らないので、変更の有無に関わらず掛ける
  const ID = '0a1b2c3d4e5f6a7b8c9d';
  const synced = good().replace('private: true', 'private: false').replace('id: null', `id: ${ID}`);
  assert.ok(!checkQiitaArticle('platforms/qiita/public/x.md', synced).errors.some((e) => e.code === 'Q19'), 'a synced article with every key passes');
  const syncedNoSlide = synced.replace('slide: false\n', '');
  assert.notStrictEqual(syncedNoSlide, synced, 'the fixture carries slide: false to remove');
  const q19 = checkQiitaArticle('platforms/qiita/public/x.md', syncedNoSlide).errors.filter((e) => e.code === 'Q19');
  assert.deepStrictEqual(q19.map((e) => e.message.match(/frontmatter の (\S+?) が/)[1]), ['slide']);

  // 過去記事(ファイル名が 20 桁 hex)は、校正・構造の検査を外し、Q19 だけを見る(checkQiita の分岐)
  const legacyFile = `platforms/qiita/public/${ID}.md`;
  const legacyText = `---\ntitle: 過去記事\ntags:\n  - AWS\nprivate: false\nupdated_at: '2022-03-17T21:15:08+09:00'\nid: ${ID}\norganization_url_name: null\n---\n本文だけの記事です。\n`;
  const r = new Report('qiita');
  assert.strictEqual(checkQiitaFile(r, legacyFile, legacyText), true, 'a 20-hex file name takes the legacy branch');
  assert.deepStrictEqual(r.errors.map((e) => e.code), ['Q19'], JSON.stringify(r.errors));
  assert.ok(r.errors[0].message.includes('slide'), r.errors[0].message);
  const ok = new Report('qiita');
  checkQiitaFile(ok, legacyFile, legacyText.replace('organization_url_name: null\n', 'organization_url_name: null\nslide: false\n'));
  assert.deepStrictEqual(ok.errors, [], 'a legacy file with every key passes');
  // 同じ本文を過去記事でない名前で読むと、構造の検査(Q2 など)も掛かる = 上の結果は過去記事の分岐のもの
  const current = new Report('qiita');
  assert.strictEqual(checkQiitaFile(current, 'platforms/qiita/public/x.md', legacyText), false);
  assert.ok(current.errors.some((e) => e.code !== 'Q19'), JSON.stringify(current.errors.map((e) => e.code)));
});
