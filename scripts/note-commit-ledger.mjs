// 投稿の後に、この実行の記録を main の台帳(platforms/note/ledger.json)へ書き戻す(CI 用)。
// 書き戻しに失敗しても終了コード 0 で返し、ジョブは赤にしない(note への投稿は済んでいるため)。
// ただし作業ツリーが main の履歴に無いとき(main 以外から起動されたとき)だけは、書き戻さずに終了コード 1 で止まる(安全弁)。
// 自己ホストの Windows ランナーでも動くよう、シェルに頼らず Node で git を呼ぶ。
//
// 書き戻し方:
//   1. この実行の記録 = 作業ツリーの台帳のうち、コミット済みの台帳(HEAD)から変わった投稿の、RECORD_FIELDS の項目。
//   2. fetch して origin/main の最新の台帳を読み、記録を投稿の id ごとに重ねる(ほかの投稿の記録は触らない)。
//   3. origin/main を親にし、台帳のファイルだけを差し替えたコミットを作って push する。作業ツリーも HEAD も動かさない。
//   4. push が拒まれたら(先に別の実行が書き戻した)、1 からやり直す(MAX_ATTEMPTS 回まで)。
// このため、同じ push で 2 つの原稿を投稿したときや、待っていた実行が古いコミットで動いたときも、ほかの記録を消さない。
// main に入るのは台帳のコミットだけ(3 の直後に、origin/main との差が台帳のファイルだけであることを確かめる)。

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { LEDGER_FILE as LEDGER, RECORD_FIELDS } from './note-ledger.mjs';

const MAX_ATTEMPTS = 5;
const MAIN = 'refs/remotes/origin/main';
const MESSAGE = 'chore(note): record the published post in the ledger [skip ci]';
const BOT = ['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com'];
const git = (args, opts = {}) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });

function parseLedger(text) {
  const ledger = JSON.parse(text);
  return { ...ledger, posts: ledger.posts || {} };
}

/** コミットの台帳の本文。台帳が無ければ null */
function ledgerTextAt(rev) {
  try {
    git(['cat-file', '-e', `${rev}:${LEDGER}`]);
  } catch {
    return null;
  }
  return git(['show', `${rev}:${LEDGER}`]);
}

/** この実行の記録(作業ツリーの台帳のうち、HEAD の台帳から変わった投稿の RECORD_FIELDS) */
function thisRunRecords() {
  const headText = ledgerTextAt('HEAD');
  const before = headText ? parseLedger(headText).posts : {};
  const now = fs.existsSync(LEDGER) ? parseLedger(fs.readFileSync(LEDGER, 'utf8')).posts : {};
  return Object.keys(now)
    .filter((id) => JSON.stringify(now[id]) !== JSON.stringify(before[id]))
    .map((id) => ({ id, record: Object.fromEntries(RECORD_FIELDS.filter((k) => now[id][k] !== undefined).map((k) => [k, now[id][k]])) }));
}

/** main に残らなかった記録と、次の実行で起きることを出す。mainPosts は最後に読めた main の台帳(読めていなければ null) */
function explainUnrecorded(records, mainPosts) {
  if (!records.length) return;
  console.log('   main の台帳に次の記録が残っていません:');
  const isNew = ({ id, record }) => (mainPosts?.[id]?.note_key ?? null) !== record.note_key;
  for (const r of records) {
    console.log(`   - ${r.id}: note_key=${r.record.note_key} url=${r.record.url}${isNew(r) ? '(新しい投稿)' : '(既存の投稿の更新。指紋が古いまま)'}`);
  }
  if (records.some(isNew)) {
    console.log('   新しい投稿の記録が無いと、次の実行では、その原稿が ready なら新しく投稿されて note の上で重複し、published なら投稿せずに止まります。');
    console.log(`   人が上の note_key と url を ${LEDGER} に記録して、main へ入れてください。`);
  }
  if (records.some((r) => !isNew(r))) {
    console.log('   指紋が古いだけの原稿は、次の実行で内容が同じでも、既存の投稿をもう一度更新します(新しい投稿は作りません)。');
  }
}

