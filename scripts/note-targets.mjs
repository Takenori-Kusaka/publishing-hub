// note へ投稿する原稿の id を決める(publish-note ワークフローの gate)。
//
//   node scripts/note-targets.mjs --post-id <id>                 # 手動実行: その原稿が ready なら出力
//   node scripts/note-targets.mjs --before <sha> --after <sha>   # push: この範囲で status が ready に変わった原稿だけ出力
//
// 出力は 1 行 1 id。何もなければ空。終了コードは常に 0(判定はワークフロー側で行う)。
//
// push 契機で「ready のまま残っている原稿」を毎回投稿しないために、
// この範囲のコミットで status が ready へ遷移した原稿(新規追加を含む)だけを対象にします。
// ready のまま本文を直しても再投稿はしません。再投稿したいときは手動実行(--post-id)を使います。

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = 'platforms/note/public';

function statusOf(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text || '');
  if (!m) return null;
  const s = /^status:\s*['"]?([a-z]+)['"]?\s*$/m.exec(m[1]);
  return s ? s[1] : null;
}

function gitShow(sha, file) {
  try {
    return execSync(`git show ${sha}:${file}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

function parse(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) o[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return o;
}

export function targetsForPush(before, after) {
  let changed = [];
  try {
    changed = execSync(`git diff --name-only ${before} ${after} -- ${DIR}`, { cwd: ROOT, encoding: 'utf8' })
      .split(/\r?\n/)
      .filter((f) => /\.md$/.test(f) && !/README\.md$/.test(f));
  } catch {
    return [];
  }
  const ids = [];
  for (const file of changed) {
    const now = statusOf(gitShow(after, file));
    const prev = statusOf(gitShow(before, file));
    if (now === 'ready' && prev !== 'ready') ids.push(path.basename(file, '.md'));
  }
  return ids;
}

export function targetForDispatch(postId) {
  if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(postId)) return [];
  const file = path.join(ROOT, DIR, `${postId}.md`);
  if (!fs.existsSync(file)) return [];
  return statusOf(fs.readFileSync(file, 'utf8')) === 'ready' ? [postId] : [];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const o = parse(process.argv.slice(2));
  const ids = o['post-id'] ? targetForDispatch(String(o['post-id'])) : o.before && o.after ? targetsForPush(String(o.before), String(o.after)) : [];
  for (const id of ids) console.log(id);
}
