// 削除の一覧(social/deletions/*.yaml)にある投稿を、LinkedIn と Bluesky から消す。
// 削除は取り消せないので、起動は人が行う(.github/workflows/social-delete.yml)。
//
// 守り:
// - 確認ワード DELETE が無ければ何もしない
// - 各原稿の台帳でいちばん新しい published の remote_ids は消さない(いまの版を守る)。1 件でも含まれれば全体を止める
// - すでに消えている投稿(404)は成功として数える(再実行できるように)
//
// 使い方: node scripts/social/delete-posts.mjs --list social/deletions/<file>.yaml --confirm DELETE [--dry-run]

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { BskyAgent } from '@atproto/api';
import { loadLedger } from './ledger.mjs';
import { redactSecret } from './publish-linkedin.mjs';

/**
 * 各原稿の、いちばん新しい published の remote_ids。これらは消さない。
 *
 * @param {object[]} records - 台帳の記録
 * @returns {Set<string>}
 */
export function protectedIds(records) {
  const latest = new Map();
  for (const r of records) {
    if (r.status === 'published' && Array.isArray(r.remote_ids) && r.remote_ids.length) latest.set(r.post_id, r.remote_ids);
  }
  return new Set([...latest.values()].flat());
}

/**
 * 一覧を読み、守るべき投稿が含まれていないかを確かめる。
 *
 * @param {object} list - { targets: { linkedin: string[], bluesky: string[] } }
 * @param {{ linkedin: object[], bluesky: object[] }} ledgers
 * @returns {{ linkedin: string[], bluesky: string[] }}
 */
export function planDeletion(list, ledgers) {
  const plan = { linkedin: list.targets?.linkedin ?? [], bluesky: list.targets?.bluesky ?? [] };
  for (const [platform, ids] of Object.entries(plan)) {
    const keep = protectedIds(ledgers[platform] ?? []);
    const hit = ids.filter((id) => keep.has(id));
    if (hit.length) throw new Error(`${platform}: 台帳のいちばん新しい版を消そうとしています: ${hit.join(', ')}`);
    for (const id of ids) {
      const ok = platform === 'linkedin' ? /^urn:li:(share|ugcPost):\d+$/.test(id) : /^at:\/\/did:[a-z]+:[A-Za-z0-9._:-]+\/app\.bsky\.feed\.post\/[a-z0-9]+$/.test(id);
      if (!ok) throw new Error(`${platform}: 識別子の形が違います: ${id}`);
    }
  }
  return plan;
}

export async function deleteLinkedIn(urn, { accessToken, version }, customFetch = fetch) {
  const res = await customFetch(`https://api.linkedin.com/rest/posts/${encodeURIComponent(urn)}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'X-RestLi-Method': 'DELETE',
      'LinkedIn-Version': version
    }
  });
  if (res.ok || res.status === 404 || res.status === 410) return res.ok ? 'deleted' : 'already-gone';
  throw new Error(`LinkedIn の削除に失敗 (${res.status}): ${redactSecret(await res.text())}`);
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const listPath = opt('--list');
  const dryRun = args.includes('--dry-run');
  if (!listPath) throw new Error('--list が要ります');
  if (opt('--confirm') !== 'DELETE' && !dryRun) throw new Error('確認ワード DELETE がありません。削除は取り消せません');

  const list = YAML.parse(fs.readFileSync(listPath, 'utf8'));
  const plan = planDeletion(list, { linkedin: loadLedger('linkedin'), bluesky: loadLedger('bluesky') });
  console.log(`理由: ${list.reason}`);
  console.log(`対象: LinkedIn ${plan.linkedin.length} 件、Bluesky ${plan.bluesky.length} 件`);
  if (dryRun) {
    for (const [p, ids] of Object.entries(plan)) for (const id of ids) console.log(`  (dry-run) ${p} ${id}`);
    return;
  }

  let failed = 0;
  for (const urn of plan.linkedin) {
    try {
      console.log(`  linkedin ${urn}: ${await deleteLinkedIn(urn, { accessToken: process.env.LINKEDIN_ACCESS_TOKEN, version: process.env.LINKEDIN_VERSION })}`);
    } catch (e) { failed++; console.log(`::error::linkedin ${urn}: ${e.message}`); }
  }
  if (plan.bluesky.length) {
    const agent = new BskyAgent({ service: process.env.BSKY_SERVICE || 'https://bsky.social' });
    await agent.login({ identifier: process.env.BSKY_IDENTIFIER, password: process.env.BSKY_APP_PASSWORD });
    for (const uri of plan.bluesky) {
      if (!uri.startsWith(`at://${agent.session.did}/`)) { failed++; console.log(`::error::bluesky ${uri}: 自分の投稿ではありません`); continue; }
      try {
        await agent.deletePost(uri);
        console.log(`  bluesky ${uri}: deleted`);
      } catch (e) { failed++; console.log(`::error::bluesky ${uri}: ${String(e.message).slice(0, 200)}`); }
    }
  }
  if (failed) { console.log(`::error::${failed} 件の削除に失敗しました`); process.exit(1); }
  console.log('✅ すべて消しました');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.log(`::error::${e.message}`); process.exit(1); });
}
