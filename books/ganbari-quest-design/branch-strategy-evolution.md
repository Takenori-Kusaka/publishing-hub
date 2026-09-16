---
title: "第Ⅶ部-2　ブランチ戦略の変遷 ― GitHub flow の 3 か月、develop 二層、動く標的と release ブランチ、hotfix の back-merge"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

main への merge は本番へのデプロイです。この不変条件の下で、ブランチの運用は 3 回変わりました。全 PR を main に出す GitHub flow、develop を挟む二層、そして release ブランチで標的を凍結する方式。この章では、それぞれの契機と、変えなかったもの（main への push が deploy を起動すること）を扱います。

## GitHub flow の 3 か月

2026-03 から 06-05 まで、すべての PR は main に向いていました。main に merge された PR は、3 月 29 本、4 月 652 本、5 月 380 本、6 月の最初の 5 日で 113 本です。4 月は 1 日あたり 20 本を超え、その 1 本 1 本が本番にデプロイされました[^prcounts]。

この期間の事故が、次の形を決めました。2026-04-30 の ADR-0026 は、force push で致命修正が消えた事故です（[第Ⅶ部-1](monorepo-and-artifacts)）。2026-05-20 の #2343 は、36 時間に本番の hotfix 4 本が同じ CI gate に連続して落ちた事故です。「urgency の文脈で品質ゲートを bypass する誘惑が常態化しつつあった」と記録されています。原因は、hotfix の急ぎで PR 本文の雛形を使わず必須の節が欠け、設計書の同期を忘れ、`process.env` を直接参照したことでした[^rationale8]。

そして [第Ⅳ部-3](maker-not-approver) で見た ADR-0022 が、作成者と承認者を分けました。作成は Takenori-Kusaka、承認と merge は lab のアカウント。ここまでは、branch ではなくアカウントで役割を分けていました。

## develop 二層

2026-06-04 の #2858 で、develop が導入されました。契機は CI の待ち時間です。個別の PR ごとに e2e 3 shard（最大 909 秒）、a11y（745 秒）、unit 2 shard、docker、storybook、visual regression を回すと、1 PR あたり 13〜16 分。ソロ開発で最も高価な資源は開発者の集中で、CI 待ちはそれを直接削ります。一方で gate を軽くしたまま main に merge すると、未検証のコードが本番に出ます[^branchstrategy]。

答えは二層です。個別の PR は develop に向け、軽量レーン（lint、unit、PR 本文の gate）で速く回す。develop から main への統合 PR は、重量レーン（e2e、a11y、visual regression、staging deploy）で 1 日 1 回集約検証する。ADR-0007 が定めていた「per-PR の軽量検証と、顧客レビュー直前の総合検証」の 2 層 cadence を、branch の軸で実装したものです。

設計経緯には、興味深い転回があります。deep research は git flow、GitHub flow に CI tiering、trunk-based に Merge Queue の 3 案を一次情報で比較し、「branch を足さずに CI 設定だけで二層化できる」GitHub flow + tiering を推奨しました。それが覆ったのは、PO が外部品質監査チーム（[第Ⅳ部-7](audit-team)）を新設する方針を示したからです。「全件を発露させてから起票し棄却する」レビューを 1 日 1 回の統合 PR に紐付けるには、develop → main という物理的な PR の境界を置いた方が、役割と cadence を分離できる。技術の比較で決まった案が、組織の決定で入れ替わりました[^rationale11]。

最初の develop 向け PR は 2026-06-05 の #2960、最初の統合 PR は翌日の #2968 でした。cutover は無停止で、順序が定められています。docs を先に merge、workflow を改修、develop を作る、数 PR で実測、Ruleset を変更、既存の open PR は retarget しない。ロールバックは develop の削除と workflow の revert だけで、deploy の経路には触れません[^branchstrategy]。

![develop 二層](/images/ganbari-quest-design/branch-strategy-evolution.png)

## 動く標的

二層は、10 日で 1 つ問題を露わにしました。統合 PR を `develop → main` で出すと、PR の HEAD は develop の毎時の merge で動き続けます。[第Ⅳ部-3](maker-not-approver) で見た adversarial evidence は TTL が 30 分で、approve から merge の直前に develop が動くたびに 8 領域の監査が無効化され、再監査のループに陥りました。#3021 で顕在化した「動く標的」問題です[^branchstrategy]。

2026-06-16 の #3063 が、release ブランチ方式を入れました。統合したい develop の特定の commit を凍結し、`release/2026-06-16` のように日付で cut する。以後 develop が進んでも release の HEAD は動かない。監査は凍結された HEAD に対して行い、merge は merge commit で（squash は禁止。develop 上の各 PR は取込時に squash 済みで、統合を squash すると含有 PR の粒度が潰れ、[第Ⅶ部-3](stacked-pr-integration) で見る attestation が成立しない）。merge 後は main から develop へ back-merge する[^branchstrategy]。

release branch は `release-lane-freeze` という Ruleset で force push を禁止されます。監査中に修正が要るなら通常の commit を append し、append したら evidence を再生成して再 approve する。「approve した HEAD と merge する HEAD を必ず一致させる」。AI のレビューに TTL があるなら、レビューの対象は不変でなければならない、という一般則です。

最初の release 方式の統合 PR #3068 は 239 ファイル、+12,578 行でした。以後、release/日付 の branch は 13 本切られ、同じ日に 4 回 cut し直した日もあります（`release/2026-07-24-4`）[^prcounts]。

## hotfix と back-merge

