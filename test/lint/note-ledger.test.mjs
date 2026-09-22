import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fingerprint, noteKeyFromUrl, decidePublish, writeEntry, getEntry, isPublishable, publicNoteUrl, fetchNoteUrl, noteApiWarnings, ledgerRecord, overlayRecord, RECORD_FIELDS, NOTE_API } from '../../scripts/note-ledger.mjs';

test('fingerprint changes when the title or body changes, and is stable otherwise', () => {
  const a = fingerprint('題', '<p>本文</p>');
  assert.strictEqual(a, fingerprint('題', '<p>本文</p>'));
  assert.notStrictEqual(a, fingerprint('題', '<p>本文2</p>'));
  assert.notStrictEqual(a, fingerprint('題2', '<p>本文</p>'));
});

test('noteKeyFromUrl extracts the key from a published note URL', () => {
  assert.strictEqual(noteKeyFromUrl('https://note.com/t_k_official/n/n7f7edb054090'), 'n7f7edb054090');
  assert.strictEqual(noteKeyFromUrl('https://note.com/user/n/abc123?foo=1'), 'abc123');
  assert.strictEqual(noteKeyFromUrl('https://editor.note.com/new'), null);
  assert.strictEqual(noteKeyFromUrl(''), null);
});

test('noteKeyFromUrl also extracts the key from the editor URL shown after publishing', () => {
  // 2026-09-22 の更新の実行で、投稿の後のページはこの形だった(run 35730622614)。新規の投稿でこの形だと、旧い正規表現では key が null になり台帳が書かれない
  assert.strictEqual(noteKeyFromUrl('https://editor.note.com/notes/na2eb161143cd/publish/'), 'na2eb161143cd');
  assert.strictEqual(noteKeyFromUrl('https://editor.note.com/notes/na2eb161143cd/edit'), 'na2eb161143cd');
  assert.strictEqual(noteKeyFromUrl('https://editor.note.com/notes/na2eb161143cd'), 'na2eb161143cd');
  assert.strictEqual(noteKeyFromUrl('https://editor.note.com/notes/'), null);
});

test('publicNoteUrl accepts only the public page of the same key', () => {
  const key = 'na2eb161143cd';
  assert.strictEqual(publicNoteUrl('https://note.com/t_k_official/n/na2eb161143cd', key), 'https://note.com/t_k_official/n/na2eb161143cd');
  assert.strictEqual(publicNoteUrl('https://note.com/t_k_official/n/nOTHER', key), null, '別の投稿の URL');
  assert.strictEqual(publicNoteUrl('https://editor.note.com/notes/na2eb161143cd/publish/', key), null, 'エディタの URL');
  // 18c948d が台帳に書いた形(HTTP 404)。パスは /n/<key> で終わるが、user の位置が notes
  assert.strictEqual(publicNoteUrl('https://note.com/notes/n/na2eb161143cd', key), null, 'user の位置が notes');
  assert.strictEqual(publicNoteUrl('http://note.com/t_k_official/n/na2eb161143cd', key), null, 'https でない');
  assert.strictEqual(publicNoteUrl('not a url', key), null);
  assert.strictEqual(publicNoteUrl(undefined, key), null);
  assert.strictEqual(publicNoteUrl('https://note.com/t_k_official/n/na2eb161143cd', ''), null);
});

test('fetchNoteUrl reads data.note_url, data.publish_at and data.status from the public API and never throws', async () => {
  const key = 'na2eb161143cd';
  const asked = [];
  // 2026-09-22 に取得した応答(https://note.com/api/v3/notes/na2eb161143cd)の該当の項目
  const ok = await fetchNoteUrl(key, async (u) => {
    asked.push(u);
    return { data: { key, note_url: 'https://note.com/t_k_official/n/na2eb161143cd', publish_at: '2026-09-13T20:18:59.000+09:00', status: 'published' } };
  });
  assert.deepStrictEqual(asked, [`${NOTE_API}${key}`]);
  assert.deepStrictEqual(ok, { url: 'https://note.com/t_k_official/n/na2eb161143cd', publishedAt: '2026-09-13T11:18:59.000Z', status: 'published', reason: null });

  const failed = await fetchNoteUrl(key, async () => {
    throw new Error('HTTP 404');
  });
  assert.deepStrictEqual({ ...failed, reason: undefined }, { url: null, publishedAt: null, status: null, reason: undefined });
  assert.match(failed.reason, /HTTP 404/);

  for (const body of [{ data: { note_url: 'https://note.com/u/n/nOTHER' } }, { data: { note_url: 'https://note.com/notes/n/na2eb161143cd' } }, { data: {} }, null]) {
    const r = await fetchNoteUrl(key, async () => body);
    assert.strictEqual(r.url, null, JSON.stringify(body));
    assert.match(r.reason, /公開ページの URL ではありません/);
  }

  // 下書きのまま(status が published でない)でも、取れた項目は返す。publish_at が無い・読めないときは null
  const draft = await fetchNoteUrl(key, async () => ({ data: { key, note_url: 'https://note.com/t_k_official/n/na2eb161143cd', publish_at: null, status: 'draft' } }));
  assert.deepStrictEqual(draft, { url: 'https://note.com/t_k_official/n/na2eb161143cd', publishedAt: null, status: 'draft', reason: null });
  const badDate = await fetchNoteUrl(key, async () => ({ data: { publish_at: 'not a date', status: 'published' } }));
  assert.strictEqual(badDate.publishedAt, null);
  assert.strictEqual(badDate.status, 'published');
});

