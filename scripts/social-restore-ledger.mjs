// 投稿の前に、ブランチ social-ledger の台帳を作業ツリーの social/ledger/ へ復元する(CI 用)。
// これにより scripts/social/cli.mjs の二重投稿の防止が、前の実行の記録を見るようになります。
// ブランチがまだ無ければ、空の台帳から始めます(終了コード 0)。
//
// 復元に失敗したときは、投稿の前に終了コード 1 で止めます。台帳が空のまま投稿すると、
// すでに投稿した原稿をもう一度投稿するためです。

import { fetchLedgerBranch, ledgerLinesFromBranch, writeWorkingTree, LEDGER_BRANCH, PLATFORMS } from './social/ledger-branch.mjs';

try {
  const ref = fetchLedgerBranch();
  if (!ref) {
    console.log(`🧾 ブランチ ${LEDGER_BRANCH} がありません。空の台帳から始めます。`);
    process.exit(0);
  }
  const lines = ledgerLinesFromBranch(ref);
  writeWorkingTree(lines);
  for (const platform of PLATFORMS) console.log(`🧾 ${platform}: ${lines[platform].length} 件の記録を復元しました。`);
  process.exit(0);
} catch (e) {
  console.log(`::error::台帳を復元できませんでした: ${String(e.stderr || e.message).slice(0, 200)}`);
  console.log('   台帳が無いまま投稿すると、すでに投稿した原稿をもう一度投稿します。投稿の前に止めます。');
  process.exit(1);
}
