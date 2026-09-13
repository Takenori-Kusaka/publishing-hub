// note の投稿台帳。どの原稿(platforms/note/public/<id>.md)が、note のどの投稿(URL・キー)に対応するかを記録する。
//
// note には「同じ投稿を更新する」API がなく、publish-note.mjs は毎回エディタで投稿を作ります。
// 台帳がないと、再実行のたびに新しい投稿が増えて重複します。台帳で次を担保します。
//   1. 同一性: 原稿 id → note の投稿(key/URL)の対応を残す。
//   2. 冪等性: 直前に投稿した内容の指紋(fingerprint)と今回の内容が同じなら、投稿しない(スキップ)。
//   3. 更新: 既に投稿がある原稿を再公開するときは、新規作成ではなく既存の投稿の編集に回す(publish-note.mjs)。
//
// 台帳は platforms/note/ledger.json に置き、CI が投稿後に書き戻します。

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LEDGER_PATH = path.join(ROOT, 'platforms/note/ledger.json');

/** 投稿する内容の指紋(題名 + HTML 本文)。内容が変わったかの判定に使う */
export function fingerprint(title, html) {
  return crypto.createHash('sha256').update(`${title}\n\n${html}`, 'utf8').digest('hex');
}

/** note の投稿 URL(https://note.com/<user>/n/<key>)から key を取り出す。取れなければ null */
export function noteKeyFromUrl(url) {
  const m = /note\.com\/[^/]+\/n\/([A-Za-z0-9_-]+)/.exec(String(url || ''));
  return m ? m[1] : null;
}

export function readLedger(ledgerPath = LEDGER_PATH) {
  try {
    return fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) : { posts: {} };
  } catch {
    return { posts: {} };
  }
}

export function getEntry(postId, ledgerPath = LEDGER_PATH) {
  return readLedger(ledgerPath).posts?.[postId] || null;
}

export function writeEntry(postId, entry, ledgerPath = LEDGER_PATH) {
  const ledger = readLedger(ledgerPath);
  ledger.posts = ledger.posts || {};
  ledger.posts[postId] = { ...ledger.posts[postId], ...entry };
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  return ledger.posts[postId];
}

/**
 * 再公開の判断。戻り値の action は 'skip' | 'update' | 'create'。
 *   - 既存の投稿があり、内容の指紋が前回と同じ → skip(重複投稿を防ぐ)
 *   - 既存の投稿があり、内容が変わった → update(既存の note.com の投稿を編集)
 *   - 既存の投稿がない → create(新規に投稿し、台帳に記録)
 * force が真なら skip しない。
 */
export function decidePublish(postId, fp, { force = false, ledgerPath = LEDGER_PATH } = {}) {
  const entry = getEntry(postId, ledgerPath);
  if (!entry || !entry.note_key) return { action: 'create', entry };
  if (!force && entry.fingerprint === fp) return { action: 'skip', entry };
  return { action: 'update', entry };
}
