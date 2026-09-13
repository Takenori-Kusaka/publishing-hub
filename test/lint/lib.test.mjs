import { test } from 'node:test';
import assert from 'node:assert';
import { globToRegExp, matchesAny, maskMarkdown, splitFrontmatter, sentences, extractLinks, fencedBlocks, headings, countChars, countProseChars, listFiles, isLegacyQiita, Report, parseArgs, restrictTo, scanFences, normalizeUrl, findUnclosedStrong, URL_RE } from '../../scripts/lint/lib.mjs';

test('globToRegExp handles **, *, {a,b} and literal dots', () => {
  assert.ok(globToRegExp('books/**/*.md').test('books/a/b/c.md'));
  assert.ok(globToRegExp('books/**/*.md').test('books/c.md'));
  assert.ok(!globToRegExp('books/*.md').test('books/a/c.md'));
  assert.ok(globToRegExp('social/posts/*.{yaml,yml}').test('social/posts/x.yml'));
  assert.ok(!globToRegExp('README.md').test('READMEXmd'));
  assert.ok(matchesAny('articles/srb-appendix-glossary.md', ['articles/srb-*.md']));
});

test('listFiles enumerates repository files by glob and honours exclude', () => {
  const files = listFiles(['articles/*.md'], { exclude: ['articles/README.md'] });
  assert.ok(files.length > 0);
  assert.ok(files.every((f) => f.startsWith('articles/') && f !== 'articles/README.md'));
  assert.ok(listFiles(['README.md']).includes('README.md'));
});

test('restrictTo normalises backslashes, ./ prefixes and absolute paths and reports unmatched arguments', () => {
  const files = ['platforms/note/public/x.md', 'platforms/note/public/y.md'];
  assert.deepStrictEqual(restrictTo(files, ['platforms\\note\\public\\x.md']).files, ['platforms/note/public/x.md']);
  assert.deepStrictEqual(restrictTo(files, ['./platforms/note/public/y.md']).files, ['platforms/note/public/y.md']);
  assert.deepStrictEqual(restrictTo(files, [process.cwd() + '/platforms/note/public/x.md']).files, ['platforms/note/public/x.md']);
  const r = restrictTo(files, ['platforms/note/public/none.md']);
  assert.deepStrictEqual(r.files, []);
  assert.match(r.note, /対象に含まれません/);
  assert.deepStrictEqual(restrictTo(files, []).files, files);
});

test('isLegacyQiita recognises synced 20-hex filenames only', () => {
  assert.strictEqual(isLegacyQiita('platforms/qiita/public/0a745151d120aa13449e.md'), true);
  assert.strictEqual(isLegacyQiita('platforms/qiita/public/multi-platform-publishing-architecture.md'), false);
});

const SAMPLE = '---\ntitle: "x"\ntopics: ["a"]\n---\n\n## 見出し\n\n本文です。`code` https://a.b/c と [l](https://x.y) です。次の文！\n\n```js\nconst a = 1;\n```\n<b>tag</b>\n';

test('maskMarkdown blanks frontmatter, code, urls and html without changing length or line numbers', () => {
  const masked = maskMarkdown(SAMPLE);
  assert.strictEqual(masked.length, SAMPLE.length);
  assert.strictEqual(masked.split('\n').length, SAMPLE.split('\n').length);
  assert.ok(!masked.includes('const a'));
  assert.ok(!masked.includes('https://'));
  assert.ok(!masked.includes('`code`'));
  assert.ok(!masked.includes('<b>'));
  assert.ok(masked.includes('本文です。'));
  assert.ok(masked.includes('[l]'));
});

test('scanFences accepts indented fences, unclosed fences and ~~~; autolinks are not HTML', () => {
  const t = '- item\n\n  ```js\n  const a = 1;\n  ```\n\n本文。\n\n~~~\nx\n~~~\n\n```text\nunclosed\n';
  const f = scanFences(t);
  assert.deepStrictEqual(f.map((x) => [x.lang, x.line, Boolean(x.unclosed)]), [['js', 3, false], ['', 9, false], ['text', 13, true]]);
  const masked = maskMarkdown(t);
  assert.ok(!masked.includes('const a') && !masked.includes('unclosed') && masked.includes('本文。'));
  assert.deepStrictEqual(fencedBlocks(t).map((b) => b.lang), ['js', '', 'text']);
  const html = maskMarkdown('<https://a.b/c> <b>x</b> <img src="y">', { frontmatter: false });
  assert.ok(html.includes('<') && !html.includes('<b>') && !html.includes('<img'));
});

