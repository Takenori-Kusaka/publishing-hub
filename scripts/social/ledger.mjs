import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const LEDGER_DIR = path.join(ROOT, 'social/ledger');

/**
 * Returns the path to the ledger file for a given platform.
 *
 * @param {string} platform - 'linkedin' | 'bluesky'
 * @returns {string}
 */
export function getLedgerPath(platform) {
  return path.join(LEDGER_DIR, `${platform}.jsonl`);
}

/**
 * Loads and parses append-only JSON Lines records from a platform's ledger.
 *
 * @param {string} platform - 'linkedin' | 'bluesky'
 * @returns {object[]} - Array of parsed ledger records
 */
export function loadLedger(platform) {
  const filePath = getLedgerPath(platform);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return content.split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      try {
        return JSON.parse(line);
      } catch (err) {
        // Log error and return null for broken lines
        console.error(`Malformed JSONL line skipped in ${platform} ledger:`, err.message);
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Appends a record to the platform's JSON Lines ledger.
 *
 * @param {string} platform - 'linkedin' | 'bluesky'
 * @param {object} record
 */
export function appendLedger(platform, record) {
  const filePath = getLedgerPath(platform);
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  const line = JSON.stringify({
    schema_version: 1,
    platform,
    ...record,
    timestamp: new Date().toISOString()
  });
  fs.appendFileSync(filePath, `${line}\n`, 'utf8');
}

/**
 * 「その媒体に届いた」ことを意味する状態。同じ原稿をもう一度投稿しない判断に使う。
 * deleted-by-human は、投稿したものを人が媒体の側で消した記録なので、自動で投稿し直さない。
 * pending(送信の直前に書く)と failed-before-send(送信の前に落ちた)は含めない。
 */
export const REACHED_STATUSES = ['published', 'partial', 'pending-unknown', 'manually-resolved', 'deleted-by-human'];

/**
 * 「届いた」記録を越えて投稿し直すときに、理由として受け取る文字列の最小の長さ。
 * 届いた記録があると二度と投稿できないため、逃げ道として --allow-repost <理由> を用意する。
 * 定型の一語(「再投稿」「やり直し」など)で通り抜けられないよう、長さの下限を置く。
 */
export const REPOST_REASON_MIN_LENGTH = 12;

/**
 * --allow-repost に渡された理由が、逃げ道として使える形か。
 *
 * @param {unknown} reason
 * @returns {boolean}
 */
export function isValidRepostReason(reason) {
  return typeof reason === 'string' && reason.trim().length >= REPOST_REASON_MIN_LENGTH;
}

/** 記録の原稿 ID。古い記録で post_id が無ければ key(媒体:原稿ID:コミットSHA)から読む */
const recordPostId = (record) => record.post_id ?? (typeof record.key === 'string' ? record.key.split(':')[1] : undefined);

/**
 * その媒体のその原稿の記録を古い順に返す。コミットの SHA は見ない
 * (原稿を直すと SHA が変わるため、SHA を鍵にすると同じ原稿を二度投稿できてしまう)。
 *
 * @param {string} platform - 'linkedin' | 'bluesky'
 * @param {string} postId
 * @returns {object[]}
 */
export function getPostRecords(platform, postId) {
  return loadLedger(platform).filter(r => recordPostId(r) === postId);
}

/**
 * その媒体のその原稿の、いちばん新しい状態。記録が無ければ null。
 *
 * @param {string} platform - 'linkedin' | 'bluesky'
 * @param {string} postId
 * @returns {string|null}
 */
export function getPostPublishStatus(platform, postId) {
  const records = getPostRecords(platform, postId);
  return records.length ? records[records.length - 1].status : null;
}

/**
 * すでにその媒体へ届いているなら、その状態を返す。届いていなければ null。
 * いちばん新しい状態ではなく「一度でも届いたか」で見る(published のあとに deleted-by-human が続いても、
 * もう一度投稿しない)。
 *
 * @param {string} platform - 'linkedin' | 'bluesky'
 * @param {string} postId
 * @returns {string|null}
 */
export function getReachedStatus(platform, postId) {
  const reached = getPostRecords(platform, postId).filter(r => REACHED_STATUSES.includes(r.status));
  return reached.length ? reached[reached.length - 1].status : null;
}

/**
 * その媒体のその原稿に、記録が 1 件でもあるか。定期実行の対象を選ぶときに使う
 * (人の入力が無い実行では、送信の前に落ちた記録や状態の分からない記録も、人が見るまで投稿し直さない)。
 *
 * @param {string} platform - 'linkedin' | 'bluesky'
 * @param {string} postId
 * @returns {boolean}
 */
export function hasAnyRecord(platform, postId) {
  return getPostRecords(platform, postId).length > 0;
}

/**
 * Adds a manual resolution record to resolve a blocked or unknown state.
 *
 * @param {string} platform - 'linkedin' | 'bluesky'
 * @param {string} postId
 * @param {string} sourceSha
 * @param {string} reason
 * @param {string[]} remoteIds
 * @param {string} operator
 */
export function resolveLedgerManually({ platform, postId, sourceSha, reason, remoteIds, operator }) {
  if (!reason || !operator || !remoteIds || remoteIds.length === 0) {
    throw new Error('Manual resolution requires: reason, operator, and remoteIds');
  }

  const key = `${platform}:${postId}:${sourceSha}`;
  appendLedger(platform, {
    key,
    post_id: postId,
    source_sha: sourceSha,
    status: 'manually-resolved',
    reason,
    remote_ids: remoteIds,
    operator
  });
}
