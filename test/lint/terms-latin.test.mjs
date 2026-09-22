import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { checkScope } from '../../scripts/lint/check-terms.mjs';

function scope(overrides = {}) {
  return {
    id: 'fixture-latin',
    title: 'fixture-latin',
    include: ['test/fixtures/lint/terms-latin/*.md'],
    exclude: [],
    rules: [],
    allow: new Set(),
    auto: 'off',
    latin_policy: null,
    ...overrides,
  };
}

test('T4 latin policy: reports density when threshold is exceeded, and respects allow/allow_patterns/multi-word allows', () => {
  const dir = path.join(process.cwd(), 'test', 'fixtures', 'lint', 'terms-latin');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'sample.md');

  try {
    // 3 unallowed latin words: gate, merge, lane
    // 10 Japanese characters ("日本語の本文です。テスト")
    // Density = 3 / (10 / 100) = 30.0, which is > 1.0 (threshold)
    fs.writeFileSync(file, [
      '---',
      'title: "テスト"',
      '---',
      '',
      '日本語の本文です。テスト',
      '',
      'gate merge lane `ignoreInline`',
      '```js',
      'const ignoreFenced = "hello";',
      '```',
      'Claude Code', // Multi-word allowed, should be ignored
      'GitHub',      // Allowed, should be ignored
      'ADR-0001',    // Allowed pattern, should be ignored
      'v12',         // Allowed pattern, should be ignored
      'a',           // Single lowercase letter, should be ignored
      '',
      '[^1]: 脚注定義の中の ignoreMe は無視されるべき。',
      '![画像](http://example.com/image.png)',
      '> リポジトリ: ignoreThisToo',
      '| table |',
      '|---|',
      '',
      '[^1]', // 脚注参照
    ].join('\n'), 'utf8');

    const s = scope({
      latin_policy: {
        threshold: 1.0,
        allow: new Set(['Claude Code', 'GitHub', 'table']),
        allow_patterns: ['^ADR-\\d{4}$', '^v\\d+$']
      }
    });

    const r = checkScope(s);
    const t4 = r.items.filter(item => item.code === 'T4');
    assert.strictEqual(t4.length, 1);
    assert.strictEqual(t4[0].severity, 'warning');
    assert.ok(t4[0].message.includes('T4 英字語の出自'));
    assert.ok(t4[0].message.includes('gate'));
    assert.ok(t4[0].message.includes('merge'));
    assert.ok(t4[0].message.includes('lane'));
    // Should NOT include ignored/allowed ones
    assert.ok(!t4[0].message.includes('Claude'));
    assert.ok(!t4[0].message.includes('Code'));
    assert.ok(!t4[0].message.includes('GitHub'));
    assert.ok(!t4[0].message.includes('ADR'));
    assert.ok(!t4[0].message.includes('v12'));
    assert.ok(!t4[0].message.includes('ignore'));

    // Check with strict option where T4 should be error
    const rStrict = checkScope(s, { strict: true });
    const t4Strict = rStrict.items.filter(item => item.code === 'T4');
    assert.strictEqual(t4Strict.length, 1);
    assert.strictEqual(t4Strict[0].severity, 'error');

    // Check scope without latin_policy produces nothing
    const sNoPolicy = scope({ latin_policy: null });
    const rNoPolicy = checkScope(sNoPolicy);
    const t4NoPolicy = rNoPolicy.items.filter(item => item.code === 'T4');
    assert.strictEqual(t4NoPolicy.length, 0);

    // latin_include limits T4 to the files it matches (the book, not its derivatives)
    const sOtherFiles = scope({ latin_policy: s.latin_policy, latin_include: ['books/other/*.md'] });
    assert.strictEqual(checkScope(sOtherFiles).items.filter(item => item.code === 'T4').length, 0);
    const sThisFile = scope({ latin_policy: s.latin_policy, latin_include: ['test/fixtures/lint/terms-latin/*.md'] });
    assert.strictEqual(checkScope(sThisFile).items.filter(item => item.code === 'T4').length, 1);

  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});


test('T4 latin policy: maskTableColumns blanks the cells of configured columns only', async () => {
  const { maskTableColumns } = await import('../../scripts/lint/check-terms.mjs');
  const md = [
    '| 本書の呼び名 | 意味 | リポジトリでの名前 |',
    '| --- | --- | --- |',
    '| 企画部 | 何を作るか | PO |',
    '',
    'PO は本文に残る',
  ].join('\n');
  const out = maskTableColumns(md, ['リポジトリでの名前']);
  assert.ok(!/\| PO \|/.test(out), 'the configured column is blanked');
  assert.ok(/\| 企画部 \|/.test(out), 'other columns are kept');
  assert.ok(/PO は本文に残る/.test(out), 'prose outside the table is kept');
});
