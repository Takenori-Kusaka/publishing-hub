---
title: "第Ⅶ部-4　33 本の自動処理 ― 検査の列で振り分け、必須の検査は消さず、8 本を消した"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

GitHub Actions の自動処理は、`.github/workflows/` に 33 本、合計 8,530 行あります。最大は自動検査の本体 `ci.yml` の 1,446 行、次が本番デプロイの `deploy.yml` の 1,197 行です。生成AIは自動処理を書けますし、書けるものは増えます。33 本を 1 つの系として保つには、何が要るのか。そして、どこで増やすのをやめたのか。

貫いているのは 4 つの原則です。プルリクエストを検査の列で振り分ける。必須の検査を発火条件で消さない。プルリクエストを出す機械名義と、出してはいけない名義を決める。自動処理の定義は薄く保ち、判定はテストできるスクリプトに置く。そして 2026 年 8 月、オーナーの 1 文で 7 本を消しました（4 月の 1 本と合わせて 8 本）。個々の関門の中身は、第Ⅴ部で見たとおりです。

## 33 本の内訳

| 役割 | 本数 | 例 |
| --- | --- | --- |
| プルリクエストの関門 | 11 | `pr-template-gate`（6 処理）、`pr-quality-gate`（4 処理）、`pr-ac-verification-check`、`pr-merge-gate`、`pr-author-guard`、`lp-metrics`、`orphan-check` |
| 自動検査の本体 | 2 | `ci.yml`（22 処理）、`codeql` |
| 見た目の回帰検査 | 3 | 紹介ページ、子供の画面、アプリの 3 層 |
| デプロイ | 5 | `deploy`（AWS の本番）、`deploy-nuc`、`pages`（紹介ページ）、`deploy-aws-staging`、`deploy-nuc-staging` |
| ブランチの機構 | 4 | `integration-pr`、`integration-attest`、`hotfix-back-merge`、`graphify-refresh` |
| 定期 | 8 | `cost-audit`（月次）、`weekly-report`、`close-leak-report`、`code-quality-weekly`、`ac-audit-monthly`、`admin-bypass-evidence`（日次）、`security-scan`（四半期）、`dependabot-auto-merge` |

最初の自動処理は 2026 年 3 月 2 日の `ci.yml` で、本番デプロイは 3 月 17 日、紹介ページの配信は 3 月 27 日です。プルリクエストの関門は 4 月に 8 本が入り、見た目の回帰検査は 5〜6 月、ブランチの機構は [第Ⅶ部-2](branch-strategy-evolution) の二層化と同じ 6 月、ナレッジグラフの更新は 8 月です[^workflows]。

ブランチ戦略の文書には、全自動処理の「関門と検査の列の対応表」があります。各自動処理がどの列で発火し、どの検査の名前を生むか。新しく自動処理を足す人はこの表に必ず 1 行足す、とあります。表は 32 本と書いていますが、実際は 33 本です。かつては表と実体の一致を機械で検証するスクリプトがありましたが、削除され、いまは手動の同期です[^branchstrategy]。

## 検査の列で振り分ける

すべてのプルリクエストは、まず検査の列に分類されます。判定の正本は `scripts/pr-lane.mjs` の 5 つの規則です。規則 1 は機械名義（Dependabot と Renovate）、規則 2 は統合（`release/*` か開発ブランチから本番ブランチへ）、規則 3 は緊急修正（`fix/*` から本番ブランチへ）。規則 4 と 5 は通常の変更（開発ブランチ向け）です。GitHub Actions の部品 `actions/pr-lane` が、この判定を各自動処理に配ります[^prlane]。

部品の置き場所には、GitHub の制約があります。`.github/actions/` に置くと再利用可能な自動処理と誤認されるため、リポジトリの最上位の `actions/` に置く。ところがその配下の `pr-lane/` は、スクリーンショット用に `.gitignore` へ書いた `/pr-*/` と偶然重なります。だから `.gitignore` には `!actions/` の除外解除があります。[第Ⅶ部-1](monorepo-and-artifacts) で見た 160 行の 1 つは、この衝突の記録です。

