---
title: 'GitとGitHub Actionsで構築する複数メディア（Qiita, Zenn, note, SNS）へのパブリッシュ管理と検証'
tags:
  - GitHubActions
  - devops
  - 個人開発
  - Playwright
private: false
updated_at: '2026-09-13T09:03:00+09:00'
id: 2cbb8255e84e97dc150d
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

:::note info
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。使ったツールと用途は、末尾の「生成AIの利用について」に書いています。
:::

# はじめに

複数のメディア（Qiita、Zenn、note、各種SNS）に同じ原稿を手で貼り直していると、修正の反映が追いつかなくなります。また、投稿を自動化した瞬間に、誤って本番へ公開する不安や、APIトークンなどの機密情報（シークレット）を漏洩させる不安が生じます。

本記事では「**Zennの原稿を知識の正本（SSOT：Single Source of Truth）とし、GitHub Actions（CI）と結合したマルチプラットフォーム個人出版・配信基盤**」を扱います。設計理由、具体的なコード実装、およびアーキテクチャを解説します。

本基盤のコードや検査規則は、以下のGitHubリポジトリにて公開しています。
- **情報源・GitHubリポジトリ:** [Takenori-Kusaka/publishing-hub](https://github.com/Takenori-Kusaka/publishing-hub)
- **正本（Zenn）:** [Gitで管理し、CIで検証する「マルチプラットフォーム個人出版」の設計と実装](https://zenn.dev/takenori_kusaka/articles/multi-platform-publishing-architecture)

---

# 1. システムアーキテクチャと設計方針

本基盤が採用した中核的な設計ポリシーは、同じ本文の複製ではなく、同じテーマに基づく個別の成果物として管理することです。

```text
publishing-hub/
├── articles/                          # Zenn 記事
├── books/                             # Zenn 本
├── platforms/
│   ├── qiita/                         # Qiita 記事・CLI設定
│   │   ├── qiita.config.json
│   │   └── public/
│   └── note/                          # note 向けエッセイの原稿
└── social/
    ├── posts/                         # 各SNS（LinkedIn, Bluesky）用 YAMLデータ
    └── schema/                        # スキーマ検証ルール
```

長文の技術詳細テキストを「正本」としてGitで一元管理し、そこから異なる媒体別の価値（バリアント）を、生成AIのエージェントと分業しながら（下書きまでをAI、最終確認を人が担当）、個別に書き分けます。そして、GitHub Actionsと専用のバリデーションエンジンを用いて検証します。

---

# 2. 技術選定理由（Why this tech stack?）

## 2.1. ブラウザ自動操作：Playwrightの選定
noteの投稿は、Playwrightによるブラウザ自動操作で、エディタに本文を流し込み、公開ボタンを押す方式です。正本はPlaywrightを選んだ理由を書いていないため、この記事でも理由は挙げません。実装は、ログイン状態を記録したファイルを `storageState` として読み込んで使います。
- **公式ドキュメント:** [Playwright Documentation](https://playwright.dev/)

## 2.2. Qiita自動デプロイ：公式 Qiita CLI の選定
Qiitaへの記事公開には公式の `qiita-cli` を採用しました。公式が提供しており、GitHub Actionsからの同期を公式にサポートしているため、本基盤のワークフローへ組み込みました。
- **公式リポジトリ:** [increments/qiita-cli](https://github.com/increments/qiita-cli)

## 2.3. SNS統合：AT Protocol API の選定
Blueskyは公開されたAPIを持つため、ブラウザ操作を使わずに投稿できます。投稿スキーマは本文の上限を300書記素と定義しており、この上限を機械的に検査できます。実装は `@atproto/api` を使っています。
- **公式ドキュメント:** [The AT Protocol specifications](https://atproto.com/)

---

# 3. コアコードの実装詳細

## 3.1. Playwrightによるnote投稿スクリプト

Playwrightを用いて、noteのエディタ画面にアクセスし、タイトルを入力してnote用にビルドされたHTML本文を流し込み、「公開に進む」や「投稿する」ボタンをクリックして投稿するスクリプトです。なお、このnote投稿処理はエディタの画面構造に依存するブラウザ自動操作であるため、画面構造が変化した場合には動作が崩れるという既知の限界があります。

抜粋の冒頭にある3つの分岐は、公開の門です。原稿の`status`が`ready`でないとき、検査エラーがあるとき、`publish_after`より前のときは、投稿せずに終わります。`ready`への切り替えは、人が内容を確認したうえで行います。

```javascript
// scripts/publish-note.mjs
import fs from 'node:fs';
// ...
import { chromium } from 'playwright';
// ...
  // @gate status が ready の原稿だけを投稿する
  if (manifest.status !== 'ready') {
    console.log(`⏭️ note 原稿 ${manifest.manuscript || postId} の status は "${manifest.status}" です。ready 以外は投稿しません(スキップ)。`);
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
// ...
  let browser;
  try {
    browser = await chromium.launch({
      headless,
      channel: 'chrome', // Use pre-installed Chrome!
// ...
    });
// ...
    // Locate the title and body editor elements (supporting both JP "記事タイトル" and EN "Article Title" placeholders)
    const titleInput = page.locator('textarea[placeholder="記事タイトル"], textarea[placeholder="Article Title"], [placeholder*="Title"], [placeholder*="タイトル"]').first();
    const editor = page.locator('[contenteditable="true"]').last();
// ...
    console.log('✍️ Filling article title...');
    await titleInput.waitFor({ state: 'visible', timeout: 30000 });
    await titleInput.fill(title);
// ...
    // Focus and execute insertHTML to paste formatted rich-text elements perfectly
    await editor.evaluate((el, value) => {
      el.focus();
      // Clear placeholder block first
      el.innerHTML = '';
      document.execCommand('insertHTML', false, value);
    }, htmlContent);
// ...
    const proceedBtn = page.locator('button:has-text("公開に進む"), button:has-text("Publish"), button:has-text("Proceed to publish")').first();
    await proceedBtn.waitFor({ state: 'visible', timeout: 30000 });
    // Wait for the button to be enabled (in case it is disabled during autosave)
    await page.waitForTimeout(2000);
    await proceedBtn.click();
// ...
    const submitBtn = page.locator('button:has-text("投稿する"), div[role="dialog"] button:has-text("Publish"), button:has-text("投稿する")').last();
    await submitBtn.waitFor({ state: 'visible', timeout: 30000 });
    await submitBtn.click();
// ...
```

## 3.2. ピュアJavaScriptによる画像EXIF APP1メタデータ除去

JPEGのAPP1セグメント（EXIF）を、依存ライブラリなしのピュアJavaScriptで取り除く処理です。バイナリを先頭から読み、`0xFFE1` のセグメントを飛ばして残りをつなぎ直します。なお、EXIF除去は投稿の経路に接続されていません。また、除去の対象はJPEGのAPP1セグメントのみであり、PNGのメタデータには触れません。

```javascript
// scripts/social/images.mjs
export function stripJpegExif(buffer) {
  if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
    return buffer; // Not a JPEG
  }

  let i = 2;
  const chunks = [buffer.subarray(0, 2)];

  while (i < buffer.length) {
    if (buffer[i] !== 0xFF) {
      return buffer; // Invalid structure, fallback to original
    }
    const marker = buffer[i + 1];
    if (marker === 0xFF) {
      i += 1; // Fill byte before a marker
      continue;
    }
    if (marker === 0xD9) {
      chunks.push(buffer.subarray(i));
      break;
    }
    if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
      chunks.push(buffer.subarray(i, i + 2)); // Standalone markers carry no length
      i += 2;
      continue;
    }
    if (marker === 0xDA) {
      // SOS: entropy-coded image data follows until EOI. APP segments never appear after it, so copy the rest as is.
      chunks.push(buffer.subarray(i));
      break;
    }
    const length = (buffer[i + 2] << 8) + buffer[i + 3];

    // APP1 marker is 0xE1 (EXIF metadata)
    if (marker === 0xE1) {
      // Skip this segment entirely
      i += 2 + length;
    } else {
      chunks.push(buffer.subarray(i, i + 2 + length));
      i += 2 + length;
    }
  }

  return Buffer.concat(chunks);
}
```

## 3.3. Intl.Segmenterによる書記素分割

Blueskyの文字数制限（上限300書記素）を正確に監視するため、結合文字や絵文字を正確に1文字として数えるバリデーターです。

```javascript
// scripts/social/graphemes.mjs
/**
 * Counts grapheme clusters (user-perceived characters) in a string using Intl.Segmenter.
 * This ensures accurate counting of multi-byte characters, emojis, and combined characters for Bluesky.
 *
 * @param {string} text
 * @returns {number}
 */
export function countGraphemes(text) {
  if (!text) return 0;
  const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
  let count = 0;
  for (const _ of segmenter.segment(text)) {
    count++;
  }
  return count;
}
```

## 3.4. 品質検証を自動化する GitHub Actions ワークフローの記述

本基盤の検査を動かす GitHub Actions ワークフローの抜粋です。`main`へのpushとプルリクエストを契機に、`npm run check`と`npm test`を実行する設定です。ただし、リポジトリの履歴にはまだプルリクエストがなく、プルリクエストを契機とする検査は一度も動いていません。

```yaml
# .github/workflows/validate.yml
# ...
jobs:
  validate:
    name: validate
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # 生成AIの開示の検査が、原稿のコミットの共著記録(Co-Authored-By)を読むため

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Run all content checks (npm run check)
        id: check
        run: npm run check

      - name: Run linter and social unit tests (npm test)
        if: ${{ !cancelled() }}
        run: npm test
```

---

# 4. 自動化テストとGitHub Actionsを用いた品質検証

検査の結果が公開を止めるかどうかは、媒体によって違います。Qiitaの記事は、`main`へのpushでQiita CLIが同期する前に、Qiita向けの校正、レシピの要件、正本との重複率、複数称の検査を通し、通らなければ同期しません。ZennはGitHub連携が直接公開するため、検査が失敗しても公開は止まらず、検査は報告にとどまります。

1. **日本語の文字集合と複数称の検査 (`scripts/check-japanese.mjs`)**
   - JIS X 0208 にない漢字と、「私たち」「弊社」などの複数称・組織称を検出してエラーにします。
2. **Qiita品質Linter (`scripts/lint/check-qiita.mjs`)**
   - 品質を保つため、「散文（コード、URLを除く）1,500字以上」「言語名付きコード3箇所以上」「公式資料2ホスト以上」といった規則で不整合を検出します。

---

# 5. まとめ

Git管理下にすべての発信ソースを置くことで、テキストの執筆にソフトウェア開発における検証プロセスの恩恵を持ち込めます。
媒体ごとの規則を設定ファイルに置き、CIの検査として実行することで、規則の変更も原稿の修正も差分として確かめられます。

# 生成AIの利用について

この記事の作成には、生成AIの Claude（Anthropic の Claude Fable 5.1）を使いました。本文の改稿と校正に使っています。
Gemini CLI（Google の gemini-3.7-flash）で変更を加えました。
具体的には、題名とタグ、および「はじめに」「1. システムアーキテクチャと設計方針」「2. 技術選定理由（Why this tech stack?）」を修正しました。
また、「3. コアコードの実装詳細」「4. 自動化テストとGitHub Actionsを用いた品質検証」「5. まとめ」を改訂しました。
scripts/publish-note.mjs と scripts/social/images.mjs、さらに scripts/social/graphemes.mjs の抜粋コードも更新しました。
あわせて .github/workflows/validate.yml の記述を更新しました。
Claude（Anthropic の Claude Opus 5）で、査読で見つかった正本との食い違いを直しました。
対象は、タグと「はじめに」、1章から5章までの記述です。
筆者が内容を確認し、必要に応じて修正しました。公開した内容の責任は筆者が負います。
