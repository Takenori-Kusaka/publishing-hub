// 定期実行で投稿する原稿を選ぶ。
//
// 原稿の campaign.publish_after は、これまで投稿を止めも起動もしませんでした(予定日を守るのは起動する側)。
// 2026-09-23 のオーナーの決定で、予定日に自動で投稿します(AGENTS.md 1 章)。
//
// 選ぶ条件(すべて満たすもの):
//   - status が ready
//   - campaign.publish_after が今以前
//   - campaign.expires_at が今より後
//   - その媒体が enabled: true
//   - その媒体とその原稿に、台帳の記録が 1 件も無い
// 台帳に記録がある媒体は選びません。published だけでなく、送信の前に落ちた記録(failed-before-send)や
// 状態の分からない記録(pending-unknown)も、人が見るまで自動で投稿し直さないためです
// (実測: quickscribe-floor-2026-09 は LinkedIn を人が消し、Bluesky は送信の前に落ちています)。
// そのため、記録のある原稿は定期実行からは二度と出ません。出し直すのは人の手動の起動だけで、
// 一度届いた媒体へ投稿し直すには --allow-repost <理由> が要ります(scripts/social/cli.mjs)。
//
// 1 回の実行で選ぶのは 1 原稿までです。予定日を過ぎた原稿がまとまっていても、1 日 1 本にします。
// 選ぶ順は publish_after の早いもの、同じなら原稿 ID の順です。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPostFile, listPostFiles } from './load.mjs';
import { hasAnyRecord } from './ledger.mjs';

const PLATFORMS = ['linkedin', 'bluesky'];

/** 媒体の並びから、ワークフローに渡す platform の値にする */
export const platformInput = (platforms) => (platforms.length === PLATFORMS.length ? 'both' : platforms[0]);

const time = (value) => {
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
};

/**
 * 投稿する原稿を 1 つ選ぶ。無ければ null。
 *
 * @param {object[]} posts - 原稿の内容(social/posts/<id>.yaml を読んだもの)
 * @param {object} options
 * @param {Date|number} options.now - 現在時刻
 * @param {(platform: string, postId: string) => boolean} options.isRecorded - 台帳に記録があるか
 * @returns {{ id: string, platforms: string[], platform: string, publishAfter: string }|null}
 */
export function selectDuePost(posts, { now, isRecorded }) {
  const at = now instanceof Date ? now.getTime() : now;
  const due = [];
  for (const post of posts) {
    if (!post || post.status !== 'ready') continue;
    const publishAfter = time(post.campaign?.publish_after);
    const expiresAt = time(post.campaign?.expires_at);
    if (publishAfter === null || publishAfter > at) continue;
    if (expiresAt === null || expiresAt <= at) continue;
    const platforms = PLATFORMS.filter((p) => post[p]?.enabled === true && !isRecorded(p, post.id));
    if (!platforms.length) continue;
    due.push({ id: post.id, platforms, platform: platformInput(platforms), publishAfter: post.campaign.publish_after, at: publishAfter });
  }
  due.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  if (!due.length) return null;
  const { at: _at, ...chosen } = due[0];
  return chosen;
}

/** social/posts/*.yaml を読む(スキーマに合わないファイルは選ばない) */
export function readPosts(files = listPostFiles()) {
  return files
    .map((file) => loadPostFile(file))
    .filter((loaded) => loaded.valid && loaded.data)
    .map((loaded) => loaded.data);
}

function main(argv) {
  let output = null;
  let nowArg = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--output') output = argv[++i];
    else if (argv[i] === '--now') nowArg = argv[++i];
  }
  const now = nowArg ? new Date(nowArg) : new Date();
  const chosen = selectDuePost(readPosts(), { now, isRecorded: hasAnyRecord });
  const lines = chosen
    ? [`count=1`, `post_id=${chosen.id}`, `platform=${chosen.platform}`]
    : ['count=0', 'post_id=', 'platform='];
  if (chosen) console.log(`🗓️ ${chosen.id} を ${chosen.platform} へ投稿します(publish_after: ${chosen.publishAfter})。`);
  else console.log(`🗓️ 予定日を過ぎた未投稿の原稿はありません(${now.toISOString()} の時点)。`);
  if (output) fs.appendFileSync(output, `${lines.join('\n')}\n`, 'utf8');
  else console.log(lines.join('\n'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2));
}
