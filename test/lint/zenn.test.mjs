import { test } from 'node:test';
import assert from 'node:assert';
import { checkArticle, checkBook, checkZenn, checkConvention, countElements, firstChapterFile } from '../../scripts/lint/check-zenn.mjs';
import { readJson, readText, readYaml, Report } from '../../scripts/lint/lib.mjs';

const policy = readJson('lint/policies/zenn.json');

const TECH = `---
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

\`\`\`mermaid
flowchart TD
  A --> B
\`\`\`

\`\`\`js
const a = 1;
\`\`\`

リポジトリ: [x](https://github.com/Takenori-Kusaka/publishing-hub)
`;

test('Z8: a declaration left at the end of an article is an error (Zenn requires only the top notice)', () => {
  assert.ok(!checkArticle('articles/a-valid-slug-name.md', TECH, policy).errors.some((e) => e.code === 'Z8'));
  const leftover = TECH + '\n## 生成AIの利用について\n\nこの記事の作成には、生成AIの Gemini CLI を使いました。筆者が内容を確認しました。\n';
  const z8 = checkArticle('articles/a-valid-slug-name.md', leftover, policy).errors.filter((e) => e.code === 'Z8');
  assert.strictEqual(z8.length, 1, JSON.stringify(z8));
  assert.ok(z8[0].message.includes('残っています'));
});

test('countElements detects code, figures, repo links, citations and book links', () => {
  const c = countElements(TECH + '\n本文 [ [ 3 ] ](https://example.org/paper) と [本編](https://zenn.dev/u/books/b/viewer/c)\n');
  assert.strictEqual(c.code_block, 1);
  assert.strictEqual(c.figure, 1);
  assert.strictEqual(c.repo_link, 1);
  assert.strictEqual(c.citation_link, 1);
  assert.strictEqual(c.book_link, 1);
});

test('Z1: article slug and frontmatter rules', () => {
  const r = checkArticle('articles/short.md', TECH.replace('type: "tech"', 'type: "blog"').replace('emoji: "📚"', 'emoji: "ab"'), policy);
  const msgs = r.errors.filter((e) => e.code === 'Z1').map((e) => e.message);
  assert.ok(msgs.some((m) => m.includes('slug')));
  assert.ok(msgs.some((m) => m.includes('type')));
  assert.ok(msgs.some((m) => m.includes('emoji')));
  const six = TECH.replace('topics: ["nodejs"]', 'topics: ["a","b","c","d","e","f"]');
  assert.ok(checkArticle('articles/a-valid-slug-name.md', six, policy).errors.some((e) => e.message.includes('topics')));
});

test('Z3: an engineering article must carry code, a figure and a repository link; an idea article need not', () => {
  const ok = checkArticle('articles/a-valid-slug-name.md', TECH, policy);
  assert.deepStrictEqual(ok.errors, [], JSON.stringify(ok.errors));
  const stripped = TECH.replace(/```js[\s\S]*?```/, '').replace(/リポジトリ.*\n/, '');
  const r = checkArticle('articles/a-valid-slug-name.md', stripped, policy);
  const z3 = r.errors.filter((e) => e.code === 'Z3').map((e) => e.message);
  assert.ok(z3.some((m) => m.includes('コードブロック')));
  assert.ok(z3.some((m) => m.includes('GitHub')));
  const idea = checkArticle('articles/a-valid-slug-name.md', stripped.replace('type: "tech"', 'type: "idea"'), policy);
  assert.deepStrictEqual(idea.errors, []);
});

test('Z2: relative images are rejected', () => {
  const r = checkArticle('articles/a-valid-slug-name.md', TECH + '\n![x](images/x.png)\n', policy);
  assert.ok(r.errors.some((e) => e.code === 'Z2'));
});

