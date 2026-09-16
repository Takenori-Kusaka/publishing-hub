import fs from 'node:fs';
import { BskyAgent, RichText } from '@atproto/api';

/**
 * Custom error type to represent partial thread failures in Bluesky publishing.
 */
export class BlueskyPartialThreadError extends Error {
  constructor(message, successfulPosts) {
    super(message);
    this.name = 'BlueskyPartialThreadError';
    this.successfulPosts = successfulPosts; // Array of { uri, cid, idx }
  }
}

/**
 * Redacts potential sensitive data from Bluesky error messages or JWT tokens.
 *
 * @param {string} msg
 * @returns {string}
 */
export function redactBlueskySecret(msg) {
  if (!msg) return '';
  return msg
    .replace(/\b[a-z]{4}-[a-z]{4}-[a-z]{4}-[a-z]{4}\b/g, '[REDACTED_BSKY_PASSWORD]')
    .replace(/\beyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*\b/g, '[REDACTED_JWT]');
}

/**
 * Publishes a single or threaded post to Bluesky.
 *
 * @param {object} postData - Original post YAML data
 * @param {object} rendered - Rendered result containing { bluesky: { langs, posts: [] } }
 * @param {object} credentials - { identifier, password, service }
 * @param {object} options - { agentInstance, onPostSuccess }
 * @returns {Promise<object>} - { success: true, remoteIds: [ { uri, cid } ] }
 */
export async function publishToBluesky(
  postData,
  rendered,
  { identifier, password, service = 'https://bsky.social' },
  { agentInstance = null, onPostSuccess = null } = {}
) {
  if (!rendered.bluesky) {
    throw new Error('Bluesky is not enabled or rendered for this post');
  }

  // Support Agent injection for robust mocking
  const agent = agentInstance || new BskyAgent({ service });

  try {
    await agent.login({ identifier, password });
  } catch (err) {
    throw new Error(`Bluesky Login Failed: ${redactBlueskySecret(err.message)}`);
  }

  const bsky = rendered.bluesky;
  const successfulPosts = [];

  let rootRecord = null;
  let parentRecord = null;

  for (let i = 0; i < bsky.posts.length; i++) {
    const post = bsky.posts[i];

    try {
      // Build RichText and automatically detect facets (links, mentions, tags)
      const rt = new RichText({ text: post.text });
      await rt.detectFacets(agent);

      // embed は「無いなら鍵ごと送らない」。null を送ると Bluesky が
      // 「Expected an object which includes the "$type" property value type (got null) at $.record.embed」
      // でレコードを拒否する(2026-09-16 に本番で踏んだ)。
      let embed;

      // 1. Resolve External Card Embed
      if (post.external) {
        let thumbBlob = undefined;
        if (post.external.thumbnail && fs.existsSync(post.external.thumbnail)) {
          const fileBuffer = fs.readFileSync(post.external.thumbnail);
          const mime = post.external.thumbnail.endsWith('.png') ? 'image/png' : 'image/jpeg';
          const uploadRes = await agent.uploadBlob(fileBuffer, { encoding: mime });
          thumbBlob = uploadRes.data.blob;
        }

        const external = {
          uri: post.external.url,
          title: post.external.title,
          description: post.external.description
        };
        // thumb も同じ理由で、値が無いなら鍵ごと送らない
        if (thumbBlob) external.thumb = thumbBlob;
        embed = { $type: 'app.bsky.embed.external', external };
      }

      // 2. Resolve Multi-Image Embed
      if (post.images && post.images.length > 0) {
        const imageEmbeds = [];
        for (const img of post.images) {
          if (fs.existsSync(img.path)) {
            const fileBuffer = fs.readFileSync(img.path);
            const mime = img.path.endsWith('.png') ? 'image/png' : 'image/jpeg';
            const uploadRes = await agent.uploadBlob(fileBuffer, { encoding: mime });
            imageEmbeds.push({
              image: uploadRes.data.blob,
              alt: img.alt
            });
          }
        }

        embed = {
          $type: 'app.bsky.embed.images',
          images: imageEmbeds
        };
      }

      // 3. Thread reply payload
      const reply = rootRecord && parentRecord ? { root: rootRecord, parent: parentRecord } : undefined;

      // Publish the post
      const record = {
        text: rt.text,
        facets: rt.facets,
        langs: bsky.langs,
        createdAt: new Date().toISOString()
      };
      if (embed) record.embed = embed;
      if (reply) record.reply = reply;
      const createRes = await agent.post(record);

      const currentRecord = {
        uri: createRes.uri,
        cid: createRes.cid
      };

      successfulPosts.push({ ...currentRecord, idx: i });

      if (onPostSuccess) {
        await onPostSuccess(currentRecord, i);
      }

      // Track records for thread links
      if (!rootRecord) {
        rootRecord = currentRecord;
      }
      parentRecord = currentRecord;

    } catch (err) {
      const errMessage = `Bluesky thread failed at index ${i}: ${redactBlueskySecret(err.message)}`;
      if (successfulPosts.length > 0) {
        throw new BlueskyPartialThreadError(errMessage, successfulPosts);
      } else {
        throw new Error(errMessage);
      }
    }
  }

  return {
    success: true,
    remoteIds: successfulPosts.map(p => ({ uri: p.uri, cid: p.cid }))
  };
}
