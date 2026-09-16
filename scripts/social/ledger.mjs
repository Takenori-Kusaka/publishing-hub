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
 * Checks if a specific post with a specific commit SHA has already been published.
 * Returns the latest status of this post if found.
 *
 * @param {string} platform - 'linkedin' | 'bluesky'
 * @param {string} postId
 * @param {string} sourceSha
 * @returns {string|null} - The latest status of the post, or null if never published
 */
export function getPostPublishStatus(platform, postId, sourceSha) {
  const records = loadLedger(platform);
  const targetKey = `${platform}:${postId}:${sourceSha}`;

  // Filter records matching this key, find latest
  const matches = records.filter(r => r.key === targetKey);
  if (matches.length === 0) {
    return null;
  }
  // Return the status of the last match (state machine transition)
  return matches[matches.length - 1].status;
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
