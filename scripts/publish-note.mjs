import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import YAML from 'yaml';
import { fingerprint, noteKeyFromUrl, decidePublish, writeEntry, isPublishable, readMainLedger, fetchNoteUrl, noteApiWarnings, ledgerRecord } from './note-ledger.mjs';

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

  // 公開ゲート: note 原稿(platforms/note/public/<id>.md)の status が ready か published の場合だけ投稿する。
  // ready はブランチ上で誰が立ててもよく、main へのマージが承認(AGENTS.md 1 章)。draft と retired はビルドとプレビューまでで止める。
  // published は投稿済みの記録なので、台帳に記録のある投稿の更新だけを行う(下の decidePublish)。
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  // @gate status が ready か published の原稿だけを投稿する
  if (!isPublishable(manifest.status)) {
    console.log(`⏭️ note 原稿 ${manifest.manuscript || postId} の status は "${manifest.status}" です。ready と published 以外は投稿しません(スキップ)。`);
    process.exit(0);
  }
  // @gate 検査エラーがある原稿は投稿しない
  if (manifest.checks && manifest.checks.errors > 0) {
    console.error(`❌ Error: note manuscript has ${manifest.checks.errors} check errors. Fix them (npm run check:note) before publishing.`);
    process.exit(1);
  }
  // 配信予定日(publish_after)より前なら投稿しない
  // @gate publish_after より前は投稿しない
  if (manifest.date && !Number.isNaN(new Date(manifest.date).getTime()) && new Date(manifest.date) > new Date()) {
    console.log(`⏭️ publish_after (${manifest.date}) より前のため投稿しません(スキップ)。`);
    process.exit(0);
  }
  const title = manifest.title || data.source?.title || 'Untitled Article';

  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // 台帳で、同じ投稿を更新するのか、新規に作るのか、内容が同じで何もしないのかを決める。
  // note には投稿を更新する API がないため、これを見ないと再実行のたびに投稿が重複する。
  // 判断には main の最新の台帳を使う。待っていた実行の作業ツリーの台帳には、先の実行の記録が無いことがある。
  const fp = fingerprint(title, htmlContent);
  let mainLedger = null;
  try {
    mainLedger = readMainLedger();
  } catch (e) {
    console.error(`   ${String(e.stderr || e.message).slice(0, 200)}`);
  }
  // @gate main の最新の台帳を読めなければ投稿しない(古い台帳で判断すると、同じ原稿を note にもう 1 本作る)
  if (!mainLedger) {
    console.error('❌ Error: main の最新の台帳(origin/main の platforms/note/ledger.json)を読めませんでした。起動したコミットの台帳で判断すると同じ原稿を note にもう 1 本作ることがあるため、投稿しません。');
    process.exit(1);
  }
  const decision = decidePublish(postId, fp, { force: process.env.NOTE_FORCE === 'true', status: manifest.status, ledger: mainLedger });
  // @gate published の原稿は、台帳に投稿の記録があるときだけ更新する(記録が無ければ投稿しない)
  if (decision.action === 'refuse') {
    console.error(`❌ Error: note 原稿 ${manifest.manuscript || postId} の status は published ですが、台帳(platforms/note/ledger.json)に投稿の記録がありません。台帳の外で投稿された記事を重複して作らないため、投稿しません。note の投稿の note_key と url を台帳に記録してから、もう一度実行してください。`);
    process.exit(1);
  }
  if (decision.action === 'skip') {
    console.log(`⏭️ note 投稿 ${postId} は前回と同じ内容です(指紋一致)。重複投稿を防ぐためスキップします。強制するなら NOTE_FORCE=true。`);
    console.log(`   既存の投稿: ${decision.entry.url || `${decision.entry.note_key}(台帳に url がありません)`}`);
    process.exit(0);
  }
  const editKey = decision.action === 'update' ? decision.entry.note_key : null;
  console.log(editKey ? `♻️ 既存の note 投稿 ${editKey} を更新します(重複を作りません)。` : '🆕 新しい note 投稿を作成します。');

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
    // 更新なら既存の投稿の編集ページ、新規なら新規作成ページを開く。
    const editorUrl = editKey ? `https://editor.note.com/notes/${editKey}/edit` : 'https://editor.note.com/new';
    console.log(`🌐 Navigating to note editor (${editorUrl})...`);
    const response = await page.goto(editorUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log(`📡 Response HTTP Status: ${response?.status() || 'unknown'}`);
    console.log(`🌐 Current Page URL: ${page.url()}`);
    console.log(`📝 Current Page Title: ${await page.title()}`);

    // 更新のはずが編集ページに入れていない(ログインリダイレクト等)なら、新規投稿を作って重複させるより止める。
    if (editKey && !/editor\.note\.com\/notes\//.test(page.url())) {
      throw new Error(`既存の投稿 ${editKey} の編集ページを開けませんでした(現在 URL: ${page.url()})。重複投稿を避けるため中止します`);
    }

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
    // 新規は「公開に進む」、更新は「公開する」「更新する」など、ボタンの文言が変わりうる。
    const proceedBtn = page.locator('button:has-text("公開に進む"), button:has-text("公開する"), button:has-text("更新する"), button:has-text("Publish"), button:has-text("Proceed to publish")').first();
    await proceedBtn.waitFor({ state: 'visible', timeout: 30000 });
    // Wait for the button to be enabled (in case it is disabled during autosave)
    await page.waitForTimeout(2000);
    await proceedBtn.click();
    console.log('☝️ Clicked the proceed button.');

    await page.waitForTimeout(4000); // Wait for the modal/popover to open

    console.log('🚀 Clicking the final submit button to publish...');
    const submitBtn = page.locator('button:has-text("投稿する"), button:has-text("更新する"), div[role="dialog"] button:has-text("公開する"), div[role="dialog"] button:has-text("Publish")').last();
    await submitBtn.waitFor({ state: 'visible', timeout: 30000 });
    await submitBtn.click();
    console.log('🎉 Clicked the submit button successfully!');

    await page.waitForTimeout(6000); // Wait for the posting to complete and redirect
    await page.screenshot({ path: 'screenshots/published.png', fullPage: true });
    console.log('📸 Screen captured: screenshots/published.png');

    // 投稿後のページの URL(https://editor.note.com/notes/<key>/publish/)から note のキーを取り、台帳に記録する。次回はこれを見て「同じ投稿の更新」に回る。
    const publishedUrl = page.url();
    const key = noteKeyFromUrl(publishedUrl) || editKey;
    if (key) {
      // 台帳の url と published_at は、同じ投稿の更新なら台帳の値を保ち、新規なら note の公開 API が返す値(公開ページの URL と初回の公開日時)にする。
      // エディタの URL からは組み立てない(ユーザー名の位置に notes が入り、開けない URL を記録した)。API に失敗しても投稿は失敗にしない。
      // API の status が published でなければ警告する。記録は残す(残さないと、次のマージで同じ原稿をもう 1 本作る)。
      const same = decision.entry?.note_key === key ? decision.entry : null;
      let publicUrl = null;
      let notePublishedAt = null;
      if (!same?.url) {
        const got = await fetchNoteUrl(key, async (apiUrl) => {
          const res = await context.request.get(apiUrl, { timeout: 15000 });
          if (!res.ok()) throw new Error(`HTTP ${res.status()}`);
          return res.json();
        });
        publicUrl = got.url;
        notePublishedAt = got.publishedAt;
        for (const w of noteApiWarnings(key, got)) console.log(`::warning::${w}`);
      }
      const record = ledgerRecord({ entry: decision.entry, noteKey: key, fingerprint: fp, title, publicUrl, notePublishedAt, now: new Date().toISOString() });
      writeEntry(postId, record);
      console.log(`🧾 台帳を更新: ${postId} → ${key} ${record.url || '(url なし)'}(platforms/note/ledger.json)`);
    } else {
      console.log('⚠️ 投稿後の URL から note のキーを取れませんでした。台帳は更新していません。次の実行では、この原稿が ready なら新しく投稿されて note の上で重複し、published なら投稿せずに止まります。note_key と url を platforms/note/ledger.json に記録してください。URL: ' + publishedUrl);
    }

    console.log(`🏁 Successfully ${editKey ? 'UPDATED' : 'PUBLISHED'} on note for article: "${title}"! (${publishedUrl})`);
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
