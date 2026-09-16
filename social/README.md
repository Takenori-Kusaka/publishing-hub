# social (SNS配信・投稿管理ディレクトリ)

このディレクトリは、LinkedIn および Bluesky へのSNS配信原稿、投稿定義スキーマ、およびテスト用フィクスチャを管理します。

## ディレクトリ構成
```text
social/
├── README.md                   # このドキュメント
├── schema/
│   └── social-post.schema.json  # 投稿データの検証用 JSON Schema
├── posts/
│   └── *.yaml                  # 実際のSNS配信投稿原稿（1キャンペーン1ファイル）
└── fixtures/
    ├── valid-single.yaml       # 検証パス用の単発投稿フィクスチャ
    ├── valid-thread.yaml       # 検証パス用のスレッド投稿フィクスチャ
    └── invalid/
        ├── invalid-char-count.yaml  # 文字数制限エラー検証用
        └── invalid-schema.yaml      # スキーマ違反エラー検証用
```

## 運用方法
1. 新しい記事や本の章を公開・告知する際は、`social/posts/` 配下に新規の YAML ファイルを作成します。
2. 作成時の `status` は必ず `draft`（下書き）として設定します。
3. PR作成時に `social-check.yml` ワークフローが走り、スキーマ、URLの実在、文字数（Grapheme数）、画像アセットの有無などが機械検査されます。
4. 人間のレビューを受け内容が確定したら、対象のコミットSHAを `revision` に記述して `status` を `ready` に変更します。
5. `main` ブランチにマージされた後、`social-publish.yml` ワークフローを手動起動し、GitHub Environmentでの人間による最終承認の後に各SNSへ安全に自動投稿されます。
