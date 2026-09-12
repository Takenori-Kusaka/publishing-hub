import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * Strips or converts Zenn-specific Markdown extensions into standard HTML/Markdown for note.
 *
 * @param {string} mdText
 * @returns {object} - { cleanMd, htmlText, warnings: [] }
 */
export function convertZennToNote(mdText) {
  const warnings = [];
  let cleanMd = mdText;

  // 1. Detect and warn on Mermaid diagrams
  if (mdText.includes('```mermaid')) {
    warnings.push({
      code: 'MERMAID_DIAGRAM_SKIPPED',
      message: 'Mermaid diagram detected and skipped. Note does not render Mermaid natively; please upload as an image.'
    });
    cleanMd = cleanMd.replace(/```mermaid[\s\S]*?```/g, '\n*(⚠️ Mermaidによる図はスキップされました。画像として追加してください。)*\n');
  }

  // 2. Convert Zenn Message Containers :::message ... ::: to Blockquotes
  cleanMd = cleanMd.replace(/:::message\r?\n([\s\S]*?):::/g, '> 💡 **補足メッセージ:**\n> $1');

  // 3. Detect and warn on Zenn Footnotes [^1]
  if (cleanMd.match(/\[\^\d+\]/)) {
    warnings.push({
      code: 'FOOTNOTES_DETECTED',
      message: 'Footnotes detected. Note editor does not support footnotes natively; converting them to standard inline text.'
    });
    // Strip footnote definitions and place inline or warn
    cleanMd = cleanMd.replace(/\[\^(\d+)\]:\s*(.*?)\r?\n/g, '\n*(注$1: $2)*\n');
  }

  // Convert cleanMd into standard HTML (simple replacements for basic formatting)
  let htmlText = cleanMd
    // Headers
    .replace(/^##\s+(.*?)\r?\n/gm, '<h2>$1</h2>\n')
    .replace(/^###\s+(.*?)\r?\n/gm, '<h3>$1</h3>\n')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Lists
    .replace(/^\s*-\s+(.*?)\r?\n/gm, '<li>$1</li>\n')
    // Links
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
    // Blockquotes
    .replace(/^>\s+(.*?)\r?\n/gm, '<blockquote>$1</blockquote>\n');

  return { cleanMd, htmlText, warnings };
}

/**
 * Builds a standard WXR (WordPress eXtended RSS) XML file for note.
 *
 * @param {object} params - { title, slug, content, tags, dateStr }
 * @returns {string} - WXR XML String
 */
export function buildWxrXML({ title, slug, content, tags = [], dateStr }) {
  const gmtDate = new Date(dateStr).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  const localDate = dateStr.replace('T', ' ').replace(/\+\d+:\d+$/, '');

  const tagXml = tags.map(tag => `      <category domain="post_tag" nicename="${encodeURIComponent(tag)}"><![CDATA[${tag}]]></category>`).join('\n');

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
    <pubDate>${new Date().toUTCString()}</pubDate>
    <language>ja</language>
    <wp:wxr_version>1.2</wp:wxr_version>
    <item>
      <title>${title}</title>
      <link>https://github.com/Takenori-Kusaka/publishing-hub/${slug}</link>
      <pubDate>${new Date(dateStr).toUTCString()}</pubDate>
      <dc:creator><![CDATA[Takenori-Kusaka]]></dc:creator>
      <guid isPermaLink="false">guid-${slug}</guid>
      <description></description>
      <content:encoded><![CDATA[${content}]]></content:encoded>
      <excerpt:encoded><![CDATA[]]></excerpt:encoded>
      <wp:post_id>${Math.floor(Math.random() * 1000000)}</wp:post_id>
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

function main() {
  const args = process.argv.slice(2);
  const postId = args[0] || 'multi-platform-publishing-architecture';

  const yamlPath = path.join(ROOT, 'social/posts', `${postId}.yaml`);
  if (!fs.existsSync(yamlPath)) {
    console.error(`❌ Error: Post metadata not found at ${yamlPath}`);
    process.exit(1);
  }

  const data = YAML.parse(fs.readFileSync(yamlPath, 'utf8'));
  if (!data.source || !data.source.path) {
    console.error('❌ Error: This post does not have an associated source file.');
    process.exit(1);
  }

  const srcPath = path.join(ROOT, data.source.path);
  if (!fs.existsSync(srcPath)) {
    console.error(`❌ Error: Source Markdown file not found at ${srcPath}`);
    process.exit(1);
  }

  const mdText = fs.readFileSync(srcPath, 'utf8');

  // Strip front matter from Zenn article
  const cleanMdText = mdText.replace(/^---[\s\S]*?---/u, '').trim();

  // Convert Zenn Markdown syntax into Note format
  const { cleanMd, htmlText, warnings } = convertZennToNote(cleanMdText);

  // Build WXR
  const wxr = buildWxrXML({
    title: data.source.title || 'Untitled',
    slug: data.id,
    content: htmlText,
    tags: data.linkedin?.hashtags || [],
    dateStr: data.campaign?.publish_after || new Date().toISOString()
  });

  // Write outputs
  const exportDir = path.join(ROOT, 'platforms/note/exports', data.id);
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  fs.writeFileSync(path.join(exportDir, 'import.wxr'), wxr, 'utf8');
  fs.writeFileSync(path.join(exportDir, 'article.md'), cleanMd, 'utf8');
  fs.writeFileSync(path.join(exportDir, 'article.html'), htmlText, 'utf8');
  fs.writeFileSync(path.join(exportDir, 'article.txt'), cleanMdText, 'utf8');

  const manifest = {
    post_id: data.id,
    title: data.source.title,
    date: data.campaign?.publish_after,
    warnings,
    assets: {
      wxr: `platforms/note/exports/${data.id}/import.wxr`,
      md: `platforms/note/exports/${data.id}/article.md`,
      html: `platforms/note/exports/${data.id}/article.html`,
      txt: `platforms/note/exports/${data.id}/article.txt`
    }
  };

  fs.writeFileSync(path.join(exportDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`🏁 Successfully generated note publishing package for: ${data.id}`);
  console.log(`📂 Outputs saved under: ${exportDir}`);
  if (warnings.length > 0) {
    console.warn('⚠️ Warnings during translation to note:');
    warnings.forEach(w => console.warn(`   - [${w.code}] ${w.message}`));
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
