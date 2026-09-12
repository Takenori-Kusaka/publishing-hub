import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPostFile } from './load.mjs';
import { countGraphemes } from './graphemes.mjs';
import { renderPost } from './render.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

/**
 * Perform semantic validation on a single loaded social post.
 *
 * @param {object} loaded - The output of loadPostFile(filePath)
 * @returns {object} - { valid, errors: [], warnings: [] }
 */
export function validatePost(loaded) {
  const errors = [];
  const warnings = [];

  // 1. Schema Validation Check
  if (!loaded.valid) {
    loaded.errors.forEach(err => {
      errors.push({
        code: 'SCHEMA_ERROR',
        message: `Schema violation at ${err.path || 'root'}: ${err.message}`
      });
    });
    return { valid: false, errors, warnings };
  }

  const data = loaded.data;
  const filePath = loaded.filePath;
  const fileName = path.basename(filePath);

  // 2. ID and Filename Alignment
  const expectedId = fileName.replace(/\.ya?ml$/, '');
  if (data.id !== expectedId) {
    errors.push({
      code: 'ID_MISMATCH',
      message: `id '${data.id}' does not match filename '${fileName}'`
    });
  }

  // 3. Source Path Traversal and Existence Check
  if (data.source && data.source.path) {
    const srcPath = data.source.path;
    // Block path traversal
    const normalized = path.normalize(srcPath);
    if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
      errors.push({
        code: 'PATH_TRAVERSAL',
        message: `Path traversal attempt detected in source.path: ${srcPath}`
      });
    } else {
      const fullPath = path.join(ROOT, srcPath);
      if (!fs.existsSync(fullPath)) {
        errors.push({
          code: 'SOURCE_NOT_FOUND',
          message: `source.path file does not exist: ${srcPath}`
        });
      }
    }
  }

  // 4. Revision Requirement
  if (data.status === 'ready' && data.source && !data.source.revision) {
    errors.push({
      code: 'MISSING_REVISION',
      message: `source.revision is required when status is 'ready'`
    });
  }

  // 5. Campaign Dates Validation
  if (data.campaign) {
    const pub = new Date(data.campaign.publish_after);
    const exp = new Date(data.campaign.expires_at);
    if (!isNaN(pub.getTime()) && !isNaN(exp.getTime())) {
      if (exp <= pub) {
        errors.push({
          code: 'INVALID_CAMPAIGN_DATES',
          message: `campaign.expires_at must be later than campaign.publish_after`
        });
      }
    }
  }

  // 6. LinkedIn Validations
  if (data.linkedin && data.linkedin.enabled) {
    const li = data.linkedin;
    const textLen = li.text ? li.text.length : 0;

    if (textLen === 0) {
      errors.push({
        code: 'LINKEDIN_EMPTY_TEXT',
        message: 'linkedin.text must not be empty when enabled'
      });
    } else {
      if (textLen > 3000) {
        errors.push({
          code: 'LINKEDIN_TEXT_EXCEEDS_MAX',
          message: `linkedin.text of ${textLen} characters exceeds the 3000 character limit`
        });
      } else if (textLen >= 2400) {
        warnings.push({
          code: 'LINKEDIN_TEXT_WARNING',
          message: `linkedin.text of ${textLen} characters is close to the 3000 limit`
        });
      }
    }

    // Article thumbnail check
    if (li.article && li.article.thumbnail) {
      const thumbPath = path.join(ROOT, li.article.thumbnail);
      if (!fs.existsSync(thumbPath)) {
        errors.push({
          code: 'LINKEDIN_THUMBNAIL_NOT_FOUND',
          message: `linkedin.article.thumbnail file does not exist: ${li.article.thumbnail}`
        });
      }
    }

    // Hashtags check
    if (li.hashtags) {
      const seen = new Set();
      if (li.hashtags.length > 3) {
        errors.push({
          code: 'LINKEDIN_HASHTAGS_EXCEEDS_MAX',
          message: `linkedin.hashtags cannot have more than 3 tags`
        });
      }
      li.hashtags.forEach(tag => {
        if (tag.startsWith('#')) {
          errors.push({
            code: 'LINKEDIN_INVALID_HASHTAG',
            message: `linkedin.hashtag '${tag}' must not contain '#' character`
          });
        }
        if (seen.has(tag.toLowerCase())) {
          errors.push({
            code: 'LINKEDIN_DUPLICATE_HASHTAG',
            message: `linkedin.hashtag '${tag}' is duplicated`
          });
        }
        seen.add(tag.toLowerCase());
      });
    }
  }

  // 7. Bluesky Validations
  if (data.bluesky && data.bluesky.enabled) {
    const bsky = data.bluesky;

    if (!bsky.posts || bsky.posts.length === 0) {
      errors.push({
        code: 'BLUESKY_EMPTY_POSTS',
        message: 'bluesky.posts must contain at least 1 post when enabled'
      });
    } else {
      if (bsky.posts.length > 5) {
        errors.push({
          code: 'BLUESKY_POSTS_EXCEEDS_MAX',
          message: `bluesky.posts cannot exceed 5 posts (max thread depth)`
        });
      }

      let rendered = null;
      try {
        rendered = renderPost(data);
      } catch (err) {
        // ignore
      }

      bsky.posts.forEach((post, pIdx) => {
        const renderedText = (rendered && rendered.bluesky?.posts[pIdx]?.text) || post.text;
        const graphemes = countGraphemes(renderedText);
        if (graphemes === 0) {
          errors.push({
            code: 'BLUESKY_EMPTY_POST_TEXT',
            message: `bluesky.posts[${pIdx}].text must not be empty`
          });
        } else if (graphemes > 300) {
          errors.push({
            code: 'BLUESKY_TEXT_EXCEEDS_MAX',
            message: `bluesky.posts[${pIdx}].text of ${graphemes} graphemes exceeds the 300 grapheme limit`
          });
        } else if (graphemes >= 260) {
          warnings.push({
            code: 'BLUESKY_TEXT_WARNING',
            message: `bluesky.posts[${pIdx}].text of ${graphemes} graphemes is close to the 300 limit`
          });
        }

        // External thumbnail check
        if (post.external && post.external.thumbnail) {
          const thumbPath = path.join(ROOT, post.external.thumbnail);
          if (!fs.existsSync(thumbPath)) {
            errors.push({
              code: 'BLUESKY_EXTERNAL_THUMBNAIL_NOT_FOUND',
              message: `bluesky.posts[${pIdx}].external.thumbnail file does not exist: ${post.external.thumbnail}`
            });
          }
        }

        // Images check
        if (post.images) {
          if (post.images.length > 4) {
            errors.push({
              code: 'BLUESKY_IMAGES_EXCEEDS_MAX',
              message: `bluesky.posts[${pIdx}].images cannot exceed 4 images`
            });
          }
          post.images.forEach((img, imgIdx) => {
            const imgPath = path.join(ROOT, img.path);
            if (!fs.existsSync(imgPath)) {
              errors.push({
                code: 'BLUESKY_IMAGE_NOT_FOUND',
                message: `bluesky.posts[${pIdx}].images[${imgIdx}].path file does not exist: ${img.path}`
              });
            }
            const imgGraphemes = countGraphemes(img.alt);
            if (imgGraphemes === 0) {
              errors.push({
                code: 'BLUESKY_IMAGE_EMPTY_ALT',
                message: `bluesky.posts[${pIdx}].images[${imgIdx}].alt must not be empty`
              });
            } else if (imgGraphemes > 1000) {
              errors.push({
                code: 'BLUESKY_IMAGE_ALT_EXCEEDS_MAX',
                message: `bluesky.posts[${pIdx}].images[${imgIdx}].alt of ${imgGraphemes} graphemes exceeds the 1000 grapheme limit`
              });
            }
          });
        }

        // Block concurrent external and images
        if (post.external && post.images && post.images.length > 0) {
          errors.push({
            code: 'BLUESKY_CONCURRENT_EMBED',
            message: `bluesky.posts[${pIdx}] cannot specify both 'external' and 'images'`
          });
        }
      });
    }
  }

  // 8. Placeholders and Credentials Protection
  function checkStringValues(obj, fn) {
    if (typeof obj === 'string') {
      fn(obj);
    } else if (Array.isArray(obj)) {
      obj.forEach(item => checkStringValues(item, fn));
    } else if (obj && typeof obj === 'object') {
      Object.values(obj).forEach(val => checkStringValues(val, fn));
    }
  }

  checkStringValues(data, (str) => {
    // Check placeholders
    const placeholderRe = /\b(TODO|TBD|FIXME)\b|\{\{|\}\}/g;
    let pm;
    if ((pm = placeholderRe.exec(str))) {
      errors.push({
        code: 'PLACEHOLDER_FOUND',
        message: `Unresolved placeholder or template syntax '${pm[0]}' found in post data`
      });
    }

    // Check for plural/corporate pronouns (strict single-person tone enforcement)
    const forbiddenPronouns = ['私たち', '我々', '弊社', '当社', '当グループ', '当チーム', '我社'];
    forbiddenPronouns.forEach(word => {
      if (str.includes(word)) {
        errors.push({
          code: 'FORBIDDEN_PLURAL_PRONOUN',
          message: `Security/Tone Error: Potential plural/corporate pronoun '${word}' found! This repository is for personal publication; please use single-person terms like '私', '著者', '当方'.`
        });
      }
    });

    // Credential scanning rules
    const credentialPatterns = [
      { name: 'LinkedIn Access Token', r: /\bAQ[A-Za-z0-9-_]{40,}\b/ },
      { name: 'Application Password', r: /\b[a-z]{4}-[a-z]{4}-[a-z]{4}-[a-z]{4}\b/ }, // bsky password format xxxx-xxxx-xxxx-xxxx
      { name: 'Generic Token', r: /\beyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*\b/ } // JWT prefix eyJ
    ];

    credentialPatterns.forEach(pattern => {
      const cm = pattern.r.exec(str);
      if (cm) {
        errors.push({
          code: 'CREDENTIAL_LEAK_PREVENTION',
          message: `Security Warning: Potential ${pattern.name} detected in post content!`
        });
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
