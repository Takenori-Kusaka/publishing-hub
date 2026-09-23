// 投稿の後に、この実行の台帳(social/ledger/*.jsonl)をブランチ social-ledger へ追記する(CI 用)。
//
// 以前はブランチ上のファイルを、その実行の分だけの台帳で置き換えていました(cp -r)。
// そのためブランチには最後の実行の記録しか残らず、二重投稿の防止が働きませんでした。
//
// 追記の仕方(scripts/note-commit-ledger.mjs と同じ作り。共通の部品は scripts/git-writeback.mjs):
//   1. fetch して social-ledger の最新を読み、履歴に一度でも現れた行を集める(置き換えで消えた行も戻す)。
//   2. そこへ、この実行の台帳のうちまだ無い行を足す。行の同一性は文字列の完全一致で見る。
//   3. 最新を親にし、ledger/*.jsonl だけを差し替えたコミットを作って push する。作業ツリーも HEAD も動かさない。
//   4. push が拒まれたら(先に別の実行が追記した)、1 からやり直す(MAX_ATTEMPTS 回まで)。
// ブランチがまだ無ければ、最初のコミットとして作ります。
//
// 追記できなかったときは、何が残らなかったかと次の実行で起きることを出し、終了コード 1 で終わります
// (投稿は済んでいますが、記録が残らないと次の実行が同じ原稿をもう一度投稿するため、人が気づけるようにします)。

import { MAX_ATTEMPTS, revParse, fileTextAt, commitFilesOnto, changedBetween, pushCommit } from './git-writeback.mjs';
import {
  LEDGER_BRANCH,
  PLATFORMS,
  branchLedgerPath,
  fetchLedgerBranch,
  historyLines,
  ledgerLinesFromWorkingTree,
  mergeLines,
  joinLines,
  splitLines,
} from './social/ledger-branch.mjs';

const MESSAGE = 'chore(ledger): append the social publishing records [skip ci]';
const PREFIX = 'ledger/';

/** ブランチに残らなかった記録と、次の実行で起きることを出す */
function explainUnrecorded(unrecorded) {
  if (!PLATFORMS.some((p) => (unrecorded[p] || []).length)) return;
  console.log(`   ブランチ ${LEDGER_BRANCH} に次の記録が残っていません:`);
  for (const platform of PLATFORMS) {
    for (const line of unrecorded[platform] || []) {
      let record = {};
      try {
        record = JSON.parse(line);
      } catch {
        record = {};
      }
      console.log(`   - ${platform}: ${record.post_id ?? '(不明)'} status=${record.status ?? '(不明)'} remote_ids=${(record.remote_ids || []).join(', ') || '(なし)'}`);
    }
  }
  console.log('   published の記録が無いと、次の実行はその原稿を投稿済みと見なさず、同じ媒体へもう一度投稿します。');
  console.log(`   人が上の記録を ${LEDGER_BRANCH} の ${branchLedgerPath('<媒体>')} に足してください。`);
}

const thisRun = ledgerLinesFromWorkingTree();
let unrecorded = { ...thisRun };
try {
  if (!PLATFORMS.some((p) => thisRun[p].length)) {
    console.log('🧾 この実行の台帳に記録がありません(投稿のジョブが台帳を残していません)。');
    process.exit(0);
  }
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ref = fetchLedgerBranch();
    const base = ref ? revParse(ref) : null;
    const files = [];
    const merged = {};
    const missing = {};
    for (const platform of PLATFORMS) {
      const file = branchLedgerPath(platform);
      const known = historyLines(base, file); // 履歴に一度でも現れた行(置き換えで消えた行を含む)
      const tip = base ? splitLines(fileTextAt(base, file)) : [];
      merged[platform] = mergeLines(known, thisRun[platform]);
      missing[platform] = thisRun[platform].filter((line) => !known.includes(line));
      if (joinLines(merged[platform]) !== joinLines(tip)) files.push({ path: file, text: joinLines(merged[platform]) });
    }
    unrecorded = missing;
    if (!files.length) {
      console.log(`🧾 ${LEDGER_BRANCH} にはすでにこの実行の記録が入っています。`);
      process.exit(0);
    }
    const commit = commitFilesOnto(base, files, MESSAGE);
    const touched = changedBetween(base, commit);
    const stray = touched.filter((p) => !p.startsWith(PREFIX));
    if (stray.length) throw new Error(`${PREFIX} 以外の変更を含むコミットになりました(${stray.join(', ')})。push しません`);
    if (pushCommit(commit, LEDGER_BRANCH)) {
      console.log(`🧾 ${LEDGER_BRANCH} へ追記しました(${PLATFORMS.map((p) => `${p} ${merged[p].length} 件`).join('、')})。`);
      process.exit(0);
    }
    console.log(`↻ ${LEDGER_BRANCH} が先に進んでいたため、最新の台帳に足し直します(${attempt}/${MAX_ATTEMPTS})。`);
  }
  throw new Error(`push が ${MAX_ATTEMPTS} 回続けて拒まれました`);
} catch (e) {
  console.log(`::error::台帳を追記できませんでした(投稿は完了しています): ${String(e.stderr || e.message).slice(0, 200)}`);
  explainUnrecorded(unrecorded);
  process.exit(1);
}
