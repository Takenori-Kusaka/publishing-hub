import { test } from 'node:test';
import assert from 'node:assert';
import { claimUnits, findClaimViolations, findUnverifiedClaims, statisticTokens, loadClaims, kanjiToNumber, findTitleMisquotes, findMissingCaveats, loadCaveats, findStaleConnectives, findAlteredQuotes, dice } from '../../scripts/lint/check-variants.mjs';
import { findSingleEmphasis } from '../../scripts/lint/check-note.mjs';
import { excerptFidelity, missingGates, checkQiitaArticle, silentGaps, treePaths } from '../../scripts/lint/check-qiita.mjs';
import { reviewStatus } from '../../scripts/lint/check-human-review.mjs';
import { findLocalPaths } from '../../scripts/lint/local-paths.mjs';
import { readJson, readText, splitFrontmatter } from '../../scripts/lint/lib.mjs';

const CANON = 'articles/multi-platform-publishing-architecture.md';
const claims = loadClaims('multi-platform-publishing-architecture', CANON);
const expressions = readJson('lint/policies/expressions.json');
const variantsPolicy = readJson('lint/policies/variants.json');
const units = (list) => list.map((text, i) => ({ text, line: i + 1 }));
const flaggedLines = (list) => [...new Set(findClaimViolations(units(list), claims).map((h) => h.unit.line))].sort((a, b) => a - b);

