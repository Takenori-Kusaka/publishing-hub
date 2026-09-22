// note 用の配信パッケージ(HTML / WXR / Markdown / manifest)をビルドする。
//
//   node scripts/build-note.mjs <id>
//
// 入力は platforms/note/public/<id>.md(note 向けに書き直した原稿)です。
// 正本(Zenn)を自動変換して note に流すことはしません。note の読者は生コードや
// 図の記法ではなく、意思決定の物語を求めているためです(docs/publishing-model.md)。
// 原稿は scripts/lint/check-note.mjs の検査に通らなければビルドしません。
//
// 出力(platforms/note/exports/<id>/、git 管理外):
//   article.html   note のエディタへ流し込む HTML
//   import.wxr     WXR(WordPress eXtended RSS)形式のインポートファイル
//   article.md     原稿本文(frontmatter なし)
//   article.txt    プレーンテキスト
//   manifest.json  status / source / canonical_url / 検査結果 / 警告(手動作業が必要なもの)

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateNoteFile } from './lint/check-note.mjs';
import { isPublishable } from './note-ledger.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * Zenn 固有の記法を note 向けに落とす(後方互換のために残す。note 原稿は本来これらを含まない)。
 *
 * @param {string} mdText
 * @returns {{cleanMd: string, htmlText: string, warnings: Array<{code: string, message: string}>}}
 */
export function convertZennToNote(mdText) {
  const warnings = [];
  let cleanMd = mdText;

  if (mdText.includes('```mermaid')) {
    warnings.push({
      code: 'MERMAID_DIAGRAM_SKIPPED',
      message: 'Mermaid diagram detected and skipped. Note does not render Mermaid natively; please upload as an image.'
    });
    cleanMd = cleanMd.replace(/```mermaid[\s\S]*?```/g, '\n*(⚠️ Mermaidによる図はスキップされました。画像として追加してください。)*\n');
  }

  cleanMd = cleanMd.replace(/:::message\r?\n([\s\S]*?):::/g, '> 💡 **補足メッセージ:**\n> $1');

  if (cleanMd.match(/\[\^\d+\]/)) {
    warnings.push({
      code: 'FOOTNOTES_DETECTED',
      message: 'Footnotes detected. Note editor does not support footnotes natively; converting them to standard inline text.'
    });
    cleanMd = cleanMd.replace(/\[\^(\d+)\]:\s*(.*?)\r?\n/g, '\n*(注$1: $2)*\n');
  }

  const images = [...cleanMd.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]);
  if (images.length) {
    warnings.push({
      code: 'IMAGES_REQUIRE_UPLOAD',
      message: `Images must be uploaded manually in the note editor: ${images.join(', ')}`
    });
  }

  return { cleanMd, htmlText: markdownToNoteHtml(cleanMd), warnings };
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s) {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => `<a href="${url}">${text}</a>`);
}

/**
 * note のエディタが受け付ける最小限の HTML へ変換する。
 * 見出し(h2/h3)・段落・箇条書き・引用・強調・リンクだけを扱う。
 */
export function markdownToNoteHtml(md) {
  const out = [];
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let para = [];
  let list = null; // { ordered, items }
  let quote = [];
  const flush = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`);
    if (list) out.push(`<${list.ordered ? 'ol' : 'ul'}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.ordered ? 'ol' : 'ul'}>`);
    if (quote.length) out.push(`<blockquote>${quote.map(inline).join('<br>')}</blockquote>`);
    para = [];
    list = null;
    quote = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const h = /^(#{1,6})\s+(.+?)\s*#*$/.exec(line);
    if (h) {
      flush();
      const level = Math.min(Math.max(h[1].length, 2), 3);
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      flush();
      out.push('<hr>');
      continue;
    }
    const li = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/.exec(line);
    if (li) {
      if (para.length || quote.length) flush();
      const ordered = Boolean(li[2]);
      if (!list || list.ordered !== ordered) {
        if (list) flush();
        list = { ordered, items: [] };
      }
      list.items.push(li[3]);
      continue;
    }
    const q = /^\s*>\s?(.*)$/.exec(line);
    if (q) {
      if (para.length || list) flush();
      quote.push(q[1]);
      continue;
    }
    if (list || quote.length) flush();
    para.push(line.trim());
  }
  flush();
  return out.join('\n') + '\n';
}

/**
 * WXR(WordPress eXtended RSS)を組み立てる。post_id は slug から決定的に導く(ビルドの再現性)。
 *
 * @param {object} params - { title, slug, content, tags, dateStr }
 * @returns {string}
 */
export function buildWxrXML({ title, slug, content, tags = [], dateStr }) {
  const date = new Date(dateStr);
  const gmtDate = date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  const localDate = String(dateStr).replace('T', ' ').replace(/[+-]\d+:\d+$/, '').replace(/Z$/, '');
  const postId = parseInt(crypto.createHash('sha1').update(slug).digest('hex').slice(0, 6), 16);
  const tagXml = tags.map((tag) => `      <category domain="post_tag" nicename="${encodeURIComponent(tag)}"><![CDATA[${tag}]]></category>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"
     xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:wfw="http://wellformedweb.org/CommentAPI/"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:wp="http://wordpress.org/export/1.2/"
