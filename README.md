# publishing-hub (マルチプラットフォーム出版・配信基盤)

本リポジトリは、Zenn、Qiita、note などのパブリッシングプラットフォーム、および LinkedIn、Bluesky などのSNSへ記事や書籍を届けるための、マルチプラットフォーム出版・配信基盤です。

GitHub を「企画・原稿・自動検証・公開履歴」の信頼できる統合管理面とし、長文（正本）から媒体別の最適な配信価値を切り出します。

---

## 1. 公開チャネルと役割比較

各パブリッシング・配信ポートフォリオは、読者ターゲットに最適化された固有の役割を持ちます。同一文章をそのまま機械的にクロスポストするのではなく、媒体特性に合わせた「バリアント」を管理します。

| 媒体 | 読者の主目的 | リポジトリにおける役割 | 推奨コンテンツ | 読了後の期待行動 |
|---|---|---|---|---|
| **Zenn Books** | 技術・設計を体系的に学ぶ | 長編・体系知の正本（SSOT） | 複数章からなる技術解説、書籍 | 体系的学習、参照 |
| **Zenn Articles** | 設計の概念や知見を深く知る | 独立技術解説の正本（SSOT） | 技術選定、設計判断の記録 | 技術的・構造的理解 |
| **Qiita** | 目の前の具体的な問題を解決する | 再現・転用可能な技術手順 | コード、環境、検証、落とし穴 | 自分のコードにコピーして試す |
| **note** | 技術の背景、葛藤、文脈を知る | 泥臭い人間・組織・学びの物語 | 開発ストーリー、チームビルディング | 組織への共感、思想の理解 |
| **LinkedIn** | キャリア、技術選定、意思決定の材料 | 専門家としての知的判断の提示 | 意思決定理由、RACI、投資対効果 | 自社の意思決定・EM運営に照らす |
| **Bluesky** | 技術的発見、即時の議論、対話 | コミュニティとのクイックな対話 | 1つの鋭い観察、コード片、問い | リプライ、引用、本編URLへの移動 |

---

## 2. 公開しているもの一覧

### 本 (Zenn Books)