![プルリクエストが開かれると 1 本のスクリプトが作成者と向き先を見て検査の列を決め、機械名義の更新は自動マージへ、開発ブランチ向けは軽い検査の列へ、本番ブランチ向けは重い検査の列へ送る流れ](/images/ganbari-quest-design/actions-portfolio.png)

`ci.yml` の 22 の処理のうち、重い 6 処理（Storybook、画面操作テスト、利用しやすさ、Cognito、Docker、デモの Lambda）は開発ブランチ向けでは実行を見送り、本番ブランチ向けの統合プルリクエストでは変更されたパスによらず必ず発火します。実行モードとプランの組み合わせを総当たりする画面操作テスト（`e2e-matrix`）は、統合プルリクエストにだけあります。変更されたパスを見る処理は `src/` から `graphify-out/` まで 24 の種類（パスの一致規則）を持ち、その閉包をテストが検査します。規則から漏れたパスの変更で単体テストが見送られないためです[^ciyml]。

## 必須の検査を発火条件で消さない

対応表には、2 つの不変の原則が太字で書かれています。1 つ目は「必須の検査は発火条件で見送ってはならない」。マージに必須として登録した検査の名前を、ブランチやパスの条件で自動処理ごと見送ると、GitHub 側では「報告されない = 保留中」のままマージが永久に止まります。だから必須の名前を生む処理は条件で消さず、処理の内部で全部の列を実行して観点だけを切り替える。2 つ目は「列による分岐は処理の内部で観点を切り替える。全体の見送りは禁止」です[^branchstrategy]。

もう 1 つ、逆向きの注意があります。マージの可否をまとめる処理 `ci-gate` は、失敗と中断だけを数え、見送りを数えません。パスの条件で見送った処理がマージを止めないための、意図された設計です。しかしその結果、「見ていない検査が通ったように見える」。[第Ⅴ部-1](pre-ready) で見たとおり、レビュー待ちにしてよいかの判定は `ci-gate` の緑ではなく、`gh pr checks` で単体テストが通っていることを見ます。見送りは合格ではない、例外なし[^branchstrategy]。

発火条件の設計にも、実測に基づく除外があります。`ci.yml` は、下書きからレビュー待ちへの変更と、本文の編集では発火しません。どちらも同じコミットに対する再実行にしかならず、統合プルリクエストでは 16〜20 分の重い検査の列を丸ごと捨てます。本文を入力にする検査は、軽い関門 4 本（いずれも 10〜40 秒）が本文の編集を契機に動いて担います。この配置はテストが機械で検証します。同じプルリクエストの古い実行を中断するのはプルリクエストの列だけで、本番ブランチへのプッシュの実行は中断しません。短時間にマージが続くと、途中のコミットの検証が欠けるからです[^ciyml]。

## 機械名義にプルリクエストを出させる

機械名義が出すプルリクエストは 4 種あります。統合プルリクエスト、緊急修正の戻しマージ、ナレッジグラフの更新、そして Dependabot の依存関係の更新。前の 3 つは [第Ⅶ部-2](branch-strategy-evolution) で見た GitHub App の短命のトークンを使います。

Dependabot は別の扱いで、自動処理が修正版と小さな版の更新を、自動検査の通過を条件に自動でマージします。ここには 3 つの修正の跡があります。1 つ目は、判定に「操作した人」を使う問題です。人が向き先を変えたりラベルを付けた瞬間に操作者は人に変わり、自動マージが発火しなくなる。だからプルリクエストの作成者で判定する。2 つ目は、人が Dependabot のブランチを作り直すとコミットの署名が失われ、更新内容を読む処理が失敗する問題です。失敗ではなく、自動マージの対象外として見送る。3 つ目は、コミットの記録者の名前を `dependabot[bot]` と比較する判定が、常に人のコミットと誤判定していた問題です。GitHub は機械名義が API で作ったコミットの記録者を、常に GitHub 自身（記録者名 `GitHub`）にします。そこで比較を直しました。直近 5 件のマージ済みの Dependabot のプルリクエストで、自動マージが 1 度も動いていなかった、と実測が書かれています[^dependabot]。