>
  <channel>
    <title>publishing-hub export</title>
    <link>https://github.com/Takenori-Kusaka/publishing-hub</link>
    <description>WXR Export for note</description>
    <pubDate>${date.toUTCString()}</pubDate>
    <language>ja</language>
    <wp:wxr_version>1.2</wp:wxr_version>
    <item>
      <title>${escapeHtml(title)}</title>
      <link>https://github.com/Takenori-Kusaka/publishing-hub/${slug}</link>
      <pubDate>${date.toUTCString()}</pubDate>
      <dc:creator><![CDATA[Takenori-Kusaka]]></dc:creator>
      <guid isPermaLink="false">guid-${slug}</guid>
      <description></description>
      <content:encoded><![CDATA[${content}]]></content:encoded>
      <excerpt:encoded><![CDATA[]]></excerpt:encoded>
      <wp:post_id>${postId}</wp:post_id>
      <wp:post_date><![CDATA[${localDate}]]></wp:post_date>
      <wp:post_date_gmt><![CDATA[${gmtDate}]]></wp:post_date_gmt>
      <wp:comment_status><![CDATA[open]]></wp:comment_status>
      <wp:ping_status><![CDATA[open]]></wp:ping_status>
      <wp:post_name><![CDATA[${slug}]]></wp:post_name>
      <wp:status><![CDATA[publish]]></wp:status>
      <wp:post_parent>0</wp:post_parent>
      <wp:menu_order>0</wp:menu_order>
      <wp:post_type><![CDATA[post]]></wp:post_type>
      <wp:post_password><![CDATA[]]></wp:post_password>
      <wp:is_sticky>0</wp:is_sticky>
${tagXml}
    </item>
  </channel>
</rss>`;
}

/** frontmatter を分離する(YAML は check-note が検証済みなので簡易パースで十分) */
function splitFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!m) return { fm: {}, body: text };
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    let v = kv[2].trim();
    if (/^\[.*\]$/.test(v)) fm[kv[1]] = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    else fm[kv[1]] = v.replace(/^["']|["']$/g, '');
  }
  return { fm, body: text.slice(m[0].length) };
}

export function manuscriptPath(postId) {
  return path.join(ROOT, 'platforms/note/public', `${postId}.md`);
}

/**
 * 原稿を検査し、配信パッケージを書き出す。
 * @returns {{manifest: object, exportDir: string}}
 */
export function buildNotePackage(postId, { now = new Date() } = {}) {
  const srcPath = manuscriptPath(postId);
  if (!fs.existsSync(srcPath)) {
    throw new Error(
      `note の原稿 platforms/note/public/${postId}.md がありません。` +
        'note は正本(Zenn)のコピーではなく、意思決定の物語として書き直した原稿から配信します(platforms/note/public/README.md)。'
    );
  }
  const rel = path.relative(ROOT, srcPath).split(path.sep).join('/');
  const check = validateNoteFile(rel);
  if (!check.ok) {
    const lines = check.errors.map((e) => `   - [${e.code}] ${e.file}${e.line ? ':' + e.line : ''} ${e.message}`);
    throw new Error(`note の原稿が検査に通りません(npm run check:note):\n${lines.join('\n')}`);
  }

  const text = fs.readFileSync(srcPath, 'utf8');
  const { fm, body } = splitFrontmatter(text);
  const { cleanMd, htmlText, warnings } = convertZennToNote(body.trim());
  const dateStr = fm.publish_after || now.toISOString();

  const wxr = buildWxrXML({
    title: fm.title || 'Untitled',
    slug: postId,
    content: htmlText,
    tags: Array.isArray(fm.tags) ? fm.tags : [],
    dateStr
  });

  const exportDir = path.join(ROOT, 'platforms/note/exports', postId);
  fs.mkdirSync(exportDir, { recursive: true });
  fs.writeFileSync(path.join(exportDir, 'import.wxr'), wxr, 'utf8');
  fs.writeFileSync(path.join(exportDir, 'article.md'), cleanMd, 'utf8');
  fs.writeFileSync(path.join(exportDir, 'article.html'), htmlText, 'utf8');
  fs.writeFileSync(path.join(exportDir, 'article.txt'), body.trim(), 'utf8');

  const manifest = {
    post_id: postId,
    title: fm.title,
    status: fm.status || 'draft',
    source: fm.source || null,
    canonical_url: fm.canonical_url || null,
    manuscript: rel,
    date: dateStr,
    built_at: now.toISOString(),
    checks: { errors: check.errors.length, warnings: check.warnings.map((w) => `[${w.code}] ${w.message}`) },
    warnings,
    assets: {
      wxr: `platforms/note/exports/${postId}/import.wxr`,
      md: `platforms/note/exports/${postId}/article.md`,
      html: `platforms/note/exports/${postId}/article.html`,
      txt: `platforms/note/exports/${postId}/article.txt`
    }
  };
  fs.writeFileSync(path.join(exportDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  return { manifest, exportDir };
}

function main() {
  const postId = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!postId) {
    console.error('使い方: node scripts/build-note.mjs <id>   (platforms/note/public/<id>.md をビルド)');
    process.exit(1);
  }
  try {
    const { manifest, exportDir } = buildNotePackage(postId);
    console.log(`🏁 note の配信パッケージを生成しました: ${postId} (status: ${manifest.status})`);
    console.log(`📂 出力先: ${exportDir}`);
    if (manifest.checks.warnings.length) {
      console.warn('⚠️ 原稿の検査で警告があります:');
      manifest.checks.warnings.forEach((w) => console.warn(`   - ${w}`));
    }
    if (manifest.warnings.length) {
      console.warn('⚠️ 手動作業が必要な項目:');
      manifest.warnings.forEach((w) => console.warn(`   - [${w.code}] ${w.message}`));
    }
    if (!isPublishable(manifest.status)) {
      console.log(`ℹ️ status が "${manifest.status}" のため、publish-note は投稿をスキップします`);
    }
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
