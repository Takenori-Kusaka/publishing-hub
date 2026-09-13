# note 原稿（思想・ナラティブバリアント）

このディレクトリには、note へ配信する原稿を `<id>.md` として置きます。`<id>` は正本（Zenn）から派生したテーマの id で、`social/posts/<id>.yaml` や `platforms/qiita/public/<id>.md` と揃えます。

note の原稿は正本のコピーではありません。読者はプロダクトマネージャーや意思決定者で、生コードや設定ファイルを見に来るわけではないからです。「なぜその技術を選んだのか」「どんな摩擦があり、どう乗り越えたか」を、著者の視点で語るエッセイとして書き直します。

## frontmatter

```yaml
---
title: "note の読者に向けたタイトル（正本と同じにしない）"
status: draft            # draft | ready | published | retired（ready 以降は人間だけが変更する）
source: articles/<id>.md # 正本のパス
canonical_url: https://zenn.dev/takenori_kusaka/articles/<id>
tags: ["個人開発", "技術発信"]
publish_after: "2026-09-20T09:00:00+09:00"
---
```

## 検査

`npm run check:note` と `npm run lint:note` が、次の点を機械的に確認します（詳細は `docs/linting.md`）。

- コードブロック・インラインコード・Mermaid を含まない
- 表・脚注・Zenn コンテナ・HTML・h2/h3 以外の見出しを含まない
- 本文に正本（`canonical_url`）への導線がある
- 1,500〜6,000 字を目安にし、一人称と意思決定を語る言葉がある
- タイトルが正本と同一でない

`scripts/build-note.mjs <id>` は、この検査に通った原稿だけを note 用の HTML / WXR に変換します。
