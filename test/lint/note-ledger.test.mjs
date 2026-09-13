import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fingerprint, noteKeyFromUrl, decidePublish, writeEntry, getEntry } from '../../scripts/note-ledger.mjs';

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
