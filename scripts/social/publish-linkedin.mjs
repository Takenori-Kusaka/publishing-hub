import fs from 'node:fs';

/**
 * Redacts potential sensitive data from HTTP response error messages.
 *
 * @param {string} msg
 * @returns {string}
 */
export function redactSecret(msg) {
  if (!msg) return '';
  return msg
    .replace(/\bAQ[A-Za-z0-9-_]{20,}\b/g, '[REDACTED_LINKEDIN_TOKEN]')
    .replace(/\beyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*\b/g, '[REDACTED_JWT]');
}

/**
 * Initializes and uploads a thumbnail image to LinkedIn.
 *
 * @param {object} options - { authorUrn, accessToken, version, filePath, customFetch }
 * @returns {Promise<string>} - The uploaded LinkedIn Image URN (urn:li:image:<id>)
 */
export async function uploadLinkedInImage({ authorUrn, accessToken, version, filePath, customFetch = fetch }) {
  const fetchFn = customFetch;
  const author = authorUrn.startsWith('urn:li:') ? authorUrn : `urn:li:person:${authorUrn}`;

  // 1. Initialize Upload
  const initUrl = 'https://api.linkedin.com/rest/images?action=initializeUpload';
  const initRes = await fetchFn(initUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': version,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: author
      }
    })
  });

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`LinkedIn Image Init Failed (${initRes.status}): ${redactSecret(errText)}`);
  }

  const initData = await initRes.json();
  const uploadUrl = initData.value?.uploadUrl;
  const imageUrn = initData.value?.image;

  if (!uploadUrl || !imageUrn) {
    throw new Error('LinkedIn Image Init returned invalid uploadUrl or image URN');
  }

  // 2. Upload binary file
  const fileBuffer = fs.readFileSync(filePath);
  const uploadRes = await fetchFn(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': filePath.endsWith('.png') ? 'image/png' : 'image/jpeg'
    },
    body: fileBuffer
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`LinkedIn Image Upload Binary Failed (${uploadRes.status}): ${redactSecret(errText)}`);
  }

  return imageUrn;
}

/**
 * Publishes a post to LinkedIn using versioned Posts API.
 *
 * @param {object} postData - The parsed post object
 * @param {object} rendered - Rendered result containing { linkedin: { text, article } }
 * @param {object} env - { authorUrn, accessToken, version }
 * @param {object} options - { customFetch, uploadImageFn }
 * @returns {Promise<object>} - { success: true, remoteId: 'urn:li:share:<id>' }
 */
export async function publishToLinkedIn(postData, rendered, { authorUrn, accessToken, version }, { customFetch = fetch, uploadImageFn = uploadLinkedInImage } = {}) {
  const fetchFn = customFetch;
  if (!rendered.linkedin) {
    throw new Error('LinkedIn is not enabled or rendered for this post');
  }

  const author = authorUrn.startsWith('urn:li:') ? authorUrn : `urn:li:person:${authorUrn}`;
  const li = rendered.linkedin;

  let thumbnailUrn = null;
  if (li.article && li.article.thumbnail) {
    // Perform thumbnail upload
    thumbnailUrn = await uploadImageFn({
      authorUrn: author,
      accessToken,
      version,
      filePath: li.article.thumbnail,
      customFetch: fetchFn
    });
  }

  // Build versioned Posts API payload
  const payload = {
    author,
    commentary: li.text,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED'
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false
  };

  if (li.article) {
    payload.content = {
      article: {
        source: li.article.url,
        title: li.article.title,
        description: li.article.description
      }
    };
    if (thumbnailUrn) {
      payload.content.article.thumbnail = thumbnailUrn;
    }
  }

  const postUrl = 'https://api.linkedin.com/rest/posts';
  const postRes = await fetchFn(postUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': version,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!postRes.ok) {
    const errText = await postRes.text();
    const status = postRes.status;
    let errCode = 'LINKEDIN_PUBLISH_FAILED';

    if (status === 401) errCode = 'LINKEDIN_AUTH_ERROR';
    else if (status === 403) errCode = 'LINKEDIN_PERMISSION_ERROR';
    else if (status === 429) errCode = 'LINKEDIN_RATE_LIMIT';

    const err = new Error(`LinkedIn Post Creation Failed (${status}): ${redactSecret(errText)}`);
    err.code = errCode;
    err.status = status;
    throw err;
  }

  // LinkedIn versioned Posts API returns URN in x-restli-id response header!
  const remoteId = postRes.headers.get('x-restli-id') || postRes.headers.get('X-Restli-Id') || 'unknown-urn';

  return {
    success: true,
    remoteId
  };
}