test('Z2: a paragraph directly followed by --- (setext heading) and a fence without language are reported', () => {
  const r = checkArticle('articles/a-valid-slug-name.md', TECH + '\n段落です。\n---\n\n```\nplain\n```\n', policy);
  assert.ok(r.errors.some((e) => e.code === 'Z2' && e.message.includes('---')));
  assert.ok(r.warnings.some((w) => w.code === 'Z2' && w.message.includes('言語名')));
  const ok = checkArticle('articles/a-valid-slug-name.md', TECH + '\n段落です。\n\n---\n\n```text\nplain\n```\n', policy);
  assert.ok(!ok.errors.some((e) => e.code === 'Z2'));
});

test('Z7: unclosed strong emphasis is reported with the right line, closed emphasis is not', () => {
  const broken = TECH + '\n\n**文です。 **次の文です。\n\n正常な **強調** です。\n';
  const r = checkArticle('articles/a-valid-slug-name.md', broken, policy);
  const z7 = r.errors.filter((e) => e.code === 'Z7');
  assert.strictEqual(z7.length, 1);
  assert.strictEqual(z7[0].line, TECH.split('\n').length + 2);
  const fixed = TECH + '\n\n**文です。** 次の文です。\n\n正常な **強調** です。\n';
  assert.strictEqual(checkArticle('articles/a-valid-slug-name.md', fixed, policy).errors.filter((e) => e.code === 'Z7').length, 0);
});

test('Z6: chapter references into a book must exist and carry the current label', () => {
  const base = 'https://zenn.dev/takenori_kusaka/books/sovereign-resilience-blueprint/viewer/';
  const good = TECH + `\n[第Ⅴ部-8](${base}50_intentional-inconvenience-practice) と 第Ⅴ部-7 を参照。\n`;
  assert.deepStrictEqual(checkArticle('articles/a-valid-slug-name.md', good, policy).errors.filter((e) => e.code === 'Z6'), []);
  const stale = TECH + `\n[第Ⅴ部-9](${base}50_intentional-inconvenience-practice) と 第Ⅴ部-19 と [x](${base}no-such-chapter) を参照。\n`;
  const z6 = checkArticle('articles/a-valid-slug-name.md', stale, policy).errors.filter((e) => e.code === 'Z6');
  assert.strictEqual(z6.length, 3, JSON.stringify(z6));
  assert.ok(z6.some((e) => e.message.includes('第Ⅴ部-8')));
  assert.ok(z6.some((e) => e.message.includes('第Ⅴ部-19')));
  assert.ok(z6.some((e) => e.message.includes('no-such-chapter')));
});

test('Z4 kinds: numbered-headings and footnotes-resolved fire on gaps, duplicates and dangling footnotes', () => {
  const seq = { id: 'seq', kind: 'numbered-headings', level: 3, severity: 'error', message: '連番' };
  const fn = { id: 'fn', kind: 'footnotes-resolved', severity: 'error', message: '脚注' };
  const run = (text, conv) => {
    const r = new Report('t');
    checkConvention(r, 'books/x/y.md', text, { title: 't' }, conv);
    return r.errors.map((e) => e.message);
  };
  assert.deepStrictEqual(run('### 1. a\n### 2. b\n### 3. c\n', seq), []);
  assert.ok(run('### 1. a\n### 2. b\n### 2. c\n### 4. d\n', seq)[0].startsWith('seq'));
  assert.ok(run('### 1. a\n### 2. b\n### 4. d\n', seq)[0].startsWith('seq'));
  assert.deepStrictEqual(run('本文[^a]。\n\n[^a]: 注\n', fn), []);
  assert.ok(run('本文[^a]。\n', fn)[0].includes('定義なし: a'));
  assert.ok(run('本文。\n\n[^b]: 注\n', fn)[0].includes('参照なし: b'));
  // target: body masks code so [n] inside fences is not a bare citation
  const cite = policy.conventions['sovereign-resilience-blueprint'].find((c) => c.id === 'srb-citation-format');
  assert.deepStrictEqual(run('本文 [ [ 1 ] ](https://x.y/z) 。\n\n```text\nlog[12]\n```\n', cite), []);
  assert.ok(run('本文 [12] です。\n', cite).length === 1);
  const p = { ...policy, books: { 'pit-in-process': { genre: 'process', conventions: 'x' } }, conventions: { x: [seq, fn] } };
  assert.deepStrictEqual(checkBook('pit-in-process', p).errors, []);
});

