---
title: "第Ⅵ部-6　Skills as SOP ― 26 の手順書、4 層の影響調査、本番を read-only で歩く、古びた cost-review"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

CLAUDE.md は常時読まれ、設計書は必要なときに読まれます。その間に、もう 1 種類の文書があります。`.claude/skills/` の SKILL.md、26 本。「こういう場面になったら、この手順で、これをやってはいけない」を書いた標準の作業手順書（SOP）です。この章では、skill が 7 か月でどう増えたか、影響調査と実機検証の 2 つの skill が何を手順にしたか、そして数字を持った skill がどう古びたかを扱います。

## 26 本の増え方

最初の 11 本は 2026-04-17 にまとめて作られました。age-mode-check、brand-check、cost-review、customer-voice、db-migration、deploy-verify、flake-hunt、issue-triage、pr-review、pre-pmf-check、regression-check。ロールセッションが定義された直後で、各ロールが繰り返す作業を切り出したものです[^skillsdir]。

以後は事故のたびに増えました。5 月 6 日に dev-open-pr と lp-review、5 月 28 日に adversarial-reviewer と impact-analysis、翌日に cognitive-walkthrough。6 月 4 日に competitive-research と policy-compliance、7 月 31 日に live-ui-verification と ui-defect-hunt。8 月 13 日に po、dev、qm、audit、platform のロール skill 5 本、9 月 12 日に graphify。合計 26 本です[^skillsdir]。

行数は、graphify が 702 行（OSS の同梱物）、dev-open-pr が 373 行、issue-triage が 358 行、ui-defect-hunt が 275 行、live-ui-verification が 225 行、impact-analysis が 220 行。最小は brand-check の 41 行です。

skill の先頭には frontmatter の `description` があり、モデルはこの 1 行を見て「いま使うべきか」を判断します。cost-review なら「AWS costs、pricing impact、budget decisions のとき。Cost Explorer の直接呼び出し（$0.01/request）を禁止」。live-ui-verification なら「【実機・確認型】確認する項目が事前に決まっているとき」。本文は使うときだけロードされます。[第Ⅵ部-1](claude-md-hierarchy) の「常時ロードしない」を、最初から満たしている文書の種類です。

## grep だけで済ませない

impact-analysis は、2026-05-28 の rename（family → premium、license → subscription）で、grep の件数だけを根拠に「影響範囲の調査完了」と書かれた PR を PO が差し戻したことから生まれました。skill の禁止事項の 1 つ目が、その文をそのまま書くことです[^impact]。

手順は 4 層です。L1 構文層は grep と ast-grep で、template literal や dispatch table まで捉える。L2 意味層は ts-morph の `findReferences` で、同名異義を区別し型経由の参照を追う。L3 構造層は knip と dependency-cruiser で、N hop 先の依存と取り残しを見る。L4 は派生 artifact の 22 カテゴリで、人が目視します。DB に保存済みの文字列、CDN のキャッシュ、Stripe の Product、Cognito の group 名（rename 不可）。Help Center、法務文書、branch protection の Required 名、snapshot、過去の Issue（検索性のため更新しない）[^impact]。

22 番目は 2026-07 に足されました。撤去系の「残置参照 sweep」です。撤去した table や stack や workflow step の名前を `.github/workflows`、`scripts`、`infra`、`docs/runbooks` に対して grep し、残置参照 0 を PR で証跡化する。第 17 回リリースの 4 連続 blocker の 5-why の Top 3 が、すべて「撤去したものを参照し続ける何か」でした。[第Ⅱ部-16](ops-console) で見た DynamoDB を scan し続ける週報は、この sweep が見つけるはずの class です[^impact]。

skill は業界の用語も書きます。Change Impact Analysis は Bohner と Arnold の 1996 年の標準用語で、Traceability、Dependency、Experiential の 3 分類を併用する。Slack の channel rename から「name は表示用 alias、内部参照は immutable ID」を学ぶ。AI に手順を渡すとき、その手順が世間の何に相当するかを書いておくと、AI は自分の知識と接続できます。

## 本番を read-only で歩く

live-ui-verification と ui-defect-hunt は、2026-07-31 の release 第 18 回で確立しました。本番の `/admin/subscription` の「⭐⭐ プレミアムへ」ボタンが自分のページを指していて、アップグレードの導線が完全に死んでいた。全 CI 緑、E2E 緑、監査完了のあとに、ブラウザ 1 回で見つかりました[^liveui]。

発見の方法が手順になっています。screenshot ではなく accessibility の snapshot を主にする。snapshot には `href` が出て、screenshot には出ない。「⭐⭐ プレミアムへ」の `/url: /admin/subscription` は、今いるページと同じ。自己リンクは押しても何も起きません。screenshot だけを見ていたら、このボタンは正常に描画されているようにしか見えなかった[^liveui]。

絶対原則は 3 つです。本番では状態が変わらない操作しかしない（ページ遷移、snapshot、フォーム入力は可、Stripe portal を開く、プラン変更、削除は不可）。検証できなかったものを無言で落とさない（`/ops` が 403 で入れず webhook の受信ログは確認できていない、と書く）。認証情報をセッションの外に出さない（gitignore 済みの `tmp/` から読み、screenshot に入力済みのパスワードを写さない）[^liveui]。