test('V8: every claims list agrees with its own canonical article', () => {
  assert.ok(claims.length >= 5, 'the claims list is loaded');
  const { body } = splitFrontmatter(readText(CANON));
  const u = claimUnits(body);
  assert.ok(u.some((x) => x.text.includes('同じジョブ内では動きます')), 'the canonical prose is not masked away');
  assert.deepStrictEqual(findClaimViolations(u, claims).map((h) => `${h.claim.id}: ${h.found}`), []);
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
  assert.deepStrictEqual(flaggedLines(bad), bad.map((_, i) => i + 1));
  const ok = [
    '公開台帳による二重投稿の拒否は、同じジョブ内では動きます。',
    'しかし実行をまたいだ拒否は動きません。',
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
  assert.deepStrictEqual(flaggedLines(bad), bad.map((_, i) => i + 1));
});

test('V8: round-3 evasions are caught (synonyms, kanji numerals, per-pattern exceptions, euphemisms)', () => {
  const bad = [
    '公開の判断とスイッチ操作を人が引き受けることで、手作業による誤公開を防ぎながら、安全な発信基盤を構築できます。',
    'Zennの記事・本を唯一の真実のソース（SSOT）とし、GitHub Actions（自動テスト）と安全に結合した自動パブリッシング基盤',
    '公開台帳システム（同一ジョブ内の2重投稿防止、実行をまたぐ場合の制限あり）',
    '精度に満足したものを、GitHub Actionsと専用のバリデーションエンジンにより、検証・プレビュー・本番公開を一元化します。',
    'だから私は、GitHub側で承認用の環境を設定すれば、公開処理を人間の手で制御できるように設計しました。',
    'SNSには、LinkedInなら千文字前後の短論考、Blueskyなら書記素数の上限に合わせた短い気づきを置きます。',
    '記述量の上限が緩やかでGitHubのブランチを登録すると自動で変更が同期されるためです。',
    '思いのほか心理的な負担になっていることに気づいたのです。',
    'この境界は、人間との約束事（指示書）として定めています。',
    '一部のブラウザ自動操作を補助する設定を含んでいます。',
    '│   └── note/   # note 変換アセット',
    'これらを活用して、価値あるアウトプットを効率的に配信できます。',
  ];
  assert.deepStrictEqual(flaggedLines(bad), bad.map((_, i) => i + 1));
});

test('V8: round-4 evasions are caught (safety synonyms, switch as trigger, units, license, euphemised effort, length)', () => {
  const bad = [
    '公開のスイッチを媒体ごとに人間が操作するように設計し、下書きまでの作成を機械と分業することで、安全な発信環境を構築しています。',
    'しかし実際に投稿する瞬間だけは、人間が手動で公開処理を起動する仕組みにしました。',
    '「1,500文字以上」「コードブロック3箇所以上」「公式ドキュメントリンク2ホスト以上」をルール化し、検証します。',
    'JIS X 0208 の文字集合から外れた文字の混入を検知します。',
    '構築された完全なオープンソースコードは、以下のGitHubリポジトリにて公開しています。',
    '    └── ledger/                        # 同一ジョブ内での二重投稿防止のための台帳',
    'そして、各媒体に手動で記事を移設する作業の重さを実感したのです。',
    '目の前のエラーを解く手順はQiitaのほうが探してもらえる。',
    'Qiitaには、選定理由と核になる実装だけを短く。',
    '私は個人で発信しているので、使える時間は限られています。',
    'それを一度決めてしまえば、個人の発信をより見通しのよい形で運用できるようになります。',
    '同じ理由で、媒体ごとの書き方の違いも検査にしました。',
    '手動起動の安全なジョブで投稿します。',
    'Zenn, Qiita, note, LinkedIn, Blueskyの多重管理をGitとActionsで一元化するセキュアな設計仕様。',
    '個人発信のトーンを崩す「私たち」「弊社」などの主語を検知します。',
  ];
  assert.deepStrictEqual(flaggedLines(bad), bad.map((_, i) => i + 1));
  const ok = [
    'Qiita の検査は、散文（コード・URL を除く）1,500字以上を求めます。',
    'リポジトリは CC BY 4.0（Creative Commons Attribution 4.0）で公開しています。',
    'SNS の公開だけは、人が手動でワークフローを起動します。',
    '公開台帳による二重投稿の拒否は同じジョブ内だけで、実行をまたぐと動きません。',
    '読者が検索から来るのはQiitaのほうが多いと、筆者は見立てています。',
  ];
  assert.deepStrictEqual(findClaimViolations(units(ok), claims), []);
});

test('V13: a connective whose antecedent was removed or rewritten is reported', () => {
  const pattern = variantsPolicy.connectives.pattern;
  const base = '## 分業\n\nこの判断で失ったものもあります。1本の記事を書く手間が、以前より増えました。\n\nしかし考える時間は、書く技術を鍛える時間でもありました。\n';
  const stale = '## 分業\n\n正本に評価が集まるようにします。\n\nしかし、考える時間は、書く技術を鍛える時間でもありました。\n';
  const hits = findStaleConnectives(stale, base, pattern);
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0].removed.text, '1本の記事を書く手間が、以前より増えました。');
  assert.deepStrictEqual(findStaleConnectives(base, base, pattern), [], 'no change, no finding');
  const fixed = stale.replace('しかし、考える時間は、書く技術を鍛える時間でもありました。', 'どの媒体の原稿にも、正本へのリンクを置きます。');
  assert.deepStrictEqual(findStaleConnectives(fixed, base, pattern), [], 'the connective sentence was rewritten too');
});

test('V11: a quotation that rewrites a canonical quote is reported; exact and short quotes are not', () => {
  const canon = '派生物の設計原則は「同じ本文の複製ではなく、同じテーマに基づく個別の成果物」です。';
  const altered = '中核的な設計ポリシーは「**同じ本文の単純複製ではなく、同じテーマに基づく個別成果物（バリアント）の管理**」です。';
  const hits = findAlteredQuotes(altered, canon, variantsPolicy.quotes);
  assert.strictEqual(hits.length, 1);
  assert.ok(hits[0].score >= 0.6 && hits[0].score < 1);
  assert.deepStrictEqual(findAlteredQuotes(canon.replace('派生物', '記事'), canon, variantsPolicy.quotes), []);
  assert.deepStrictEqual(findAlteredQuotes('この「貼る仕事」は面倒でした。', canon, variantsPolicy.quotes), []);
  assert.strictEqual(dice('abc', 'abc'), 1);
});