| タイトル | パス |
| --- | --- |
| [AIが実装する時代の開発プロセス — ピットイン方式](https://zenn.dev/takenori_kusaka/books/pit-in-process) | `books/pit-in-process/` |
| [ローカル完結ボイスジャーナルの設計 ― QuickScribe を Tauri + Rust + Svelte でつくる](https://zenn.dev/takenori_kusaka/books/quickscribe-design) | `books/quickscribe-design/` |
| [未来予測の設計図 ―― 歴史的事実・現在の外部入力・20年後の社会構造](https://zenn.dev/takenori_kusaka/books/sovereign-resilience-blueprint) | `books/sovereign-resilience-blueprint/` |
| [生成AIに実装を任せて商用サービスを作る ― がんばりクエストの設計と開発プロセス](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design) | `books/ganbari-quest-design/` |

### 単発記事 (Zenn Articles)

| タイトル | パス |
| --- | --- |
| [未来予測の設計図 付録A：技術者は社会にとって何をする人になるのか](https://zenn.dev/takenori_kusaka/articles/srb-appendix-engineer-role) | `articles/srb-appendix-engineer-role.md` |
| [未来予測の設計図 付録B：用語集 ―― 本書が採用した専門用語の定義](https://zenn.dev/takenori_kusaka/articles/srb-appendix-glossary) | `articles/srb-appendix-glossary.md` |
| [未来予測の設計図 付録C：参考文献 ―― 参照したすべての一次資料および公的資料](https://zenn.dev/takenori_kusaka/articles/srb-appendix-bibliography) | `articles/srb-appendix-bibliography.md` |

---

## 3. ディレクトリ構成

```text
.
├── .github/workflows/
│   ├── validate.yml            # 全検査（npm run check + npm test）。レポートを Step Summary に出す
│   ├── social-check.yml        # SNS配信原稿・自動検査 CIワークフロー
│   ├── social-publish.yml      # SNS本番公開ワークフロー（マージ後に人が main で手動起動。source_sha は main のコミットだけ）
│   ├── social-token-check.yml  # 週次LinkedIn・Blueskyトークン期限監視ワークフロー
│   ├── publish-qiita.yml       # Qiita 同期（検査 gate → Qiita CLI。手動の起動は main だけ）
│   ├── stage-note.yml          # note 配信パッケージの生成（検査 gate → WXR/HTML）
│   └── publish-note.yml        # note 投稿（マージで変わった ready / published の原稿。手動の起動は main だけ）
├── articles/                   # Zenn 単発記事 (slug.md) ―― 正本
├── books/                      # Zenn Books ―― 正本
├── platforms/
│   ├── qiita/public/           # Qiita バリアント（課題解決レシピ）。Qiita CLI が同期
│   └── note/public/            # note バリアント（意思決定の物語）。正本とは別に書く
├── lint/                       # 媒体別・題材別の検査規則（docs/linting.md）
│   ├── channels.json           # 媒体の台帳（対象ファイル・プロファイル・ポリシー）
│   ├── textlint/               # 媒体別の校正プロファイル（zenn / qiita / note / social / docs）
│   ├── policies/               # 構造ポリシー（genre・レシピ要件・エッセイ要件・SNS編集規則・非対称）
│   └── terms/                  # 用語辞書（全媒体共通・ソフトウェア・作品別）
├── docs/                       # 設計、ガイドライン、および認証設定 runbook
│   ├── publishing-model.md     # 配信アーキテクチャモデル（ADR）
│   ├── linting.md              # 媒体別 linter と検査機構の設計
│   ├── ai-disclosure.md        # 生成AIの利用の開示（文言・置き場所・検査）
│   ├── social-editorial-guide.md # 媒体別SNS配信・編集ガイドライン
│   ├── linkedin-setup.md       # LinkedIn API認証・トークン更新マニュアル
│   └── bluesky-setup.md        # Blueskyアプリパスワード作成・失効マニュアル
├── images/                     # 画像アセット（/images/... で絶対パス参照）
├── scripts/                    # 検査・ビルド・配信スクリプト
│   ├── lint/                   # 媒体別 linter（check-all / run-textlint / check-terms / check-zenn / check-qiita / check-note / check-variants）
│   └── social/                 # SNS原稿の検証・レンダリング・配信
├── test/                       # ユニットテスト（social / lint）
└── social/                     # SNS配信・管理ルート
    ├── schema/
    │   └── social-post.schema.json # 投稿データ構造を規定する JSON Schema
    ├── posts/
    │   └── *.yaml              # SNS 配信原稿
    └── ledger/
        └── *.jsonl             # 重複投稿を防止する Append-Only 公開台帳（social-ledgerブランチにて管理）
```

---

## 4. 執筆・配信ワークフロー

### 4.1 長文原稿（正本）の執筆フロー
1. `articles/` または `books/` 以下にMarkdownで執筆します。題材はシステムに限りません。本ごとに genre（engineering / process / research など）を `lint/policies/zenn.json` に登録します。
2. `npm run check` をローカルで実行し、校正、書籍構成、Mermaid、画像、用語統一、genre が要求する要素（コード・図・出典など）を検証します。
3. PRを作成し、CI (`validate.yml`) が通過したことを確認してマージします（Zenn連携が直接自動同期します）。

### 4.2 Qiita バリアント（課題解決レシピ）の作成フロー
1. 正本から「技術選定理由」「コアロジックのコード（言語名付きで1箇所以上）」「GitHub への導線」を切り出し、`platforms/qiita/public/<id>.md` に書きます。正本のコピーは重複コンテンツとして検査で止まります。
2. `npm run lint:qiita && npm run check:qiita && npm run check:variants` で、レシピの要件と正本への導線、重複率を検証します。
3. `main` へマージすると `publish-qiita.yml` が同じ検査を gate として通し、Qiita CLI が同期します。記事は公開で作ります。`private: false` の記事は、未同期（`id` なし）でも最初の同期で公開の状態で作られます。

### 4.3 note バリアント（意思決定の物語）の作成フロー
1. `platforms/note/public/<id>.md` に、正本とは別のエッセイとして書きます（生コード・Mermaid・表は使えません。[platforms/note/public/README.md](platforms/note/public/README.md)）。
   - 作成時の `status` は必ず `draft` にします。
2. `npm run check:note && npm run lint:note` で、物語の要件と正本への導線を検証します。`node scripts/build-note.mjs <id>` で配信パッケージを生成できます。
3. `status: ready` にした PR をマージすると、`publish-note.yml` がその原稿を投稿します。push では、マージで変わった原稿のうち `status` が `ready` か `published` のものが対象です。`ready` は、台帳（`platforms/note/ledger.json`）に記録のある投稿の更新か、新規の投稿になります。`published` は、台帳に記録のある投稿の更新だけになり、記録が無ければ投稿せずに止まります。内容が前回と同じなら何もしません。`draft` と `retired` はビルドまでで止まります。投稿後は `status: published` に変えてください。失敗の後のやり直しなどは、`publish-note.yml` を `main` で手動で起動します（ほかのブランチからの起動は、最初のジョブで止めます）。

### 4.4 SNS配信原稿の作成フロー
1. 正本から配信価値を切り出し、`social/posts/` 配下に `<id>.yaml` を新規作成します。
   - 作成時の `status` は必ず `draft`（下書き）にします。
2. `npm run social:validate` を実行して、スキーマ、URL実在、文字数（書記素数）、画像の有無、シークレット漏洩、編集規則（冒頭のフック、煽り表現、正本への導線、1投稿1論点など）を自動検査します。
3. PRを作成し、PRチェックCI (`social-check.yml`) のパスと、Actionsの artifact へ保存される墨消し（Redacted）されたMarkdown プレビュー（`${id}-preview.md`）を目視確認します。
4. 対象コミットの40桁SHAを `revision` へ転記し、`status` を `ready`（公開可能）にした PR をマージします。
   - **`ready` へのマージそのものは、自動投稿をトリガーしません。** 

### 4.5 安全なSNS公開フロー
1. GitHubのActionsタブから `social-publish` ワークフローを選択し、[Run workflow] で `main` を選んで押します。ほかのブランチを選ぶと、ジョブは投稿の前に止まります。止める段を含まない古いブランチのワークフローのファイルから起動しても、投稿のジョブは止まります（Environment `social-production` を使えるブランチを `main` だけに限っているため。正本 9 章）。
2. パラメータとして `post_id`, `platform`, `source_sha` を、そして確認キーワードに `PUBLISH` を入力して実行します。`source_sha` には、`status: ready` の原稿を含む `main` のコミットの SHA（40 桁）を入れます。原稿の `revision` の値ではありません。ジョブはこのコミットを取り出して検査し、投稿し、台帳もこの SHA で記録します。`revision` は原稿を `ready` にする前のコミットを指すことがあり（コミットは自分の SHA を書けません）、その時点の原稿が `draft` なら検査で止まります。
3. ジョブは、確認キーワード、起動したブランチが `main` であること、`source_sha` が `main` に含まれる 40 桁の SHA であることを確かめます。続けて、原稿の検査（`social:validate`）、`status` が `ready` であることと `revision` のコミットの実在を確かめたうえで、GitHub Environment `social-production` の Secrets（実トークン）を使って各APIへ投稿します。
4. 承認は手順 4.4 の PR のマージで済んでいます。`social-production` は Secrets の置き場で、配置承認（Required Reviewers）は置いていません。起動（手順 1・2）はマージの後に人が行います（AGENTS.md 1 章）。
5. 公開が成功すると、結果レコードが Append-Only 公開台帳に追記され、専用の `social-ledger` ブランチに保存されます。投稿が途中で失敗したときも、投稿できた媒体を記録するために台帳を書きます。投稿の前の検査（手順 3）で止まったときは、投稿も台帳の記録も行いません。台帳の二重投稿の防止は、投稿 ID・媒体・`source_sha` の組で判定するので（`scripts/social/cli.mjs`）、一部の媒体だけ投稿された後に起動し直すときは、同じ `source_sha` を使います。ただし今のワークフローは、投稿の前に `social-ledger` ブランチの台帳を読み込まないため、この判定は前の実行の記録を見ません。起動し直すときは、`platform` にまだ投稿していない媒体だけを選びます。

---

## 5. 検査・開発コマンド

```bash
npm install

# 1. Zenn本・記事のローカルプレビュー
npm run preview

# 2. 全検査（校正・構成・図・日本語・用語統一・正本の構造・Qiita/note/SNSのバリアント・媒体間の非対称）
npm run check               # レポート: .tmp/lint/report.md

# 3. ユニットテスト（SNS + linter）
npm test

# (個別コマンド)
npm run lint                # 媒体別 textlint（lint:zenn / lint:qiita / lint:note / lint:social / lint:docs）
npm run check:terms         # 用語統一（題材別辞書・表記ゆれ検出）
npm run check:zenn          # 正本の構造（genre・記述規範）
npm run check:qiita         # Qiita バリアントの構造
npm run check:note          # note バリアントの構造
npm run check:variants      # 媒体間の非対称（重複率・正本への導線）
npm run social:validate     # SNS原稿（YAML）のスキーマ・意味・編集規則・セキュリティチェック
npm run social:test         # SNSテスト（Ajv、grapheme、mockアダプター）の実行
npm run social:render       # SNSプレビューMarkdownファイルの書き出し
npm run note:build -- <id>  # note 配信パッケージ（WXR / HTML）の生成
```

規則の設計と一覧は [docs/linting.md](docs/linting.md) を参照してください。

---

## ⚠️ シークレット情報の取り扱いに関する重要警告

本リポジトリは公開リポジトリです。
**LinkedInの `access_token` や、Blueskyの通常パスワード、アプリパスワードを、YAMLファイル内、Markdown内、テストコード内、スクリプトのコメント、あるいは Actions ログに直接記述してはなりません（コミット厳禁）。**

これらはすべて、GitHubの [Settings] ➔ [Environments] ➔ [social-production] の **Environment Secrets** としてのみ厳重に管理されます。また、CLIツールおよびアダプターには、誤ってこれらが流出しそうになった時点で検知して自動で処理を強制停止・墨消しする強力な保護フィルター（Redactor）が搭載されています。

詳しいトークンの取得・更新・緊急無効化（Revocation）手順は、以下のマニュアルを参照してください。
- **LinkedIn:** [docs/linkedin-setup.md](docs/linkedin-setup.md)
- **Bluesky:** [docs/bluesky-setup.md](docs/bluesky-setup.md)

---

## 関連リポジトリ

| | |
| --- | --- |
| 標準本文とサイト | https://github.com/Takenori-Kusaka/process-compass |
| 準拠テンプレート | https://github.com/Takenori-Kusaka/pit-in-template |

## ライセンス

原稿テキスト・Mermaid図は [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.ja)。コードスニペット・検証スクリプトは [MIT License](LICENSE)。詳細は [NOTICE.md](NOTICE.md) を参照してください。
