---
title: "第Ⅴ部-7　セキュリティ検査 ― CodeQL の baseline 台帳、依存の供給線、再導入禁止の grep"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

がんばりクエストが扱うのは子供の記録です。第Ⅴ部の最後は、セキュリティに関わる検査を扱います。ただし、この章は「万全の体制」を書くものではありません。CodeQL を required にしない判断、依存の更新が監査をすり抜けた事故、法務文書にだけ書かれていた約束。生成AIが実装する環境で、何を機械に任せ、何を人が見て、何が見えていなかったかを記録します。

## CodeQL を required にしない

CodeQL は main 向けのプルリクエストと main への push、schedule で走ります。対象は `src/` と `static/`、`package.json` の変更だけで、テストやスクリプト、docs、LP の変更では走りません[^codeqlyml]。

main の branch ruleset で CodeQL を required にはしていません。理由は Pre-PMF の判断です。既知の alert が解消されるまで全プルリクエストが止まり、`src/` 外の CI 補助スクリプト由来のものまで含めると、リリース全停止に見合いません。しかし「required でないから赤でも人の判断で通してよい」ことにはしませんでした。統合監査のたびに人が判断する形は、外形が admin bypass と区別できません。実際に統合 PR #4152 では、監査自身が入れた `js/incomplete-url-substring-sanitization` を判断で流しかけました[^codeqlcheck]。

代わりに置いたのが機械条件です。統合 PR の ref 由来の open alert が baseline を 1 件も超えないこと。baseline は `(rule, path)` の組と `count` で pin する台帳で、a11y の baseline と同型です。

| 規則 | 内容 |
| --- | --- |
| 受容 | 台帳の組は count まで受容。超過分は new alert として fail |
| 未登録 | 台帳に無い組の alert は 1 件で fail |
| `src/` の禁止 | 顧客経路の alert を台帳に載せることは禁止。台帳の検証自体が fail する |
| 解消トリガー | 全 entry に `resolutionTrigger` 必須。日付ではなく「その file を次に触るとき」 |
| 検査不能 | 対象 ref の analysis が 0 件、または API 取得に失敗したら fail |

`src/` の禁止は 2026-08-01 の PO 決裁で、顧客経路の alert に「受容」の選択肢を作らないためです。検査不能を fail にするのは、[第Ⅴ部-5](visual-regression) のペア 0 件 skip と同じ class を作らないためです[^branchstrategy]。

CodeQL の指摘は、gate のコードにも痕跡を残しています。[第Ⅴ部-6](pr-body-gates) の HTML コメント除去が不動点まで繰り返すのは `js/incomplete-multi-character-sanitization` への対応で、`--!>` を閉じタグとして扱うのは `js/bad-tag-filter` への対応です。装置のコードも顧客経路と同じ scanner で見られています。

## 依存の供給線

依存の更新は、監査をすり抜ける経路になりえます。2026 年 6 月、better-sqlite3 の 12.11.1 を含む Dependabot の更新が main へ直行し、develop の軽量レーンと 8 領域の監査をすり抜けて、統合監査で SIGSEGV を起こしました。`target-branch: develop` は設定してありましたが、その実効性は機械で検証されていませんでした[^depguard]。

対処は 3 つで、`ci.yml` の supply chain job にまとまっています。Dependabot の設定の全 ecosystem が `target-branch: develop` を持つことを YAML の parse で検証する。better-sqlite3・bcrypt・sharp の native binding が読み込めることを軽量レーンで smoke する。SIGSEGV を起こさない版への pin からの逸脱を `package.json` と lock で静的に捕まえる[^ciyml]。

ただし、security update は別経路で来ます。Dependabot の設定ファイルには、adversarial review で実測した注記があります。security 経路は `target-branch` を無視して default branch の main に直行する。設定を入れた 2026-06-17 以降の Dependabot PR は 70 件で、develop 60 件、main 10 件。main 側 10 件のうち security 経路が 6 件、残り 4 件は設定が届く前の version update です。「CVE が出れば bump PR は来る。ここで閉じているのは定期の version update だけ」と、閉じた範囲を限定して書いています[^dependabot]。

`package.json` を変えるプルリクエストでは dependency-review が走り、既知の脆弱性を持つ依存の追加を止めます。これは develop 向けでも発火する軽量レーンです[^deprev]。Dependabot の PR は auto-merge しますが、対象は `dependabot[bot]` だけで renovate は含めません。判定は PR の作成者で行います。actor で判定すると、人間が base を変えたりラベルを付けたりした瞬間、actor が人間に変わり、auto-merge が発火しなくなるからです[^automerge]。

四半期ごとに `npm audit` を走らせ、結果を Issue に起票する workflow もあります。high と critical は個別の Issue、moderate と low は 1 つのサマリー Issue に集約し、GHSA / CVE の id をタイトルに含めて既存の open Issue と重複しないようにします。osv-scanner と semgrep はローカルの手動実行で、必須ではありません[^secscan]。

