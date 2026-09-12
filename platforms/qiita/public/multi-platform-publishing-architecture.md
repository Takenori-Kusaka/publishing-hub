---
title: "GitとGitHub Actionsで構築する！複数メディア（Qiita, Zenn, note, SNS）の自動・安全パブリッシング基盤"
tags:
  - Qiita
  - GitHubActions
  - DevOps
  - 個人開発
private: false
updated_at: "2026-09-12T18:09:04+09:00"
id: 2cbb8255e84e97dc150d
organization_url_name: null
slide: false
ignorePublish: false
---

# はじめに

個人開発や技術発信を行っていると、複数のメディア（Qiita、Zenn、note、各種SNS）に手動で同じ記事をコピペ・転載するコストが大きな課題になります。また、ローカルから手動で投稿を行う運用は、誤公開やAPIトークンなどの機密情報（シークレット）の漏洩リスクを孕んでいます。

本記事では、**「Gitを唯一の真実のソース（SSOT：Single Source of Truth）」とし、GitHub Actions（CI/CD）と安全に結合したマルチプラットフォーム技術出版・SNS自動パブリッシング基盤**の、設計理由、具体的なコード実装、およびアーキテクチャについて詳細に解説します。

構築された完全なオープンソースコードは、以下のGitHubリポジトリにて公開しています。
- **情報源・GitHubリポジトリ:** [Takenori-Kusaka/zenn-content](https://github.com/Takenori-Kusaka/zenn-content)

---

# 1. システムアーキテクチャと設計方針

本基盤が採用した中核的な設計ポリシーは、**「同じ本文の単純複製ではなく、同じテーマに基づく個別成果物（バリアント）の統合管理」**です。

```text
E:\Github\zenn-content\
├── articles/                          # Zenn 記事
├── books/                             # Zenn 本
├── platforms/
│   ├── qiita/                         # Qiita 記事・CLI設定
│   │   ├── qiita.config.json
│   │   └── public/
│   └── note/                          # note 変換アセット
└── social/
    ├── posts/                         # 各SNS（LinkedIn, Bluesky）用 YAMLデータ
    └── ledger/                        # 公開台帳システム（2重投稿防止）
```

長文の技術詳細テキストを「正本」としてGitで一元管理し、そこから異なる媒体別の価値（バリアント）を人間が明示的に切り出します。そして、GitHub Actionsと専用のバリデーションエンジンにより、検証・プレビュー・本番公開を一元化します。

---

# 2. 技術選定理由（Why this tech stack?）

### 2.1. ブラウザ自動操作：Playwrightの選定
noteは公式に公開APIを提供していないため、ブラウザ自動操作（Scraping/Automation）が必要です。Puppeteerと比較して、**Playwright** はモダンな複数ブラウザ（Chromium, Firefox, WebKit）のマルチスレッド実行や、ログイン状態を記録して再利用する `storageState` 機能が洗練されているため選定しました。
- **公式ドキュメント:** [Playwright Documentation](https://playwright.dev/)

### 2.2. Qiita自動デプロイ：公式 Qiita CLI の選定
Qiitaの記事管理には、公式が提供する **`@qiita/qiita-cli`** を採用しました。サードパーティ製のAPIクライアントと異なり、公式が開発保守しているため仕様変更に強く、YAMLフロントマターを用いたID自動マッピング機能が秀逸であるため、これをGitHub Actionsワークフローへ組み込みました。
- **公式リポジトリ:** [increments/qiita-cli](https://github.com/increments/qiita-cli)

### 2.3. SNS統合：AT Protocol API の選定
Blueskyへの投稿には、オープンな分散型SNS規格である **AT Protocol** の公式APIクライアント（`@atproto/api`）を採用しました。
- **公式ドキュメント:** [The AT Protocol specifications](https://atproto.com/)

---

# 3. コアコードの実装詳細

### 3.1. Windows/Linux両対応：Playwrightによるnoteフルオート下書き公開スクリプト

Playwrightを用いて、noteのエディタ画面にアクセスし、タイトルを入力してZennからビルドされたクリーンなHTML本文を流し込み、**「公開に進む」➔「投稿する」ボタンを完全自動でクリックしてパブリッシュするスクリプト**です。

```javascript
// scripts/publish-note.mjs から抜粋
import { chromium } from 'playwright';
import fs from 'node:fs';

const isWindows = process.platform === 'win32';
const headless = !isWindows; // Windows環境（ローカル/Self-hosted）ではWAF回避のため画面を表示（headful）！

const browser = await chromium.launch({
  headless,
  channel: 'chrome',
  args: ['--disable-blink-features=AutomationControlled'] // 自動操作フラグを隠滅してBot検知を回避
});
const context = await browser.newContext({ storageState: 'note-state.json' });
const page = await context.newPage();

await page.goto('https://editor.note.com/new', { waitUntil: 'domcontentloaded' });

// タイトルと本文の流し込み
const titleInput = page.locator('textarea[placeholder="記事タイトル"], textarea[placeholder="Article Title"]').first();
await titleInput.fill('技術記事タイトル');

const editor = page.locator('[contenteditable="true"]').last();
await editor.evaluate((el, html) => {
  el.focus();
  el.innerHTML = '';
  document.execCommand('insertHTML', false, html); // HTML成形テキストをペースト
}, '<h2>見出し2</h2><p>本文です。</p>');

// フルオート公開フロー
const proceedBtn = page.locator('button:has-text("公開に進む"), button:has-text("Publish")').first();
await proceedBtn.waitFor({ state: 'visible' });
await proceedBtn.click();

const submitBtn = page.locator('button:has-text("投稿する"), button:has-text("Publish")').last();
await submitBtn.waitFor({ state: 'visible' });
await submitBtn.click(); // 本番公開完了！
```

### 3.2. 依存関係ゼロ：純JavaScriptによる画像EXIF APP1メタデータ除去

プライバシー保護のため、アップロードされる画像からGPS情報やカメラ情報（EXIF）を削除するプロセッサーです。環境依存になりやすいネイティブパッケージ（Sharpなど）を完全に排除し、**純粋なJavaScriptのバイナリ操作のみでJPEGの `0xFFE1` APP1セグメントをスキャンして削除する超軽量ロジック**を実装しました。

```javascript
// scripts/social/images.mjs から抜粋
export function stripJpegExif(buffer) {
  if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
    return buffer; // JPEGではない場合はそのまま返す
  }
  let i = 2;
  const len = buffer.length;
  const segments = [buffer.slice(0, 2)]; // SOI (0xFFD8)

  while (i < len) {
    if (buffer[i] === 0xFF && buffer[i + 1] === 0xD9) {
      segments.push(buffer.slice(i)); // EOI (0xFFD9)
      break;
    }
    if (buffer[i] === 0xFF) {
      const marker = buffer[i + 1];
      const size = (buffer[i + 2] << 8) + buffer[i + 3];
      if (marker === 0xE1) {
        // EXIFを含む APP1 セグメント (0xFFE1) を完全にスキップ（削除）！
        console.log('✂️ Found and stripped JPEG EXIF APP1 segment.');
      } else {
        segments.push(buffer.slice(i, i + 2 + size));
      }
      i += 2 + size;
    } else {
      i++;
    }
  }
  return Buffer.concat(segments);
}
```

### 3.3. 正確な文字数カウント：Intl.Segmenterによる書記素分割

Blueskyの300文字制限を正確に監視するため、結合文字や絵文字を正確に1文字として数えるバリデーターです。

```javascript
// scripts/social/graphemes.mjs
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

---

# 4. 信頼性を担保する自動化テストとGitHub Actions

技術記事としての品質を維持し、誤送信や秘密情報の漏洩を防ぐため、リポジトリへのプッシュを契機に以下の検証をGitHub Actions上で強制実行（Gate）しています。

1. **JIS X 0208 漢字規格チェック & 複数個人称Linter (`scripts/check-japanese.mjs`)**
   - 常用漢字を外れた中国語簡体字の混入、および個人発信のトーンを崩す「私たち」「弊社」などの複数・企業主語を自動的にエラー検知。
2. **Qiita品質Linter (`scripts/check-qiita-quality.mjs`)**
   - 本記事の作成に伴い、新規に実装。技術記事としての品質を保つため、「1500文字以上」「コードブロック3箇所以上」「公式ドキュメントリンク2箇所以上」「GitHubリポジトリへのリンク」をルール化し、満たさない記事の公開をCIで強制ブロック。

---

# 5. まとめ

Git管理下にすべての発信ソースを置くことで、テキストの執筆にソフトウェア開発における「テスト」「バリデーション」「自動デプロイ」の恩恵を100%持ち込むことが可能になります。
手動作業を極限まで排除した安全で美しく、技術的に深い発信基盤を構築し、価値あるアウトプットを世界に届けましょう！
