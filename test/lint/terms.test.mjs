import { test } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { checkScope, loadScopes, autoOwners, textUnits } from '../../scripts/lint/check-terms.mjs';

const require = createRequire(import.meta.url);

function scope(overrides = {}) {
  return {
    id: 'fixture',
    title: 'fixture',
    include: ['test/fixtures/lint/terms/*.md'],
    exclude: [],
    rules: [
      { expected: 'GitHub', reason: '公式表記', dictionary: 'x', fix: true, replacement: 'GitHub', patterns: [/(?<![A-Za-z])Github(?![A-Za-z])/g, /(?<![A-Za-z./@_-])github(?![A-Za-z./@_-])/g] },
      { expected: 'サーバ', reason: '長音なし', dictionary: 'x', fix: true, replacement: 'サーバ', patterns: [/サーバー/g] },
    ],
    allow: new Set(),
    auto: 'warning',
    ...overrides,
  };
}

test('T1: dictionary violations are reported in prose and title, but not inside code, URLs or inline code', () => {
  const r = checkScope(scope());
  const t1 = r.errors.filter((e) => e.code === 'T1');
  const found = t1.map((e) => /"([^"]+)"/.exec(e.message)[1]);
  assert.deepStrictEqual(found.sort(), ['Github', 'Github', 'サーバー'].sort());
  // one Github in the body (line 7) and one in the title
  assert.ok(t1.some((e) => e.line === 7));
  assert.ok(t1.some((e) => e.message.includes('(title)')));
  assert.ok(!t1.some((e) => e.message.includes('github.com')));
});

test('T2/T3: auto detection reports long-vowel and spacing variants coexisting in the same scope', () => {
  const r = checkScope(scope());
  const codes = r.warnings.map((w) => w.code);
  assert.ok(codes.includes('T2'), 'ユーザ / ユーザー should be detected');
  assert.ok(codes.includes('T3'), '生成 AI / 生成AI should be detected');
  assert.ok(r.warnings.some((w) => w.message.includes('ユーザ')));
  assert.ok(r.warnings.some((w) => w.message.includes('生成')));
});

test('auto detection can be switched off per scope and is owned by the most specific scope', () => {
  const r = checkScope(scope({ auto: 'off' }));
  assert.strictEqual(r.warnings.length, 0);
  const a = scope({ id: 'general' });
  const b = scope({ id: 'specific' });
  const owners = autoOwners([a, b]);
  assert.strictEqual(owners.get('test/fixtures/lint/terms/sample.md'), 'specific');
  const ra = checkScope(a, { owners });
  assert.strictEqual(ra.warnings.length, 0, 'the general scope must not duplicate the auto findings');
  const rb = checkScope(b, { owners });
  assert.ok(rb.warnings.length > 0);
});

test('the shipped index and dictionaries load and every pattern compiles', () => {
  const scopes = loadScopes();
  assert.ok(scopes.length >= 5);
  for (const s of scopes) {
    assert.ok(s.include.length > 0, `${s.id} has include globs`);
    for (const rule of s.rules) {
      assert.ok(rule.expected, `${s.id}: rule has expected`);
      assert.ok(rule.patterns.length > 0, `${s.id}: ${rule.expected} has patterns`);
      for (const re of rule.patterns) {
        re.lastIndex = 0;
        assert.strictEqual(re.test(rule.expected), false, `${s.id}: pattern ${re} must not match its own expected form "${rule.expected}"`);
        re.lastIndex = 0;
        // 置換後の文字列が再び同じパターンに一致しない(--fix が収束する)
        if (rule.fix) {
          re.lastIndex = 0;
          assert.strictEqual(re.test(rule.replacement), false, `${s.id}: replacement "${rule.replacement}" of ${re} must not match the pattern again`);
          re.lastIndex = 0;
        }
      }
    }
  }
});

test('--fix rewrites only the matched span, honours replacement and fix:false, and keeps title/code/URL intact', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const dir = path.join(process.cwd(), 'test', 'fixtures', 'lint', 'terms-fix');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'tmp.md');
  fs.writeFileSync(file, '---\ntitle: "Github の使い方"\n---\n\nGithub と `Github` と https://github.com/x を、紐付けと紐付く。\n', 'utf8');
  try {
    const s = scope({
      include: ['test/fixtures/lint/terms-fix/*.md'],
      auto: 'off',
      rules: [
        { expected: 'GitHub', reason: '', dictionary: 'x', fix: true, replacement: 'GitHub', patterns: [/(?<![A-Za-z])Github(?![A-Za-z])/g] },
        { expected: '紐づく', reason: '', dictionary: 'x', fix: true, replacement: '紐づ', patterns: [/紐付(?=[くけい])/g] },
      ],
    });
    checkScope(s, { fix: true });
    const out = fs.readFileSync(file, 'utf8');
    assert.strictEqual(out, '---\ntitle: "Github の使い方"\n---\n\nGitHub と `Github` と https://github.com/x を、紐づけと紐づく。\n');
    // fix:false leaves the file untouched
    fs.writeFileSync(file, 'Github\n', 'utf8');
    const s2 = scope({ include: ['test/fixtures/lint/terms-fix/*.md'], auto: 'off', rules: [{ expected: 'GitHub', reason: '', dictionary: 'x', fix: false, replacement: 'GitHub', patterns: [/Github/g] }] });
    const r = checkScope(s2, { fix: true });
    assert.strictEqual(r.errors.length, 1);
    assert.strictEqual(fs.readFileSync(file, 'utf8'), 'Github\n');
    // CRLF is preserved
    fs.writeFileSync(file, 'Github\r\nx\r\n', 'utf8');
    checkScope(scope({ include: ['test/fixtures/lint/terms-fix/*.md'], auto: 'off', rules: [{ expected: 'GitHub', reason: '', dictionary: 'x', fix: true, replacement: 'GitHub', patterns: [/Github/g] }] }), { fix: true });
    assert.strictEqual(fs.readFileSync(file, 'utf8'), 'GitHub\r\nx\r\n');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('textUnits extracts prose fields from social YAML and body + title from Markdown', () => {
  const units = textUnits('social/fixtures/valid-single.yaml');
  const labels = units.map((u) => u.label);
  assert.ok(labels.includes('linkedin.text'));
  assert.ok(labels.includes('bluesky.posts[0].text'));
  assert.ok(labels.includes('source.title'));
  const md = textUnits('test/fixtures/lint/terms/sample.md');
  assert.strictEqual(md[0].label, null);
  assert.strictEqual(md[1].label, 'title');
});
