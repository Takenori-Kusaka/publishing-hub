import { test } from 'node:test';
import assert from 'node:assert';
import { redactBlueskySecret, publishToBluesky, BlueskyPartialThreadError } from '../../scripts/social/publish-bluesky.mjs';

test('redactBlueskySecret should mask sensitive Bluesky app passwords and JWTs', () => {
  const password = 'abcd-efgh-ijkl-mnop';
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

  const raw = `Login failed: pwd is ${password} and session is ${jwt}`;
  const redacted = redactBlueskySecret(raw);

  assert.strictEqual(redacted.includes('abcd-efgh'), false);
  assert.strictEqual(redacted.includes('eyJhbGci'), false);
  assert.strictEqual(redacted.includes('[REDACTED_BSKY_PASSWORD]'), true);
  assert.strictEqual(redacted.includes('[REDACTED_JWT]'), true);
});

test('publishToBluesky should successfully publish single post with mocked agent', async () => {
  const postData = { id: 'test' };
  const rendered = {
    bluesky: {
      langs: ['ja'],
      posts: [
        { text: 'Hello Bluesky!' }
      ]
    }
  };

  // Create mock BskyAgent
  const mockAgent = {
    login: async ({ identifier, password }) => {
      assert.strictEqual(identifier, 'user.bsky.social');
      assert.strictEqual(password, 'abcd-efgh-ijkl-mnop');
    },
    post: async (payload) => {
      assert.strictEqual(payload.text, 'Hello Bluesky!');
      assert.deepStrictEqual(payload.langs, ['ja']);
      return {
        uri: 'at://did:plc:123/app.bsky.feed.post/post111',
        cid: 'cid111'
      };
    }
  };

  const result = await publishToBluesky(
    postData,
    rendered,
    { identifier: 'user.bsky.social', password: 'abcd-efgh-ijkl-mnop' },
    { agentInstance: mockAgent }
  );

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.remoteIds.length, 1);
  assert.strictEqual(result.remoteIds[0].uri, 'at://did:plc:123/app.bsky.feed.post/post111');
});

test('publishToBluesky should publish threads and link subsequent replies to the root and parent', async () => {
  const postData = { id: 'test' };
  const rendered = {
    bluesky: {
      langs: ['ja'],
      posts: [
        { text: 'Thread Post 1' },
        { text: 'Thread Post 2' },
        { text: 'Thread Post 3' }
      ]
    }
  };

  const posted = [];

  const mockAgent = {
    login: async () => {},
    post: async (payload) => {
      const idx = posted.length;
      if (idx === 0) {
        assert.strictEqual(payload.reply, undefined);
      } else {
        assert.ok(payload.reply);
        assert.strictEqual(payload.reply.root.uri, 'at://did:plc:123/app.bsky.feed.post/root');
        const expectedParentSuffix = idx === 1 ? 'root' : `post${idx - 1}`;
        assert.strictEqual(payload.reply.parent.uri, `at://did:plc:123/app.bsky.feed.post/${expectedParentSuffix}`);
      }

      const suffix = idx === 0 ? 'root' : `post${idx}`;
      const record = {
        uri: `at://did:plc:123/app.bsky.feed.post/${suffix}`,
        cid: `cid_${suffix}`
      };
      posted.push(record);
      return record;
    }
  };

  const result = await publishToBluesky(
    postData,
    rendered,
    { identifier: 'user', password: 'pass' },
    { agentInstance: mockAgent }
  );

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.remoteIds.length, 3);
  assert.strictEqual(result.remoteIds[0].uri, 'at://did:plc:123/app.bsky.feed.post/root');
  assert.strictEqual(result.remoteIds[1].uri, 'at://did:plc:123/app.bsky.feed.post/post1');
  assert.strictEqual(result.remoteIds[2].uri, 'at://did:plc:123/app.bsky.feed.post/post2');
});

test('publishToBluesky should catch errors mid-thread and throw BlueskyPartialThreadError with successful post list', async () => {
  const postData = { id: 'test' };
  const rendered = {
    bluesky: {
      langs: ['ja'],
      posts: [
        { text: 'Post 1 (Successful)' },
        { text: 'Post 2 (Fails)' }
      ]
    }
  };

  let callCount = 0;
  const mockAgent = {
    login: async () => {},
    post: async (payload) => {
      callCount++;
      if (callCount === 1) {
        return {
          uri: 'at://did:plc:123/app.bsky.feed.post/root',
          cid: 'cid_root'
        };
      }
      throw new Error('PDS is down!');
    }
  };

  await assert.rejects(async () => {
    await publishToBluesky(
      postData,
      rendered,
      { identifier: 'user', password: 'pass' },
      { agentInstance: mockAgent }
    );
  }, (err) => {
    assert.strictEqual(err instanceof BlueskyPartialThreadError, true);
    assert.strictEqual(err.successfulPosts.length, 1);
    assert.strictEqual(err.successfulPosts[0].uri, 'at://did:plc:123/app.bsky.feed.post/root');
    assert.strictEqual(err.message.includes('Bluesky thread failed at index 1'), true);
    return true;
  });
});
