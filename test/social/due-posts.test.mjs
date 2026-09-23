import { test } from 'node:test';
import assert from 'node:assert';
import { selectDuePost, platformInput } from '../../scripts/social/due-posts.mjs';

// 定期実行で投稿する原稿の選び方。原稿の campaign.publish_after が来たら投稿し、
// 台帳に記録のある媒体は選ばない。1 回の実行で選ぶのは 1 原稿まで。

const NOW = new Date('2026-10-01T00:00:00Z'); // 2026-10-01 09:00 JST

const post = (id, overrides = {}) => ({
  id,
  status: 'ready',
  campaign: {
    publish_after: '2026-09-25T09:00:00+09:00',
    expires_at: '2026-12-31T23:59:59+09:00',
    utm_campaign: id.replace(/-/g, '_'),
  },
  linkedin: { enabled: true },
  bluesky: { enabled: true },
  ...overrides,
});

const none = () => false;
const recorded = (pairs) => (platform, id) => pairs.includes(`${platform}:${id}`);

test('a manuscript whose publish_after has not come yet is not selected', () => {
  const future = post('future', { campaign: { ...post('future').campaign, publish_after: '2026-10-02T09:00:00+09:00' } });
  assert.strictEqual(selectDuePost([future], { now: NOW, isRecorded: none }), null);
  // 予定日ちょうどは投稿する
  const exact = post('exact', { campaign: { ...post('exact').campaign, publish_after: '2026-10-01T09:00:00+09:00' } });
  assert.strictEqual(selectDuePost([exact], { now: NOW, isRecorded: none })?.id, 'exact');
});

test('an expired manuscript is not selected', () => {
  const expired = post('expired', { campaign: { ...post('expired').campaign, expires_at: '2026-09-30T23:59:59+09:00' } });
  assert.strictEqual(selectDuePost([expired], { now: NOW, isRecorded: none }), null);
});

test('a manuscript that is not ready is not selected', () => {
  for (const status of ['draft', 'paused', 'retired']) {
    assert.strictEqual(selectDuePost([post('x', { status })], { now: NOW, isRecorded: none }), null, status);
  }
});

test('a manuscript already recorded on both platforms is not selected', () => {
  const chosen = selectDuePost([post('done')], { now: NOW, isRecorded: recorded(['linkedin:done', 'bluesky:done']) });
  assert.strictEqual(chosen, null);
});

test('when only one platform is recorded, the other one is still posted', () => {
  const chosen = selectDuePost([post('half')], { now: NOW, isRecorded: recorded(['linkedin:half']) });
  assert.deepStrictEqual(chosen, { id: 'half', platforms: ['bluesky'], platform: 'bluesky', publishAfter: '2026-09-25T09:00:00+09:00' });
});

test('a platform that is disabled in the manuscript is not posted', () => {
  const chosen = selectDuePost([post('one-sided', { bluesky: { enabled: false } })], { now: NOW, isRecorded: none });
  assert.deepStrictEqual(chosen.platforms, ['linkedin']);
  assert.strictEqual(selectDuePost([post('off', { linkedin: { enabled: false }, bluesky: { enabled: false } })], { now: NOW, isRecorded: none }), null);
});

test('when several manuscripts are due, only the earliest one is selected', () => {
  const early = post('early', { campaign: { ...post('early').campaign, publish_after: '2026-09-20T09:00:00+09:00' } });
  const late = post('late', { campaign: { ...post('late').campaign, publish_after: '2026-09-28T09:00:00+09:00' } });
  const chosen = selectDuePost([late, early], { now: NOW, isRecorded: none });
  assert.strictEqual(chosen.id, 'early', '1 回の実行で投稿するのは 1 原稿まで(publish_after の早いもの)');
  // 同じ予定日なら原稿 ID の順(実行ごとに入れ替わらない)
  const same = post('aaa', { campaign: { ...post('aaa').campaign, publish_after: '2026-09-20T09:00:00+09:00' } });
  assert.strictEqual(selectDuePost([early, same], { now: NOW, isRecorded: none }).id, 'aaa');
});

test('a record of any kind blocks the platform, not just published', () => {
  // 送信の前に落ちた記録や、状態の分からない記録も、人が見るまで自動では投稿し直さない
  const chosen = selectDuePost([post('failed')], { now: NOW, isRecorded: recorded(['bluesky:failed']) });
  assert.deepStrictEqual(chosen.platforms, ['linkedin']);
});

test('a manuscript without campaign dates is not selected', () => {
  assert.strictEqual(selectDuePost([{ id: 'bare', status: 'ready', linkedin: { enabled: true } }], { now: NOW, isRecorded: none }), null);
  const broken = post('broken', { campaign: { publish_after: 'not a date', expires_at: '2026-12-31T23:59:59+09:00' } });
  assert.strictEqual(selectDuePost([broken], { now: NOW, isRecorded: none }), null);
});

test('platformInput maps the selected platforms to the workflow input', () => {
  assert.strictEqual(platformInput(['linkedin', 'bluesky']), 'both');
  assert.strictEqual(platformInput(['linkedin']), 'linkedin');
  assert.strictEqual(platformInput(['bluesky']), 'bluesky');
});
