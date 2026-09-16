import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPostFile } from '../../scripts/social/load.mjs';
import { validatePost } from '../../scripts/social/validate.mjs';
import { renderPost } from '../../scripts/social/render.mjs';
import { getPostPublishStatus, appendLedger, getLedgerPath } from '../../scripts/social/ledger.mjs';
import { publishToLinkedIn } from '../../scripts/social/publish-linkedin.mjs';
import { publishToBluesky, BlueskyPartialThreadError } from '../../scripts/social/publish-bluesky.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('E2E Integration Dry Run: success, partial, and timeout states in ledger', async () => {
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
    const filePath = path.resolve(__dirname, '../../social/fixtures/valid-thread.yaml');
    const loaded = loadPostFile(filePath);
    assert.strictEqual(loaded.valid, true);

    const data = loaded.data;
    const rendered = renderPost(data);

    // 1. Success Integration Simulation
    const mockFetchSuccess = async () => {
      return {
        ok: true,
        status: 201,
        headers: new Map([['x-restli-id', 'urn:li:share:share123']])
      };
    };

    const liResult = await publishToLinkedIn(
      data,
      rendered,
      { authorUrn: '12345', accessToken: 'mock_token', version: '202604' },
      { customFetch: mockFetchSuccess }
    );

    appendLedger('linkedin', {
      key: `linkedin:${data.id}:${data.source.revision}`,
      post_id: data.id,
      source_sha: data.source.revision,
      status: 'published',
      remote_ids: [liResult.remoteId]
    });

    assert.strictEqual(getPostPublishStatus('linkedin', data.id, data.source.revision), 'published');

    // 2. Partial Thread Integration Simulation
    const mockAgentPartial = {
      login: async () => {},
      post: async (payload) => {
        // Mocking second post failure
        if (payload.text.includes('不確実性')) {
          throw new Error('PDS timeout!');
        }
        return { uri: 'at://did:plc:123/app.bsky.feed.post/p1', cid: 'cid1' };
      }
    };

    try {
      await publishToBluesky(
        data,
        rendered,
        { identifier: 'user', password: 'pass' },
        { agentInstance: mockAgentPartial }
      );
      assert.fail('Should have thrown BlueskyPartialThreadError');
    } catch (err) {
      assert.strictEqual(err instanceof BlueskyPartialThreadError, true);
      assert.strictEqual(err.successfulPosts.length, 2);

      appendLedger('bluesky', {
        key: `bluesky:${data.id}:${data.source.revision}`,
        post_id: data.id,
        source_sha: data.source.revision,
        status: 'partial',
        remote_ids: err.successfulPosts.map(p => p.uri)
      });
    }

    assert.strictEqual(getPostPublishStatus('bluesky', data.id, data.source.revision), 'partial');

    // 3. Timeout / Unknown Integration Simulation
    const mockFetchTimeout = async () => {
      throw new Error('Connection timed out');
    };

    try {
      await publishToLinkedIn(
        data,
        rendered,
        { authorUrn: '12345', accessToken: 'mock_token', version: '202604' },
        { customFetch: mockFetchTimeout }
      );
    } catch (err) {
      appendLedger('linkedin', {
        key: `linkedin:${data.id}:${data.source.revision}-timeout`,
        post_id: data.id,
        source_sha: `${data.source.revision}-timeout`,
        status: 'pending-unknown',
        error: err.message
      });
    }

    assert.strictEqual(getPostPublishStatus('linkedin', data.id, `${data.source.revision}-timeout`), 'pending-unknown');

  } finally {
    // Restore backups
    if (fs.existsSync(lnPath)) fs.unlinkSync(lnPath);
    if (fs.existsSync(bskyPath)) fs.unlinkSync(bskyPath);

    if (lnBackup) fs.writeFileSync(lnPath, lnBackup);
    if (bskyBackup) fs.writeFileSync(bskyPath, bskyBackup);
  }
});