test('noteApiWarnings warns when the URL is missing or the post is not published, and is silent for a published post', () => {
  const key = 'nKEY';
  assert.deepStrictEqual(noteApiWarnings(key, { url: 'https://note.com/u/n/nKEY', publishedAt: 't', status: 'published', reason: null }), []);

  const noUrl = noteApiWarnings(key, { url: null, publishedAt: null, status: null, reason: 'HTTP 404' });
  assert.strictEqual(noUrl.length, 1, '通信に失敗したとき(status が分からない)は、URL の警告だけ');
  assert.match(noUrl[0], /URL を取れませんでした\(HTTP 404\)/);

  const draft = noteApiWarnings(key, { url: 'https://note.com/u/n/nKEY', publishedAt: null, status: 'draft', reason: null });
  assert.strictEqual(draft.length, 1);
  assert.match(draft[0], /status が "draft" です/);
  assert.match(draft[0], /台帳には記録します/, '記録は残す(残さないと次のマージで同じ原稿をもう 1 本作る)');
});

test('ledgerRecord: updating the same post keeps url and published_at and writes updated_at', () => {
  const entry = { note_key: 'nKEY', url: 'https://note.com/u/n/nKEY', note: '手で書いた説明', fingerprint: 'f0', title: '題', published_at: '2026-09-13T11:18:59.000Z' };
  const now = '2026-09-22T13:02:04.765Z';
  const r = ledgerRecord({ entry, noteKey: 'nKEY', fingerprint: 'f1', title: '題2', publicUrl: 'https://note.com/other/n/nKEY', now });
  assert.deepStrictEqual(r, { note_key: 'nKEY', url: 'https://note.com/u/n/nKEY', fingerprint: 'f1', title: '題2', published_at: '2026-09-13T11:18:59.000Z', updated_at: now });

  // 台帳に url が無い記録(新規の投稿で公開 API から取れなかった)は、この実行で取れた URL で補う。published_at が無ければ作らない
  const bare = ledgerRecord({ entry: { note_key: 'nKEY', fingerprint: 'f0' }, noteKey: 'nKEY', fingerprint: 'f1', title: '題', publicUrl: 'https://note.com/u/n/nKEY', now });
  assert.strictEqual(bare.url, 'https://note.com/u/n/nKEY');
  assert.ok(!('published_at' in bare), '初回の公開日時が分からない更新では published_at を作らない');
  assert.strictEqual(bare.updated_at, now);

  // 公開 API の publish_at は、台帳に published_at が無いときだけ補う。台帳にあれば台帳の値を保つ
  const filled = ledgerRecord({ entry: { note_key: 'nKEY', fingerprint: 'f0' }, noteKey: 'nKEY', fingerprint: 'f1', title: '題', notePublishedAt: '2026-09-13T11:18:59.000Z', now });
  assert.strictEqual(filled.published_at, '2026-09-13T11:18:59.000Z');
  const kept = ledgerRecord({ entry, noteKey: 'nKEY', fingerprint: 'f1', title: '題', notePublishedAt: '2026-01-01T00:00:00.000Z', now });
  assert.strictEqual(kept.published_at, '2026-09-13T11:18:59.000Z');
});