critical な本番修正だけは、main から `fix/*` を切って main に直接出します。gate は省略しません。ADR-0002 の 5 要件（E2E 回帰、AC 全完了、提案全実装、5 年齢モード検証、直近 30 日の重複変更チェック）は緊急でも要求されます。#2343 の 4 連続 fail は、この規律の下で起きた事故でした[^branchstrategy]。

hotfix を main に入れたら、develop にも入れなければ、次の統合で消えます。この back-merge は `hotfix-back-merge.yml` が機械強制します。main への hotfix の merge を契機に、bot が `back-merge/<ref>` の PR を develop 向けに発行する。conflict なら force resolve せず、`status:blocked` の PR と通知で人に渡す。統合 PR の merge は back-merge の契機から除外され、無限ループを防ぎます[^backmerge]。

bot が PR を出すには、名義の問題がありました。`secrets.GITHUB_TOKEN` で PR を作ると author が `github-actions[bot]` になり、[第Ⅶ部-4](actions-portfolio) で見る `pr-author-guard` に auto-close され、しかも下流の CI を起動しません。#3067 で専用の GitHub App を作り、実行ごとに短命の install token を発行する形にしました。長命の個人 PAT は撤廃されました。

## Issue はいつ閉じるか

二層で、Issue の close の意味が変わりました。GitHub の auto-close は、closing keyword が default branch（main）に到達したときだけ発火します。develop への merge では発火せず、しかもこのリポジトリの commit 規約 `fix: #N` はコロンを挟むため closing keyword ではありません[^branchstrategy]。

当初の運用は「develop merge 後も Issue は open のまま保持し、未対応と誤認しないよう注意喚起する」でした。注意力に依存した統制は破れました。open 126 件のうち 53 件が develop で解決済みなのに未対応として危機報告され、4 日間の滞留を生みました。2026-07-30 の改訂で、develop merge の時点で Issue を close して `status:awaiting-release` を付け、main 到達で外す運用になりました。統合 PR は含有 PR の `Closes #N` を集約し、main 反映で取りこぼしを拾う保険です[^branchstrategy]。

「Issue の状態を進捗の代理指標にしない」は、この滞留から私が学んだことです。数字の正しさに統制を移す、という改訂の言葉は、第Ⅳ部で見た「注意力より装置」の別の形です。

## 数字で見る変遷

| 月 | main へ merge | develop へ merge |
| --- | --- | --- |
| 2026-03 | 29 | 0 |
| 2026-04 | 652 | 0 |
| 2026-05 | 380 | 0 |
| 2026-06 | 136 | 231 |
| 2026-07 | 17 | 341 |
| 2026-08 | 9 | 332 |
| 2026-09（16 日まで） | 6 | 105 |

main への merge は、6 月以降は統合 PR と hotfix だけです。7 か月の合計は main 1,229 本、develop 1,009 本。branch-strategy の注記にある「直近 200 PR の base は develop 193 / main 7」は、この構造の実測です[^prcounts]。

## 今ならこうする

順序は正しかったと考えています。最初から git flow を敷いていたら、4 月の 652 本は流れませんでした。GitHub flow で速度を出し、事故が形を教え、監査の体制ができた時点で二層へ移す。branch 戦略は組織に従い、組織が先に変わりました。

「動く標的」は、AI がレビューする開発に固有の教訓です。人のレビューは TTL を持ちませんが、AI の evidence は持ちます。TTL のあるレビューには不変の対象が要る。release ブランチの凍結は、そのための機構でした。

Ruleset の実体を docs に写さない判断（#4403）も正しい。docs にある Ruleset の名前は `PR_Mearge` で、GitHub 側の綴りをそのまま写しています。オーナーはどちらも typo として直すとしていますが、写しは腐ります。設定は設定の場所に置き、docs は「どこにあるか」だけを書く。[第Ⅵ部-1](claude-md-hierarchy) の「掲載しない」と同じ判断が、GitHub の設定にも及んでいます。

[^prcounts]: base 別の merge 数は GitHub の search API（`is:pr is:merged base:main merged:2026-04-01..2026-04-30` 等）で数えた（2026-09-16）。release/* の branch 名は merge 済み PR の head から集計。出典: [Pull requests](https://github.com/Takenori-Kusaka/ganbari-quest/pulls?q=is%3Apr+is%3Amerged+base%3Amain)

[^rationale8]: hotfix PR CI fail 連続再発 防止策の rationale（#2343）。4 PR の fail パターン、4 つの構造的問題、4 層防御。出典: [docs/rationale/08-hotfix-pr-ci-fail-prevention.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/rationale/08-hotfix-pr-ci-fail-prevention.md)

[^branchstrategy]: ブランチ戦略 SSOT。§1 設計背景（CI 待ち 13〜16 分）、§3.1 release ブランチ方式（動く標的、#3063）、§3.2 Issue close 運用（53 / 126 の滞留と 2026-07-30 改訂）、§5 hotfix 経路、§7 Ruleset、§8 無停止 cutover。出典: [docs/sessions/branch-strategy.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/sessions/branch-strategy.md)

[^rationale11]: ブランチ戦略の rationale（#2858）。3 案の比較、一次情報、deep research の推奨が覆った理由。出典: [docs/rationale/11-branch-strategy-rationale.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/rationale/11-branch-strategy-rationale.md)

[^backmerge]: hotfix back-merge の workflow（#2951）と判定の SSOT。出典: [.github/workflows/hotfix-back-merge.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/hotfix-back-merge.yml)、[scripts/hotfix-back-merge.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/hotfix-back-merge.mjs)
