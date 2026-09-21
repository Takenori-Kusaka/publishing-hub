---
title: 'GitとGitHub Actionsで構築する複数メディア（Qiita, Zenn, note, SNS）へのパブリッシュ管理と検証'
tags:
  - GitHubActions
  - devops
  - 個人開発
  - Playwright
private: false
updated_at: '2026-09-21T23:27:31+09:00'
id: 2cbb8255e84e97dc150d
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

:::note info
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。
:::

# はじめに

複数のメディアへ同一の原稿を手動で転記していると、修正の反映が追いつかなくなります。しかし、公開を単純に自動化するだけでは、意図しない誤公開や認証トークンの漏洩といったセキュリティ上の不安が残ります。そこで本基盤では、同じ文章を複製して使い回すのではなく、同一テーマから媒体別に最適化した別成果物を切り出す方針をとっています。

- 正本（Zenn）: [Gitで管理し、CIで検証する「マルチプラットフォーム個人出版」の設計と実装](https://zenn.dev/takenori_kusaka/articles/multi-platform-publishing-architecture)
- リポジトリ: [Takenori-Kusaka/publishing-hub](https://github.com/Takenori-Kusaka/publishing-hub)

# システム構成と設計方針

本基盤における派生物は、同じ本文の複製ではなく、同じテーマに基づく個別の成果物として作成します。Qiitaの記事では、冒頭40行以内に正本への導線を設置し、Zenn固有の記法は使用しません。こうした媒体ごとの住み分けは、構造ポリシーとしてシステムにより機械化されています。

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

# 公開の門：プルリクエストのマージ

各配信メディアに対して、公開を管理するためのスイッチはそれぞれ1つずつ用意されています。スイッチはブランチ上で立て、生成AIが立ててもかまいません。公開の前に入る人の操作は、`main`へのプルリクエストのマージか、公開のワークフローの手動起動です。公開前の確認の記録として残るのはマージだけです。Zenn、Qiita、noteの配信は`main`への反映を契機に動き（Qiitaとnoteは手動でも起動でき、起動したブランチの原稿を公開します）、SNSはマージの後に人がワークフローを手動で起動します。生成AIが`main`へ直接pushしないことは指示書が定める決まりです。`main`にブランチの保護は設定されていません。Qiita、note、SNSは、配信の検査を通らなければ配信されません。まだ同期されておらずIDがない記事は、`private: true`または`ignorePublish: true`に設定されていないと検査で止まります。一方、Zennの同期はGitHub連携が直接実行するため、たとえCI検査が失敗したとしてもZennへの公開自体を停止させることはできません。Zennにとっての検査は、公開を防ぐ遮断層ではなく、単なる状態の報告として機能します。

# コアコードの実装

本システムにおけるnoteの投稿は、Playwrightを用いたブラウザ自動操作によりエディタへ本文を流し込んで公開ボタンを押す仕組みです。この自動投稿の処理は、noteのエディタが持つ画面構造に依存するブラウザ操作となっています。そのため、画面構造が変更された場合には、投稿処理自体が機能しなくなるという限界があります。

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
    const proceedBtn = page.locator('button:has-text("公開に進む"), button:has-text("公開する"), button:has-text("更新する"), button:has-text("Publish"), button:has-text("Proceed to publish")').first();
    await proceedBtn.waitFor({ state: 'visible', timeout: 30000 });
    // Wait for the button to be enabled (in case it is disabled during autosave)
    await page.waitForTimeout(2000);
    await proceedBtn.click();
// ...
    const submitBtn = page.locator('button:has-text("投稿する"), button:has-text("更新する"), div[role="dialog"] button:has-text("公開する"), div[role="dialog"] button:has-text("Publish")').last();
    await submitBtn.waitFor({ state: 'visible', timeout: 30000 });
    await submitBtn.click();
// ...

```

外部ライブラリを使用せずにピュアJavaScriptでEXIF除去を実装し、テストを通過させていますが、実際のアップロード経路にはまだ接続していません。そのため、現状の投稿機能では、取り込んだ画像のバイト列がそのまま送信される状態になっています。なお、除去の対象はJPEGのAPP1セグメントのみに限定されており、PNGのメタデータへの処理は含まれていません。

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

Blueskyの文字数は書記素で数えます。次は書記素を数えるバリデーターです。

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

- Playwright: [Playwright Documentation](https://playwright.dev/)
- AT Protocol: [The AT Protocol specifications](https://atproto.com/)

# 検証

1つのコマンドを実行するだけで12の検査フェーズが順に進み、途中でエラーが発生しても最後まで稼働して全体の状況を一度に可視化します。この検証結果はMarkdown形式のレポートとして整理され、CIのStep Summaryに掲載されます。出力される検証結果では、エラーと警告が明確に区別して扱われます。エラーが発生した場合はCIが赤になりますが、警告は対応の判断を人間に任せるための助言として提示されます。

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

# まとめ

派生物の設計原則は、単なる本文の複製ではなく、共通のテーマに基づきそれぞれ個別に書き分けることです。配信にあたっては、媒体ごとに1つだけの公開用スイッチを用意しています。スイッチは生成AIを含め誰でもブランチ上で立てられ、公開の門は人が行う`main`へのマージに置いています。
