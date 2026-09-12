# zenn-content

[Zenn](https://zenn.dev/) へ公開する記事と本の原稿です。GitHub 連携で自動デプロイされます。

## 公開しているもの

### 本 (Zenn Books)

| タイトル | パス |
| --- | --- |
| [AIが実装する時代の開発プロセス — ピットイン方式](https://zenn.dev/takenori_kusaka/books/pit-in-process) | `books/pit-in-process/` |
| [ローカル完結ボイスジャーナルの設計 ― QuickScribe を Tauri + Rust + Svelte でつくる](https://zenn.dev/takenori_kusaka/books/quickscribe-design) | `books/quickscribe-design/` |
| [未来予測の設計図 ―― 歴史的事実・現在の外部入力・20年後の社会構造](https://zenn.dev/takenori_kusaka/books/sovereign-resilience-blueprint) | `books/sovereign-resilience-blueprint/` |

### 単発記事 (Zenn Articles)

| タイトル | パス |
| --- | --- |
| [未来予測の設計図 付録A：技術者は社会にとって何をする人になるのか](https://zenn.dev/takenori_kusaka/articles/srb-appendix-engineer-role) | `articles/srb-appendix-engineer-role.md` |
| [未来予測の設計図 付録B：用語集 ―― 本書が採用した専門用語の定義](https://zenn.dev/takenori_kusaka/articles/srb-appendix-glossary) | `articles/srb-appendix-glossary.md` |
| [未来予測の設計図 付録C：参考文献 ―― 参照したすべての一次資料および公的資料](https://zenn.dev/takenori_kusaka/articles/srb-appendix-bibliography) | `articles/srb-appendix-bibliography.md` |

## 構成

```
.
├── .github/workflows/
│   └── validate.yml  CI ワークフロー (自動検証)
├── articles/         Zenn 単発記事 (slug.md)
├── books/            Zenn Books
│   └── <book-slug>/
│       ├── config.yaml   タイトル・トピック・章の順序
│       ├── cover.png     カバー画像 (500×700)
│       └── *.md          各章の原稿
├── docs/             開発プロセスやルール、校正基準等の設計文書
├── images/           画像アセット。参照は /images/... の絶対パス
└── scripts/          自動検証や各種チェックを実行するスクリプト
```

## 執筆

```bash
npm install
npm run preview   # http://localhost:8000 (Zenn プレビュー)
npm run lint      # textlint による日本語の校正
npm run check     # 全ての自動検証チェック (校正 + 本の構成 + Mermaid等)
npm run new:book  # 新しい本の雛形
```

## 注意

- **`config.yaml` の `chapters` に書かれていない章は、zenn.dev 上から削除される**。章を増減したら必ず更新する
- **公開後に slug を変えると URL が変わる**。公開前に確定させる
- 画像は `/images/...` の**絶対パス**で参照する。相対パスは動かない
- Mermaid は1ブロック 2000 文字以内、ノード数 8 以下、1ノードから出る矢印 2本以下、ラベル 1行12文字以下 (3行以下) を静的にチェックします

## 関連

| | |
| --- | --- |
| 標準本文とサイト | https://github.com/Takenori-Kusaka/process-compass |
| 準拠テンプレート | https://github.com/Takenori-Kusaka/pit-in-template |

## ライセンス

原稿は [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.ja)。
