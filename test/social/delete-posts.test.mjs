import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import YAML from 'yaml';
import { planDeletion, protectedIds, deleteLinkedIn } from '../../scripts/social/delete-posts.mjs';

const ledgers = {
  linkedin: [
    { post_id: 'a', status: 'published', remote_ids: ['urn:li:share:1'] },
    { post_id: 'a', status: 'published', remote_ids: ['urn:li:share:2'] }
  ],
  bluesky: [{ post_id: 'a', status: 'published', remote_ids: ['at://did:plc:x/app.bsky.feed.post/new1'] }]
};

test('protectedIds keeps only the newest published version of each post', () => {
  const keep = protectedIds(ledgers.linkedin);
  assert.ok(keep.has('urn:li:share:2'));
  assert.ok(!keep.has('urn:li:share:1'));
});

test('planDeletion allows old versions', () => {
  const plan = planDeletion({ targets: { linkedin: ['urn:li:share:1'], bluesky: ['at://did:plc:x/app.bsky.feed.post/old1'] } }, ledgers);
  assert.deepStrictEqual(plan.linkedin, ['urn:li:share:1']);
});

test('planDeletion refuses the current version', () => {
  assert.throws(() => planDeletion({ targets: { linkedin: ['urn:li:share:2'] } }, ledgers), /いちばん新しい版/);
  assert.throws(() => planDeletion({ targets: { bluesky: ['at://did:plc:x/app.bsky.feed.post/new1'] } }, ledgers), /いちばん新しい版/);
});

test('planDeletion refuses malformed identifiers', () => {
  assert.throws(() => planDeletion({ targets: { linkedin: ['urn:li:activity:1'] } }, ledgers), /識別子の形/);
});

test('deleteLinkedIn treats 404 as already gone and sends DELETE', async () => {
  const calls = [];
  const f = async (url, o) => { calls.push([url, o.method]); return { ok: false, status: 404, text: async () => '' }; };
  assert.strictEqual(await deleteLinkedIn('urn:li:share:9', { accessToken: 't', version: 'v' }, f), 'already-gone');
  assert.deepStrictEqual(calls[0], ['https://api.linkedin.com/rest/posts/urn%3Ali%3Ashare%3A9', 'DELETE']);
});

test('the 2026-10-14 deletion list is well-formed', () => {
  const list = YAML.parse(fs.readFileSync(new URL('../../social/deletions/2026-10-14-figureless.yaml', import.meta.url), 'utf8'));
  const plan = planDeletion(list, { linkedin: [], bluesky: [] });
  assert.strictEqual(plan.linkedin.length, 11);
  assert.strictEqual(plan.bluesky.length, 10);
});
