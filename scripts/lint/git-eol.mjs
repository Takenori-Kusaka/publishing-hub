// 原稿がリポジトリ(git の index)に CRLF の改行で入っていないかを見る。
// CRLF でコミットされると差分が全行の書き換えに見え、人の査読で変更箇所を追えなくなります。

import { execFileSync } from 'node:child_process';
import { ROOT } from './lib.mjs';

let eolMap = null;

/** git の index での改行('lf' / 'crlf' / 'mixed' / 'none')。git が使えないか未追跡なら null */
export function indexEol(file) {
  if (eolMap === null) {
    eolMap = new Map();
    try {
      const out = execFileSync('git', ['ls-files', '--eol', '--', 'articles', 'books', 'platforms', 'social/posts'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      for (const l of out.split(/\r?\n/)) {
        const m = /^i\/(\S*)\s+w\/\S*\s+attr\/\S*\s+(.+)$/.exec(l);
        if (m) eolMap.set(m[2].trim(), m[1]);
      }
    } catch {
      // git が使えない環境では検査しない
    }
  }
  return eolMap.get(String(file).replace(/\\/g, '/')) ?? null;
}

export function checkIndexEol(report, file, code) {
  const eol = indexEol(file);
  if (eol === 'crlf' || eol === 'mixed') {
    report.error(file, code, `原稿が ${eol === 'crlf' ? 'CRLF' : 'CRLF と LF の混在'}の改行でコミットされています。LF でコミットしてください(差分が全行の書き換えに見え、人の査読で変更箇所を追えません)`, 1);
  }
}