反対に、プルリクエストを出してはいけない名義もあります。作成者を検査する自動処理は、プルリクエストが開かれた瞬間、再び開かれた瞬間、レビュー待ちになった瞬間の 3 回、作成者を見ます。品質保証部のアカウントなら即座に閉じ、違反のコメントを投稿します。[第Ⅳ部-3](maker-not-approver) の「作った者は認めない」を、GitHub 側で強制する関門です。それまでの Claude Code のフックとプッシュ前のフックは手元の環境に依存し、ウェブの画面や API の直接の操作を捕捉できず、実際に 2 度違反が再発しました[^authorguard]。

## 薄い取りまとめ役

ブランチの機構の自動処理は、どれも同じ形をしています。判定は `scripts/*.mjs` の純粋な関数で、単体テスト付き。自動処理の定義は薄い取りまとめ役です。統合プルリクエストの本文は `integration-pr-body.mjs`、戻しマージの判定は `hotfix-back-merge.mjs`。署名付きの記録の中身は `generate-release-predicate.mjs`、閉じ漏れの検出は `close-leak-report.mjs`。本文を組み立てる論理を YAML に散らさない、と各自動処理の冒頭のコメントに書かれています[^integrationyml]。

YAML はテストできず、生成AIが書くと長くなります。`ci.yml` の 1,446 行と `deploy.yml` の 1,197 行は、その例です。`deploy.yml` は、かつてデプロイ前のテストを持っていました。`ci.yml` と完全に重複し、不安定なテストが 2 回走って本番ブランチが詰まる温床だったので、外されました。いまの `deploy.yml` は、ビルド、デプロイ、疎通確認、失敗時の前のイメージへの巻き戻し、そしてプルリクエストの本文から顧客向けのリリースノートを作って Discord に送る処理です。リリースノートの出典はコミットの件名からプルリクエストの「顧客価値」の節に移り、取れなければ止まる形になりました[^deployyml]。

使う部品は、版の名前ではなくコミットの識別子で固定されます。`actions/checkout@3d3c42e5…` のように。それを検査するスクリプトがあり、[第Ⅵ部-4](graphify) で見た Python の依存関係の指紋による固定と同じ思想です[^shapin]。

## 8 本を消す

削除された自動処理は 8 本です。1 本は 2026 年 4 月 25 日のプルリクエストの大きさの検査で、別の処理に統合されました。残る 7 本は 8 月で、オーナーの決定の結果です[^workflows]。

**狙い。** 生成AIの出す 60 点を 100 点へ寄せるために、関門を足し続けていました。

**起きたこと。** 自動処理は 37 本、検査スクリプトは 61 本まで増えました。前身の取り組みは「8 本に絞る」を目標に掲げて、1 本も減らせませんでした。

**なぜ。** オーナーの決定は、理由をこう書いています。「すべてのブロッカーを機械で入れることは不可能だと判断しました。機械的な打ち手は『その打ち手を守る打ち手』を呼び、無限ループになります。目標値を 100 点ではなく 80 点に置きます」[^issue4291]。

**変えたこと。** 61 本の検査スクリプトと 37 本の自動処理を 3 つに振り分けました。A は 80 点のあとの 20 点しか詰めない検査で、削除する。B はリリースの最終レビューで 1 回やれば流出を防げる検査で、統合の列へ移す。C は顧客の金とデータと法務に直結し、プルリクエスト単位でしか判定できないもので、維持する。B が効く理由は、こう書かれています。顧客に届くのは本番ブランチへ入った時点であって、プルリクエストが開発ブランチへ入った時点ではない。流出を止められる最後の地点で 1 回やれば十分な検査を、プルリクエストごとに 1 日何回も回していた。[第Ⅶ部-2](branch-strategy-evolution) の二層は、関門を減らす根拠にもなりました。受入基準は「装置が実際に減ったことで判定する」と書き換えられ、8 月 2 日に監査の実行と GCP の構成の 2 本、8 月 7 日に雛形の節の同期、自動検査の失敗で下書きに戻す処理、Issue を閉じる関門、紹介ページの予備の検査、Zenn の校正の 5 本が消えました。検査スクリプトは 61 本から 45 本になりました[^issue4291]。

**読者のリポジトリでは。** 自動処理の一覧を並べ、それぞれが「顧客に届く最後の地点で 1 回やれば足りる検査か」を問うてください。足りるものは、プルリクエストごとに回す必要がありません。

## 効いたか、足りなかったか