test('ledgerRecord: a new post writes published_at and updated_at, and url only when the public API gave one', () => {
  const now = '2026-09-22T13:02:04.765Z';
  const r = ledgerRecord({ entry: null, noteKey: 'nNEW', fingerprint: 'f1', title: '題', publicUrl: 'https://note.com/u/n/nNEW', now });
  assert.deepStrictEqual(r, { note_key: 'nNEW', url: 'https://note.com/u/n/nNEW', fingerprint: 'f1', title: '題', published_at: now, updated_at: now });

  // 公開 API の publish_at が取れれば、実行の時刻ではなくそれを初回の公開日時にする
  const publishAt = '2026-09-22T13:01:58.000Z';
  const fromApi = ledgerRecord({ entry: null, noteKey: 'nNEW', fingerprint: 'f1', title: '題', publicUrl: 'https://note.com/u/n/nNEW', notePublishedAt: publishAt, now });
  assert.strictEqual(fromApi.published_at, publishAt);
  assert.strictEqual(fromApi.updated_at, now);

  const noUrl = ledgerRecord({ entry: null, noteKey: 'nNEW', fingerprint: 'f1', title: '題', publicUrl: null, now });
  assert.ok(!('url' in noUrl), 'URL を取れなければ url を書かない(エディタの URL から組み立てない)');
  assert.strictEqual(noUrl.published_at, now);
  assert.strictEqual(noUrl.updated_at, now);

  // 台帳の記録と key が違えば、同じ投稿ではない。古い記録の url と published_at を引き継がない
  const other = ledgerRecord({ entry: { note_key: 'nOLD', url: 'https://note.com/u/n/nOLD', published_at: '2026-01-01T00:00:00.000Z' }, noteKey: 'nNEW', fingerprint: 'f1', title: '題', publicUrl: null, now });
  assert.ok(!('url' in other));
  assert.strictEqual(other.published_at, now);

  for (const rec of [r, noUrl, other]) assert.ok(Object.keys(rec).every((k) => RECORD_FIELDS.includes(k)), '記録の項目は RECORD_FIELDS の中だけ');
});

test('an update written to the ledger keeps url, published_at and the hand-written note, and adds updated_at', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'note-ledger-'));
  const ledgerPath = path.join(dir, 'ledger.json');
  const first = '2026-09-22T00:00:00.000Z';
  writeEntry('x', ledgerRecord({ entry: null, noteKey: 'nKEY', fingerprint: 'f0', title: '題', publicUrl: 'https://note.com/u/n/nKEY', now: first }), ledgerPath);
  writeEntry('x', { note: '手で書いた説明' }, ledgerPath);

  const d = decidePublish('x', 'f1', { ledgerPath, status: 'ready' });
  assert.strictEqual(d.action, 'update');
  const later = '2026-09-23T00:00:00.000Z';
  writeEntry('x', ledgerRecord({ entry: d.entry, noteKey: 'nKEY', fingerprint: 'f1', title: '題', publicUrl: null, now: later }), ledgerPath);
  assert.deepStrictEqual(getEntry('x', ledgerPath), { note_key: 'nKEY', url: 'https://note.com/u/n/nKEY', fingerprint: 'f1', title: '題', published_at: first, updated_at: later, note: '手で書いた説明' });
});

test('writeEntry: a record of another post (a different note_key) without url does not keep the old url or published_at', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'note-ledger-'));
  const ledgerPath = path.join(dir, 'ledger.json');
  writeEntry('x', { note_key: 'nOLD', url: 'https://note.com/u/n/nOLD', fingerprint: 'f0', title: '題', published_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-02T00:00:00.000Z', note: '手で書いた説明' }, ledgerPath);

  const now = '2026-09-22T13:02:04.765Z';
  const record = ledgerRecord({ entry: getEntry('x', ledgerPath), noteKey: 'nNEW', fingerprint: 'f1', title: '題', publicUrl: null, now });
  writeEntry('x', record, ledgerPath);
  const got = getEntry('x', ledgerPath);
  assert.ok(!('url' in got), `古い投稿の url を新しい note_key に付けない: ${JSON.stringify(got)}`);
  assert.deepStrictEqual(got, { note: '手で書いた説明', ...record }, 'RECORD_FIELDS は record の値だけにし、人が書いた note は残す');

  // record に note_key が無い書き込み(人の note を足すなど)は、今の記録をそのまま残す
  writeEntry('x', { note: '書き直した説明' }, ledgerPath);
  assert.deepStrictEqual(getEntry('x', ledgerPath), { ...got, note: '書き直した説明' });
});

test('decidePublish: a record without url (the public API failed) is still the same post', () => {
  const ledger = { posts: { x: { note_key: 'nKEY', fingerprint: 'f0', published_at: '2026-09-22T00:00:00.000Z', updated_at: '2026-09-22T00:00:00.000Z' } } };
  assert.strictEqual(decidePublish('x', 'f0', { ledger, status: 'ready' }).action, 'skip');
  assert.strictEqual(decidePublish('x', 'f1', { ledger, status: 'ready' }).action, 'update');
  assert.strictEqual(decidePublish('x', 'f1', { ledger, status: 'published' }).action, 'update');
});

