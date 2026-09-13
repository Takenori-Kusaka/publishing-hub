// 原稿の「直前の版」を git から取り出す。差分を見る検査(V13 の接続の語、宣言の範囲)が使う共通部品です。
//
// 作業ツリーの原稿が HEAD と違えば、HEAD の版を返します(コミット前のエージェントの改訂を見るとき)。
// 同じなら、その原稿を最後に変更したコミットの親の版を返します(push されたコミットを CI で見るとき)。
// git が使えないか履歴が浅い(shallow)ときは null を返し、差分を見る検査を省きます。

import { execFileSync } from 'node:child_process';
import { ROOT, readText, exists } from './lib.mjs';

export const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });

let full = null;

/** 全履歴の git が使えるか */
export function hasFullHistory() {
  if (full === null) {
    try {
      full = git(['rev-parse', '--is-shallow-repository']).trim() === 'false';
    } catch {
      full = false;
    }
  }
  return full;
}

/** トレーラーの値(区切りは \x1d か改行)を名前の配列にする。メールアドレスは落とす */
export function trailerNames(s) {
  return String(s || '')
    .split(/[\x1d\r\n]+/)
    .map((x) => x.replace(/<[^>]*>/g, '').trim())
    .filter(Boolean);
}

/** rev の版の原稿(LF にそろえる)。そのコミットに原稿がなければ null */
export function showAt(rev, file) {
  try {
    return git(['show', `${rev}:${String(file).replace(/\\/g, '/')}`]).replace(/\r\n/g, '\n');
  } catch {
    return null;
  }
}

const cache = new Map();

/**
 * 直前の版。{ text, ref, committed, commit } か null。
 *   text       直前の版の原稿(まだない原稿なら '')
 *   committed  作業ツリーが HEAD と同じなら true(直前の版は、原稿を最後に変更したコミットの親)
 *   commit     committed のとき、原稿を最後に変更したコミット { sha, coAuthors }
 */
export function previousVersion(file) {
  const f = String(file).replace(/\\/g, '/');
  if (cache.has(f)) return cache.get(f);
  let out = null;
  if (hasFullHistory() && exists(f)) {
    const head = showAt('HEAD', f);
    if (head === null || head !== readText(f)) {
      out = { text: head ?? '', ref: 'HEAD', committed: false, commit: null };
    } else {
      try {
        const [sha, co] = git(['log', '-1', '--format=%H%x1f%(trailers:key=Co-Authored-By,valueonly,separator=%x1d)', '--', f]).trim().split('\x1f');
        if (sha) out = { text: showAt(`${sha}^`, f) ?? '', ref: `${sha}^`, committed: true, commit: { sha, coAuthors: trailerNames(co) } };
      } catch {
        out = null;
      }
    }
  }
  cache.set(f, out);
  return out;
}
