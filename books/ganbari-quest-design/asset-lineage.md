---
title: "第Ⅵ部-7　コード以外の資産の来歴 ― 設計書 46 本、紹介ページ 10 ページ、法務 4 文書、プリセット 34、手順書 23 を git で数える"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

コードがいつ書かれ、何回変わったかは git が持っています。しかし、リポジトリにはコード以外の資産も同じくらいあります。設計書、紹介ページ、法務文書、みんなのテンプレート（テンプレートの共有機能）のプリセット、Discord サーバの設計、手順書。これらの来歴は、誰が、どこに持つのか。人が保守する「改訂履歴」の表は、要るのか。

要りません。コード以外の資産も同じ git にあり、同じコマンドで数えられます。数えてみると、資産は日々少しずつではなく、事故や転換の前後に束で書かれていました。画像アセットの来歴は [第Ⅱ部-17](image-assets) にあります。数字はすべて 2026 年 9 月 16 日の本番ブランチで取りました[^method]。

## 波は 3 回

資産は一様には増えていません。3 つの波があります。

![資産は 2026 年 2 月の着手、3 月の公開準備、4 月の方針決めの 3 つの波で束になって書かれ、5 月の作り直し、7 月の Aurora DSQL、8 月の手順書が続く](/images/ganbari-quest-design/asset-lineage.png)

最初の波は 2026 年 2 月 19 日と 20 日で、[第Ⅵ部-2](design-doc-ssot) で見た 9 本の設計書です。2 つ目は 3 月末で、紹介ページの `index.html`（3 月 27 日）、`privacy.html`、`terms.html`、`sla.html`（同日）、`tokushoho.html`（3 月 31 日）、そしてデータ保護影響評価書（3 月 31 日）。ウェブで提供する製品として公開する準備が、紹介ページと法務から始まっています。3 つ目は 4 月で、`docs/design/` に 25 本が加わりました。`DESIGN.md`（4 月 10 日）、並行実装マップ（4 月 9 日）、設計判断の記録の一覧（4 月 9 日）、COPPA対応方針書・同意管理設計書・Cookie ポリシー（4 月 10 日）、Discord サーバ設計書（4 月 4 日）、プリセットの最初のファイル（4 月 10 日）[^firstdates]。

5 月は 51 本で最多ですが、その多くは課金の作り直しとみんなのテンプレートの設計書で、[第Ⅱ部-12](billing) と [第Ⅱ部-10](marketplace) で見た作り直しの記録です。7 月の 24 本は `docs/design/dsql/` の `m1`〜`m4` とレビュー台帳で、[第Ⅱ部-4](data-modeling) の形式データモデリングです。8 月は設計書がほぼ増えず、手順書が 7 本増えました。

## 設計書

番号付きの設計書は 46 本、サブディレクトリを含めた `docs/design/` の Markdown は 100 本です。改版の回数を多い順に並べると、UI設計書 239、API設計書 119、データベース設計書 119、セキュリティ設計書 96、AWSサーバレスアーキテクチャ設計書 74、並行実装マップ 72、紹介ページのコンテンツマップ 59、ゲーミフィケーション設計書 39 です[^revisions]。

上位 3 本は初日の 9 本に含まれ、7 か月間ずっと書き換えられています。設計書は正本である、という原則が守られた跡です。一方で、COPPA対応方針書は 2 回、同意管理設計書と Cookie ポリシーは 1 回しか改版されていません。2026 年 4 月 10 日に書かれ、そのままです。対応する `site/privacy.html` は 43 回、`terms.html` は 33 回改版されています。法務の「設計書」と「本文」の改版回数は、20 倍ずれています[^legal]。

削除は 6 本です。ライセンスキーの設計書 4 本（2026 年 7 月 17 日）、アクセシビリティ監査の一時文書（7 月 16 日）、取り込み画面のデータモデル原則（5 月 23 日）。[第Ⅵ部-3](adr-deletionism) の設計判断の記録が 35 本削除されたのに対し、設計書の削除は控えめです。設計書は「現状の正解」を書き換えて生き延び、設計判断の記録は決定ごとに増えて削除される。文書の種類で、来歴の形が違います。

## 紹介ページと法務文書

紹介ページは 10 ページです。初出と改版回数を並べます。

