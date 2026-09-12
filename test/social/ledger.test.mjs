import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLedgerPath, loadLedger, appendLedger, getPostPublishStatus, resolveLedgerManually } from '../../scripts/social/ledger.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const tmpLedgerDir = path.resolve(__dirname, '../../social/ledger');

test('ledger operations on fresh and sequential entries', () => {
  // Back up existing linkedin.jsonl / bluesky.jsonl if they exist to prevent interference
  const lnPath = getLedgerPath('linkedin');
  const bskyPath = getLedgerPath('bluesky');

  let lnBackup = null;
  let bskyBackup = null;

  if (fs.existsSync(lnPath)) {
    lnBackup = fs.readFileSync(lnPath);
    fs.unlinkSync(lnPath);
  }
  if (fs.existsSync(bskyPath)) {
    bskyBackup = fs.readFileSync(bskyPath);
    fs.unlinkSync(bskyPath);
  }

  try {
    // 1. Fresh ledger is empty
    const fresh = loadLedger('linkedin');
    assert.strictEqual(fresh.length, 0);

    // 2. Append first state: pending
    const key = 'linkedin:my-post-id:commit123';
    appendLedger('linkedin', {
      key,
      post_id: 'my-post-id',
      source_sha: 'commit123',
      status: 'pending'
    });

    assert.strictEqual(getPostPublishStatus('linkedin', 'my-post-id', 'commit123'), 'pending');

    // 3. Append final state: published
    appendLedger('linkedin', {
      key,
      post_id: 'my-post-id',
      source_sha: 'commit123',
      status: 'published',
      remote_ids: ['urn:li:share:123']
    });

    // Expecting the LATEST state to be published
    assert.strictEqual(getPostPublishStatus('linkedin', 'my-post-id', 'commit123'), 'published');

    // 4. Resolve manually
    resolveLedgerManually({
      platform: 'linkedin',
      postId: 'my-post-id',
      sourceSha: 'commit123',
      reason: 'manual cleanup',
      remoteIds: ['urn:li:share:456'],
      operator: 'admin'
    });

    assert.strictEqual(getPostPublishStatus('linkedin', 'my-post-id', 'commit123'), 'manually-resolved');

    const records = loadLedger('linkedin');
    assert.strictEqual(records.length, 3);
    assert.strictEqual(records[2].operator, 'admin');
    assert.strictEqual(records[2].reason, 'manual cleanup');

  } finally {
    // Clean up test outputs and restore backups
    if (fs.existsSync(lnPath)) {
      fs.unlinkSync(lnPath);
    }
    if (fs.existsSync(bskyPath)) {
      fs.unlinkSync(bskyPath);
    }

    if (lnBackup) {
      fs.writeFileSync(lnPath, lnBackup);
    }
    if (bskyBackup) {
      fs.writeFileSync(bskyPath, bskyBackup);
    }
  }
});
