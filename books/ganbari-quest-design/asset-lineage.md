---
title: "第Ⅵ部-7　コード以外の資産の来歴 ― 設計書 46 本、LP 10 ページ、法務 4 文書、プリセット 34、runbook 23 を git で数える"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

コードの来歴は git が持ちます。コード以外の資産も同じ git にあり、同じ方法で数えられます。この章では、設計書、LP、法務文書、マーケットプレイスのプリセット、Discord サーバの設計、runbook、そして rationale と research の初出と改版を、`git log --follow` で並べます。画像アセットは [第Ⅱ部-17](image-assets) で扱ったので、ここでは触れません。数字はすべて 2026-09-16 の main で取り、取り方を脚注に書きます[^method]。

## 波は 3 回

資産は一様には増えていません。3 つの波があります。

![波は 3 回](/images/ganbari-quest-design/asset-lineage.png)

最初の波は 2026-02-19 と 20 日で、[第Ⅵ部-2](design-doc-ssot) で見た 9 本の設計書です。2 つ目は 3 月末で、LP の `index.html`（03-27）、`privacy.html`、`terms.html`、`sla.html`（同日）、`tokushoho.html`（03-31）、そしてデータ保護影響評価書（03-31）。SaaS として公開する準備が、LP と法務から始まっています。3 つ目は 4 月で、`docs/design/` に 25 本が加わりました。DESIGN.md（04-10）、並行実装マップ（04-09）、ADR の README（04-09）、COPPA対応方針書・同意管理設計書・Cookie ポリシー（04-10）、Discord サーバ設計書（04-04）、プリセットの最初のファイル（04-10）[^firstdates]。

5 月は 51 本で最多ですが、その多くは billing-redesign と marketplace の設計書で、[第Ⅱ部-12](billing) と [第Ⅱ部-10](marketplace) で見た作り直しの記録です。7 月の 24 本は `docs/design/dsql/` の m1〜m4 とレビュー台帳で、[第Ⅱ部-4](data-modeling) の形式データモデリングです。8 月は設計書がほぼ増えず、runbook が 7 本増えました。

## 設計書

番号付きの設計書は 46 本、サブディレクトリを含めた `docs/design/` の Markdown は 100 本です。改版の回数を多い順に並べると、UI設計書 239、API設計書 119、データベース設計書 119、セキュリティ設計書 96、AWSサーバレスアーキテクチャ設計書 74、並行実装マップ 72、LP のコンテンツマップ 59、ゲーミフィケーション設計書 39 です[^revisions]。

上位 3 本は初日の 9 本に含まれ、7 か月間ずっと書き換えられています。設計書は SSOT である、という原則が守られた跡です。一方で、COPPA対応方針書は 2 回、同意管理設計書と Cookie ポリシーは 1 回しか改版されていません。2026-04-10 に書かれ、そのままです。対応する `site/privacy.html` は 43 回、`terms.html` は 33 回改版されています。法務の「設計書」と「本文」の改版回数は、20 倍ずれています[^legal]。

削除は 6 本です。ライセンスキーの設計書 4 本（2026-07-17）、アクセシビリティ監査の一時文書（07-16）、import hub のデータモデル原則（05-23）。[第Ⅵ部-3](adr-deletionism) の ADR が 35 本削除されたのに対し、設計書の削除は控えめです。設計書は「現状の正解」を書き換えて生き延び、ADR は決定ごとに増えて削除される。文書の種類で、来歴の形が違います。

## LP と法務文書

LP は 10 ページです。初出と改版回数を並べます。

| ページ | 初出 | 改版 |
| --- | --- | --- |
| index.html | 2026-03-27 | 173 |
| pricing.html | 2026-04-03 | 80 |
| pamphlet.html | 2026-04-03 | 53 |
| privacy.html | 2026-03-27 | 43 |
| faq.html | 2026-04-21 | 42 |
| tokushoho.html | 2026-03-31 | 35 |
| terms.html | 2026-03-27 | 33 |
| sla.html | 2026-03-27 | 29 |
| selfhost.html | 2026-04-17 | 21 |
| graduation.html | 2026-05-06 | 14 |

`index.html` の 173 回は、[第Ⅲ部-8](lp-delivery) で見た SSOT 注入と寸法の ratchet の下で行われました。LP の文言は `labels.ts` から生成されるので、173 回の多くはレイアウトと構造の変更です。法務 4 文書（privacy、terms、tokushoho、sla）は 3 月末にまとめて書かれ、以後 30〜40 回ずつ改版されています。改版のたびに `CURRENT_TERMS_VERSION` を更新する規則が並行実装マップにあり、法務文書と同意の版の整合は test が検査します[^legal]。

## プリセット

マーケットプレイスのプリセットは、`src/lib/data/marketplace/` に 34 ファイルあります。活動パック 12（幼稚園・小学生・中学生・高校生 × 男の子・女の子の 8、チャレンジ 3、スターター 1）、ごほうびセット 10、チェックリスト 3、ルールプリセット 9。最初のファイルは 2026-04-10、最後は 05-19 です。チャレンジセットは `tests/fixtures/` にだけあり、[第Ⅱ部-10](marketplace) で見たとおり陳列から外れています[^presets]。

プリセットは JSON で、[第Ⅱ部-1](stack-selection) で見た Valibot の schema で検証され、3 本の監査文書（活動、ごほうび、チェックリスト）がその内容を審査しています。LP の「120 種類以上の活動」は、このファイル群のユニークな活動名を数えた実数を下回るように CI が検査します。第Ⅴ部で見た LP truth の、プリセット側の根拠です。