## 高権限 Actions の SHA pin

GitHub Actions 自体も供給線です。secret の消費・provenance の発行・本番 AWS role の assume・image の build と push・PR の auto-merge。こうした高権限の Actions は、`@v3` のような floating tag ではなく full-length の commit SHA で pin します。tag の付け替えによる注入を防ぐためです[^secdesign]。

手動の列挙は treadmill になります。#3318 から #3457、#3483 と手動で追加を続けた root は、「新規の高権限 third-party action を未 pin で導入しても silent に通る」網羅漏れでした。対処は default-deny です。任意の permission scope に write を宣言する workflow 内の third-party action は SHA pin 必須とし、floating を許容するものは理由付きの allowlist に明示します。write のクラスを列挙する方式も、issues や pages や security-events が列挙外という別の treadmill を生んだため、全 write scope を generic に lock しました[^secdesign]。

この gate は「default の GITHUB_TOKEN は read-only」を前提にします。前提が崩れないよう、全 workflow に top-level の `permissions:` 宣言を必須化して default token に依存する workflow を構造的に排除し、repo 設定の実測はオーナーがローカルで assert します。残余リスクは 3 点が明記されています。first-party の floating tag の供給元信頼、allowlist の例外判断の誤り、実測 assert が opt-in で連続実行されないこと。いずれも Pre-PMF で許容しています[^secdesign]。

## 再導入を grep で禁じる

3 つ目の層は、リポジトリ内を grep する小さなスクリプト群です。ADR-0007 の階層で言えば T1 の PR gate で、どれも数秒で終わります。

**license key の再導入禁止**。ライセンスキーは 2026 年 6 月に全廃されましたが、LP、メール、ラベル、UI のどこからでも概念が再導入されえます。`src/` と `site/` で `licenseKey` や `LICENSE_KEY` などの参照を grep し、コメント行以外で 1 件でもあれば fail します。allowlist に残るのは旧 URL の redirect 表だけで、ブックマーク維持のため永久保持されるからです。課金プランの enum は license と無関係でしたが、命名に `license` を含んでいたため `SUBSCRIPTION_PLAN` に rename し、その語彙も検出対象に加えました[^licleak]。

**env の直接参照禁止**。`process.env.X` と `$env/dynamic/private` の読み込みは `src/lib/runtime/env.ts` だけに許します。採択時点で直接参照していたファイルは grandfather list に凍結し、新規追加は禁止です。列挙は「P4 完了時にゼロ」の予定と書かれたまま残っています[^envaccess]。

**必須 env の配布証跡**。PR の diff から「production で必須になった env」を検出し、本文に「配布済み:」の証跡が無ければ fail します。当初は新規追加の env だけを見ていましたが、2026-07-31 に既存の `CRON_SECRET` が backup コンテナの hard requirement になった変化を素通りし、NUC の日次バックアップが毎晩失敗して発覚まで 18 日かかりました。以後、optional から required への変化（`.optional()` の除去、既定値の撤去、CDK の silent skip 撤去）も見ます。スクリプトの冒頭には「検出できない範囲」が 5 項目列挙されています。diff 外での必須化、アプリ外の消費者、条件付き必須、動的な env 名、配布先の実在。「黙って守れていることにしない」ための明示です[^newenv]。

**shell の fail-open**。GitHub Actions の `run:` は既定で `bash -e` なので、`$?` を見て fail-open するつもりの分岐に到達しません。PR のレーン判定でこれが起き、API の一過性の失敗で gate が hard-fail しました。`$?` を参照する run ブロックは同じブロック内で `set +e` を明示することを要求します[^shellguard]。

![再導入を grep で禁じる](/images/ganbari-quest-design/security-scans.png)

## 一度きりのレビュー

機械の検査とは別に、2026-03-31 に Security Agent（Claude Opus 4.6）による手動のコードレビューが 1 回あります。対象は認証と認可の middleware、Cognito の provider、Stripe 連携、ログインフロー、48 の API endpoint、ファイルアップロード、rate limiter、CDK の 4 stack、ops 画面。手法は OWASP Top 10 2021 と PCI DSS v4.0 SAQ A への適合性評価です[^secreview]。この報告書は `docs/security/` に残っていますが、その後の変更に追随していません。定期化もされていません。

## 今ならこうする

まず、見えていなかったものを書きます。リポジトリの workflow には gitleaks のような secret scanner がありません。ログに平文の secret や PII が出る事故は 2026 年 9 月にも起きていて（おやカギコードと保護者メールが CloudWatch に出た件）、これは静的検査では捕まらない class でした。ログの設計はアプリケーションの部で扱います。

