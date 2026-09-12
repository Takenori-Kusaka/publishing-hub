import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * Strict quality criteria for Qiita technical articles.
 */
function checkQiitaArticleQuality(filePath) {
  const relPath = path.relative(ROOT, filePath);
  const fileName = path.basename(filePath);

  // Skip checking historical synced items (exactly 20 hex chars) to prevent breaking builds on legacy posts
  const isLegacySync = /^[0-9a-f]{20}\.md$/i.test(fileName);
  if (isLegacySync) {
    return { filePath: relPath, valid: true, errors: [] };
  }

  const rawText = fs.readFileSync(filePath, 'utf8');

  // Strip front matter
  const bodyText = rawText.replace(/^---[\s\S]*?---/u, '').trim();
  const charCount = bodyText.length;

  const errors = [];

  // Q1: Minimum character count (must be at least 1500 characters for deep explanations)
  if (charCount < 1500) {
    errors.push(
      `[Q1] 文字数不足: 本文が${charCount}文字です。技術記事としての品質を担保するため、技術的背景、選定理由、設計詳細を記述し「1500文字以上」に達するように拡張してください。`
    );
  }

  // Q2: Technical architecture / selection rationale headings requirement
  const hasArchitectureHeading = /##\s+.*?(設計|構成|選定|アーキテクチャ|背景)/i.test(bodyText);
  if (!hasArchitectureHeading) {
    errors.push(
      `[Q2] 構成セクション不足: 技術的な設計・選定理由、またはシステムアーキテクチャに関する見出し（例: '## 技術選定理由', '## システムアーキテクチャ', '## 設計'）を含めてください。`
    );
  }

  // Q3: GitHub repository link requirement
  const hasGitHubLink = /github\.com\/[A-Za-z0-9-_]+\/[A-Za-z0-9-_]+/i.test(bodyText);
  if (!hasGitHubLink) {
    errors.push(
      `[Q3] 情報源不足: 成果物のオープン性・透明性を担保するため、GitHub リポジトリ（github.com/...）への具体的なリンクを本文に掲載してください。`
    );
  }

  // Q4: Official technology documentation links requirement (at least 2 distinct external spec/doc links)
  const officialTechLinks = [
    /playwright\.dev/i,
    /api\.linkedin\.com/i,
    /atproto\.com/i,
    /qiita\.com/i,
    /zenn\.dev/i,
    /npmjs\.com/i,
    /github\.com\/increments\/qiita-cli/i,
    /github\.com\/google\/gemini-cli/i
  ];
  const matchedLinks = officialTechLinks.filter(re => re.test(bodyText));
  if (matchedLinks.length < 2) {
    errors.push(
      `[Q4] 公式リンク不足: 採用技術の信頼性を裏付けるため、採用ライブラリや技術規格の公式ドキュメント/仕様書（例: Playwright, LinkedIn API, AT Protocol, Qiita CLI などの公式リンク・ドキュメント）を「少なくとも2件以上」掲載してください。`
    );
  }

  // Q5: Code block density (must have at least 3 code blocks)
  const codeBlockCount = (bodyText.match(/```[A-Za-z0-9-_]*\r?\n[\s\S]*?```/g) || []).length;
  if (codeBlockCount < 3) {
    errors.push(
      `[Q5] 実装詳細不足: エンジニア向けの技術的な再現性を担保するため、具体的なコードブロック（\`\`\`js などの実装断片）を「3箇所以上」含めてください（現在: ${codeBlockCount}箇所）。`
    );
  }

  return {
    filePath: relPath,
    valid: errors.length === 0,
    errors
  };
}

function main() {
  const qiitaPublicDir = path.join(ROOT, 'platforms/qiita/public');
  if (!fs.existsSync(qiitaPublicDir)) {
    console.log('💡 Qiita public directory does not exist yet. Skipping check.');
    process.exit(0);
  }

  const files = fs.readdirSync(qiitaPublicDir)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(qiitaPublicDir, f));

  let failed = false;
  let checkedCount = 0;

  for (const file of files) {
    checkedCount++;
    const result = checkQiitaArticleQuality(file);
    if (!result.valid) {
      failed = true;
      console.error(`❌ Qiita Quality Verification Failed: ${result.filePath}`);
      result.errors.forEach(err => console.error(`   - ${err}`));
    } else {
      console.log(`✅ Qiita Quality Passed: ${result.filePath}`);
    }
  }

  if (failed) {
    process.exit(1);
  } else {
    console.log(`🏁 Checked ${checkedCount} Qiita articles. All quality gates passed!`);
    process.exit(0);
  }
}

main();
