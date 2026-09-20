---
title: "第Ⅱ部-1　技術選定 ― SvelteKit 2、Svelte 5、Ark UI、Drizzle、Valibot と「OSS を先に探す」ルール"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

第Ⅱ部は、アプリケーションの設計を 1 章 1 サブシステムで扱います。最初の章は技術選定です。2026-02-19 の最初の commit は README と CLAUDE.md と AGENTS.md とチケットで、`package.json` は翌日でした。設計書が先で、コードが後です。この章では、そのときに選んだスタックと、7 か月の間に何が変わったか、そして「10 行を超える独自実装の前に OSS を 2 件探す」というルールがどう生まれたかを扱います。

## 選んだもの

現在の `package.json` は、本番依存が 28、開発依存が 68 です。主なものを版とともに並べます[^packagejson]。

| 層 | 選定 | 版 |
| --- | --- | --- |
| フレームワーク | SvelteKit | 2.70 |
| UI | Svelte 5（Runes） | 5.57 |
| UI コンポーネント | Ark UI Svelte | 5.24 |
| スタイル | Tailwind CSS | 4.2 |
| 言語 | TypeScript（strict） | 5.x |
| ORM | Drizzle ORM | 0.45 |
| DB | Aurora DSQL（本番）、PGlite（NUC）、SQLite（テスト） | — |
| バリデーション | Valibot（Zod も 9 ファイルに残存） | 1.4 / 4.5 |
| テスト | Vitest、Playwright | 4.1 / 1.63 |
| lint | Biome、ESLint、Stylelint | 2.4 |
| ビルド | Vite | 8.2 |
| Node | 22 系に固定 | `>=22.22.2 <23` |

表の DB の欄が 3 つあるのは、7 か月で 2 回変わったからです。最初は家庭内の NUC で動かす前提の SQLite、AWS へ載せるときは DynamoDB、そして 2026 年 7 月から Aurora DSQL で、NUC 側は PGlite になりました。経緯は [第Ⅱ部-6](aurora-dsql) と [第Ⅲ部-7](nuc-selfhost) で扱います。

## なぜ SvelteKit だったのか

リポジトリには、フレームワークを比較した記録がありません。最初の commit の README で、SvelteKit 2・Svelte 5・Ark UI は既に決まっていました。比較は着手前に、リポジトリの外で行われています。

判断の軸は、著者によれば 3 つでした。1 つ目は、Lambda に 1 つのパッケージとして載せられること。SvelteKit の `adapter-node` は、サーバとクライアントが 1 つのビルド出力に収まり、[第Ⅲ部-3](lambda-sveltekit) で見るとおりコンテナイメージにそのまま詰められます。同じ成果物が家庭内の NUC でも動くことは、この製品の配布形態（[第Ⅰ部-1](product)）の前提でした。2 つ目は、ホスティングの自由度です。特定のホスティング事業者に最適化されたフレームワークは、そこから出るときにコストがかかります。3 つ目は、軽量で速いこと。Lambda は呼ばれなかったあとの初回起動（cold start）が遅く、フレームワークの起動時間がそのまま顧客の待ち時間に乗ります。Svelte はコンポーネントをコンパイル時に展開し、実行時のランタイムが小さいので、cold start で致命的にならないことを期待しました。

期待どおりだったかは、[第Ⅲ部-3](lambda-sveltekit) と [第Ⅲ部-6](multi-lambda-demo) の実測で見ます。cold start は 1〜2 秒で、Provisioned Concurrency 無しで運用できています。生成AIが書く UI として十分に読みやすいことは、選んだ時点では分からず、7 か月経って分かったことです。

## Svelte 5 を Svelte 5 として書かせる

生成AIに Svelte を書かせると、学習データの多い Svelte 4 の構文が混ざります。開発指針書は Svelte 5 固有のルールを、良い例と悪い例で示しています。`$state`・`$derived`・`$effect` を使い、`$:` のリアクティブ宣言は禁止。TypeScript は `any` を禁止して `unknown` と型ガードを使い、関数の戻り値型を明示し、enum ではなく `as const` と型を使う[^devguide]。