検査の列の分類を 1 つのスクリプトに集め、部品として配る設計は、33 本を 1 つの系として保つ核でした。分類が無ければ、各自動処理が自分の条件で向き先を判定し、判定はずれます。

必須の検査を発火条件で消さない原則は、GitHub 固有の落とし穴を知らないと踏みます。永久に保留中となったとき、初めて踏んだ人には何が起きているか分かりません。原則を設計書に書き、処理の内部で観点を切り替える形に揃えたのは、正しい判断でした。

8 本を消した判断は、この部で最も重要です。生成AIは自動処理を書けます。書けるものは増えます。「その打ち手を守る打ち手」の無限の繰り返しを止めたのは、機械ではなくオーナーの 1 文でした。第Ⅳ部で見た「装置を増やさない」は、この 1 文から始まっています。

## 持ち帰るもの

- プルリクエストの分類を 1 か所に置き、各自動処理に配る。分類が散ると、自動処理ごとに向き先の判定がずれる
- マージに必須の検査を、ブランチやパスの条件で丸ごと見送らない。処理の内部で観点を切り替える。見送りは合格ではない
- 自動処理を足す前に「顧客に届く最後の地点で 1 回やれば足りるか」を問う。足りるなら、プルリクエストごとには回さない

次の部では、7 か月の数字と、事故の記録と、そこから導いた原則を扱います。

[^workflows]: 自動処理の一覧と行数、初出日は `git log --follow` で取った（2026-09-16）。削除は `git log --diff-filter=D -- .github/workflows`。削除された 8 本は次のとおり。`pr-size-check`（2026-04-25、`pr-info` に統合）。`audit-run`、`gcp-terraform`（08-02）。`check-pr-template-sections-sync`、`draft-on-ci-fail`、`issue-close-gate`、`lp-fallback-check`、`zenn-lint`（08-07）。出典: [.github/workflows/](https://github.com/Takenori-Kusaka/ganbari-quest/tree/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows)

[^branchstrategy]: ブランチ戦略の正本。関門と検査の列の対応表（2 つの不変の原則、列の帰属の凡例、全自動処理の対応表。表と実体の一致を検証するスクリプトは #4322 で削除）、レビュー待ちの判定の根拠（見送りは合格ではない）。出典: [docs/sessions/branch-strategy.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/sessions/branch-strategy.md)

[^prlane]: 検査の列の判定の正本と、GitHub Actions の部品。出典: [scripts/pr-lane.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/pr-lane.mjs)、[actions/pr-lane/action.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/actions/pr-lane/action.yml)

[^ciyml]: `ci.yml`（1,446 行、22 処理）。同時実行の設計（#3128）、発火条件の除外（#1218 / #4171）、変更されたパスの型、重い処理の保証発火。出典: [.github/workflows/ci.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/ci.yml)、[scripts/lib/ci/pr-trigger-lane-registry.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/lib/ci/pr-trigger-lane-registry.mjs)

[^dependabot]: Dependabot の自動マージの自動処理（#2947 / #4133 操作者でなく作成者で判定 / #4422 署名の喪失は見送り / #4946 記録者の名前の比較）。出典: [.github/workflows/dependabot-auto-merge.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/dependabot-auto-merge.yml)

[^authorguard]: プルリクエストの作成者を GitHub 側で検査する関門（#1994）。背景、動作、設計判断。出典: [.github/workflows/pr-author-guard.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/pr-author-guard.yml)

[^integrationyml]: 統合プルリクエストの自動処理の冒頭コメント（薄い取りまとめ役の原則）。出典: [.github/workflows/integration-pr.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/integration-pr.yml)

[^deployyml]: 本番デプロイの自動処理（1,197 行）。デプロイ前のテストの撤去（#1277）、巻き戻し、リリースノート（#4883）。出典: [.github/workflows/deploy.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/deploy.yml)

[^shapin]: 部品をコミットの識別子で固定する検査。出典: [scripts/check-action-sha-pin.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/check-action-sha-pin.mjs)

[^issue4291]: Issue #4291「品質ゲートを 80 点主義で削減・移管する」。オーナーの決定、A / B / C の判定基準、やらないこと、受入基準。前身は #4121。出典: [Issue #4291](https://github.com/Takenori-Kusaka/ganbari-quest/issues/4291)
