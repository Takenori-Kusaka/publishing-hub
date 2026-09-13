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
} from '../../scripts/lint/disclosure.mjs';
import { checkEditorial } from '../../scripts/social/editorial.mjs';
import { Report } from '../../scripts/lint/lib.mjs';

const policy = loadDisclosurePolicy();
const NOTICE = 'この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。';
const DECL = 'この記事の作成には、生成AIの Claude（Anthropic）を使いました。本文の下書きと校正に使っています。筆者が内容を確認し、必要に応じて修正しました。公開した内容の責任は筆者が負います。';
const zennBody = (extra = '') => `\n:::message\n${NOTICE}\n:::\n\n## 本文\n\n説明です。\n${extra}\n## 生成AIの利用について\n\n${DECL}\n`;

function run(body, channel = 'zenn', file = 'articles/x.md', p = policy) {
  const r = new Report('t');
  checkManuscriptDisclosure(r, file, body, 5, channel, 'Z8', p);
  return r;
}

test('a top notice in the channel form and a complete last-heading declaration pass on every channel', () => {
  assert.deepStrictEqual(run(zennBody()).errors, []);
  const qiita = zennBody().replace(':::message', ':::note info').replace('## 生成AIの利用について', '# 生成AIの利用について');
  assert.deepStrictEqual(run(qiita, 'qiita').errors, []);
  const note = `\n> ${NOTICE}\n\n## 本文\n\n説明です。\n\n## 生成AIの利用について\n\n${DECL}\n`;
  assert.deepStrictEqual(run(note, 'note').errors, []);
});

test('the notice must sit near the top, use the channel form and say that a human checked the text', () => {
  const late = '\n' + '段落です。\n\n'.repeat(10) + `:::message\n${NOTICE}\n:::\n\n## 生成AIの利用について\n\n${DECL}\n`;
  const e = run(late).errors;
  assert.strictEqual(e.length, 1, JSON.stringify(e));
  assert.ok(e[0].message.includes('冒頭'));
  assert.ok(e[0].line > 5, 'the error points at the misplaced notice');
  assert.strictEqual(run(zennBody(), 'note').errors.length, 1, 'a :::message box is not the note form');
  const noReview = run(zennBody().replace(NOTICE, 'この記事は生成AIを使いました。')).errors;
  assert.ok(noReview.some((x) => x.message.includes('告知')), JSON.stringify(noReview));
});

test('the declaration must exist, be the last heading, use an allowed level and carry the four elements', () => {
  assert.ok(run(zennBody().replace(/## 生成AIの利用について[\s\S]*$/, '')).errors.some((e) => e.message.includes('宣言節がありません')));
  assert.ok(run(zennBody() + '\n## 付録\n\n補足です。\n').errors.some((e) => e.message.includes('最後の見出し')));
  assert.ok(run(zennBody().replace('## 生成AIの利用について', '#### 生成AIの利用について')).errors.some((e) => e.message.includes('見出しレベル')));
  const labels = run(zennBody().replace(DECL, '生成AIを使いました。')).errors.map((e) => e.message);
  for (const l of ['使ったツール名', '用途と範囲', '人による確認', '責任の所在']) assert.ok(labels.some((m) => m.includes(l)), `${l} expected in ${labels}`);
});

test('headings inside code blocks do not count as the last heading', () => {
  const withCode = zennBody().replace(DECL, `${DECL}\n\n\`\`\`md\n## コード内の見出し\n\`\`\``);
  assert.deepStrictEqual(run(withCode).errors, []);
});

test('stripDisclosure removes the notice block and the declaration section, and nothing else', () => {
  const s = stripDisclosure(zennBody('\n> 引用です。\n'));
  assert.ok(!s.includes(NOTICE));
  assert.ok(!s.includes('生成AIの利用について'));
  assert.ok(!s.includes('Anthropic'));
  assert.ok(s.includes('## 本文'));
  assert.ok(s.includes('> 引用です。'));
});

test('stripDisclosureSentences drops only the disclosure sentence; both words must share one sentence', () => {
  const t = '一文目です。二文目です。\n※生成AI（Claude）で下書きし、筆者が確認して投稿しています。';
  assert.strictEqual(stripDisclosureSentences(t).trim(), '一文目です。二文目です。');
  assert.ok(isDisclosureText(t));
  assert.ok(!isDisclosureText('生成AIの話です。確認します。'));
});

test('SNS: LinkedIn text and the Bluesky thread must each carry a disclosure sentence', () => {
  const data = { id: 'x', linkedin: { enabled: true, text: '本文です。' }, bluesky: { enabled: true, posts: [{ text: '一つ目。' }, { text: '二つ目。' }] } };
  assert.strictEqual(checkSocialDisclosure(data).length, 2);
  data.linkedin.text += '\n\n※この投稿は、生成AI（Claude）で下書きし、筆者が内容を確認して公開しています。';
  data.bluesky.posts[1].text += '\n※生成AI（Claude）で下書きし、筆者が確認して投稿しています。';
  assert.deepStrictEqual(checkSocialDisclosure(data), []);
});

test('the editorial check reports SOCIAL_AI_DISCLOSURE and does not count the disclosure as a sentence', () => {
  const canon = 'https://zenn.dev/takenori_kusaka/books/pit-in-process/viewer/the-structure';
  const four = '一文目です。二文目です。三文目です。四文目です。';
  const data = {
    id: 'x',
    source: { canonical_url: canon },
    bluesky: { enabled: true, langs: ['ja'], posts: [{ text: four, external: { url: canon, title: 't', description: 'd' } }] },
  };
  assert.ok(checkEditorial(data, null).errors.some((e) => e.code === 'SOCIAL_AI_DISCLOSURE'));
  data.bluesky.posts[0].text = `${four}\n※生成AI（Claude）で下書きし、筆者が確認して投稿しています。`;
  const r = checkEditorial(data, null);
  assert.ok(!r.errors.some((e) => e.code === 'SOCIAL_AI_DISCLOSURE'));
  assert.ok(!r.warnings.some((w) => w.code === 'BS_ONE_POINT'), 'the disclosure is not a fifth sentence');
});

test('every AI co-author recorded in git must be named in the declaration', () => {
  const authors = ['Claude Opus 5 (1M context)', 'Gemini CLI'];
  assert.deepStrictEqual(missingCoAuthorTools('x.md', 'Claude と Gemini を使いました', policy, authors), []);
  assert.deepStrictEqual(missingCoAuthorTools('x.md', 'Claude を使いました', policy, authors), ['Gemini CLI']);
  assert.deepStrictEqual(missingCoAuthorTools('x.md', '生成AIを使いました', policy, []), []);
  assert.strictEqual(missingCoAuthorTools('x.md', 'Claude', policy, null), null, 'no git history means no verdict');
});

test('the shipped manuscripts name every AI co-author in their declarations', (t) => {
  const real = coAuthors('articles/multi-platform-publishing-architecture.md');
  if (!real) return t.skip('git history is shallow or unavailable');
  assert.ok(real.some((a) => /Claude/.test(a)), JSON.stringify(real));
});

test('exempt entries skip the check and carry their reason', () => {
  const p = { ...policy, exempt: { entries: { 'articles/human-*.md': '2019 年に手で書いた記事' } } };
  assert.strictEqual(exemptReason('articles/human-written.md', p), '2019 年に手で書いた記事');
  assert.deepStrictEqual(run('\n本文だけです。\n', 'zenn', 'articles/human-written.md', p).errors, []);
  assert.strictEqual(exemptReason('articles/other.md', p), null);
});
