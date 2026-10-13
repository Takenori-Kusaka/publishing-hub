// ブランチへ「1 コミットだけ載せて push する」共通の部品(CI 用)。
// 使うのは scripts/note-commit-ledger.mjs(note の台帳)、scripts/qiita-commit-sync.mjs(Qiita の id の書き戻し)、
// scripts/social-commit-ledger.mjs(SNS の台帳)の 3 つ。
//
// 共通の作り:
//   1. fetch して、押し戻す先のブランチの最新(origin の ref)を読む。
//   2. その最新を親にし、指定のファイルだけを差し替えたコミットを作る。作業ツリーも index も HEAD も動かさない
//      (一時の GIT_INDEX_FILE を使う)。
//   3. push する。先に別の実行が進めていて拒まれたら、1 からやり直す(呼ぶ側が MAX_ATTEMPTS 回まで回す)。
//   4. push の前に、そのコミットが親と比べて変えたファイルを呼ぶ側が確かめる(意図しないファイルを main へ入れない)。
// 自己ホストの Windows ランナーでも動くよう、シェルに頼らず Node で git を呼ぶ。

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/** push が拒まれたときに読み直して載せ直す回数 */
export const MAX_ATTEMPTS = 5;

/** コミットの作成者(GitHub Actions の bot)。git の設定を書き換えずに -c で渡す */
export const BOT = ['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com'];

export const git = (args, opts = {}) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });

/** origin の追跡 ref。fetch はここへ書く */
export const remoteRef = (branch) => `refs/remotes/origin/${branch}`;

/**
 * origin の branch を取り込む。ブランチが無ければ false を返す(例外にしない)。
 * required: true なら、取り込めなかったときに例外にする(必ずあるはずのブランチ用)。
 */
export function fetchBranch(branch, { required = false } = {}) {
  try {
    git(['fetch', '--quiet', 'origin', `+refs/heads/${branch}:${remoteRef(branch)}`]);
    return true;
  } catch (e) {
    if (required) throw e;
    return false;
  }
}

export const revParse = (rev) => git(['rev-parse', rev]).trim();

/** コミットにあるファイルの本文。無ければ null */
export function fileTextAt(rev, file) {
  try {
    git(['cat-file', '-e', `${rev}:${file}`]);
  } catch {
    return null;
  }
  return git(['show', `${rev}:${file}`]);
}

/** rev が ref の履歴に含まれるか */
export function isAncestorOf(rev, ref) {
  try {
    git(['merge-base', '--is-ancestor', rev, ref]);
    return true;
  } catch (e) {
    if (e.status === 1) return false;
    throw e;
  }
}

/**
 * base(コミット。null なら空)の内容に files を重ねたコミットを作る。作業ツリーと index は使わない。
 * files: [{ path, text }]。text が null ならそのファイルを消す。
 * 本文は .gitattributes の改行の正規化(LF)を通す(--path)。git add で入れたときと同じ blob になる。
 */
export function commitFilesOnto(base, files, message) {
  const indexFile = path.join(os.tmpdir(), `git-writeback-index-${process.pid}-${Date.now()}`);
  const env = { ...process.env, GIT_INDEX_FILE: indexFile };
  try {
    if (base) git(['read-tree', base], { env });
    else git(['read-tree', '--empty'], { env });
    for (const f of files) {
      if (f.text === null || f.text === undefined) {
        git(['update-index', '--force-remove', f.path], { env });
        continue;
      }
      const blob = git(['hash-object', '-w', '--path', f.path, '--stdin'], { input: f.text, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      git(['update-index', '--add', '--cacheinfo', `${f.mode || '100644'},${blob},${f.path}`], { env });
    }
    const tree = git(['write-tree'], { env }).trim();
    const args = [...BOT, 'commit-tree', tree];
    if (base) args.push('-p', base);
    return git([...args, '-m', message]).trim();
  } finally {
    fs.rmSync(indexFile, { force: true });
  }
}

/** base と commit のあいだで変わったファイルの一覧。base が null(最初のコミット)なら commit の全ファイル */
export const changedBetween = (base, commit) =>
  git(base ? ['diff', '--name-only', base, commit] : ['ls-tree', '-r', '--name-only', commit])
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

/** push する。先にブランチが進んでいて拒まれたら false、それ以外の失敗は例外 */
export function pushCommit(commit, branch) {
  try {
    git(['push', 'origin', `${commit}:refs/heads/${branch}`]);
    return true;
  } catch (e) {
    if (/\[rejected\]|non-fast-forward|fetch first|cannot lock ref|failed to update ref|already exists/.test(String(e.stderr || ''))) return false;
    throw e;
  }
}
