import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fingerprint, noteKeyFromUrl, decidePublish, writeEntry, getEntry, isPublishable } from '../../scripts/note-ledger.mjs';

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
