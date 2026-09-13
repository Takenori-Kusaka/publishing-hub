# lint/ — 媒体別 linter の規則

配信媒体ごと・題材ごとの検査規則をここに置きます。実装は `scripts/lint/`、設計は [docs/linting.md](../docs/linting.md) です。

```text
lint/
├── channels.json                  媒体の台帳（対象 glob、校正プロファイル、構造ポリシー）
├── textlint/
│   ├── zenn.json                  正本。商業出版の水準 + 学術的な語調
│   ├── qiita.json                 レシピ。短文・断定・「！」禁止
│   ├── note.json                  エッセイ。留保は許す、煽りは抑える
│   ├── social.json                SNS 本文。1 文 100 字、読点 3 つまで
│   └── docs.json                  運用文書。最低限
├── policies/
│   ├── zenn.json                  genre（engineering / process / research / companion / essay）と記述規範
│   ├── qiita.json                 Q1〜Q9 の閾値
│   ├── note.json                  N1〜N8 の閾値
│   ├── social.json                LinkedIn / Bluesky の編集規則
│   ├── variants.json              重複率・導線・節構成(長さは評価しない)
│   ├── disclosure.json            生成AIの利用の開示(docs/ai-disclosure.md)
│   └── expressions.json           煽り表現・複数称・告知型の冒頭（媒体別の強度）
└── terms/
    ├── index.yaml                 スコープ（辞書と適用範囲）
    ├── common.yaml                全媒体共通
    ├── software.yaml              ソフトウェア工学
    ├── pit-in-process.yaml        作品別
    ├── quickscribe-design.yaml
    └── sovereign-resilience-blueprint.yaml
```

規則を変えるときは JSON / YAML を編集し、`npm run check` と `npm test` を通してください。閾値をコードに書かないのは、規則の変更を差分として読めるようにするためです。
