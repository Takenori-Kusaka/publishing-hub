// 公開する原稿に作業環境のパス(C:\Users\…、/home/…、評価用のサンドボックス名など)が漏れていないかを見る。
// 生成AIのエージェントは、作業ディレクトリの絶対パスをディレクトリ構成図やコマンド例にそのまま書きがちです。
// コードブロックの中も含めて検査します。パターンは lint/policies/expressions.json の local_paths にあります。

import { readJson } from './lib.mjs';

let cached = null;

export function localPathPatterns() {
  if (!cached) cached = (readJson('lint/policies/expressions.json').local_paths?.patterns || []).map((p) => new RegExp(p));
  return cached;
}

/** 行ごとに最初に当たったパスを返す。line は 1 始まり */
export function findLocalPaths(text) {
  const out = [];
  String(text || '').split('\n').forEach((l, i) => {
    for (const re of localPathPatterns()) {
      const m = re.exec(l);
      if (m) {
        out.push({ line: i + 1, found: m[0] });
        break;
      }
    }
  });
  return out;
}

export function checkLocalPaths(report, file, body, bodyLine, code) {
  for (const h of findLocalPaths(body)) {
    report.error(file, code, `作業環境のパス「${h.found}」があります。公開する原稿には手元の絶対パスを書かず、リポジトリ内の相対パスにしてください`, bodyLine + h.line - 1);
  }
}
