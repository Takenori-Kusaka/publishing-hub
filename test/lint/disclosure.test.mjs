import { test } from 'node:test';
import assert from 'node:assert';
import {
  checkManuscriptDisclosure,
  stripDisclosure,
  stripDisclosureSentences,
  checkSocialDisclosure,
  isDisclosureText,
  exemptReason,
  loadDisclosurePolicy,
  missingCoAuthorTools,
  coAuthors,
  modelTokens,
  sameExceptDisclosure,
  misattributedAuthors,
  declarationChanges,
  toolClauses,
  outerQuotes,
  declarationHeadings,
} from '../../scripts/lint/disclosure.mjs';
import { checkEditorial } from '../../scripts/social/editorial.mjs';
import { Report, readText } from '../../scripts/lint/lib.mjs';

const policy = loadDisclosurePolicy();
const pDecl = { ...policy, channels: { ...policy.channels, note: { declaration: { required: true } } } };
// 宣言を求める媒体の検査(今はどの媒体も求めない)を確かめるための方針。宣言を含む fixture はこの方針か pDecl で読む
const pDeclAll = { ...policy, channels: { zenn: { declaration: { required: true } }, qiita: { declaration: { required: true } }, note: { declaration: { required: true } } } };
const NOTICE = 'この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。';
const DECL = 'この記事の作成には、生成AIの Claude（Anthropic）を使いました。本文の下書きと校正に使っています。筆者が内容を確認し、必要に応じて修正しました。公開した内容の責任は筆者が負います。';
const zennBody = (extra = '') => `\n:::message\n${NOTICE}\n:::\n\n## 本文\n\n説明です。\n${extra}\n## 生成AIの利用について\n\n${DECL}\n`;
const zennNoticeOnly = (extra = '') => `\n:::message\n${NOTICE}\n:::\n\n## 本文\n\n説明です。\n${extra}`;

function run(body, channel = 'zenn', file = 'articles/x.md', p = policy) {
  const r = new Report('t');
  checkManuscriptDisclosure(r, file, body, 5, channel, 'Z8', p);
  return r;
}

test('where a channel requires a declaration, a top notice and a complete last-heading declaration pass on every channel', () => {
  assert.deepStrictEqual(run(zennBody(), 'zenn', 'articles/x.md', pDeclAll).errors, []);
  const qiita = zennBody().replace(':::message', ':::note info').replace('## 生成AIの利用について', '# 生成AIの利用について');
  assert.deepStrictEqual(run(qiita, 'qiita', 'articles/x.md', pDeclAll).errors, []);
  const note = `\n> ${NOTICE}\n\n## 本文\n\n説明です。\n\n## 生成AIの利用について\n\n${DECL}\n`;
  assert.deepStrictEqual(run(note, 'note', 'articles/x.md', pDeclAll).errors, []);
});

test('the notice must sit near the top, use the channel form and say that a human checked the text', () => {
  const late = '\n' + '段落です。\n\n'.repeat(10) + `:::message\n${NOTICE}\n:::\n`;
  const e = run(late).errors;
  assert.strictEqual(e.length, 1, JSON.stringify(e));
  assert.ok(e[0].message.includes('冒頭'));
  assert.ok(e[0].line > 5, 'the error points at the misplaced notice');
  assert.strictEqual(run(zennNoticeOnly(), 'note').errors.length, 1, 'a :::message box is not the note form');
  const noReview = run(zennBody().replace(NOTICE, 'この記事は生成AIを使いました。')).errors;
  assert.ok(noReview.some((x) => x.message.includes('告知')), JSON.stringify(noReview));
});