test('URL_RE stops at Japanese text and full-width punctuation; normalizeUrl strips trailing symbols and query', () => {
  const urls = extractLinks('正本はhttps://zenn.dev/u/articles/aです。（https://x.y/b）https://e.f/g.').map((l) => l.url);
  assert.deepStrictEqual(urls, ['https://zenn.dev/u/articles/a', 'https://x.y/b', 'https://e.f/g']);
  assert.strictEqual(normalizeUrl('https://zenn.dev/u/articles/a?utm_source=x'), 'https://zenn.dev/u/articles/a');
  assert.strictEqual(normalizeUrl('https://zenn.dev/u/articles/a/.'), 'https://zenn.dev/u/articles/a');
  assert.ok(new RegExp(URL_RE.source).test('https://zenn.dev/'));
});

test('splitFrontmatter parses YAML and reports the body start line', () => {
  const { frontmatter, body, bodyLine } = splitFrontmatter(SAMPLE);
  assert.deepStrictEqual(frontmatter, { title: 'x', topics: ['a'] });
  assert.strictEqual(bodyLine, 5);
  assert.ok(body.startsWith('\n## 見出し'));
  assert.strictEqual(splitFrontmatter('no frontmatter').frontmatter, null);
});

test('sentences, headings, fencedBlocks and extractLinks give positions', () => {
  const s = sentences(SAMPLE).map((x) => x.text);
  assert.ok(s.includes('本文です。'));
  assert.ok(s.includes('次の文！'));
  assert.ok(!s.includes('見出し'), 'headings are not sentences');
  assert.deepStrictEqual(headings(SAMPLE).map((h) => [h.level, h.text]), [[2, '見出し']]);
  assert.deepStrictEqual(headings('## b ##\n### c #\n').map((h) => h.text), ['b', 'c']);
  assert.deepStrictEqual(fencedBlocks(SAMPLE).map((b) => b.lang), ['js']);
  assert.deepStrictEqual(extractLinks(SAMPLE).map((l) => l.url), ['https://a.b/c', 'https://x.y']);
  assert.ok(countChars(SAMPLE) > countProseChars(SAMPLE));
  assert.deepStrictEqual(sentences('正本の文です、この文は\n続きます。', { joinSoftBreaks: true }).map((x) => x.text), ['正本の文です、この文は続きます。']);
});

test('findUnclosedStrong reports the broken line inside a multi-line paragraph and accepts CRLF', () => {
  assert.deepStrictEqual(findUnclosedStrong('**ok** line1\nline2\n**文。 **次 line3\n', 10).map((x) => x.line), [12]);
  assert.deepStrictEqual(findUnclosedStrong('para\r\n\r\n**文。 **次\r\n', 1).map((x) => x.line), [3]);
  assert.deepStrictEqual(findUnclosedStrong('**文。** 次\n\n`**` in code\n', 1), []);
});

test('parseArgs takes values for --only and --report-dir in both forms', () => {
  const a = parseArgs(['--only', 'terms', '--report-dir', '.tmp/x', '--strict', 'file.md']);
  assert.strictEqual(a.values.get('only'), 'terms');
  assert.strictEqual(a.values.get('report-dir'), '.tmp/x');
  assert.ok(a.flags.has('strict'));
  assert.deepStrictEqual(a.positional, ['file.md']);
  assert.strictEqual(parseArgs(['--only=zenn']).values.get('only'), 'zenn');
});

test('Report tracks errors and warnings and produces a JSON summary', () => {
  const r = new Report('t');
  r.file('a.md');
  r.error('a.md', 'X1', 'bad', 3);
  r.warn('a.md', 'X2', 'meh');
  assert.strictEqual(r.errors.length, 1);
  assert.strictEqual(r.warnings.length, 1);
  assert.strictEqual(r.exitCode(), 1);
  assert.strictEqual(new Report('ok').exitCode(), 0);
  const w = new Report('w');
  w.warn('a', 'c', 'm');
  assert.strictEqual(w.exitCode(), 0);
  assert.strictEqual(w.exitCode({ strict: true }), 1);
  assert.strictEqual(r.toJSON().errors[0].line, 3);
  assert.match(r.summary(), /errors 1, warnings 1/);
});