これらは CLAUDE.md にも短く書かれ、CI が守ります。Biome と svelte-check の `--threshold warning` が hard-fail で、Svelte 4 の構文は型検査で落ちます。[第Ⅴ部-2](static-analysis-tiers) で見た自作の ESLint ルール 6 本は、この上に載る規約です。

TypeScript の厳格化には、独立したポリシー文書があります。原則は「プリセットを丸呑みせず cherry-pick する」「big-bang ではなく段階導入し、フラグ有効化で出た違反は同一 PR で 0 にしてから恒久 ON にする」「tsc で拾えない bug class は lint に委譲する」の 3 つです。`noUncheckedIndexedAccess` や `noImplicitReturns` は採用しました。`exactOptionalPropertyTypes` は CDK の型と非互換で AWS が WONTFIX としているため見送りました。`noPropertyAccessFromIndexSignature` は「runtime の安全性を上げない style flag」として見送りです[^tsstrict]。

type-aware の lint（`no-floating-promises` と `no-misused-promises`）は、tsc に等価フラグが無い bug class を捕まえる最高 ROI のルールですが、型プログラムをロードするため重い。だから default の ESLint 設定には載せず、分離した設定で CI 専用の step でだけ走らせます。ローカルと pre-ready の lint は非 type-aware のまま高速に保つ。「両ルールが CI 設定で error、default 設定には載っていない」ことは fitness function が検証しています[^tsstrict]。

## OSS を先に探す

技術選定で最も効いたのは、個々のライブラリの選択ではなく、ADR のテンプレートに置かれた 1 つのルールでした。

> 技術選定・機構設計を伴う ADR では、独自実装する前に OSS / 確立パターンを最低 2 件調査し、その比較を本節に残すこと。「世間が使っているものを見もしないまま独自実装」を構造的に防ぐ。[^adrreadme]

手順は 4 つです。npm と GitHub で既存 OSS を 2 件以上探し、採用実績と最終 commit とライセンスと bundle size を見る。GoF や DDD や Repository のような確立パターンの該当を確認する。見つからなければ「探した範囲」を ADR に明記する。そして「独自実装が 10 行を超えそうなら、先に OSS を探す」。この節を埋めない ADR や Issue は、レビューで `[must]` 指摘になります[^adrreadme]。

生成AIは、ライブラリを探すより自分で書く方を選びがちです。数分で 200 行を書けるからです。第Ⅴ部で見た pixelmatch の採用理由の 1 つは「110 行のコアを再実装する意味が無い」で、DOMPurify の採用理由は「XSS 関連は確立 OSS 必須」でした。このルールが無ければ、どちらも自前実装になっていたと思います。

採用の記録は 1 つの表に集まっています[^adrreadme]。

- BudouX: 日本語の折り返し。CDN で 0KB
- DOMPurify: LP の XSS 防御
- cookie-signature: おやカギの cookie 署名
- Valibot と Standard Schema: マーケットプレイスの schema 検証。Zod v3 比で bundle 92% 削減
- axe-core: E2E のアクセシビリティ検査
- driver.js: ページガイドの positioning
- PGlite: DSQL の integration test 基盤。のちに NUC の本番 DB
- CDK の Firehose L2 construct
- Graphify

不採用の表は、[第Ⅴ部-4](fitness-functions) で見たとおり「不在の証明」列を持ち、現在 0 件です。

Valibot の採用が象徴的です。当初のバリデーションは Zod でした。マーケットプレイスの 5 type の schema を SSOT にするとき、bundle への影響で Valibot を選び、Standard Schema の spec を挟んで将来 Zod や ArkType に切り替える自由を残しました。Zod は 9 ファイルに残っています。全面移行しなかったのは、動いているものを触らない判断です[^adrreadme]。

## 依存とライセンス

依存の更新は Dependabot の週次で、patch と minor は CI 通過で自動 merge、major は手動レビューです。パッケージを足す手順は、ライセンスの確認、bundle size の確認、メンテナンス状態の確認、標準 API で代替できないかの検討の 4 段です[^depspolicy]。供給線の事故と gate は [第Ⅴ部-7](security-scans) で見ました。

