import fs from 'node:fs';
import path from 'node:path';
import { injectUTM } from './urls.mjs';
import { loadSocialPolicy } from './editorial.mjs';

const ARTICLE_DISPLAY = loadSocialPolicy().linkedin.article_display || 'card';

/**
 * Renders the final post contents for both LinkedIn and Bluesky, injecting UTM parameters.
 *
 * @param {object} data - The parsed post object
 * @returns {object} - The rendered result containing { linkedin, bluesky }
 */
export function renderPost(data) {
  const result = {
    id: data.id,
    linkedin: null,
    bluesky: null
  };

  const utmCampaign = data.campaign?.utm_campaign || 'default_campaign';

  // 1. Render LinkedIn
  if (data.linkedin && data.linkedin.enabled) {
    const li = data.linkedin;
    let text = li.text || '';

    let article = null;
    if (li.article) {
      const injectedUrl = injectUTM(li.article.url, {
        source: 'linkedin',
        medium: 'social',
        campaign: utmCampaign,
        content: data.id
      });
      // 既定は lint/policies/social.json の linkedin.article_display。画像で載せるには図(thumbnail)が要る
      const display = li.article.display || (li.article.thumbnail ? ARTICLE_DISPLAY : 'card');
      article = {
        ...li.article,
        url: injectedUrl,
        display
      };
      // 図を画像として載せるときは、リンクカードが無くなるので記事の URL を本文に置く
      if (display === 'image') {
        text += `\n\n記事: ${injectedUrl}`;
      }
    }

    // Append hashtags at the end of the text
    if (li.hashtags && li.hashtags.length > 0) {
      const tagLine = li.hashtags.map(t => `#${t}`).join(' ');
      text += `\n\n${tagLine}`;
    }

    result.linkedin = {
      actorKind: li.actor || 'member',
      text,
      article
    };
  }

  // 2. Render Bluesky
  if (data.bluesky && data.bluesky.enabled) {
    const bsky = data.bluesky;
    const posts = bsky.posts.map(post => {
      // Find URLs in text and inject UTM
      let renderedText = post.text || '';
      const urlRe = /(https?:\/\/[^\s]+)/g;
      renderedText = renderedText.replace(urlRe, (urlStr) => {
        try {
          return injectUTM(urlStr, {
            source: 'bluesky',
            medium: 'social',
            campaign: utmCampaign,
            content: data.id
          });
        } catch {
          // If parsing fails, fall back to raw URL
          return urlStr;
        }
      });

      let external = null;
      if (post.external) {
        const injectedUrl = injectUTM(post.external.url, {
          source: 'bluesky',
          medium: 'social',
          campaign: utmCampaign,
          content: data.id
        });
        external = {
          ...post.external,
          url: injectedUrl
        };
      }

      return {
        text: renderedText,
        external,
        images: post.images || []
      };
    });

    result.bluesky = {
      langs: bsky.langs,
      posts
    };
  }

  return result;
}

/**
 * Writes redacted Markdown preview files to a directory.
 *
 * @param {object} rendered - Rendered result from renderPost()
 * @param {object} rawData - Original raw post data
 * @param {string} outputDir - Path to write the preview file
 */
export function writeRedactedPreview(rendered, rawData, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const lines = [];
  lines.push(`# SNS 配信プレビュー (ID: ${rendered.id})`);
  lines.push('');
  lines.push(`- **ステータス:** \`${rawData.status}\``);
  lines.push(`- **配信予定日時:** \`${rawData.campaign?.publish_after}\``);
  lines.push(`- **キャンペーン名:** \`${rawData.campaign?.utm_campaign}\``);
  lines.push(`- **主な読者:** \`${rawData.audience?.primary}\``);
  lines.push('');

  if (rendered.linkedin) {
    lines.push('## 🟦 LinkedIn');
    lines.push('');
    lines.push(`- **投稿主:** \`[REDACTED_LINKEDIN_AUTHOR_URN]\` (${rendered.linkedin.actorKind})`);
    lines.push('');
    lines.push('### 投稿本文');
    lines.push('```text');
    lines.push(rendered.linkedin.text);
    lines.push('```');
    lines.push('');
    if (rendered.linkedin.article) {
      lines.push('### 共有カード');
      lines.push(`- **タイトル:** ${rendered.linkedin.article.title}`);
      lines.push(`- **説明:** ${rendered.linkedin.article.description}`);
      lines.push(`- **URL:** [${rendered.linkedin.article.url}](${rendered.linkedin.article.url})`);
      lines.push(`- **表示:** ${rendered.linkedin.article.display === 'image' ? '図を画像として載せる(URL は本文の末尾)' : 'リンクカード'}`);
      if (rendered.linkedin.article.thumbnail) {
        lines.push(`- **サムネイル:** \`${rendered.linkedin.article.thumbnail}\` (Alt: ${rendered.linkedin.article.alt})`);
      }
    }
    lines.push('');
  }

  if (rendered.bluesky) {
    lines.push('## 🦋 Bluesky');
    lines.push('');
    lines.push(`- **言語設定:** \`${rendered.bluesky.langs.join(', ')}\``);
    lines.push('');
    rendered.bluesky.posts.forEach((post, idx) => {
      lines.push(`### 投稿 ${idx + 1} / ${rendered.bluesky.posts.length}`);
      lines.push('```text');
      lines.push(post.text);
      lines.push('```');
      lines.push('');
      if (post.external) {
        lines.push('#### 外部共有リンクカード');
        lines.push(`- **タイトル:** ${post.external.title}`);
        lines.push(`- **説明:** ${post.external.description}`);
        lines.push(`- **URL:** [${post.external.url}](${post.external.url})`);
        if (post.external.thumbnail) {
          lines.push(`- **サムネイル:** \`${post.external.thumbnail}\``);
        }
        lines.push('');
      }
      if (post.images && post.images.length > 0) {
        lines.push('#### 添付画像');
        post.images.forEach((img, imgIdx) => {
          lines.push(`- **画像 ${imgIdx + 1}:** \`${img.path}\` (Alt: ${img.alt})`);
        });
        lines.push('');
      }
    });
  }

  const outputFilePath = path.join(outputDir, `${rendered.id}-preview.md`);
  fs.writeFileSync(outputFilePath, lines.join('\n'), 'utf8');
}
