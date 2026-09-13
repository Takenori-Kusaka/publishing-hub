// 投稿後に platforms/note/ledger.json を書き戻す(CI 用)。
// note への投稿は成功が最優先なので、この書き戻しが失敗しても終了コード 0 で返し、ジョブは赤にしない。
// 自己ホストの Windows ランナーでも動くよう、シェルの `&&`/`||` に頼らず Node で git を順に呼ぶ。
// checkout は分離 HEAD になりうるため push は HEAD:main。他所の push とぶつからないよう fetch→rebase してから押す。

import { execFileSync } from 'node:child_process';

const LEDGER = 'platforms/note/ledger.json';
const git = (args, opts = {}) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });

try {
  const changed = git(['status', '--porcelain', '--', LEDGER]).trim();
  if (!changed) {
    console.log('🧾 note ledger unchanged; nothing to commit.');
    process.exit(0);
  }
  git(['config', 'user.name', 'github-actions[bot]']);
  git(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
  git(['add', LEDGER]);
  git(['commit', '-m', 'chore(note): record the published post in the ledger [skip ci]']);
  try {
    git(['fetch', 'origin', 'main']);
    git(['rebase', 'origin/main']);
  } catch (e) {
    console.log(`⚠️ rebase をスキップ(${String(e.message).slice(0, 80)})`);
  }
  git(['push', 'origin', 'HEAD:main']);
  console.log('🧾 note ledger committed and pushed.');
  process.exit(0);
} catch (e) {
  // 書き戻しの失敗は投稿の成否に影響させない。次回のためにログだけ残す。
  console.log(`⚠️ note ledger の書き戻しに失敗しました(投稿は完了しています): ${String(e.stderr || e.message).slice(0, 200)}`);
  console.log('   次回の実行で内容が同じなら「スキップ」、違えば「更新」になります。手元で ledger を直してコミットしても構いません。');
  process.exit(0);
}