test('the technical genre needs a figure but no code or repository link', () => {
  const p = { ...policy, articles: { ...policy.articles, genre_overrides: { 'measure-*.md': 'technical' } } };
  const noCode = TECH.replace(/```js[\s\S]*?```/, '').replace(/リポジトリ.*\n/, '');
  assert.deepStrictEqual(checkArticle('articles/measure-voltage-drop.md', noCode, p).errors.filter((e) => e.code === 'Z3'), []);
  assert.ok(checkArticle('articles/measure-voltage-drop.md', noCode.replace(/```mermaid[\s\S]*?```/, ''), p).errors.some((e) => e.code === 'Z3'));
});

test('the repository satisfies every genre requirement and declared convention', () => {
  const r = checkZenn();
  assert.deepStrictEqual(r.errors, [], JSON.stringify(r.errors, null, 1));
});

test('every book has a genre and every convention references a defined severity', () => {
  for (const [slug, entry] of Object.entries(policy.books)) {
    assert.ok(policy.genres[entry.genre], `${slug}: genre ${entry.genre} defined`);
    if (entry.conventions) {
      const convKey = typeof entry.conventions === 'string' ? entry.conventions : entry.conventions.id;
      assert.ok(Array.isArray(policy.conventions[convKey]), `${slug}: conventions ${convKey} defined`);
      for (const c of policy.conventions[convKey]) {
        assert.ok(c.id && c.message, `${slug}: convention has id and message`);
        assert.ok(['error', 'warning'].includes(c.severity), `${c.id}: severity`);
        assert.ok(c.must_match || c.must_not_match || ['numbered-headings', 'footnotes-resolved'].includes(c.kind), `${c.id}: has a rule`);
        if (c.must_match) new RegExp(c.must_match, c.flags || 'm');
        if (c.must_not_match) new RegExp(c.must_not_match, c.flags || 'm');
      }
    }
  }
});

test('Z8 in a book looks only at the first chapter: a declaration left there is an error, one in a later chapter is not checked', () => {
  // 本の開示は、告知と同じく最初の章(config.yaml の chapters の先頭)だけを見る(docs/ai-disclosure.md 4 章の限界)
  const slug = 'pit-in-process';
  const chapters = readYaml(`books/${slug}/config.yaml`).chapters;
  const first = firstChapterFile(`books/${slug}`);
  assert.strictEqual(first, `books/${slug}/${chapters[0]}.md`, 'the first chapter comes from config.yaml');
  const second = `books/${slug}/${chapters[1]}.md`;
  const LEFT = '\n## 生成AIの利用について\n\nこの本の作成には、生成AIの Claude を使いました。筆者が内容を確認しました。\n';
  // 章のファイルは書き換えず、読み方だけを差し替えて末尾に宣言を足す
  const z8 = (withLeft) => checkBook(slug, policy, undefined, { read: (f) => readText(f) + (withLeft.includes(f) ? LEFT : '') }).errors.filter((e) => e.code === 'Z8');
  assert.deepStrictEqual(z8([]), [], 'the book as committed has no Z8 error');
  const inFirst = z8([first]);
  assert.strictEqual(inFirst.length, 1, JSON.stringify(inFirst));
  assert.strictEqual(inFirst[0].file, first);
  assert.ok(inFirst[0].message.includes('「生成AIの利用について」の節が残っています'), inFirst[0].message);
  assert.deepStrictEqual(z8([second]), [], 'a declaration left in a later chapter is outside the check');
});
