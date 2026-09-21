// note の投稿台帳。どの原稿(platforms/note/public/<id>.md)が、note のどの投稿(URL・キー)に対応するかを記録する。
//
// note には「同じ投稿を更新する」API がなく、publish-note.mjs は毎回エディタで投稿を作ります。
// 台帳がないと、再実行のたびに新しい投稿が増えて重複します。台帳で次を担保します。
//   1. 同一性: 原稿 id → note の投稿(key/URL)の対応を残す。
//   2. 冪等性: 直前に投稿した内容の指紋(fingerprint)と今回の内容が同じなら、投稿しない(スキップ)。
//   3. 更新: 既に投稿がある原稿を再公開するときは、新規作成ではなく既存の投稿の編集に回す(publish-note.mjs)。
//
// 台帳は platforms/note/ledger.json に置き、CI が投稿後に main へ書き戻します(scripts/note-commit-ledger.mjs)。
// 投稿の判断には、作業ツリーの台帳ではなく main の最新の台帳を使います(readMainLedger)。

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** リポジトリの根からの台帳のパス(git の中のパスにも使う) */
export const LEDGER_FILE = 'platforms/note/ledger.json';
export const LEDGER_PATH = path.join(ROOT, LEDGER_FILE);

/** publish-note.mjs が投稿のたびに台帳へ書く項目。書き戻しでは、この項目だけを main の台帳に重ねる */
export const RECORD_FIELDS = ['note_key', 'url', 'fingerprint', 'title', 'published_at'];

/**
 * 投稿の対象になる原稿の status。ready は新規の投稿か、台帳に記録のある投稿の更新になる。
 * published は台帳に記録のある投稿の更新だけになる(decidePublish)。draft と retired は投稿しない。
 */
export const PUBLISHABLE_STATUSES = new Set(['ready', 'published']);

export function isPublishable(status) {
  return PUBLISHABLE_STATUSES.has(status);
}

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

/**
 * main の最新の台帳を読む(git fetch のうえで origin/main の platforms/note/ledger.json)。
 * 投稿の判断はこれで行う。待っていた実行の作業ツリー(起動したコミット)の台帳には、先の実行が書き戻した記録が無く、
 * それで判断すると同じ原稿を note にもう 1 本作る。main に台帳が無ければ空の台帳。fetch や読み取りに失敗したら例外。
 */
export function readMainLedger({ cwd = ROOT } = {}) {
  const run = (args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  run(['fetch', '--quiet', 'origin', '+refs/heads/main:refs/remotes/origin/main']);
  const spec = `refs/remotes/origin/main:${LEDGER_FILE}`;
  try {
    run(['cat-file', '-e', spec]);
  } catch {
    return { posts: {} };
  }
  const ledger = JSON.parse(run(['show', spec]));
  return { ...ledger, posts: ledger.posts || {} };
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
 * 再公開の判断。戻り値の action は 'skip' | 'update' | 'create' | 'refuse'。
 *   - 既存の投稿があり、内容の指紋が前回と同じ → skip(重複投稿を防ぐ)
 *   - 既存の投稿があり、内容が変わった → update(既存の note.com の投稿を編集)
 *   - 既存の投稿がなく、原稿の status が published → refuse(投稿しない。published は投稿済みの記録なので、
 *     台帳に無いのは台帳の外で投稿されたもの。新規に作ると note 上で重複する)
 *   - 既存の投稿がない → create(新規に投稿し、台帳に記録)
 * force が真なら skip しない(refuse は force でも変えない)。
 * ledger を渡せばそれで判断する(publish-note.mjs は readMainLedger の結果を渡す)。無ければ ledgerPath のファイルを読む。
 */
export function decidePublish(postId, fp, { force = false, ledgerPath = LEDGER_PATH, status = null, ledger = null } = {}) {
  const entry = (ledger ?? readLedger(ledgerPath)).posts?.[postId] || null;
  if (!entry || !entry.note_key) return { action: status === 'published' ? 'refuse' : 'create', entry };
  if (!force && entry.fingerprint === fp) return { action: 'skip', entry };
  return { action: 'update', entry };
}
