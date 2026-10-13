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
4. 内容が確定したら、対象のコミットの SHA を `revision` に書き、`status` を `ready` にします（AI を含め誰が行ってもよい。承認は PR のマージです）。
5. `main` ブランチにマージされた後、`campaign.publish_after` の日に `social-publish.yml` が自動で投稿します。このワークフローは毎日 09:00 JST の予定で動き、次の 5 つをすべて満たす原稿を 1 本だけ投稿します（1 回の実行で 1 原稿まで。選ぶ順は予定日の早いもの）。
   - `status` が `ready`
   - `campaign.publish_after` が現在時刻以前
   - `campaign.expires_at` が現在時刻より後
   - その媒体が `enabled: true`
   - その媒体とその原稿に、台帳の記録が 1 件も無い
6. **定期実行は遅れることがあり、その回が動かないこともあります**（GitHub の `schedule` の挙動。正本 9 章）。実測で、このリポジトリの週次の定期実行は 2 回とも約 1 時間 50 分遅れて動きました。予定日に出たかどうかは、人が台帳を見るまで分かりません。
7. 予定日より前に出すときや、送信の前に失敗した原稿を送り直すときは、`social-publish.yml` を手動で起動します。起動は、人と AI のどちらが行ってもかまいません（AGENTS.md 1 章）。起動のときの `source_sha` には、`status: ready` の原稿を含む `main` のコミットの SHA（40 桁）を入れます。原稿の `revision` の値ではありません。`main` 以外のブランチから起動したときや、`source_sha` が `main` に含まれる 40 桁の SHA でないときは、投稿の前に止まります（手順は [README.md](../README.md) 4.5）。
8. 投稿の記録は `social-ledger` ブランチの台帳（`ledger/*.jsonl`）に追記されます。投稿のジョブは投稿の前にこの台帳を作業ツリーへ復元するので、同じ媒体・同じ投稿 ID の原稿を二度投稿しません。
9. 一度その媒体へ届いた記録があると、その原稿はそれ以降どの経路でも投稿できません。届いた記録とは、`published` / `partial` / `pending-unknown` / 人による解決の記録 / 人による媒体側での削除の記録です。逃げ道は手動の起動だけで、`npm run social:publish -- … --allow-repost "<12 文字以上の理由>"` を付けたときに限り、記録を越えて投稿します。理由は台帳の記録（`repost_reason`）に残ります。**定期実行ではこの指定を使いません。**