test('overlayRecord keeps the url and published_at on main for the same post, and takes the record for a new one', () => {
  const main = { note_key: 'nKEY', url: 'https://note.com/u/n/nKEY', note: '手で書いた説明', fingerprint: 'f0', published_at: '2026-09-13T11:18:59.000Z' };
  // 18c948d が書いた形(開けない url と、更新の時刻の published_at)が来ても、main の値を保つ
  const stale = { note_key: 'nKEY', url: 'https://note.com/notes/n/nKEY', fingerprint: 'f1', published_at: '2026-09-22T13:02:04.765Z', updated_at: '2026-09-22T13:02:04.765Z' };
  assert.deepStrictEqual(overlayRecord(main, stale), { ...main, fingerprint: 'f1', updated_at: '2026-09-22T13:02:04.765Z' });
  // main に url が無ければ record の url で補う
  const noUrl = { ...main };
  delete noUrl.url;
  assert.strictEqual(overlayRecord(noUrl, { note_key: 'nKEY', url: 'https://note.com/u/n/nKEY' }).url, 'https://note.com/u/n/nKEY');
  // 別の投稿(key が違う)と、main に記録が無い投稿は record の値
  const fresh = { note_key: 'nNEW', url: 'https://note.com/u/n/nNEW', fingerprint: 'f1', published_at: 't', updated_at: 't' };
  assert.deepStrictEqual(overlayRecord(main, fresh), { ...main, ...fresh });
  assert.deepStrictEqual(overlayRecord(undefined, fresh), fresh);
  // 別の投稿で url が無い記録(公開 API から取れなかった新規の投稿)は、main の古い投稿の url と published_at を引き継がない
  const freshNoUrl = { note_key: 'nNEW', fingerprint: 'f1', title: '題', updated_at: 't' };
  const merged = overlayRecord(main, freshNoUrl);
  assert.ok(!('url' in merged), `古い投稿の url を新しい note_key に付けない: ${JSON.stringify(merged)}`);
  assert.ok(!('published_at' in merged), '古い投稿の published_at を引き継がない');
  assert.deepStrictEqual(merged, { note: '手で書いた説明', ...freshNoUrl }, '人が書いた note は残す');
});

test('decidePublish creates, updates or skips based on the ledger and content fingerprint', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'note-ledger-'));
  const ledgerPath = path.join(dir, 'ledger.json');
  const fp = fingerprint('題', '<p>v1</p>');

  // no entry yet -> create
  assert.strictEqual(decidePublish('x', fp, { ledgerPath }).action, 'create');

  // record a post, then the same content -> skip
  writeEntry('x', { note_key: 'nKEY', url: 'https://note.com/u/n/nKEY', fingerprint: fp }, ledgerPath);
  assert.strictEqual(getEntry('x', ledgerPath).note_key, 'nKEY');
  assert.strictEqual(decidePublish('x', fp, { ledgerPath }).action, 'skip');

  // force overrides skip -> update
  assert.strictEqual(decidePublish('x', fp, { ledgerPath, force: true }).action, 'update');

  // changed content -> update the same post (no duplicate)
  const fp2 = fingerprint('題', '<p>v2</p>');
  const d = decidePublish('x', fp2, { ledgerPath });
  assert.strictEqual(d.action, 'update');
  assert.strictEqual(d.entry.note_key, 'nKEY');
});

test('decidePublish: a published manuscript without a ledger record is refused, never created', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'note-ledger-'));
  const ledgerPath = path.join(dir, 'ledger.json');
  const fp = fingerprint('題', '<p>v1</p>');

  // published で記録が無い -> 投稿しない(台帳の外で投稿されたものを重複して作らない)。force でも変わらない
  assert.strictEqual(decidePublish('p', fp, { ledgerPath, status: 'published' }).action, 'refuse');
  assert.strictEqual(decidePublish('p', fp, { ledgerPath, status: 'published', force: true }).action, 'refuse');
  // ready で記録が無い -> 新規
  assert.strictEqual(decidePublish('p', fp, { ledgerPath, status: 'ready' }).action, 'create');

  // 記録があれば、published も ready と同じく、内容が同じなら skip、変われば同じ投稿を update
  writeEntry('p', { note_key: 'nP', url: 'https://note.com/u/n/nP', fingerprint: fp }, ledgerPath);
  assert.strictEqual(decidePublish('p', fp, { ledgerPath, status: 'published' }).action, 'skip');
  const d = decidePublish('p', fingerprint('題', '<p>v2</p>'), { ledgerPath, status: 'published' });
  assert.strictEqual(d.action, 'update');
  assert.strictEqual(d.entry.note_key, 'nP');
});

test('isPublishable: only ready and published are posted', () => {
  assert.deepStrictEqual(['ready', 'published', 'draft', 'retired', null, undefined].map(isPublishable), [true, true, false, false, false, false]);
});
