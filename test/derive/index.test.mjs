// 派生物パイプラインの土台を、LLM を呼ばずに CI で守るテスト。
// 索引が決定的であること、要件表と較正データが正本と整合していることを確かめる。
// これにより、正本が変わっても、パイプラインの前提が崩れていないかを npm test が検出する。

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { buildIndex } from '../../scripts/derive/index.mjs';
import { readText } from '../../scripts/lint/lib.mjs';

const CANON = 'articles/multi-platform-publishing-architecture.md';
const REQ = 'lint/derive/requirements/multi-platform-publishing-architecture.json';
const CAL = 'test/derive/calibration/multi-platform-publishing-architecture.test.jsonl';

test('the canonical index is deterministic and ids are unique', () => {
  const a = buildIndex(CANON, readText(CANON));
  const b = buildIndex(CANON, readText(CANON));
  assert.deepStrictEqual(a, b, 'building twice gives the same index');
  const ids = a.sentences.map((s) => s.id);
  assert.strictEqual(ids.length, new Set(ids).size, 'sentence ids are unique');
  assert.ok(a.sentences.length > 100, 'the index has the canonical sentences');
});

test('every requirement section resolves to real canonical sentences', () => {
  const idx = buildIndex(CANON, readText(CANON));
  const sections = new Set(idx.sentences.map((s) => s.section));
  const ids = new Set(idx.sentences.map((s) => s.id));
  const req = JSON.parse(readText(REQ));
  for (const [ch, spec] of Object.entries(req.channels)) {
    for (const sec of spec.must_cover) assert.ok(sections.has(sec), `${ch} の must_cover ${sec} が正本にありません`);
    for (const w of spec.lay_wording || []) if (w.canonical_id) assert.ok(ids.has(w.canonical_id), `${ch} の lay_wording ${w.canonical_id} が正本にありません`);
  }
  for (const n of req.not_stated) if (n.canonical_id) assert.ok(ids.has(n.canonical_id), `not_stated ${n.canonical_id} が正本にありません`);
});

test('the calibration set is well-formed and covers the past failure families', () => {
  const rows = readText(CAL).split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
  const bad = rows.filter((r) => r.expected === 'bad');
  const good = rows.filter((r) => r.expected === 'good');
  assert.ok(bad.length >= 20, `bad が ${bad.length} 件(20 件以上)`);
  assert.ok(good.length >= 10, `good が ${good.length} 件(10 件以上)`);
  for (const r of rows) {
    assert.ok(typeof r.text === 'string' && r.text.length > 0, 'text がある');
    assert.ok(['bad', 'good'].includes(r.expected), 'expected は bad か good');
  }
  // 6 ラウンド生き残った失敗の系統が、負例として登録されている
  const cats = new Set(bad.map((r) => r.category));
  for (const c of ['selection-reason', 'effort-reduction', 'search-engine']) {
    assert.ok(cats.has(c), `過去の失敗系統 ${c} が較正データにありません`);
  }
});

test('the generated samples exist and carry the notice', () => {
  for (const f of ['scripts/derive/samples/qiita-multi-platform-publishing-architecture.md', 'scripts/derive/samples/note-multi-platform-publishing-architecture.md']) {
    assert.ok(fs.existsSync(f), `${f} がありません`);
    const t = readText(f);
    assert.ok(/生成AIを使って作成し、筆者が内容を確認/.test(t), `${f} に冒頭の告知がありません`);
  }
});