ライセンスの方針には、1 つ注記があります。依存として禁止するライセンスに AGPL が挙がっている一方で、がんばりクエスト自身は AGPL-3.0 で公開されています。製品を AGPL にしたのは、企業にただ乗りされないための防止策で、意図した選択です。依存の禁止表は 2026 年 4 月のもので、製品のライセンスより前に書かれました。オーナーの方針は、買収のような話が出たときに表ごと見直す、です[^osslicense]。

## Copilot に渡すはずだった仕事

開発指針書には「Claude Code と GitHub Copilot の使い分け」の表があります。設計文書・アーキテクチャ・複雑なロジック・デプロイ設定は Claude Code が主担当、CRUD の API・DB スキーマ・テストコードは Copilot が実装可能、という分担です。Copilot に渡すチケットの条件も 3 つ書かれています[^devguide]。

この分担は、実際には成立しませんでした。7 か月の commit の共著記録に現れるのは Claude のモデル名だけです。Copilot が実際に担ったのは PR の自動レビューで、2026 年 4 月から 7 月末ごろまでに 781 本の PR へレビューを付けました。しかし PR の量が Copilot の利用上限を超え、レビューは本質に届かず、指示文書を育てて賢くする試行錯誤ののち、費用体系の見直しを機に解約されました。[第Ⅳ部-1](one-human-many-sessions) で見た「一人と複数のロールセッション」の体制は、CRUD から設計まで同じ Claude Code が担う形で固まりました。分担表は、生成AIで開発を始める前に人が想像した形の記録として残っています。

## 今ならこうする

スタックの選定そのものは、変えません。SvelteKit と Svelte 5 は、生成AIが書く UI として十分に読みやすく、Ark UI は headless で primitives を自前で作る土台になりました。Drizzle は方言の壁で一度躓きましたが、それは [第Ⅲ部-7](nuc-selfhost) で見たとおり PGlite が解決しました。

比較の記録をリポジトリに残さなかったことは、後悔しています。着手前の判断は、着手後の判断と違って、書く場所がまだありません。最初の commit に「なぜこれを選んだか」の 1 ファイルがあれば、この節は著者の記憶ではなく出典から書けました。

そして「OSS を先に探す」ルールは、AI に実装を任せる開発で最初に置くべきルールだったと考えています。AI は探すより書きます。書かせる前に探させる規律が無いと、リポジトリは自前実装で埋まります。

[^packagejson]: 依存の一覧と版。出典: [package.json](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/package.json)

[^devguide]: 開発指針書。§3 技術スタック（2026 年 4 月時点の表）、§5 コーディング規約（Svelte 5 固有ルール、TypeScript ルール）、§11 Claude Code / GitHub Copilot の使い分け。出典: [docs/design/05-開発指針書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/05-%E9%96%8B%E7%99%BA%E6%8C%87%E9%87%9D%E6%9B%B8.md)


[^tsstrict]: TypeScript 厳格化ポリシー。設計原則、採用フラグ（アプリと CDK）、type-aware lint の CI 限定の分離、見送りフラグと理由。出典: [docs/design/typescript-strictness-policy.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/typescript-strictness-policy.md)

[^adrreadme]: ADR 一覧。§OSS 先調査ルール、§OSS 採用記録（9 件の表）、§OSS 調査済み・不採用記録。出典: [docs/decisions/README.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/README.md)

[^depspolicy]: 依存関係の管理方針。Dependabot の自動 merge 条件、パッケージ追加の 4 段、lock ファイルの管理。出典: [docs/design/41-依存関係管理方針.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/41-%E4%BE%9D%E5%AD%98%E9%96%A2%E4%BF%82%E7%AE%A1%E7%90%86%E6%96%B9%E9%87%9D.md)

[^osslicense]: OSSライセンスコンプライアンス。許容、注意、禁止の 3 分類（AGPL は禁止に分類）、監査方法。出典: [docs/design/36-OSSライセンスコンプライアンス.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/36-OSS%E3%83%A9%E3%82%A4%E3%82%BB%E3%83%B3%E3%82%B9%E3%82%B3%E3%83%B3%E3%83%97%E3%83%A9%E3%82%A4%E3%82%A2%E3%83%B3%E3%82%B9.md)
