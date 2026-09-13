import { test } from 'node:test';
import assert from 'node:assert';
import { claimUnits, findClaimViolations, findUnverifiedClaims, statisticTokens, loadClaims, kanjiToNumber } from '../../scripts/lint/check-variants.mjs';
import { excerptFidelity, missingGates, checkQiitaArticle } from '../../scripts/lint/check-qiita.mjs';
import { reviewStatus } from '../../scripts/lint/check-human-review.mjs';
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

test('V8: round-2 evasions are caught (unless far away, rephrased SEO, completed approval, SNS length, effort, JIS)', () => {
  const bad = [
    'ローカルから手動で投稿する運用は、誤公開やAPIトークンなどの機密情報の漏洩リスクを孕んでいます。',
    'そこから異なる媒体別の価値を人間が明示的に切り出します。',
    'リポジトリへのプッシュを契機に以下の検証をGitHub Actions上で強制実行（Gate）しています。',
    'さらに、同じ内容のページに重複があると、どれを本物と見なすか判断しにくくなるおそれもあります。',
    'せっかくの正本の評価について、薄まるおそれがあると考えたのです。',
    'だから私は、公開ボタンを人間の承認の後ろに置きました。',
    'この境界を、指示書によるルールだけでなく、Qiitaの未同期記事の検査やSNSの承認といった機械の検査としても置きました。',
    'ルールは忘れられますが、検査は忘れないからです。',
    'SNSには、正本へ向かう300字の導線だけを。',
    '書く時間より、貼って直す時間のほうが長い日もあるのだと。',
    '1本の記事を書く手間が、以前より増えました。',
    '常用漢字を外れた中国語簡体字の混入を検知します。',
    'まだ誰も気づいていませんが、ここでは設計の話をしてから、二重投稿を防止します。',
  ];
  const lines = [...new Set(findClaimViolations(units(bad), claims).map((h) => h.unit.line))].sort((a, b) => a - b);
  assert.deepStrictEqual(lines, bad.map((_, i) => i + 1));
});

test('V10: kanji and full-width numerals are counted', () => {
  const st = readJson('lint/policies/variants.json').statistics;
  assert.strictEqual(kanjiToNumber('四千九百十七'), 4917);
  assert.strictEqual(kanjiToNumber('二十六'), 26);
  assert.deepStrictEqual([...statisticTokens('二十六ファイル、四千九百十七行、９３件', st)].sort(), ['26ファイル', '4917行', '93件'].sort());
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
    '環境依存になりやすいネイティブパッケージ（Sharpなど）を使わずに実装しました。',
    '深夜にそんな想像をして、何度か手が止まりました。',
    'const headless = !isWindows; // Headful on Windows to bypass anti-bot',
    '全自動化しています。',
  ]);
  const hits = findUnverifiedClaims(u, expressions.unverified_claims.patterns, '');
  assert.deepStrictEqual([...new Set(hits.map((h) => h.unit.line))].sort((x, y) => x - y), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepStrictEqual(findUnverifiedClaims(u.slice(3, 4), expressions.unverified_claims.patterns, '本文。フルオートで公開します。'), []);
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

test('Q12: a rewritten end-of-line comment is not verbatim, and skipping an @gate branch is reported', () => {
  const src = readText('scripts/publish-note.mjs');
  const line = src.split(/\r?\n/).find((l) => l.includes('const headless ='));
  assert.ok(line, 'the headless line exists');
  assert.strictEqual(excerptFidelity(line, src).ratio, 1);
  const rewritten = line.replace(/\/\/.*$/, '// Windows ではローカル、Linux では CI');
  assert.strictEqual(excerptFidelity(rewritten, src).ratio, 0);
  const clicks = src.split(/\r?\n/).filter((l) => /\.click\(\)/.test(l));
  assert.ok(clicks.length, 'the publish clicks exist');
  const noGate = ['// scripts/publish-note.mjs', '// ...', ...clicks].join('\n');
  assert.strictEqual(missingGates(noGate, src).length, 3);
  const gateLines = src.split(/\r?\n/).filter((l, i, a) => i > 0 && /@gate\b/.test(a[i - 1]));
  const withGates = ['// scripts/publish-note.mjs', ...gateLines, '// ...', ...clicks].join('\n');
  assert.deepStrictEqual(missingGates(withGates, src), []);
});

test('H1: an AI co-authored change to a public manuscript needs a later human Reviewed-by', () => {
  const f = 'platforms/qiita/public/x.md';
  const c = (o) => ({ sha: o.sha, coAuthors: o.co || [], reviewers: o.rev || [], reviewedPaths: o.paths || [], touches: Boolean(o.touches) });
  assert.deepStrictEqual(reviewStatus([c({ sha: 'b', touches: true })], f), { needed: false, reviewed: true });
  assert.strictEqual(reviewStatus([c({ sha: 'a', touches: true, co: ['Gemini CLI'] })], f).reviewed, false);
  assert.strictEqual(reviewStatus([c({ sha: 'r', rev: ['Takenori Kusaka'], paths: [f] }), c({ sha: 'a', touches: true, co: ['Gemini CLI'] })], f).reviewed, true);
  assert.strictEqual(reviewStatus([c({ sha: 'r', rev: ['Claude Opus 5'], paths: [f] }), c({ sha: 'a', touches: true, co: ['Gemini CLI'] })], f).reviewed, false, 'an AI cannot review');
  assert.strictEqual(reviewStatus([c({ sha: 'a2', touches: true, co: ['Claude Opus 5'] }), c({ sha: 'r', rev: ['Takenori Kusaka'], touches: true }), c({ sha: 'a', touches: true, co: ['Gemini CLI'] })], f).reviewed, false, 'a newer AI change needs a new review');
});

test('local paths are found in prose and code alike', () => {
  assert.deepStrictEqual(findLocalPaths('ok\nE:\\Github\\zenn-content\\\n/home/alice/work\nC:\\Users\\bob\\AppData\\Local').map((h) => h.line), [2, 3, 4]);
  assert.deepStrictEqual(findLocalPaths('scripts/lint/lib.mjs と /usr/bin/env node'), []);
});
