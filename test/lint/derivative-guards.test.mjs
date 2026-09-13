import { test } from 'node:test';
import assert from 'node:assert';
import { claimUnits, findClaimViolations, findUnverifiedClaims, statisticTokens, loadClaims } from '../../scripts/lint/check-variants.mjs';
import { excerptFidelity, checkQiitaArticle } from '../../scripts/lint/check-qiita.mjs';
import { findLocalPaths } from '../../scripts/lint/local-paths.mjs';
import { readJson, readText, splitFrontmatter } from '../../scripts/lint/lib.mjs';

const CANON = 'articles/multi-platform-publishing-architecture.md';
const claims = loadClaims('multi-platform-publishing-architecture', CANON);
const expressions = readJson('lint/policies/expressions.json');
const units = (list) => list.map((text, i) => ({ text, line: i + 1 }));

test('V8: every claims list agrees with its own canonical article', () => {
  assert.ok(claims.length >= 5, 'the claims list is loaded');
  const { body } = splitFrontmatter(readText(CANON));
  assert.deepStrictEqual(findClaimViolations(claimUnits(body), claims).map((h) => `${h.claim.id}: ${h.found}`), []);
});

test('V8: sentences that contradict the canonical are caught, qualified ones are not', () => {
  const bad = [
    'プライバシー保護のため、アップロードされる画像からEXIFを削除するプロセッサーです。',
    '二重投稿は公開台帳が止めます。',
    'タイトルを入力してZennからビルドされたHTML本文を流し込みます。',
    'そのゲートを通過した原稿だけが、世界に送り出される。',
    '人間が承認しないと動かない仕組みにしました。',
    'この境界を、文章の約束ではなく機械の検査として置きました。',
    'さらに検索エンジンは、同じ内容のページが複数あれば重複扱いにし、どれが本物かを判断できなくなります。',
    'そのうち103件は開発者自身による手動です。',
    '派生原稿はPRで機械検査してから投稿します。',
  ];
  const lines = [...new Set(findClaimViolations(units(bad), claims).map((h) => h.unit.line))].sort((a, b) => a - b);
  assert.deepStrictEqual(lines, bad.map((_, i) => i + 1));
  const ok = [
    '公開台帳による二重投稿の拒否は、同じジョブ内では動きます。',
    'Environmentに必須レビュアーを設定すると、承認されるまでジョブはシークレットにアクセスできません。',
    'EXIF除去は実装済みですが、アップロードされる画像から除去する経路にはまだ接続していません。',
  ];
  assert.deepStrictEqual(findClaimViolations(units(ok), claims), []);
});

test('V8: code comments and plain-text blocks are checked too', () => {
  const body = '本文です。\n\n```text\n└── ledger/   # 公開台帳システム（2重投稿防止）\n```\n\n```js\nconst a = 1; // Zennからビルドされた本文を流す\n```\n';
  const hits = findClaimViolations(claimUnits(body), claims).map((h) => h.claim.id).sort();
  assert.deepStrictEqual(hits, ['dedupe-single-job', 'note-written-separately']);
});

test('V9: assertions absent from the canonical are flagged; phrases the canonical itself makes are not', () => {
  const u = units([
    'noteは公式に公開APIを提供していないため、ブラウザ自動操作が必要です。',
    'Playwright はマルチスレッド実行に対応しています。',
    '自動操作フラグを隠滅してBot検知を回避',
    'フルオートで公開します。',
  ]);
  const hits = findUnverifiedClaims(u, expressions.unverified_claims.patterns, '');
  assert.deepStrictEqual([...new Set(hits.map((h) => h.unit.line))], [1, 2, 3, 4]);
  assert.deepStrictEqual(findUnverifiedClaims(u.slice(3), expressions.unverified_claims.patterns, '本文。フルオートで公開します。'), []);
});

test('V10: statistic tokens need at least two digits and a counter', () => {
  const st = readJson('lint/policies/variants.json').statistics;
  assert.deepStrictEqual([...statisticTokens('コミットは108件、4,917行、3箇所、11段階です。', st)].sort(), ['108件', '11段階', '4917行'].sort());
});

test('Q12: code excerpts must match the cited file, and a missing source file is an error', () => {
  const src = readText('scripts/social/graphemes.mjs');
  assert.strictEqual(excerptFidelity(src, src).ratio, 1);
  const invented = 'export function countGraphemes(text) {\n  return text.length * 2;\n}';
  assert.ok(excerptFidelity(invented, src).ratio < 0.8);
  const fm = '---\ntitle: "t"\ntags:\n  - a\nprivate: true\n---\n';
  const md = `${fm}\n\`\`\`js\n// scripts/no/such-file.mjs から抜粋\nconst a = 1;\n\`\`\`\n`;
  assert.ok(checkQiitaArticle('platforms/qiita/public/x.md', md).errors.some((e) => e.code === 'Q12' && e.message.includes('ありません')));
  const cited = `${fm}\n\`\`\`js\n// scripts/social/graphemes.mjs\n${src}\n\`\`\`\n`;
  assert.ok(!checkQiitaArticle('platforms/qiita/public/x.md', cited).errors.some((e) => e.code === 'Q12'));
});

test('local paths are found in prose and code alike', () => {
  assert.deepStrictEqual(findLocalPaths('ok\nE:\\Github\\zenn-content\\\n/home/alice/work\nC:\\Users\\bob\\AppData\\Local').map((h) => h.line), [2, 3, 4]);
  assert.deepStrictEqual(findLocalPaths('scripts/lint/lib.mjs と /usr/bin/env node'), []);
});
