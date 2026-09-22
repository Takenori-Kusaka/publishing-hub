import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { targetsForPush, targetForDispatch } from '../../scripts/note-targets.mjs';

// 一時の git リポジトリに note の原稿を置き、コミットの範囲で投稿の対象を決める(publish-note の push 契機)。
const DIR = 'platforms/note/public';

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'note-targets-'));
  const git = (...args) => execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', '-c', 'core.autocrlf=false', ...args], { cwd: root, encoding: 'utf8' }).trim();
  git('init', '-q');
  fs.mkdirSync(path.join(root, DIR), { recursive: true });
  const write = (id, status, body) => fs.writeFileSync(path.join(root, DIR, `${id}.md`), `---\ntitle: "${id}"\nstatus: ${status}\n---\n\n${body}\n`, 'utf8');
  const commit = (msg) => {
    git('add', '-A');
    git('commit', '-q', '--allow-empty', '-m', msg);
    return git('rev-parse', 'HEAD');
  };
  return { root, write, commit };
}

test('push: a ready manuscript whose body changed is a target, and one left unchanged is not', () => {
  const r = repo();
  r.write('edited', 'ready', '本文 v1');
  r.write('untouched', 'ready', '本文');
  const before = r.commit('base');
  r.write('edited', 'ready', '本文 v2');
  const after = r.commit('edit the body only');
  assert.deepStrictEqual(targetsForPush(before, after, r.root), ['edited']);
});

test('push: a published manuscript whose body changed is a target (the ledger decides to update)', () => {
  const r = repo();
  r.write('done', 'published', '本文 v1');
  const before = r.commit('base');
  r.write('done', 'published', '本文 v2');
  const after = r.commit('edit a published manuscript');
  assert.deepStrictEqual(targetsForPush(before, after, r.root), ['done']);
});

test('push: a manuscript that became ready, including a new one, is still a target', () => {
  const r = repo();
  r.write('switched', 'draft', '本文');
  const before = r.commit('base');
  r.write('switched', 'ready', '本文');
  r.write('added', 'ready', '本文');
  const after = r.commit('set ready and add one');
  assert.deepStrictEqual(targetsForPush(before, after, r.root).sort(), ['added', 'switched']);
});

test('push: draft and retired manuscripts are not targets even when they change', () => {
  const r = repo();
  r.write('wip', 'draft', '本文 v1');
  r.write('old', 'published', '本文');
  const before = r.commit('base');
  r.write('wip', 'draft', '本文 v2');
  r.write('old', 'retired', '本文');
  const after = r.commit('edit a draft and retire one');
  assert.deepStrictEqual(targetsForPush(before, after, r.root), []);
});

test('push: an unknown range yields no targets', () => {
  const r = repo();
  r.write('x', 'ready', '本文');
  const after = r.commit('base');
  assert.deepStrictEqual(targetsForPush('0000000000000000000000000000000000000000', after, r.root), []);
});

test('dispatch: ready and published manuscripts are targets; draft, retired and unknown ids are not', () => {
  const r = repo();
  r.write('ready-one', 'ready', '本文');
  r.write('published-one', 'published', '本文');
  r.write('draft-one', 'draft', '本文');
  r.write('retired-one', 'retired', '本文');
  assert.deepStrictEqual(targetForDispatch('ready-one', r.root), ['ready-one']);
  assert.deepStrictEqual(targetForDispatch('published-one', r.root), ['published-one']);
  assert.deepStrictEqual(targetForDispatch('draft-one', r.root), []);
  assert.deepStrictEqual(targetForDispatch('retired-one', r.root), []);
  assert.deepStrictEqual(targetForDispatch('no-such-post', r.root), []);
  assert.deepStrictEqual(targetForDispatch('../escape', r.root), []);
});