test('V9: evasion in code lines is an error-level finding; other patterns ignore code', () => {
  const u = [
    { text: "  args: ['--disable-blink-features=AutomationControlled']", line: 1, kind: 'code' },
    { text: 'const mode = fullAuto; // フルオート', line: 2, kind: 'comment' },
    { text: 'const fullAuto = true; フルオート', line: 3, kind: 'code' },
    { text: 'Windows/Linux両対応のスクリプトです。公式が開発保守しているため仕様変更に強い。', line: 4, kind: 'prose' },
  ];
  const hits = findUnverifiedClaims(u, expressions.unverified_claims.patterns, '');
  assert.ok(hits.some((h) => h.unit.line === 1 && h.severity?.qiita === 'error'));
  assert.ok(hits.some((h) => h.unit.line === 2));
  assert.ok(!hits.some((h) => h.unit.line === 3), 'non-evasion patterns do not look at code');
  assert.deepStrictEqual([...new Set(hits.filter((h) => h.unit.line === 4).map((h) => h.label))].sort(), ['外部製品の性質の断定', '対応範囲の断定'].sort());
});

test('V11 / V12 / N3: title misquotes, missing caveats for excerpted parts, single emphasis', () => {
  const canon = 'https://zenn.dev/takenori_kusaka/articles/multi-platform-publishing-architecture';
  const title = 'Gitで管理し、CIで検証する「マルチプラットフォーム個人出版」の設計と実装';
  const links = [
    { url: canon, text: 'Gitで管理し、自動テストで検証する「マルチプラットフォーム個人出版」の設計と実装' },
    { url: canon, text: title },
    { url: canon, text: '正本' },
  ];
  assert.strictEqual(findTitleMisquotes(links, canon, title).length, 1);
  const caveats = loadCaveats('multi-platform-publishing-architecture');
  const body = '## 画像\n\n説明です。\n\n```js\n// scripts/social/images.mjs\nexport function stripJpegExif(buffer) {\n```\n\n## 次\n\nPNG は対象外で、未接続です。\n';
  assert.deepStrictEqual(findMissingCaveats(body, caveats).map((m) => m.caveat.pattern).sort(), caveats.filter((c) => c.source === 'scripts/social/images.mjs').map((c) => c.pattern).sort());
  const ok = body.replace('説明です。', '投稿の経路には未接続で、PNG は対象外です。');
  assert.deepStrictEqual(findMissingCaveats(ok, caveats), []);
  assert.strictEqual(findSingleEmphasis('*Zennを正本に置く理由です。* と **太字** と snake_case_name').length, 1);
});

