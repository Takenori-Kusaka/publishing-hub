// Qiita の同期のあとに、Qiita CLI が書いた platforms/qiita/** の変更を main へ書き戻す(CI 用)。
// 書き戻すのは、新しく作った記事の id と、同期した記事の updated_at です。
//
// 以前は Qiita CLI の GitHub Actions(increments/qiita-cli/actions/publish@v1)が
// git add platforms/qiita/public/* → git commit → 引数なしの git push を行っていました。
// 同期のあいだに main が進むとこの push は non-fast-forward で拒まれ、アクションはやり直さずに失敗します
// (2026-09-22T14:56:14Z の実行 35743804385。main の 09bbf0c で動き、push は
// 「! [rejected] main -> main (fetch first)」で終わっています)。
// id が残らないと、次の同期は同じ記事をもう一度作ります。
//
// 書き戻し方(scripts/note-commit-ledger.mjs と同じ作り。共通の部品は scripts/git-writeback.mjs):
//   1. この実行の変更 = 作業ツリーのうち HEAD から変わった platforms/qiita/** のファイル。
//      ただし platforms/qiita/public/.remote/** は除きます(下記)。
//   2. fetch して origin/main の最新を読み、その上にこのファイルだけを重ねたコミットを作る。
//      作業ツリーも index も HEAD も動かさない。
//   3. push の前に、origin/main との差が platforms/qiita/** だけであることを確かめる。
//      作業ツリーに platforms/qiita/** の外の変更(追跡しているファイル)があれば、想定していない状態として止める。
//   4. push が拒まれたら(先に別の実行が main を進めた)、1 からやり直す(MAX_ATTEMPTS 回まで)。
// platforms/qiita/public/.remote/** を除く理由: Qiita CLI は同期のたびに、Qiita 上の記事の写しを
// この下に書きます(@qiita/qiita-cli の FileSystemRepo.getRemotePath が public/.remote を作る)。
// 写しは原稿ではなく、次の同期で作り直されるので main に置く意味がありません。旧アクションの
// git add は platforms/qiita/public/* で、ドットで始まるこのディレクトリを拾っていませんでした。
// .gitignore にも入れてありますが、ignore が外れても main に入らないよう、ここでも落とします。
// 安全弁: 作業ツリー(HEAD)が main の履歴に無ければ、書き戻さずに終了コード 1 で止まります(公開は main からだけ)。
// 書き戻せなかったときは、何が残らなかったかと次の同期で起きることを出し、終了コード 1 で終わります
// (同期は済んでいますが、id が残らないと次の同期が記事を二重に作るため、実行を赤にして人が気づけるようにします)。

import fs from 'node:fs';
import { MAX_ATTEMPTS, git, remoteRef, fetchBranch, revParse, fileTextAt, isAncestorOf, commitFilesOnto, changedBetween, pushCommit } from './git-writeback.mjs';

const MAIN = remoteRef('main');
const PREFIX = 'platforms/qiita/';
/** Qiita CLI が書くリモートの写し。書き戻しの対象から外す */
const REMOTE_PREFIX = 'platforms/qiita/public/.remote/';
const MESSAGE = 'chore(qiita): sync metadata with Qiita [skip ci]';

/** git status の出力(-z の NUL 区切り)を [状態, パス] にほどく */
function statusEntries(args) {
  return git(['status', '--porcelain', '-z', ...args])
    .split('\0')
    .filter(Boolean)
    .map((entry) => [entry.slice(0, 2), entry.slice(3)]);
}

/** この実行で変わった platforms/qiita/** のファイル(リモートの写しを除く)。消えたファイルは text: null */
function changedQiitaFiles() {
  const files = [];
  for (const [status, file] of statusEntries(['--untracked-files=all', '--', PREFIX])) {
    if (file.startsWith(REMOTE_PREFIX)) continue;
    if (/R|C/.test(status)) throw new Error(`platforms/qiita に rename/copy(${status})がありました(${file})。書き戻し方を決められないので止めます`);
    if (!file.startsWith(PREFIX)) continue;
    files.push({ path: file, text: status.includes('D') ? null : fs.readFileSync(file, 'utf8') });
  }
  return files.sort((a, b) => (a.path < b.path ? -1 : 1));
}