## Discord と runbook

Discord サーバの設計書は 2026-04-04 に書かれ、7 回改版されました。有料プラン向けのコミュニティとサポートチャネルとして、無料は入れず、スタンダードは質問チャンネル、ファミリーは優先対応、GitHub Sponsors は限定チャンネル、というロール設計です。サーバの構築・ロール・チャンネルは手作業で、設計書はその手順と根拠です[^discord]。

runbook は 23 本です。最初は 2026-04-24 の Cognito の pool 移行で、以後の分布は 4 月 1 本、5 月 2 本、6 月 6 本。7 月 7 本、8 月 7 本です。7 月は DSQL のアラート対応と restore、PGlite の restore drill。8 月は ops のアラート通知、契約状態の監査の是正、猶予期間の削除の運用、MFA の設定、origin-verify の秘密の rotation、公開前の live drill、返金と課金のインシデント。[第Ⅲ部-5](observability) で見た「アラートが鳴ったらどうするか」は、runbook がある領域とない領域に分かれています[^runbooks]。

runbook は、設計書と違って「現状の正解」ではなく「手順」です。実行されたかどうかは git に残りません。PGlite の restore drill と pre-launch の live drill は、実行の記録を Issue に残す設計です。runbook の来歴は書いた日しか分からず、動いた日は Issue にしかありません。

## rationale と research

rationale は 19 本です。02 のコアループから 19 の越境同意まで、番号は 02〜19 と 2510（活動データの復旧）。01 は運用ルールです。番号の 09 は欠けています。[第Ⅵ部-2](design-doc-ssot) で見たとおり「なぜそう決めたか」を持つ層で、削除されたものはありません。

research は現在 15 本で、これまでに 22 本が追加されました。7 本は削除されています。`docs/CLAUDE.md` の research 配置規律は「役目を終えたら削除する」「one-off の結論は設計書か ADR に内包し、詳細は git に委ねる」です。設計書 6 本、ADR 35 本、research 7 本。削除の数は、その文書の種類が「経緯」にどれだけ近いかに比例しています[^docsclaude]。

## 今ならこうする

この章の表は、すべて `git log --follow` と `git ls-tree` で作りました。人が保守する来歴の表は要りません。設計書のテンプレートにある「改訂履歴」の表は、git が持っている情報の劣化コピーでした。

法務文書の改版回数のずれは、設計書が SSOT でない領域の存在を示しています。COPPA対応方針書が 2 回、`privacy.html` が 43 回。本文が先に変わり、方針書は追いません。[第Ⅰ部-6](legal-by-design) の 2 層（画面の平易語と法務文書の法定記載）に、方針書は含まれていません。方針書を削除するか、本文から生成するかのどちらかです。

波が 3 回あったことは、AI 開発の形を示しています。文書は事故や転換の前後に、まとめて書かれます。2 月は着手、3〜4 月は SaaS 化、7 月は DSQL。日々少しずつではなく、判断のたびに束で。AI は束で書けます。束で書かれた文書が、束のまま古びないように保つのが、第Ⅵ部で見てきた仕事でした。

[^method]: 初出は `git log --follow --format=%ad --date=short -- <file> | tail -1`、改版回数は `git log --oneline --follow -- <file> | wc -l`。月別の追加数は `git log --diff-filter=A --format=%ad --name-only`。2026-09-16、main（3af6c2e）で実行。出典: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest/tree/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0)

[^firstdates]: 各資産の初出は上記の方法で取った。LP の出典は [site/](https://github.com/Takenori-Kusaka/ganbari-quest/tree/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/site)。設計書の出典は [docs/design/](https://github.com/Takenori-Kusaka/ganbari-quest/tree/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design)

[^revisions]: 改版回数の上位。出典: [docs/design/06-UI設計書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/06-UI%E8%A8%AD%E8%A8%88%E6%9B%B8.md)、[docs/design/07-API設計書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/07-API%E8%A8%AD%E8%A8%88%E6%9B%B8.md)、[docs/design/08-データベース設計書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/08-%E3%83%87%E3%83%BC%E3%82%BF%E3%83%99%E3%83%BC%E3%82%B9%E8%A8%AD%E8%A8%88%E6%9B%B8.md)

[^legal]: 法務の設計書 3 本（2026-04-10）と site の法務文書 4 本。版の整合は [tests/unit/services/legal-doc-version-parity.test.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/services/legal-doc-version-parity.test.ts) が検査する。出典: [docs/design/29-COPPA対応方針書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/29-COPPA%E5%AF%BE%E5%BF%9C%E6%96%B9%E9%87%9D%E6%9B%B8.md)、[site/privacy.html](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/site/privacy.html)

[^presets]: プリセット 34 ファイル（activity-packs 12、reward-sets 10、checklists 3、rule-presets 9）。出典: [src/lib/data/marketplace/](https://github.com/Takenori-Kusaka/ganbari-quest/tree/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/data/marketplace)

[^discord]: Discord サーバ設計書（2026-04-04）。目的、方針の表、サーバ基盤、ロールとチャンネル。出典: [Discord サーバ設計書（docs/design/23）](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/23-Discord%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E8%A8%AD%E8%A8%88%E6%9B%B8.md)

[^runbooks]: runbook 23 本の一覧と初出。出典: [docs/runbooks/](https://github.com/Takenori-Kusaka/ganbari-quest/tree/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/runbooks)

[^docsclaude]: docs/CLAUDE.md §docs SSOT 原則の research 配置規律（#3516）。出典: [docs/CLAUDE.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/CLAUDE.md)