test('V8: listing manual reposting and the fear of mis-publishing side by side is not a causal claim', () => {
  const ok = ['Zenn・Qiita・note・SNSへ同じ原稿を手で貼り直す作業と、誤公開やトークン漏洩の恐怖を、配信基盤で解決しました。'];
  assert.deepStrictEqual(findClaimViolations(units(ok), claims).filter((h) => h.claim.id === 'automation-caused-fear'), []);
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

test('Q12: skipping source lines between two excerpt lines needs an ellipsis', () => {
  const src = 'a();\nb();\nc();\n// note\nd();\n';
  assert.strictEqual(silentGaps('// scripts/x.mjs\na();\nc();', src).length, 1);
  assert.deepStrictEqual(silentGaps('// scripts/x.mjs\na();\n// ...\nc();', src), []);
  assert.deepStrictEqual(silentGaps('c();\nd();', src), [], 'only a comment lies between');
  assert.deepStrictEqual(silentGaps(readText('scripts/social/graphemes.mjs'), readText('scripts/social/graphemes.mjs')), []);
});

test('Q16: directory trees are read into repository paths', () => {
  const code = 'publishing-hub/\n├── articles/\n├── platforms/\n│   ├── qiita/\n│   │   └── public/\n└── social/\n    ├── posts/     # SNS\n    └── ledger/\n';
  assert.deepStrictEqual(treePaths(code).map((p) => p.path), ['articles', 'platforms', 'platforms/qiita', 'platforms/qiita/public', 'social', 'social/posts', 'social/ledger']);
  const md = `---\ntitle: "t"\ntags:\n  - a\nprivate: true\n---\n\n\`\`\`text\n${code}\`\`\`\n`;
  const q16 = checkQiitaArticle('platforms/qiita/public/x.md', md).warnings.filter((w) => w.code === 'Q16');
  if (q16.length) assert.deepStrictEqual(q16.map((w) => w.message.split(' ')[1]), ['social/ledger']);
});

test('Q17: a technology in the title or tags needs an excerpt of its configuration', () => {
  const md = (extra) => `---\ntitle: "GitHub Actionsで公開する"\ntags:\n  - GitHubActions\nprivate: true\n---\n\n本文です。\n${extra}`;
  assert.ok(checkQiitaArticle('platforms/qiita/public/x.md', md('')).warnings.some((w) => w.code === 'Q17'));
  const wf = readText('.github/workflows/publish-qiita.yml').split('\n').find((l) => l.startsWith('name:'));
  const withYaml = md(`\n\`\`\`yaml\n# .github/workflows/publish-qiita.yml\n${wf}\n\`\`\`\n`);
  assert.ok(!checkQiitaArticle('platforms/qiita/public/x.md', withYaml).warnings.some((w) => w.code === 'Q17'));
});

test('H1: the latest body change to a public manuscript needs a later human Reviewed-by, whoever made it', () => {
  const f = 'platforms/qiita/public/x.md';
  const c = (o) => ({ sha: o.sha, author: o.author || 'Takenori-Kusaka', coAuthors: o.co || [], reviewers: o.rev || [], reviewedPaths: o.paths || [], touches: Boolean(o.touches), bodyChanged: o.bodyChanged });
  assert.deepStrictEqual(reviewStatus([], f), { needed: false, reviewed: true });
  const plain = reviewStatus([c({ sha: 'b', touches: true })], f);
  assert.strictEqual(plain.needed, true, 'a change without an AI trailer may still be an AI change');
  assert.strictEqual(plain.reviewed, false);
  assert.strictEqual(reviewStatus([c({ sha: 'a', touches: true, co: ['Gemini CLI'] })], f).reviewed, false);
  assert.strictEqual(reviewStatus([c({ sha: 'r', rev: ['Takenori Kusaka'], paths: [f] }), c({ sha: 'a', touches: true, co: ['Gemini CLI'] })], f).reviewed, true);
  assert.strictEqual(reviewStatus([c({ sha: 'r', rev: ['Claude Opus 5'], paths: [f] }), c({ sha: 'a', touches: true, co: ['Gemini CLI'] })], f).reviewed, false, 'an AI cannot review');
  assert.strictEqual(reviewStatus([c({ sha: 'a2', touches: true, co: ['Claude Opus 5'] }), c({ sha: 'r', rev: ['Takenori Kusaka'], touches: true }), c({ sha: 'a', touches: true, co: ['Gemini CLI'] })], f).reviewed, false, 'a newer AI change needs a new review');
  assert.strictEqual(reviewStatus([c({ sha: 'x', touches: true }), c({ sha: 'r', rev: ['Takenori Kusaka'], paths: [f] })], f).reviewed, false, 'a newer change without trailers needs a new review');
  assert.strictEqual(reviewStatus([c({ sha: 's', touches: true, author: 'github-actions[bot]' }), c({ sha: 'r', rev: ['Takenori Kusaka'], paths: [f] }), c({ sha: 'a', touches: true, co: ['Gemini CLI'] })], f).reviewed, true, 'a bot sync does not reset the review');
  assert.strictEqual(reviewStatus([c({ sha: 'm', touches: true, bodyChanged: false }), c({ sha: 'r', rev: ['Takenori Kusaka'], paths: [f] }), c({ sha: 'a', touches: true, co: ['Gemini CLI'] })], f).reviewed, true, 'a frontmatter-only change does not reset the review');
});

test('local paths are found in prose and code alike', () => {
  assert.deepStrictEqual(findLocalPaths('ok\nE:\\Github\\zenn-content\\\n/home/alice/work\nC:\\Users\\bob\\AppData\\Local').map((h) => h.line), [2, 3, 4]);
  assert.deepStrictEqual(findLocalPaths('scripts/lint/lib.mjs と /usr/bin/env node'), []);
});
