import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { getLedgerPath, loadLedger, appendLedger, getPostPublishStatus, getReachedStatus, hasAnyRecord, resolveLedgerManually, isValidRepostReason, REPOST_REASON_MIN_LENGTH } from '../../scripts/social/ledger.mjs';

/** 本物の台帳を退避して、空の台帳でテストする */
function withEmptyLedger(body) {
  const paths = ['linkedin', 'bluesky'].map((p) => getLedgerPath(p));
  const backups = paths.map((p) => (fs.existsSync(p) ? fs.readFileSync(p) : null));
  for (const p of paths) fs.rmSync(p, { force: true });
  try {
    body();
  } finally {
    for (const [i, p] of paths.entries()) {
      fs.rmSync(p, { force: true });
      if (backups[i]) fs.writeFileSync(p, backups[i]);
    }
  }
}

test('ledger operations on fresh and sequential entries', () => {
  withEmptyLedger(() => {
    // 1. Fresh ledger is empty
    assert.strictEqual(loadLedger('linkedin').length, 0);

    // 2. Append first state: pending
    const key = 'linkedin:my-post-id:commit123';
    appendLedger('linkedin', { key, post_id: 'my-post-id', source_sha: 'commit123', status: 'pending' });
    assert.strictEqual(getPostPublishStatus('linkedin', 'my-post-id'), 'pending');
    assert.strictEqual(getReachedStatus('linkedin', 'my-post-id'), null, 'pending だけでは、まだ媒体に届いていない');

    // 3. Append final state: published
    appendLedger('linkedin', { key, post_id: 'my-post-id', source_sha: 'commit123', status: 'published', remote_ids: ['urn:li:share:123'] });
    assert.strictEqual(getPostPublishStatus('linkedin', 'my-post-id'), 'published');
    assert.strictEqual(getReachedStatus('linkedin', 'my-post-id'), 'published');

    // 4. Resolve manually
    resolveLedgerManually({
      platform: 'linkedin',
      postId: 'my-post-id',
      sourceSha: 'commit123',
      reason: 'manual cleanup',
      remoteIds: ['urn:li:share:456'],
      operator: 'admin',
    });
    assert.strictEqual(getPostPublishStatus('linkedin', 'my-post-id'), 'manually-resolved');

    const records = loadLedger('linkedin');
    assert.strictEqual(records.length, 3);
    assert.strictEqual(records[2].operator, 'admin');
    assert.strictEqual(records[2].reason, 'manual cleanup');
  });
});

test('a post already published under another commit SHA is still counted as published', () => {
  // 原稿を直すと source_sha が変わる。SHA を鍵にすると、同じ原稿を二度投稿できてしまう
  withEmptyLedger(() => {
    appendLedger('bluesky', { key: 'bluesky:same-post:oldsha', post_id: 'same-post', source_sha: 'oldsha', status: 'published', remote_ids: ['at://x'] });
    assert.strictEqual(getReachedStatus('bluesky', 'same-post'), 'published', '別の SHA でも投稿済みと見る');
    assert.strictEqual(getReachedStatus('bluesky', 'other-post'), null);
    assert.strictEqual(getReachedStatus('linkedin', 'same-post'), null, '媒体ごとに見る');
  });
});

test('a post deleted by a human on the platform is not published again', () => {
  // 2026-09-16 に quickscribe-floor-2026-09 の LinkedIn の投稿を筆者が消した。
  // いちばん新しい状態(deleted-by-human)だけを見ると、自動でもう一度投稿してしまう
  withEmptyLedger(() => {
    const base = { key: 'linkedin:deleted-post:sha', post_id: 'deleted-post', source_sha: 'sha' };
    appendLedger('linkedin', { ...base, status: 'pending' });
    appendLedger('linkedin', { ...base, status: 'published', remote_ids: ['urn:li:share:1'] });
    appendLedger('linkedin', { ...base, status: 'deleted-by-human', remote_ids: ['urn:li:share:1'], reason: '文脈がなく伝わらないため', operator: 'author' });
    assert.strictEqual(getPostPublishStatus('linkedin', 'deleted-post'), 'deleted-by-human');
    assert.strictEqual(getReachedStatus('linkedin', 'deleted-post'), 'deleted-by-human', '一度届いているので、もう一度投稿しない');
  });
});

test('a post that failed before sending can be published again by hand, but has a record', () => {
  withEmptyLedger(() => {
    appendLedger('bluesky', { key: 'bluesky:failed-post:sha', post_id: 'failed-post', source_sha: 'sha', status: 'failed-before-send', error: 'embed is null' });
    assert.strictEqual(getReachedStatus('bluesky', 'failed-post'), null, '送信の前に落ちたので、手動の起動では投稿し直せる');
    assert.strictEqual(hasAnyRecord('bluesky', 'failed-post'), true, '定期実行では、記録があるので選ばない');
    assert.strictEqual(hasAnyRecord('bluesky', 'never-posted'), false);
  });
});

test('an old record without post_id is read from its key', () => {
  withEmptyLedger(() => {
    fs.writeFileSync(getLedgerPath('linkedin'), `${JSON.stringify({ schema_version: 1, platform: 'linkedin', key: 'linkedin:legacy-post:sha', status: 'published' })}\n`, 'utf8');
    assert.strictEqual(getReachedStatus('linkedin', 'legacy-post'), 'published');
  });
});

test('the way past a reached record needs a reason, and a one-word reason is not one', () => {
  // 届いた記録があると二度と投稿できない。逃げ道は --allow-repost <理由> だけで、理由には長さの下限がある
  assert.strictEqual(isValidRepostReason(null), false, '理由が無ければ越えられない');
  assert.strictEqual(isValidRepostReason(''), false);
  assert.strictEqual(isValidRepostReason('再投稿'), false, '定型の一語では越えられない');
  assert.strictEqual(isValidRepostReason('   ' + 'あ'.repeat(REPOST_REASON_MIN_LENGTH - 1) + '   '), false, '前後の空白は理由に数えない');
  assert.strictEqual(isValidRepostReason('媒体の側で投稿が消えたのを確認した'), true);
});