| ページ | 初出 | 改版 |
| --- | --- | --- |
| `index.html` | 2026-03-27 | 173 |
| `pricing.html` | 2026-04-03 | 80 |
| `pamphlet.html` | 2026-04-03 | 53 |
| `privacy.html` | 2026-03-27 | 43 |
| `faq.html` | 2026-04-21 | 42 |
| `tokushoho.html` | 2026-03-31 | 35 |
| `terms.html` | 2026-03-27 | 33 |
| `sla.html` | 2026-03-27 | 29 |
| `selfhost.html` | 2026-04-17 | 21 |
| `graduation.html` | 2026-05-06 | 14 |

`index.html` の 173 回は、[第Ⅲ部-8](lp-delivery) で見た正本からの注入と寸法の歯止めの下で行われました。紹介ページの文言は `labels.ts` から生成されるので、173 回の多くはレイアウトと構造の変更です。法務 4 文書（`privacy.html` のプライバシーポリシー、`terms.html` の利用規約、`tokushoho.html` の特定商取引法の表示、`sla.html` のサービス水準）は 3 月末にまとめて書かれ、以後 30〜40 回ずつ改版されています。改版のたびに `CURRENT_TERMS_VERSION` を更新する規則が並行実装マップにあり、法務文書と同意の版の整合はテストが検査します[^legal]。

## プリセット

みんなのテンプレートのプリセットは、`src/lib/data/marketplace/` に 34 ファイルあります。活動パック 12（幼稚園・小学生・中学生・高校生 × 男の子・女の子の 8、チャレンジ 3、スターター 1）、ごほうびセット 10、チェックリスト 3、ルールプリセット 9。最初のファイルは 2026 年 4 月 10 日、最後は 5 月 19 日です。チャレンジセットは `tests/fixtures/` にだけあり、[第Ⅱ部-10](marketplace) で見たとおり陳列から外れています[^presets]。

プリセットは JSON で、[第Ⅱ部-1](stack-selection) で見た Valibot の型定義で検証され、3 本の監査文書（活動、ごほうび、チェックリスト）がその内容を審査しています。紹介ページの「120 種類以上の活動」は、このファイル群のユニークな活動名を数えた実数を下回るように自動検査が検査します。第Ⅴ部で見た「紹介ページの記述は実装の事実に従う」の、プリセット側の根拠です。

## Discord と手順書

Discord サーバの設計書は 2026 年 4 月 4 日に書かれ、7 回改版されました。有料プラン向けのコミュニティとサポート窓口として、無料は入れず、スタンダードは質問チャンネル、ファミリーは優先対応、GitHub Sponsors は限定チャンネル、という役割設計です。サーバの構築、役割、チャンネルは手作業で、設計書はその手順と根拠です[^discord]。

手順書は 23 本です。最初は 2026 年 4 月 24 日の Cognito の利用者プールの移行で、以後の分布は 4 月 1 本、5 月 2 本、6 月 6 本。7 月 7 本、8 月 7 本です。7 月は Aurora DSQL の警報への対応と復元、PGlite の復元の予行。8 月は運用の警報の通知、契約状態の監査の是正、猶予期間の削除の運用、多要素認証の設定、`origin-verify` の秘密の更新、公開前の本番での予行、返金と課金の事故。[第Ⅲ部-5](observability) で見た「警報が鳴ったらどうするか」は、手順書がある領域とない領域に分かれています[^runbooks]。

手順書は、設計書と違って「現状の正解」ではなく「手順」です。実行されたかどうかは git に残りません。PGlite の復元の予行と公開前の予行は、実行の記録を Issue に残す設計です。手順書の来歴は書いた日しか分からず、動いた日は Issue にしかありません。

## 設計理由の記録と調査資料

設計理由の記録は 19 本です。02 のコアループから 19 の越境同意まで、番号は 02〜19 と 2510（活動データの復旧）。01 は運用ルールです。番号の 09 は欠けています。[第Ⅵ部-2](design-doc-ssot) で見たとおり「なぜそう決めたか」を持つ層で、削除されたものはありません。

調査資料は現在 15 本で、これまでに 22 本が追加されました。7 本は削除されています。`docs/CLAUDE.md` の配置規律は「役目を終えたら削除する」「1 回限りの結論は設計書か設計判断の記録に内包し、詳細は git に委ねる」です。設計書 6 本、設計判断の記録 35 本、調査資料 7 本。削除の数は、その文書の種類が「経緯」にどれだけ近いかに比例しています[^docsclaude]。

