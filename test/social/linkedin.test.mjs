import { test } from 'node:test';
import assert from 'node:assert';
import { redactSecret, publishToLinkedIn } from '../../scripts/social/publish-linkedin.mjs';

test('redactSecret should mask sensitive LinkedIn tokens and JWTs', () => {
  const token = 'AQxxxx_this_is_a_very_long_mock_token_1234567890';
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

  const raw = `Failed to publish: Token is ${token} and JWT is ${jwt}`;
  const redacted = redactSecret(raw);

  assert.strictEqual(redacted.includes('AQxxxx'), false);
  assert.strictEqual(redacted.includes('eyJhbGci'), false);
  assert.strictEqual(redacted.includes('[REDACTED_LINKEDIN_TOKEN]'), true);
  assert.strictEqual(redacted.includes('[REDACTED_JWT]'), true);
});

test('publishToLinkedIn should successfully publish a text post', async () => {
  const postData = { id: 'test-post' };
  const rendered = {
    linkedin: {
      text: 'Hello LinkedIn! #AI'
    }
  };

  const mockFetch = async (url, options) => {
    assert.strictEqual(url, 'https://api.linkedin.com/rest/posts');
    assert.strictEqual(options.method, 'POST');
    assert.strictEqual(options.headers['LinkedIn-Version'], '202604');
    assert.strictEqual(options.headers['X-Restli-Protocol-Version'], '2.0.0');
    assert.strictEqual(options.headers['Authorization'], 'Bearer mock_token');

    const body = JSON.parse(options.body);
    assert.strictEqual(body.author, 'urn:li:person:12345');
    assert.strictEqual(body.commentary, 'Hello LinkedIn! #AI');

    return {
      ok: true,
      status: 201,
      headers: new Map([['x-restli-id', 'urn:li:share:abc987']])
    };
  };

  const result = await publishToLinkedIn(
    postData,
    rendered,
    { authorUrn: '12345', accessToken: 'mock_token', version: '202604' },
    { customFetch: mockFetch }
  );

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.remoteId, 'urn:li:share:abc987');
});

test('publishToLinkedIn should classify HTTP 401 as LINKEDIN_AUTH_ERROR and redact secrets', async () => {
  const postData = { id: 'test-post' };
  const rendered = {
    linkedin: {
      text: 'Hello'
    }
  };

  const mockFetch = async () => {
    return {
      ok: false,
      status: 401,
      text: async () => 'Invalid token AQxxxx_secret_token_value_is_here'
    };
  };

  await assert.rejects(async () => {
    await publishToLinkedIn(
      postData,
      rendered,
      { authorUrn: '12345', accessToken: 'mock_token', version: '202604' },
      { customFetch: mockFetch }
    );
  }, (err) => {
    assert.strictEqual(err.code, 'LINKEDIN_AUTH_ERROR');
    assert.strictEqual(err.status, 401);
    assert.strictEqual(err.message.includes('AQxxxx'), false);
    assert.strictEqual(err.message.includes('[REDACTED_LINKEDIN_TOKEN]'), true);
    return true;
  });
});

test('publishToLinkedIn should support article share cards and call thumbnail uploader', async () => {
  const postData = { id: 'test-post' };
  const rendered = {
    linkedin: {
      text: 'Hello',
      article: {
        url: 'https://zenn.dev',
        title: 'Title',
        description: 'Desc',
        thumbnail: 'E:/Github/zenn-content/images/social/thumb.png',
        alt: 'Thumbnail Alt'
      }
    }
  };

  const mockUploadImage = async ({ authorUrn, accessToken, version, filePath }) => {
    assert.strictEqual(authorUrn, 'urn:li:person:12345');
    assert.strictEqual(accessToken, 'mock_token');
    assert.strictEqual(version, '202604');
    assert.strictEqual(filePath, 'E:/Github/zenn-content/images/social/thumb.png');
    return 'urn:li:image:img777';
  };

  const mockFetch = async (url, options) => {
    if (url === 'https://api.linkedin.com/rest/posts') {
      const body = JSON.parse(options.body);
      assert.strictEqual(body.content.article.source, 'https://zenn.dev');
      assert.strictEqual(body.content.article.thumbnail, 'urn:li:image:img777');
      return {
        ok: true,
        status: 201,
        headers: new Map([['x-restli-id', 'urn:li:share:share777']])
      };
    }
  };

  const result = await publishToLinkedIn(
    postData,
    rendered,
    { authorUrn: '12345', accessToken: 'mock_token', version: '202604' },
    { customFetch: mockFetch, uploadImageFn: mockUploadImage }
  );

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.remoteId, 'urn:li:share:share777');
});