ui-defect-hunt は、同じ作法で「何が壊れているか分からない状態から探す」skill です。最初の Step は「機械が既に見ている軸を手で歩かない」。axe が見る a11y、visual regression 3 層が見る見た目、lp-metrics が見る寸法と禁止語は、手で探さない。手で探すのは 8 観点で、最も収穫が多いのは構造と導線です。CTA の自己リンク、同じ遷移先のボタンが 3 か所、dead-end、routes にあるがどこからもリンクされていない画面[^hunt]。

![本番を read-only で歩く](/images/ganbari-quest-design/skills-as-sop.png)

3 つの skill は、実装前、確認型、探索型で分かれ、互いに代替しません。live-ui-verification の「絶対原則」が 3 skill 共通の作法の SSOT で、ui-defect-hunt は「先にそれを読め」で始まります。

## 古びた cost-review

cost-review は最初の 11 本の 1 つで、50 行です。「Year 1 原価枠」の表を持ち、Lambda 500 円、DynamoDB 300 円、S3 と CloudFront 200 円、合計 1,500 円。新機能のチェック項目は「DynamoDB の RCU/WCU が増えるか」。DynamoDB は [第Ⅱ部-6](aurora-dsql) で見たとおり 7 月に撤去され、[第Ⅲ部-1](serverless-cost) で見た実測は月 1〜3 ドルです[^costreview]。

同じ skill の禁止事項は「`aws ce get-cost-and-usage` — $0.01/回課金」です。[第Ⅱ部-16](ops-console) で見たとおり、`/ops/costs` はその API を呼んでいます。skill は AI の手作業を縛りますが、コードは縛りません。規則として残す価値があったのは「DB を直接参照しない」の 1 行だけで、DynamoDB 前提の数字と手順は、書いた日の正解のまま古びました。

dev-open-pr には、もう 1 つの食い違いがあります。skill は `.husky/pre-push` の 4 段の verify chain を「defense in depth 第 4 層」として説明します。ADR-0030 の題名は「pre-ready CLI 採用と pre-push hook 非採用」です。ADR が非採用としたのは重い検査の hook で、`.husky/pre-push` にあるのはアカウントの検証と軽量な verify です。経緯は試行錯誤で、一時期はすべての検査を CI に寄せる方針でしたが、push の前に検査しないと非効率な状態が続き、軽量な pre-push hook を採用しました。矛盾ではありませんが、題名だけを読んだ AI は「pre-push hook は無い」と理解します。ADR の題名は、経緯を知らない読み手にとっては本文より強い主張です[^devopenpr]。

## 今ならこうする

skill は、この本で見た文書の中で、最も生成AI向けの形式です。場面、手順、禁止、そして実例。description の 1 行で必要なときだけロードされ、本文は具体的なコマンドを持ちます。live-ui-verification の「snapshot の `/url` を読む」は、skill が無ければ次のセッションが再発見するしかなかった知識です。

古びるのは数字です。cost-review の 1,500 円と DynamoDB は、書いた日の正解でした。skill は必要なときだけ読まれるので、古びても気づかれません。26 本のうち削除されたものが 0 だったのは、増やす契機（事故）はあっても減らす契機が無かったからです。[第Ⅵ部-3](adr-deletionism) の削除主義が ADR には効いて skill には及ばなかった、というのがこの章の学びです。

[^skillsdir]: skill の一覧と各 SKILL.md の frontmatter。初出日は `git log --diff-filter=A` で取った。出典: [.claude/skills/](https://github.com/Takenori-Kusaka/ganbari-quest/tree/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.claude/skills)

[^impact]: impact-analysis skill。起動タイミング、Bohner & Arnold の 3 分類、L1〜L4 の 4 層、22 カテゴリ checklist（§H 撤去系 #3930）、大規模事例の教訓、禁忌、初版の契機（Epic #2525）。出典: [.claude/skills/impact-analysis/SKILL.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.claude/skills/impact-analysis/SKILL.md)

[^liveui]: live-ui-verification skill。#4139 の経緯、絶対原則 3 つ、snapshot を主とする理由、手順。出典: [.claude/skills/live-ui-verification/SKILL.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.claude/skills/live-ui-verification/SKILL.md)

[^hunt]: ui-defect-hunt skill。既存資産と重複しない範囲の決め方、対象面、8 観点マトリクス。出典: [.claude/skills/ui-defect-hunt/SKILL.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.claude/skills/ui-defect-hunt/SKILL.md)

[^costreview]: cost-review skill（Year 1 原価枠の表、DynamoDB の RCU/WCU、Cost Explorer の禁止）。出典: [.claude/skills/cost-review/SKILL.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.claude/skills/cost-review/SKILL.md)

[^devopenpr]: dev-open-pr skill の push 時自己検証 hook（#2598、4 層 defense in depth）と、ADR-0030「pre-ready CLI 採用と pre-push hook 非採用」。出典: [.claude/skills/dev-open-pr/SKILL.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.claude/skills/dev-open-pr/SKILL.md)、[.husky/pre-push](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.husky/pre-push)、[docs/decisions/0030-pre-ready-cli-and-no-pre-push-hook.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0030-pre-ready-cli-and-no-pre-push-hook.md)