セキュリティ設計書の §11.4 には「コミット前チェック: Biome lint + svelte-check + Vitest + Playwright E2E」と書かれていますが、[第Ⅳ部-8](platform-session) で見たとおり commit hook での重い検査は ADR-0030 で退けられています。設計書のこの節は古いままです。

CodeQL の baseline 台帳は、うまくいった判断だと考えています。required にできない現実と、「赤でも通す」を人の判断にしない規律を、台帳と解消トリガーで両立させました。`src/` を台帳に載せられない規則は、Pre-PMF で受容する範囲を「顧客経路以外」に限定する線で、この線は他の gate にも引くべきでした。

供給線の話は、生成AI固有ではありません。ただ、AI が書いた `target-branch: develop` の設定は「効いているはず」と扱われ、実効性は SIGSEGV で初めて検証されました。この経緯は、[第Ⅳ部-5](sixty-to-hundred) の「配線の確認は実装の確認ではない」の実例です。設定を書くことと、設定が効いていることを機械で言えることは別です。

[^codeqlyml]: CodeQL の workflow。concurrency の設計（main push の per-commit scan を保全）、trigger と paths の限定。出典: [.github/workflows/codeql.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/codeql.yml)

[^codeqlcheck]: CodeQL の new alert 0 件を機械条件にする検査。required にしない経緯、統合 PR #4152 の実例、判定規則（台帳、`src/` 禁止、`resolutionTrigger`、検査不能を fail）。出典: [scripts/audit/check-codeql-alerts.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/audit/check-codeql-alerts.mjs)。台帳本体は [scripts/audit/codeql-baseline.json](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/audit/codeql-baseline.json)

[^branchstrategy]: ブランチ戦略 §4「CodeQL の扱い」。required にしない理由、代わりに満たすべき条件、検査主体、台帳、`src/` の禁止（PO 決裁 2026-08-01）、解消トリガー、NG-0 条件への組み込み。出典: [docs/sessions/branch-strategy.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/sessions/branch-strategy.md)

[^depguard]: Dependabot の target-branch を検証する regression guard。#3158 が main へ直行し統合監査で SIGSEGV を起こした経緯。出典: [scripts/check-dependabot-target-branch.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/check-dependabot-target-branch.mjs)

[^ciyml]: CI の `deps-supply-chain-check` job。target-branch guard、native dependency smoke、SIGSEGV-safe pin の静的捕捉。出典: [.github/workflows/ci.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/ci.yml)

[^dependabot]: Dependabot の設定。ecosystem ごとの `target-branch: develop`、security 経路が main に直行する実測（2026-06-17 以降 70 件の内訳）、閉じている範囲の限定。出典: [.github/dependabot.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/dependabot.yml)

[^deprev]: dependency-review の workflow。trigger（main と develop、package.json と lock の変更）。出典: [.github/workflows/dependency-review.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/dependency-review.yml)

[^automerge]: Dependabot の auto-merge。対象を `dependabot[bot]` に限定する理由、PR 作成者で判定する理由。出典: [.github/workflows/dependabot-auto-merge.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/dependabot-auto-merge.yml)

[^secscan]: 四半期の security scan。`npm audit` の実行と Issue 起票。出典: [.github/workflows/security-scan.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/security-scan.yml)。起票の規則は [scripts/security-findings-to-issues.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/security-findings-to-issues.mjs)、ツールの位置付けは [docs/security/scan.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/security/scan.md)

[^secdesign]: セキュリティ設計書 §11.3 シークレット管理、§11.4 CI/CD セキュリティ（高権限 Actions の SHA pin、網羅性 gate の default-deny、write クラス列挙の廃止、default token 前提の 2 層担保、残余リスク 3 点）。出典: [docs/design/14-セキュリティ設計書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/14-セキュリティ設計書.md)

[^licleak]: license key の再導入防止 guard。検出パターン、`SUBSCRIPTION_PLAN` への rename、allowlist の設計（redirect 表の永久保持、コメント行の許容）。出典: [scripts/check-license-key-leak.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/check-license-key-leak.mjs)

[^envaccess]: env の直接参照を禁じる検査。SSOT のファイル、grandfather list の凍結。出典: [scripts/check-no-direct-env-access.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/check-no-direct-env-access.mjs)

[^newenv]: 必須化された env の配布証跡チェック。検出範囲の 5 パターン、optional から required への変化を見る理由（`CRON_SECRET` の 18 日）、検出できない範囲の明示。出典: [scripts/check-new-required-env.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/check-new-required-env.mjs)

[^shellguard]: shell の fail-open を守るテスト。`bash -e` の挙動、レーン判定で起きた実害、`set +e` の要求。出典: [tests/unit/architecture/ci-shell-fail-open-guard.test.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/ci-shell-fail-open-guard.test.ts)

[^secreview]: 2026-03-31 のセキュリティコードレビュー報告書。対象範囲、手法、脅威モデル。出典: [docs/security/security-code-review-2026-03.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/security/security-code-review-2026-03.md)
