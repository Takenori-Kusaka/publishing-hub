import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function main() {
  const args = process.argv.slice(2);
  const postId = args[0] || 'multi-platform-publishing-architecture';

  const yamlPath = path.join(ROOT, 'social/posts', `${postId}.yaml`);
  if (!fs.existsSync(yamlPath)) {
    console.error(`❌ Error: Post metadata not found at ${yamlPath}`);
    process.exit(1);
  }

  const data = YAML.parse(fs.readFileSync(yamlPath, 'utf8'));
  const title = data.source?.title || 'Untitled Article';

  const exportDir = path.join(ROOT, 'platforms/note/exports', postId);
  const htmlPath = path.join(exportDir, 'article.html');

  if (!fs.existsSync(htmlPath)) {
    console.error(`❌ Error: Note HTML asset not found at ${htmlPath}. Run 'scripts/build-note.mjs' first.`);
    process.exit(1);
  }

  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // Load storage state from B64 env
  const storageStateB64 = process.env.NOTE_STORAGE_STATE_B64;
  if (!storageStateB64) {
    console.error('❌ Error: NOTE_STORAGE_STATE_B64 environment variable is not set!');
    console.error('If running locally, please set NOTE_STORAGE_STATE_B64 in your environment.');
    process.exit(1);
  }

  const storageStatePath = path.join(ROOT, '.tmp-note-storage-state.json');
  fs.writeFileSync(
    storageStatePath,
    Buffer.from(storageStateB64, 'base64').toString('utf8'),
    { mode: 0o600 }
  );

  const screenshotDir = path.join(ROOT, 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  console.log('🚀 Launching headless Chromium...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: storageStatePath });
  const page = await context.newPage();

  try {
    console.log('🌐 Navigating to note editor (https://editor.note.com/new)...');
    const response = await page.goto('https://editor.note.com/new', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log(`📡 Response HTTP Status: ${response?.status() || 'unknown'}`);
    console.log(`🌐 Current Page URL: ${page.url()}`);
    console.log(`📝 Current Page Title: ${await page.title()}`);

    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/opened.png', fullPage: true });
    console.log('📸 Screen captured: screenshots/opened.png');

    // Locate the title and body editor elements (supporting both JP "記事タイトル" and EN "Article Title" placeholders)
    const titleInput = page.locator('textarea[placeholder="記事タイトル"], textarea[placeholder="Article Title"], [placeholder*="Title"], [placeholder*="タイトル"]').first();
    const editor = page.locator('[contenteditable="true"]').last();

    console.log('✍️ Filling article title...');
    await titleInput.waitFor({ state: 'visible', timeout: 30000 });
    await titleInput.fill(title);

    console.log('✍️ Pasting article HTML content into editor...');
    await editor.waitFor({ state: 'visible', timeout: 30000 });

    // Focus and execute insertHTML to paste formatted rich-text elements perfectly
    await editor.evaluate((el, value) => {
      el.focus();
      // Clear placeholder block first
      el.innerHTML = '';
      document.execCommand('insertHTML', false, value);
    }, htmlContent);

    await page.waitForTimeout(5000); // Wait for auto-save and rendering to complete
    await page.screenshot({ path: 'screenshots/filled.png', fullPage: true });
    console.log('📸 Screen captured: screenshots/filled.png');

    console.log('💾 Waiting for note to auto-save draft...');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'screenshots/draft-saved.png', fullPage: true });
    console.log('📸 Screen captured: screenshots/draft-saved.png');

    console.log(`🏁 Successfully staged draft on note for article: "${title}"!`);
  } catch (err) {
    console.error(`❌ Error during Playwright automation: ${err.message}`);
    await page.screenshot({ path: 'screenshots/error-debug.png', fullPage: true });
    console.error('📸 Error state captured to: screenshots/error-debug.png');
    process.exit(1);
  } finally {
    await context.close();
    await browser.close();
    if (fs.existsSync(storageStatePath)) {
      fs.unlinkSync(storageStatePath);
    }
  }
}

main();
