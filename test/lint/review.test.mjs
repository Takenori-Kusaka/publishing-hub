import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalize, hashOf, quoteExists, recordPathFor } from '../../scripts/lint/check-review.mjs';

test('hashOf: Qiita の同期が書き戻す欄(id・updated_at・キャンペーンのキー・title の引用符)ではハッシュが変わらない', () => {
  const f = 'platforms/qiita/public/x.md';
  const before = "---\ntitle: 'A — b'\ntags:\n  - t\nprivate: false\nupdated_at: ''\nid: null\nslide: false\n---\n\n本文\n";
  const after = "---\ntitle: A — b\ntags:\n  - t\nprivate: false\nupdated_at: '2026-10-12T18:40:36+09:00'\nid: 5d348e2a993248f11aac\nslide: false\nposting_campaign_uuid: null\nagreed_posting_campaign_term: false\n---\n\n本文\n";
  assert.strictEqual(hashOf(after, f), hashOf(before, f));
  assert.strictEqual(hashOf(before, f), hashOf(before), '同期前の形は、これまでのハッシュと同じ値になる');
  // 人が決める欄と本文は照合の対象のまま
  assert.notStrictEqual(hashOf(after.replace('A — b', 'A — c'), f), hashOf(before, f));
  assert.notStrictEqual(hashOf(after.replace('private: false', 'private: true'), f), hashOf(before, f));
  assert.notStrictEqual(hashOf(after.replace('本文', '本文2'), f), hashOf(before, f));
  // Qiita 以外の媒体はそろえない
  assert.notStrictEqual(hashOf(after, 'articles/x.md'), hashOf(before, 'articles/x.md'));
});

test('normalize: CRLF と行末の空白と末尾の改行をそろえる', () => {
  assert.strictEqual(normalize('a  \r\nb\r\n\r\n'), 'a\nb\n');
  assert.strictEqual(hashOf('a\r\nb'), hashOf('a\nb\n'));
});

test('quoteExists: 原稿側の折り返しと空白を無視して逐語を照合する', () => {
  assert.ok(quoteExists('決められた場所では\n必ず人間が触る。', '決められた場所では必ず人間が触る'));
  assert.ok(!quoteExists('決められた場所では必ず人間が触る。', '決められた場所で人間が触る'));
});

test('recordPathFor: 原稿の隣に .review.yaml を置く', () => {
  const policy = { record_suffix: '.review.yaml' };
  assert.strictEqual(recordPathFor('articles/x.md', policy), 'articles/x.review.yaml');
  assert.strictEqual(recordPathFor('social/posts/x.yaml', policy), 'social/posts/x.review.yaml');
});

test('schema: 記録の書式(必須の節が揃っているか)', async () => {
  const Ajv = (await import('ajv/dist/2020.js')).default;
  const schema = JSON.parse(fs.readFileSync('lint/review/review-record.schema.json', 'utf8'));
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
  const ok = {
    schema: 'review-record/1',
    subject: { path: 'articles/x.md', sha256: 'a'.repeat(64), medium: 'zenn', terms: ['ピットイン方式'] },
    reviewer: { fact_session_id: 'fact-0001', cold_session_id: 'cold-0001', writer_session_id: 'writer-0001', allowed_inputs: { fact: ['subject', 'canonical'], cold: ['subject_body_only'] } },
    fact_review: { claims: [{ id: 'C01', quote: 'abcd', status: 'unsupported', severity: '止める' }], not_checked: ['x'] },
    cold_read: { first_lines_given: 3, subject_identified: 'ピットイン方式', subject_is_named_in_first_lines: true, unintelligible: [], bounce_points: [], ending_natural: true },
    adoption: [{ finding: 'C01', decision: '削る', rule: 'AGENTS-2.3-2', fixed_in_sha256: 'b'.repeat(64) }],
    summary: { verdict: 'go-with-fixes', top_risks: [], reviewed_at: '2026-10-12' },
  };
  assert.ok(validate(ok), JSON.stringify(validate.errors));
  const bad = { ...ok, cold_read: { ...ok.cold_read, subject_identified: '' } };
  assert.ok(!validate(bad));
});

test('targets: 公開のスイッチの読み方(フィクスチャ)', async () => {
  const { targets } = await import('../../scripts/lint/check-review.mjs');
  const policy = JSON.parse(fs.readFileSync('lint/policies/review.json', 'utf8'));
  const list = targets(policy);
  // 既存の公開済み原稿は grandfathered に全部載っているか(載っていないものが残っていれば R1 で落ちる)
  const gf = policy.grandfathered.files;
  const missing = list.map((t) => t.file).filter((f) => !(f in gf) && !fs.existsSync(f.replace(/\.(md|ya?ml)$/i, '.review.yaml')));
  assert.deepStrictEqual(missing, [], `記録も grandfathered も無い公開原稿: ${missing.join(', ')}`);
});

test('同一コミットの検出は、未コミットなら null を返す', async () => {
  const { sameCommitTouches } = await import('../../scripts/lint/check-review.mjs');
  const tmp = path.join(os.tmpdir(), `rv-${Date.now()}.review.yaml`);
  fs.writeFileSync(tmp, 'x');
  try {
    assert.strictEqual(sameCommitTouches(tmp, 'articles/none.md'), null);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
});
