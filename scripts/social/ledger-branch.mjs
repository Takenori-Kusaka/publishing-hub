// SNS の台帳(social/ledger/*.jsonl)と、台帳を保管するブランチ social-ledger のあいだの読み書き。
//
// 台帳は追記だけの JSON Lines です。以前は記録のジョブが「その実行の分だけの台帳」で
// ブランチ上のファイルを置き換えていたため(cp -r)、ブランチには最後の実行の記録しか残りませんでした。
// 実測(origin/social-ledger の 5 コミットの ledger/bluesky.jsonl を古い順に読んだもの):
//   2026-09-12 62cf607 multi-platform-publishing-architecture の 2 行
//   2026-09-16 fb8d1e2 上に quickscribe-floor-2026-09 の 2 行を足した 4 行
//   2026-09-22 f28ca23 family-link-chrome-pwa の 2 行だけ(前の 4 行 = 2 原稿ぶんが落ちた。落ちたのはここが最初)
//   2026-09-22 84cade3 ganbari-anti-engagement-2026-09 の 2 行だけ(family-link-chrome-pwa も落ちた)
//   2026-09-23 eb7d3d4 ganbari-ai-suggest-2026-09 の 2 行だけ(先頭に残らないのは合計 4 原稿ぶん)
// つまり先頭にはその実行の 1 原稿ぶんしか残らず、それ以前の記録は履歴の中にしかありません。
// また投稿のジョブはブランチの台帳を読まないため、二重投稿の防止が前の実行の記録を見ませんでした。
//
// そこで読み書きを次のようにします。
//   - 復元: ブランチの「履歴に一度でも現れた行」を古い順に集め、作業ツリーの social/ledger/ に書く。
//     追記だけの台帳なので、置き換えで消えた行も履歴から戻せます。
//   - 追記: ブランチの最新(と履歴)に、この実行の台帳の行のうちまだ無いものを足して押し戻す。
// 行の同一性は文字列の完全一致で見ます。記録には送信の時刻(timestamp)が入るので、同じ行は同じ記録です。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { git, remoteRef, fetchBranch, fileTextAt } from '../git-writeback.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

/** 台帳を保管するブランチ。main には置かない(Zenn の同期を汚さないため) */
export const LEDGER_BRANCH = 'social-ledger';
export const PLATFORMS = ['linkedin', 'bluesky'];

/** ブランチ上の台帳のパス(作業ツリーの social/ledger/<platform>.jsonl に対応する) */
export const branchLedgerPath = (platform) => `ledger/${platform}.jsonl`;
export const workingLedgerPath = (platform) => path.join(ROOT, 'social/ledger', `${platform}.jsonl`);

export const splitLines = (text) => (text || '').split('\n').map((l) => l.trim()).filter(Boolean);
export const joinLines = (lines) => (lines.length ? `${lines.join('\n')}\n` : '');

/** previous に、incoming のうちまだ無い行を順に足す(重複は足さない) */
export function mergeLines(previous, incoming) {
  const seen = new Set(previous);
  const merged = [...previous];
  for (const line of incoming) {
    if (seen.has(line)) continue;
    seen.add(line);
    merged.push(line);
  }
  return merged;
}

/** ref の履歴で file に一度でも現れた行を、古い順・ファイル内の順に集める */
export function historyLines(ref, file) {
  if (!ref) return [];
  const commits = git(['rev-list', '--reverse', '--full-history', ref, '--', file])
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  let lines = [];
  for (const commit of commits) {
    const text = fileTextAt(commit, file);
    if (text === null) continue;
    lines = mergeLines(lines, splitLines(text));
  }
  return lines;
}

/** social-ledger を取り込む。ブランチが無ければ null(まだ 1 度も投稿していない) */
export function fetchLedgerBranch() {
  return fetchBranch(LEDGER_BRANCH) ? remoteRef(LEDGER_BRANCH) : null;
}

/** ブランチの履歴から復元した、媒体ごとの台帳の行 */
export function ledgerLinesFromBranch(ref) {
  return Object.fromEntries(PLATFORMS.map((p) => [p, historyLines(ref, branchLedgerPath(p))]));
}

/** 作業ツリーの social/ledger/<platform>.jsonl の行 */
export function ledgerLinesFromWorkingTree() {
  return Object.fromEntries(
    PLATFORMS.map((p) => {
      const file = workingLedgerPath(p);
      return [p, fs.existsSync(file) ? splitLines(fs.readFileSync(file, 'utf8')) : []];
    }),
  );
}

/** 復元した行を作業ツリーへ書く。行が無い媒体のファイルは消す(前の実行の残りを残さない) */
export function writeWorkingTree(linesByPlatform) {
  for (const platform of PLATFORMS) {
    const file = workingLedgerPath(platform);
    const lines = linesByPlatform[platform] || [];
    if (!lines.length) {
      fs.rmSync(file, { force: true });
      continue;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, joinLines(lines), 'utf8');
  }
}