function isAncestorOfMain(rev) {
  try {
    git(['merge-base', '--is-ancestor', rev, MAIN]);
    return true;
  } catch (e) {
    if (e.status === 1) return false;
    throw e;
  }
}

/** base を親にし、台帳のファイルだけを text に差し替えたコミットを作る(作業ツリーと index は使わない) */
function commitLedgerOnto(base, text) {
  const blob = git(['hash-object', '-w', '--stdin'], { input: text, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const index = path.join(os.tmpdir(), `note-ledger-index-${process.pid}-${Date.now()}`);
  const env = { ...process.env, GIT_INDEX_FILE: index };
  try {
    git(['read-tree', base], { env });
    git(['update-index', '--add', '--cacheinfo', `100644,${blob},${LEDGER}`], { env });
    const tree = git(['write-tree'], { env }).trim();
    return git([...BOT, 'commit-tree', tree, '-p', base, '-m', MESSAGE]).trim();
  } finally {
    fs.rmSync(index, { force: true });
  }
}

/** push する。先に main が進んでいて拒まれたら false、それ以外の失敗は例外 */
function push(commit) {
  try {
    git(['push', 'origin', `${commit}:refs/heads/main`]);
    return true;
  } catch (e) {
    if (/\[rejected\]|non-fast-forward|fetch first|cannot lock ref|failed to update ref/.test(String(e.stderr || ''))) return false;
    throw e;
  }
}

let records = [];
let mainPosts = null;
try {
  records = thisRunRecords();
  if (!records.length) {
    console.log('🧾 note ledger unchanged; nothing to commit.');
    process.exit(0);
  }
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    git(['fetch', '--quiet', 'origin', `+refs/heads/main:${MAIN}`]);
    // 安全弁: 作業ツリー(HEAD)が main の履歴に含まれるときだけ書き戻す。公開は main からだけ行う前提
    // (publish-note.yml の最初の段が main 以外の起動を止める)が崩れているので、ジョブを赤にして気づけるようにする。
    if (attempt === 1 && !isAncestorOfMain('HEAD')) {
      console.log(`::error::note の台帳を書き戻しません。作業ツリー(${git(['rev-parse', '--short', 'HEAD']).trim()})が main の履歴にありません。公開は main からだけ行います。`);
      explainUnrecorded(records, null);
      process.exit(1);
    }
    const base = git(['rev-parse', MAIN]).trim();
    const baseText = ledgerTextAt(base);
    const ledger = baseText ? parseLedger(baseText) : { posts: {} };
    mainPosts = { ...ledger.posts };
    for (const { id, record } of records) ledger.posts[id] = { ...ledger.posts[id], ...record };
    const text = `${JSON.stringify(ledger, null, 2)}\n`;
    if (text === baseText) {
      console.log('🧾 note ledger: main already has this run\'s records.');
      process.exit(0);
    }
    const commit = commitLedgerOnto(base, text);
    const touched = git(['diff', '--name-only', base, commit]).trim();
    if (touched !== LEDGER) throw new Error(`台帳以外の変更を含むコミットになりました(${touched})。push しません`);
    if (push(commit)) {
      console.log(`🧾 note ledger committed and pushed (${records.map((r) => r.id).join(', ')}).`);
      process.exit(0);
    }
    console.log(`↻ main が先に進んでいたため、最新の台帳に重ね直します(${attempt}/${MAX_ATTEMPTS})。`);
  }
  throw new Error(`push が ${MAX_ATTEMPTS} 回続けて拒まれました`);
} catch (e) {
  // 書き戻しの失敗は投稿の成否に影響させない。何が残らなかったかと、次の実行で起きることをログに残す。
  console.log(`⚠️ note の台帳の書き戻しに失敗しました(投稿は完了しています): ${String(e.stderr || e.message).slice(0, 200)}`);
  explainUnrecorded(records, mainPosts);
  process.exit(0);
}