/**
 * 追跡しているファイルのうち、platforms/qiita/** の外で変わったもの。
 * 同期の実行の作業ツリーには platforms/qiita の変更しか出ないはずなので、ほかの変更があれば
 * 想定していない状態として止める(main に混ぜて押し込まない)。追跡していないファイルは数えない。
 */
const changedOutsideQiita = () => statusEntries(['--untracked-files=no']).map(([, file]) => file).filter((file) => !file.startsWith(PREFIX));

/** 記事の frontmatter の 1 行を読む(id / updated_at の報告用) */
const frontmatterValue = (text, key) => {
  if (!text) return null;
  const m = new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(text);
  return m ? m[1].trim() : null;
};

/** main に残らなかった書き戻しと、次の同期で起きることを出す */
function explainUnwritten(files) {
  if (!files.length) return;
  console.log('   main に次の変更が残っていません:');
  const created = [];
  for (const f of files) {
    const before = frontmatterValue(fileTextAt('HEAD', f.path), 'id');
    const after = frontmatterValue(f.text, 'id');
    const isNew = (before === null || before === 'null' || before === '') && after && after !== 'null';
    if (isNew) created.push(f);
    console.log(`   - ${f.path}: id=${after ?? '(なし)'} updated_at=${frontmatterValue(f.text, 'updated_at') ?? '(なし)'}${isNew ? '(新しく作った記事)' : '(既存の記事の同期)'}`);
  }
  if (created.length) {
    console.log('   新しく作った記事の id が無いと、次の同期はその記事をもう一度 Qiita に作ります。');
  }
  console.log('   既存の記事の updated_at が古いままだと、その記事を次に直したとき Qiita CLI が「Qiita 上の記事より古い可能性がある」として止まり、全記事の同期が止まります。');
  console.log('   人が上の id と updated_at を原稿に書き戻して、main へ入れてください。');
}

let files = [];
try {
  files = changedQiitaFiles();
  if (!files.length) {
    console.log('🧾 Qiita: 書き戻す変更はありません。');
    process.exit(0);
  }
  const outside = changedOutsideQiita();
  if (outside.length) throw new Error(`${PREFIX} の外に変更があります(${outside.slice(0, 5).join(', ')})。main に混ぜないため、書き戻さずに止めます`);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    fetchBranch('main', { required: true });
    // 安全弁: 作業ツリー(HEAD)が main の履歴に含まれるときだけ書き戻す。
    // 公開は main からだけ行う前提(publish-qiita.yml の最初のジョブが main 以外の起動を止める)が崩れている。
    if (attempt === 1 && !isAncestorOf('HEAD', MAIN)) {
      console.log(`::error::Qiita の同期の結果を書き戻しません。作業ツリー(${git(['rev-parse', '--short', 'HEAD']).trim()})が main の履歴にありません。公開は main からだけ行います。`);
      explainUnwritten(files);
      process.exit(1);
    }
    const base = revParse(MAIN);
    const commit = commitFilesOnto(base, files, MESSAGE);
    const touched = changedBetween(base, commit);
    if (!touched.length) {
      console.log('🧾 Qiita: main にはすでにこの実行の変更が入っています。');
      process.exit(0);
    }
    const stray = touched.filter((p) => !p.startsWith(PREFIX));
    if (stray.length) throw new Error(`${PREFIX} 以外の変更を含むコミットになりました(${stray.join(', ')})。push しません`);
    if (pushCommit(commit, 'main')) {
      console.log(`🧾 Qiita の同期の結果を main へ書き戻しました(${touched.join(', ')})。`);
      process.exit(0);
    }
    console.log(`↻ main が先に進んでいたため、最新の main に載せ直します(${attempt}/${MAX_ATTEMPTS})。`);
  }
  throw new Error(`push が ${MAX_ATTEMPTS} 回続けて拒まれました`);
} catch (e) {
  console.log(`::error::Qiita の同期の結果を書き戻せませんでした(Qiita への同期は済んでいます): ${String(e.stderr || e.message).slice(0, 200)}`);
  explainUnwritten(files);
  process.exit(1);
}