## 効いたことと、足りなかったこと

ここまでの表は、すべて `git log --follow` と `git ls-tree` で作りました。人が保守する来歴の表は要りません。設計書のテンプレートにある「改訂履歴」の表は、git が持っている情報の劣化した写しでした。

法務文書の改版回数のずれは、設計書が正本でない領域の存在を示しています。COPPA対応方針書が 2 回、`privacy.html` が 43 回。本文が先に変わり、方針書は追いません。[第Ⅰ部-6](legal-by-design) の 2 層（画面の平易な言葉と法務文書の法定記載）に、方針書は含まれていません。本文から生成されない方針書は、正本の座を本文に譲ったまま残りました。

波が 3 回あったことは、生成AIとの開発の形を示しています。文書は事故や転換の前後に、まとめて書かれます。2 月は着手、3〜4 月は公開の準備、7 月は Aurora DSQL。日々少しずつではなく、判断のたびに束で。生成AIは束で書けます。束で書かれた文書が、束のまま古びないように保つのが、第Ⅵ部で見てきた仕事でした。

## 持ち帰るもの

- 来歴の表を人が保守しない。初出と改版回数は git に聞く
- 改版回数が極端に少ない文書を探す。それは正本でなくなった文書か、正本が別の場所に移った文書の印
- 文書は束で書かれると想定し、束のまま古びないための仕組み（削除、実在の検査、経緯の分離）を先に置く

次の章からは第Ⅶ部です。生成物の置き場、ブランチの運用の変遷、機械が発行する統合プルリクエスト、自動処理の全体設計といった、リポジトリと git の運用を扱います。

[^method]: 初出は `git log --follow --format=%ad --date=short -- <file> | tail -1`、改版回数は `git log --oneline --follow -- <file> | wc -l`。月別の追加数は `git log --diff-filter=A --format=%ad --name-only`。2026-09-16、main（3af6c2e）で実行。出典: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest/tree/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0)

[^firstdates]: 各資産の初出は上記の方法で取った。紹介ページの出典は [site/](https://github.com/Takenori-Kusaka/ganbari-quest/tree/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/site)。設計書の出典は [docs/design/](https://github.com/Takenori-Kusaka/ganbari-quest/tree/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design)

[^revisions]: 改版回数の上位。出典: [docs/design/06-UI設計書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/06-UI%E8%A8%AD%E8%A8%88%E6%9B%B8.md)、[docs/design/07-API設計書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/07-API%E8%A8%AD%E8%A8%88%E6%9B%B8.md)、[docs/design/08-データベース設計書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/08-%E3%83%87%E3%83%BC%E3%82%BF%E3%83%99%E3%83%BC%E3%82%B9%E8%A8%AD%E8%A8%88%E6%9B%B8.md)

[^legal]: 法務の設計書 3 本（2026-04-10）と `site/` の法務文書 4 本。版の整合は [tests/unit/services/legal-doc-version-parity.test.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/services/legal-doc-version-parity.test.ts) が検査する。出典: [docs/design/29-COPPA対応方針書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/29-COPPA%E5%AF%BE%E5%BF%9C%E6%96%B9%E9%87%9D%E6%9B%B8.md)、[site/privacy.html](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/site/privacy.html)

[^presets]: プリセット 34 ファイル（活動パック 12、ごほうびセット 10、チェックリスト 3、ルールプリセット 9）。出典: [src/lib/data/marketplace/](https://github.com/Takenori-Kusaka/ganbari-quest/tree/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/data/marketplace)

[^discord]: Discord サーバ設計書（2026-04-04）。目的、方針の表、サーバ基盤、役割とチャンネル。出典: [Discord サーバ設計書（docs/design/23）](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/23-Discord%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E8%A8%AD%E8%A8%88%E6%9B%B8.md)

[^runbooks]: 手順書 23 本の一覧と初出。出典: [docs/runbooks/](https://github.com/Takenori-Kusaka/ganbari-quest/tree/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/runbooks)

[^docsclaude]: `docs/` の指示書の「docs SSOT 原則」にある調査資料の配置規律（#3516）。出典: [docs/CLAUDE.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/CLAUDE.md)