test('the declaration must exist, be the last heading, use an allowed level and carry the four elements', () => {
  const noteBody = `\n> ${NOTICE}\n\n## 本文\n\n説明です。\n\n## 生成AIの利用について\n\n${DECL}\n`;
  assert.ok(run(noteBody.replace(/## 生成AIの利用について[\s\S]*$/, ''), 'note', 'articles/x.md', pDecl).errors.some((e) => e.message.includes('宣言節がありません')));
  assert.ok(run(noteBody + '\n## 付録\n\n補足です。\n', 'note', 'articles/x.md', pDecl).errors.some((e) => e.message.includes('最後の見出し')));
  assert.ok(run(noteBody.replace('## 生成AIの利用について', '#### 生成AIの利用について'), 'note', 'articles/x.md', pDecl).errors.some((e) => e.message.includes('見出しレベル')));
  const labels = run(noteBody.replace(DECL, '生成AIを使いました。'), 'note', 'articles/x.md', pDecl).errors.map((e) => e.message);
  for (const l of ['使ったツール名', '用途と範囲', '人による確認', '責任の所在']) assert.ok(labels.some((m) => m.includes(l)), `${l} expected in ${labels}`);
});

test('headings inside code blocks do not count as the last heading', () => {
  const noteBody = `\n> ${NOTICE}\n\n## 本文\n\n説明です。\n\n## 生成AIの利用について\n\n${DECL}\n`;
  const withCode = noteBody.replace(DECL, `${DECL}\n\n\`\`\`md\n## コード内の見出し\n\`\`\``);
  assert.deepStrictEqual(run(withCode, 'note', 'articles/x.md', pDecl).errors, []);
});

test('stripDisclosure removes the notice block and the declaration section, and nothing else', () => {
  const s = stripDisclosure(zennBody('\n> 引用です。\n'));
  assert.ok(!s.includes(NOTICE));
  assert.ok(!s.includes('生成AIの利用について'));
  assert.ok(!s.includes('Anthropic'));
  assert.ok(s.includes('## 本文'));
  assert.ok(s.includes('> 引用です。'));
});

test('stripDisclosure does not read a closing ::: as the start of a block that runs to the end', () => {
  const later = `\n:::message\n${NOTICE}\n:::\n\n## 本文\n\n説明です。生成AIの出力は筆者が確認します。\n\n:::details 補足\n中身です。\n:::\n\n## 生成AIの利用について\n\n${DECL}\n`;
  const s = stripDisclosure(later);
  assert.ok(s.includes('## 本文') && s.includes('説明です。') && s.includes(':::details 補足'), s);
  const canon = readText('articles/multi-platform-publishing-architecture.md');
  const stripped = stripDisclosure(canon);
  assert.ok(stripped.split('\n').length > canon.split('\n').length - 20, 'only the notice and the declaration are removed');
  assert.ok(stripped.includes('## 9. 既知の限界と未検証事項'));
});

test('stripDisclosureSentences drops only the disclosure sentence; both words must share one sentence', () => {
  const t = '一文目です。二文目です。\n※生成AI（Claude）で下書きし、筆者が確認して投稿しています。';
  assert.strictEqual(stripDisclosureSentences(t).trim(), '一文目です。二文目です。');
  assert.ok(isDisclosureText(t));
  assert.ok(!isDisclosureText('生成AIの話です。確認します。'));
});

test('SNS: a disclosure sentence left in the body is reported so the author removes it', () => {
  // 2026-09-16 に方針を反転した。SNS は文字数の枕が厳しく、開示は導線の先(正本・Qiita・note)で果たす。
  const data = { id: 'x', linkedin: { enabled: true, text: '本文です。' }, bluesky: { enabled: true, posts: [{ text: '一つ目。' }, { text: '二つ目。' }] } };
  assert.deepStrictEqual(checkSocialDisclosure(data), [], '開示がないのが正しい状態');
  data.linkedin.text += '\n\n※この投稿は、生成AI（Claude）で下書きし、筆者が内容を確認して公開しています。';
  data.bluesky.posts[1].text += '\n※生成AI（Claude）で下書きし、筆者が確認して投稿しています。';
  const out = checkSocialDisclosure(data);
  assert.strictEqual(out.length, 2);
  assert.ok(out.every((o) => o.code === 'SOCIAL_AI_DISCLOSURE_UNNEEDED'));
});

test('the editorial check reports a disclosure left in the body and does not count it as a sentence', () => {
  const canon = 'https://zenn.dev/takenori_kusaka/books/pit-in-process/viewer/the-structure';
  const four = '一文目です。二文目です。三文目です。四文目です。';
  const data = {
    id: 'x',
    source: { canonical_url: canon },
    bluesky: { enabled: true, langs: ['ja'], posts: [{ text: four, external: { url: canon, title: 't', description: 'd' } }] },
  };
  assert.ok(!checkEditorial(data, null).errors.some((e) => e.code.startsWith('SOCIAL_AI_DISCLOSURE')));
  data.bluesky.posts[0].text = `${four}\n※生成AI（Claude）で下書きし、筆者が確認して投稿しています。`;
  const r = checkEditorial(data, null);
  assert.ok(r.errors.some((e) => e.code === 'SOCIAL_AI_DISCLOSURE_UNNEEDED'), 'the disclosure must be removed from the body');
  assert.ok(!r.warnings.some((w) => w.code === 'BS_ONE_POINT'), 'the disclosure is not a fifth sentence');
});

test('every AI co-author recorded in git must be named in the declaration', () => {
  const authors = ['Claude Opus 5 (1M context)', 'Gemini CLI'];
  assert.deepStrictEqual(missingCoAuthorTools('x.md', 'Claude と Gemini を使いました', policy, authors), []);
  assert.deepStrictEqual(missingCoAuthorTools('x.md', 'Claude を使いました', policy, authors), ['Gemini CLI']);
  assert.deepStrictEqual(missingCoAuthorTools('x.md', '生成AIを使いました', policy, []), []);
  assert.strictEqual(missingCoAuthorTools('x.md', 'Claude', policy, null), null, 'no git history means no verdict');
  assert.deepStrictEqual(missingCoAuthorTools('x.md', 'Claude Fable 5.1 と Gemini を使いました', policy, ['Claude Opus 5 (1M context)', 'Claude Fable 5.1', 'Gemini CLI'], { model: true }), ['Claude Opus 5 (1M context)']);
  assert.deepStrictEqual(missingCoAuthorTools('x.md', 'Claude Opus 5 と Claude Fable 5.1、Gemini CLI を使いました', policy, ['Claude Opus 5 (1M context)', 'Claude Fable 5.1', 'Gemini CLI'], { model: true }), []);
});

test('the co-author record of the shipped canonical article names the AI that wrote it', (t) => {
  const real = coAuthors('articles/multi-platform-publishing-architecture.md');
  if (!real) return t.skip('git history is shallow or unavailable');
  assert.ok(real.some((a) => /Claude/.test(a)), JSON.stringify(real));
});

test('model names come from the co-author name, including a model in parentheses', () => {
  const rule = (n) => policy.declaration.trailer_tools.tools.find((t) => new RegExp(t.trailer, 'i').test(n));
  const tokens = (n) => modelTokens(n, rule(n), policy);
  assert.deepStrictEqual(tokens('Claude Opus 5 (1M context)'), ['Opus 5']);
  assert.deepStrictEqual(tokens('Gemini CLI (gemini-3.7-flash)'), ['gemini-3.7-flash']);
  assert.deepStrictEqual(tokens('Gemini CLI'), []);
  assert.deepStrictEqual(tokens('GPT-5'), ['GPT-5']);
  const authors = ['Gemini CLI (gemini-3.7-flash)'];
  assert.deepStrictEqual(missingCoAuthorTools('x.md', 'Gemini CLI（Google の gemini-3.7-flash）で 2 章を改訂しました', policy, authors, { model: true }), []);
  assert.deepStrictEqual(missingCoAuthorTools('x.md', 'Gemini CLI で 2 章を改訂しました', policy, authors, { model: true }), authors);
});

test('a commit that only adds the disclosure frame is recognised', () => {
  const before = '---\ntitle: t\n---\n\n## 本文\n\n説明です。\n';
  const after = `---\ntitle: t\n---\n\n:::message\n${NOTICE}\n:::\n\n## 本文\n\n説明です。\n\n## 生成AIの利用について\n\n${DECL}\n`;
  assert.strictEqual(sameExceptDisclosure(before, after, 'articles/x.md', policy), true);
  assert.strictEqual(sameExceptDisclosure(before, after.replace('説明です。', '説明を直しました。'), 'articles/x.md', policy), false);
});

test('a model that only added the disclosure frame must not be credited with drafting', () => {
  const records = [
    { sha: 'b', coAuthors: ['Claude Opus 5 (1M context)'], disclosureOnly: true },
    { sha: 'a', coAuthors: ['Claude Fable 5.1'], disclosureOnly: false },
  ];
  const wrong = 'この記事の作成には、生成AIの Claude（Anthropic の Claude Fable 5.1 と Claude Opus 5 (1M context)）を本文の作成や改稿、校正に使いました。';
  assert.deepStrictEqual(misattributedAuthors(wrong, records, policy).map((m) => m.author), ['Claude Opus 5 (1M context)']);
  const right = 'この記事の作成には、生成AIの Claude（Anthropic の Claude Fable 5.1）を本文の改稿と校正に使いました。Claude Opus 5 は、生成AIの開示の追加に使いました。';
  assert.deepStrictEqual(misattributedAuthors(right, records, policy), []);
  assert.deepStrictEqual(missingCoAuthorTools('x.md', right.replace(/Claude Opus 5 は、[^。]+。/, ''), policy, ['Claude Fable 5.1'], { model: true }), [], 'frame-only authors are not required');
});

test('a tool added to the declaration needs a purpose and a concrete scope; other tools\' sentences stay', () => {
  const base = '## 生成AIの利用について\n\nこの記事の作成には、生成AIの Claude（Anthropic の Claude Fable 5.1）を使いました。本文の改稿と校正に使っています。筆者が内容を確認し、必要に応じて修正しました。公開した内容の責任は筆者が負います。';
  const add = (s) => base.replace('筆者が内容を確認し', `${s}筆者が内容を確認し`);
  const vague = declarationChanges(add('また、Gemini CLI（Google の gemini-3.7-flash）を全体の改訂と検証の修正で使用しました。'), base, policy);
  assert.deepStrictEqual(vague.vague.map((v) => v.found), ['全体の改訂']);
  const none = declarationChanges(add('Gemini CLI（Google の gemini-3.7-flash）も使いました。'), base, policy);
  assert.deepStrictEqual([none.noPurpose, none.unscoped], [['Gemini'], ['Gemini']]);
  const scoped = declarationChanges(add('Gemini CLI（Google の gemini-3.7-flash）で、2 章「技術選定理由」と 3.1 節のコードの抜粋を改訂しました。'), base, policy, { headingTexts: ['2. 技術選定理由'] });
  assert.deepStrictEqual(scoped, { noPurpose: [], vague: [], unscoped: [], rewritten: [], missingPaths: [], missingTitle: [], unknownHeadings: [] });
  assert.deepStrictEqual(declarationChanges(add('Gemini CLI（Google の gemini-3.7-flash）で、本稿の各節を改訂しました。'), base, policy).vague.map((v) => v.found), ['本稿の各節']);
  const byHeading = declarationChanges(add('Gemini CLI（Google の gemini-3.7-flash）で、学んだことの節を書き直しました。'), base, policy, { headingTexts: ['学んだこと'] });
  assert.deepStrictEqual(byHeading.unscoped, []);
  const widened = add('Gemini CLI（Google の gemini-3.7-flash）で 2 章を改訂しました。').replace('本文の改稿と校正', '本文の作成や改稿、校正');
  assert.deepStrictEqual(declarationChanges(widened, base, policy, { committers: ['Gemini CLI (gemini-3.7-flash)'] }).rewritten, ['Claude']);
  assert.deepStrictEqual(declarationChanges(widened, base, policy, { committers: ['Claude Opus 5 (1M context)'] }).rewritten, [], 'the tool itself may rewrite its own sentence');
});

test('a revising tool names the code paths and the title it changed, quotes headings exactly, and comes before the review sentence', () => {
  const base = '## 生成AIの利用について\n\nこの記事の作成には、生成AIの Claude（Anthropic の Claude Fable 5.1）を使いました。本文の改稿と校正に使っています。筆者が内容を確認し、必要に応じて修正しました。公開した内容の責任は筆者が負います。';
  const add = (s) => base.replace('筆者が内容を確認し', `${s}筆者が内容を確認し`);
  const heading = '「複製」をやめて「切り出し」にする';
  const opts = { headingTexts: [heading], changedPaths: ['scripts/publish-note.mjs'], titleChanged: true };
  const loose = declarationChanges(add('Gemini CLI（Google の gemini-3.7-flash）で、「複製をやめる」の節を改訂しました。'), base, policy, opts);
  assert.deepStrictEqual(loose.unknownHeadings.map((u) => u.quote), ['複製をやめる']);
  assert.deepStrictEqual(loose.missingPaths.map((m) => m.paths), [['scripts/publish-note.mjs']]);
  assert.deepStrictEqual(loose.missingTitle, ['Gemini']);
  const exact = declarationChanges(add(`Gemini CLI（Google の gemini-3.7-flash）で、題名と「${heading}」の節、scripts/publish-note.mjs の抜粋を改訂しました。`), base, policy, opts);
  assert.deepStrictEqual([exact.unknownHeadings, exact.missingPaths, exact.missingTitle], [[], [], []]);
  assert.deepStrictEqual(outerQuotes(`「${heading}」の節`).map((q) => q.text), [heading]);
  const clauses = toolClauses('Claude で下書きしました。本文も直しました。数値も確かめました。筆者が内容を確認しました。', policy.declaration.trailer_tools.tools[0], policy);
  assert.strictEqual(clauses.length, 1);
  assert.ok(clauses[0].includes('数値も確かめました'));
  const noteBody = `\n> ${NOTICE}\n\n## 本文\n\n説明です。\n\n## 生成AIの利用について\n\n${DECL}\n`;
  const late = noteBody.replace(DECL, `${DECL}Gemini CLI（Google の gemini-3.7-flash）で 2 章を改訂しました。`);
  assert.ok(run(late, 'note', 'articles/x.md', pDecl).warnings.some((w) => w.message.includes('ツールの文より前')));
  assert.ok(!run(noteBody, 'note', 'articles/x.md', pDecl).warnings.some((w) => w.message.includes('ツールの文より前')));
});

test('exempt entries skip the check and carry their reason', () => {
  const p = { ...policy, exempt: { entries: { 'articles/human-*.md': '2019 年に手で書いた記事' } } };
  assert.strictEqual(exemptReason('articles/human-written.md', p), '2019 年に手で書いた記事');
  assert.deepStrictEqual(run('\n本文だけです。\n', 'zenn', 'articles/human-written.md', p).errors, []);
  assert.strictEqual(exemptReason('articles/other.md', p), null);
});

test('Zenn does not require declaration section but still requires the top notice', () => {
  const bodyWithNoticeNoDecl = `\n:::message\n${NOTICE}\n:::\n\n## 本文\n\n説明です。\n`;
  const r1 = run(bodyWithNoticeNoDecl, 'zenn');
  assert.deepStrictEqual(r1.errors, [], 'having notice and no declaration is valid for zenn');

  const bodyNoNoticeNoDecl = `\n## 本文\n\n説明です。\n`;
  const r2 = run(bodyNoNoticeNoDecl, 'zenn');
  assert.ok(r2.errors.some((e) => e.message.includes('告知がありません')), 'notice is still required even if declaration is optional');
});

test('note does not require declaration section but still requires the top notice', () => {
  const bodyWithNoticeNoDecl = `\n> ${NOTICE}\n\n## 本文\n\n説明です。\n`;
  const r1 = run(bodyWithNoticeNoDecl, 'note');
  assert.deepStrictEqual(r1.errors, [], 'having notice and no declaration is valid for note');

  const bodyNoNoticeNoDecl = `\n## 本文\n\n説明です。\n`;
  const r2 = run(bodyNoNoticeNoDecl, 'note');
  assert.ok(r2.errors.some((e) => e.message.includes('告知がありません')), 'notice is still required even if declaration is optional');
});

test('a declaration left in a channel that does not require one is an error on every channel (Z8 / Q11 / N9)', () => {
  // 2026-09-21: 宣言をやめた(#46)より前にマージした記事が、ツール名・モデル名入りの宣言を残したまま公開されていた
  for (const channel of ['zenn', 'qiita', 'note']) assert.strictEqual(policy.channels[channel].declaration.required, false, `${channel} requires no declaration`);
  const zenn = run(zennBody(), 'zenn').errors;
  assert.strictEqual(zenn.length, 1, JSON.stringify(zenn));
  assert.ok(zenn[0].message.includes('「生成AIの利用について」の節が残っています'), zenn[0].message);
  assert.strictEqual(zenn[0].line, 5 + zennBody().split('\n').findIndex((l) => l === '## 生成AIの利用について'), 'the error points at the heading');
  const qiita = zennBody().replace(':::message', ':::note info').replace('## 生成AIの利用について', '# 生成AIの利用について');
  assert.ok(run(qiita, 'qiita').errors.some((x) => x.message.includes('残っています')));
  const note = `\n> ${NOTICE}\n\n## 本文\n\n説明です。\n\n### 生成AIの利用について ##\n\n${DECL}\n`;
  assert.ok(run(note, 'note').errors.some((x) => x.message.includes('残っています')), 'any level, closing hashes ignored');
  // 宣言がなければ通り、コードブロックの中の見出し(書き方の例示)は数えない
  assert.deepStrictEqual(run(zennNoticeOnly(), 'zenn').errors, []);
  assert.deepStrictEqual(run(zennNoticeOnly('\n```md\n## 生成AIの利用について\n```\n'), 'zenn').errors, []);
});

test('the declaration heading comes from the policy, and falls back to the fixed name when the policy has none', () => {
  assert.deepStrictEqual(declarationHeadings(policy), policy.declaration.headings);
  assert.deepStrictEqual(declarationHeadings({ ...policy, declaration: { ...policy.declaration, headings: undefined } }), ['生成AIの利用について']);
  const renamed = { ...policy, declaration: { ...policy.declaration, headings: ['AIの利用'] } };
  assert.ok(run(zennNoticeOnly('\n## AIの利用\n\nClaude を使いました。\n'), 'zenn', 'articles/x.md', renamed).errors.some((x) => x.message.includes('「AIの利用」')));
  assert.deepStrictEqual(run(zennBody(), 'zenn', 'articles/x.md', renamed).errors, [], 'only the configured heading counts');
});

test('a policy without the declaration block does not throw, and a declaration left in the text is still found by the fixed name', () => {
  // どの媒体も宣言を求めないので、declaration のブロックごと消される可能性がある。宣言を求めない媒体でも毎回 findDeclaration を通る
  const { declaration, ...noDecl } = policy;
  assert.ok(declaration, 'the current policy has the block, so this test removes it');
  assert.doesNotThrow(() => run(zennNoticeOnly(), 'zenn', 'articles/x.md', noDecl));
  assert.deepStrictEqual(run(zennNoticeOnly(), 'zenn', 'articles/x.md', noDecl).errors, []);
  for (const channel of ['zenn', 'qiita', 'note']) {
    assert.doesNotThrow(() => run(zennBody(), channel, 'articles/x.md', noDecl), channel);
  }
  const left = run(zennBody(), 'zenn', 'articles/x.md', noDecl).errors;
  assert.strictEqual(left.length, 1, JSON.stringify(left));
  assert.ok(left[0].message.includes('「生成AIの利用について」の節が残っています'), left[0].message);
});
