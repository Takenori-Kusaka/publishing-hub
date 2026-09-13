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

  if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(postId)) {
    console.error(`❌ Error: invalid post id "${postId}"`);
    process.exit(1);
  }

  // SNS 原稿(social/posts/<id>.yaml)は任意。あればタイトルの補完にだけ使う
  const yamlPath = path.join(ROOT, 'social/posts', `${postId}.yaml`);
  const data = fs.existsSync(yamlPath) ? YAML.parse(fs.readFileSync(yamlPath, 'utf8')) : {};

  const exportDir = path.join(ROOT, 'platforms/note/exports', postId);
  const htmlPath = path.join(exportDir, 'article.html');
  const manifestPath = path.join(exportDir, 'manifest.json');

  if (!fs.existsSync(htmlPath) || !fs.existsSync(manifestPath)) {
    console.error(`❌ Error: Note package not found under ${exportDir}. Run 'node scripts/build-note.mjs ${postId}' first.`);
    process.exit(1);
  }

  // 公開ゲート: note 原稿(platforms/note/public/<id>.md)の status が ready の場合だけ投稿する。
  // ready への変更は人間だけが行う(AGENTS.md 1 章)。draft はビルドとプレビューまでで止める。
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.status !== 'ready') {
    console.log(`⏭️ note 原稿 ${manifest.manuscript || postId} の status は "${manifest.status}" です。ready 以外は投稿しません(スキップ)。`);
    process.exit(0);
  }
  if (manifest.checks && manifest.checks.errors > 0) {
    console.error(`❌ Error: note manuscript has ${manifest.checks.errors} check errors. Fix them (npm run check:note) before publishing.`);
    process.exit(1);
  }
  // 配信予定日(publish_after)より前なら投稿しない
  if (manifest.date && !Number.isNaN(new Date(manifest.date).getTime()) && new Date(manifest.date) > new Date()) {
    console.log(`⏭️ publish_after (${manifest.date}) より前のため投稿しません(スキップ)。`);
    process.exit(0);
  }
  const title = manifest.title || data.source?.title || 'Untitled Article';

  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // Load storage state from B64 env, or fallback to local note-state.json for local execution!
  const storageStateB64 = process.env.NOTE_STORAGE_STATE_B64;
  const storageStatePath = path.join(ROOT, '.tmp-note-storage-state.json');
  const localStatePath = path.join(ROOT, 'note-state.json');

  if (storageStateB64) {
    fs.writeFileSync(
      storageStatePath,
      Buffer.from(storageStateB64, 'base64').toString('utf8'),
      { mode: 0o600 }
    );
  } else if (fs.existsSync(localStatePath)) {
    console.log('💡 NOTE_STORAGE_STATE_B64 is not set, but local note-state.json was found. Copying for execution...');
    fs.copyFileSync(localStatePath, storageStatePath);
  } else {
    console.error('❌ Error: No authentication session found!');
    console.error('Please set NOTE_STORAGE_STATE_B64 env, or place a valid note-state.json in the root folder.');
    process.exit(1);
  }

  const screenshotDir = path.join(ROOT, 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const isWindows = process.platform === 'win32';
  const headless = !isWindows; // Headful (visible browser window) on Windows to bypass anti-bot, Headless on Linux!
  console.log(`🚀 Launching browser (headless: ${headless}) using local Chrome/Edge...`);

  let browser;
  try {
    browser = await chromium.launch({
      headless,
      channel: 'chrome', // Use pre-installed Chrome!
      args: ['--disable-blink-features=AutomationControlled']
    });
  } catch (err) {
    try {
      console.log('⚠️ Local Google Chrome was not found. Trying local Microsoft Edge...');
      browser = await chromium.launch({
        headless,
        channel: 'msedge', // Use pre-installed Edge!
        args: ['--disable-blink-features=AutomationControlled']
      });
    } catch (err2) {
      console.log('⚠️ Local Chrome/Edge channels failed. Launching default Chromium...');
      browser = await chromium.launch({ headless });
    }
  }

  const context = await browser.newContext({ storageState: storageStatePath });
  const page = await context.newPage();

  // Capture browser console logs and uncaught exceptions to diagnose Next.js / API blockages
  page.on('console', msg => console.log(`🖥️ BROWSER CONSOLE [${msg.type()}]: ${msg.text()}`));
  page.on('pageerror', err => console.error(`❌ BROWSER ERROR: ${err.message}`));

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

    console.log('🚀 Proceeding to public publishing...');
    const proceedBtn = page.locator('button:has-text("公開に進む"), button:has-text("Publish"), button:has-text("Proceed to publish")').first();
    await proceedBtn.waitFor({ state: 'visible', timeout: 30000 });
    // Wait for the button to be enabled (in case it is disabled during autosave)
    await page.waitForTimeout(2000);
    await proceedBtn.click();
    console.log('☝️ Clicked "公開に進む" (Proceed to Publish) button.');

    await page.waitForTimeout(4000); // Wait for the modal/popover to open

    console.log('🚀 Clicking the final submit button to publish...');
    const submitBtn = page.locator('button:has-text("投稿する"), div[role="dialog"] button:has-text("Publish"), button:has-text("投稿する")').last();
    await submitBtn.waitFor({ state: 'visible', timeout: 30000 });
    await submitBtn.click();
    console.log('🎉 Clicked "投稿する" (Submit Post) button successfully!');

    await page.waitForTimeout(6000); // Wait for the posting to complete and redirect
    await page.screenshot({ path: 'screenshots/published.png', fullPage: true });
    console.log('📸 Screen captured: screenshots/published.png');

    console.log(`🏁 Successfully PUBLISHED on note for article: "${title}"!`);
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
