---
title: "第Ⅴ部-7　安全の検査 ― CodeQL の台帳、依存の供給線、再導入を禁じる検索"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

がんばりクエストが扱うのは子供の記録です。安全に関わる検査は万全にしたいところですが、顧客が付く前の段階で、全部を必須の検査にはできません。何を機械に任せ、何を人が見て、何が見えていなかったのか。

必須にできない検査は「赤でも通す」を人の判断にせず、台帳で機械の条件にしました。依存の更新は、設定が効いていることを機械で言えるまで信じないことにしました。そして、秘密情報のログへの漏れは見えていませんでした。

## CodeQL を必須の検査にしない

CodeQL は本番ブランチ向けのプルリクエストと本番ブランチへのプッシュ、それに定期の予定で走ります。対象は `src/` と `static/`、`package.json` の変更だけで、テストやスクリプト、文書、紹介ページの変更では走りません[^codeqlyml]。

本番ブランチの保護規則で CodeQL を必須にはしていません。理由は顧客が付く前の段階の判断です。既知の指摘が解消されるまで全プルリクエストが止まり、`src/` の外にある自動検査の補助スクリプト由来の指摘まで含めると、リリースの全停止に見合いません。しかし「必須でないから赤でも人の判断で通してよい」ことにはしませんでした。統合の監査のたびに人が判断する形は、外形が管理者権限による迂回と区別できません。実際にある統合プルリクエストでは、監査自身が入れた指摘を判断で流しかけました[^codeqlcheck]。

代わりに置いたのが機械の条件です。統合プルリクエストの参照先に由来する未解決の指摘が、台帳を 1 件も超えないこと。台帳は規則とファイルの組と件数を固定する記録で、利用しやすさの検査の基準値と同型です。

| 規則 | 内容 |
| --- | --- |
| 受容 | 台帳の組は件数まで受容する。超過分は新しい指摘として落とす |
| 未登録 | 台帳に無い組の指摘は 1 件で落とす |
| `src/` の禁止 | 顧客の経路の指摘を台帳に載せることは禁止。台帳の検証自体が落ちる |
| 解消の引き金 | 全項目に `resolutionTrigger` が必須。日付ではなく「そのファイルを次に触るとき」 |
| 検査不能 | 対象の参照先の解析が 0 件、または API の取得に失敗したら落とす |

`src/` の禁止は 2026 年 8 月 1 日の企画部の決裁で、顧客の経路の指摘に「受容」の選択肢を作らないためです。検査不能を落とすのは、[第Ⅴ部-5](visual-regression) の組が 0 件の見送りと同じ型の不具合を作らないためです[^branchstrategy]。

CodeQL の指摘は、関門のコードにも痕跡を残しています。[第Ⅴ部-6](pr-body-gates) の HTML コメントの除去が変化しなくなるまで繰り返すのは `js/incomplete-multi-character-sanitization` への対応で、`--!>` を閉じタグとして扱うのは `js/bad-tag-filter` への対応です。道具のコードも顧客の経路と同じ検査に見られています。

## 依存の供給線

**狙い。** 依存の更新は Dependabot に任せ、`target-branch: develop` を設定して、更新のプルリクエストが開発ブランチの検査と監査を通るようにしていました。

**起きたこと。** 2026 年 6 月、`better-sqlite3` の 12.11.1 を含む Dependabot の更新が本番ブランチへ直行し、開発ブランチの軽い検査の列と 8 つの領域の監査をすり抜けて、統合の監査で `SIGSEGV` を起こしました[^depguard]。

**なぜ。** 設定は書いてありましたが、その実効性は機械で検証されていませんでした。[第Ⅱ部-2](layered-architecture) の「配線の確認は実装の確認ではない」の実例です。

**変えたこと。** 対処は 3 つで、`ci.yml` の供給線の処理にまとまっています。Dependabot のパッケージの種類ごとの設定の全部が `target-branch: develop` を持つことを YAML の読み込みで検証する。`better-sqlite3`、`bcrypt`、`sharp` のネイティブの部品が読み込めることを軽い検査の列で疎通確認する。`SIGSEGV` を起こさない版への固定からの逸脱を `package.json` とロックファイルで静的に捕まえる[^ciyml]。

ただし、脆弱性の修正は別の経路で来ます。Dependabot の設定ファイルには、反対役のレビューで実測した注記があります。脆弱性の経路は `target-branch` を無視して既定のブランチである本番ブランチに直行する。設定を入れた 2026 年 6 月 17 日以降の Dependabot のプルリクエストは 70 件で、開発ブランチ 60 件、本番ブランチ 10 件。本番ブランチの側 10 件のうち脆弱性の経路が 6 件、残り 4 件は設定が届く前の版の更新です。脆弱性の識別番号（CVE）が出れば更新のプルリクエストは来る、ここで閉じているのは定期の版の更新だけだ、と閉じた範囲を限定して書いています[^dependabot]。

`package.json` を変えるプルリクエストでは GitHub の依存レビューが走り、既知の脆弱性を持つ依存の追加を止めます。これは開発ブランチ向けでも発火する軽い検査の列です[^deprev]。Dependabot のプルリクエストは自動でマージしますが、対象は `dependabot[bot]` だけで `renovate` は含めません。判定はプルリクエストの作成者で行います。操作した人で判定すると、人間が分岐元を変えたりラベルを付けたりした瞬間に判定が人間へ変わり、自動マージが発火しなくなるからです[^automerge]。

四半期ごとに `npm audit` を走らせ、結果を Issue に起票する自動処理もあります。重大度が高いものと最も高いものは個別の Issue、中と低は 1 つの要約の Issue に集約し、脆弱性の識別番号（GHSA / CVE）を題名に含めて既存の未解決の Issue と重複しないようにします。`osv-scanner` と `semgrep` は手元の手動実行で、必須ではありません[^secscan]。

**読者のリポジトリでは。** 依存の更新の向き先を設定しているなら、その設定が効いていることを検査する 1 本があるかを確かめてください。無ければ、効いていないことは事故で分かります。

## 高い権限を持つ自動処理を固定する

GitHub Actions 自体も供給線です。秘密情報の消費、来歴の証明の発行、本番の AWS の権限の引き受け、コンテナイメージの構築と配置、プルリクエストの自動マージ。こうした高い権限の部品は、`@v3` のような動く目印ではなく、コミットの完全な指紋（SHA）で固定します。目印の付け替えによる注入を防ぐためです[^secdesign]。

手動の列挙は、いたちごっこになります。手動で追加を続けた根本は、新規の高い権限の外部製の部品を固定せずに導入しても黙って通る、という網羅漏れでした。対処は既定で拒否する方式です。いずれかの権限の範囲に書き込みを宣言する自動処理の中の外部製の部品は指紋での固定を必須とし、動く目印を許すものは理由付きの許可一覧に明示します。書き込みの種類を列挙する方式も、`issues` や `pages` や `security-events` が列挙の外という別のいたちごっこを生んだため、全書き込みの範囲を一括で固定しました[^secdesign]。

この関門は「既定の `GITHUB_TOKEN` は読み取り専用」を前提にします。前提が崩れないよう、全自動処理に最上位の `permissions:` の宣言を必須にして既定のトークンに依存する自動処理を構造的に排除し、リポジトリ設定の実測はオーナーが手元で確かめます。残る危険は 3 点が明記されています。GitHub 公式の部品の動く目印の供給元の信頼、許可一覧の例外の判断の誤り、実測の確認が手動で連続実行されないこと。いずれも顧客が付く前の段階で許容しています[^secdesign]。

## 再導入を検索で禁じる

3 つ目の層は、リポジトリの中を検索する小さなスクリプト群です。[第Ⅴ部-2](static-analysis-tiers) の階層で言えば第 1 層で、どれも数秒で終わります。

![安全の検査の流れ。プルリクエストは第 1 層の再導入を禁じる検索と供給線の検査を通り、本番ブランチ向けなら CodeQL の指摘を台帳と突き合わせ、統合の監査で未解決 0 件を確かめる](/images/ganbari-quest-design/security-scans.png)

**ライセンスキーの再導入の禁止。** ライセンスキーは 2026 年 6 月に全廃されましたが、紹介ページ、メール、ラベル、画面のどこからでも概念が再導入されえます。`src/` と `site/` で `licenseKey` や `LICENSE_KEY` などの参照を検索し、コメントの行以外で 1 件でもあれば落とします。許可一覧に残るのは旧 URL の転送の表だけで、ブックマークの維持のため永久に保持されるからです。課金プランの列挙型はライセンスと無関係でしたが、命名に `license` を含んでいたため `SUBSCRIPTION_PLAN` に改名し、その語彙も検出の対象に加えました[^licleak]。

**環境変数の直接参照の禁止。** `process.env.X` と `$env/dynamic/private` の読み込みは `src/lib/runtime/env.ts` だけに許します。採択の時点で直接参照していたファイルは経過措置の一覧に凍結し、新規の追加は禁止です。一覧は「第 4 段階の完了時にゼロ」の予定と書かれたまま残っています[^envaccess]。

**必須の環境変数の配布の証跡。** プルリクエストの差分から「本番で必須になった環境変数」を検出し、本文に「配布済み:」の証跡が無ければ落とします。当初は新規追加の環境変数だけを見ていましたが、2026 年 7 月 31 日に既存の `CRON_SECRET` がバックアップのコンテナの必須の要件になった変化を素通りし、NUC の日次のバックアップが毎晩失敗して発覚まで 18 日かかりました。以後、任意から必須への変化（`.optional()` の除去、既定値の撤去、AWS CDK の黙って飛ばす処理の撤去）も見ます。スクリプトの冒頭には「検出できない範囲」が 5 項目列挙されています。差分の外での必須化、アプリの外の消費者、条件付きの必須、動的な環境変数の名前、配布先の実在。「黙って守れていることにしない」ための明示です[^newenv]。

**シェルの失敗の素通り。** GitHub Actions の `run:` は既定で `bash -e` なので、`$?` を見て失敗しても通すつもりの分岐に到達しません。プルリクエストのレーン判定でこれが起き、API の一過性の失敗で関門が止まりました。`$?` を参照するブロックは同じブロックの中で `set +e` を明示することを要求します[^shellguard]。

## 一度きりのレビュー

機械の検査とは別に、2026 年 3 月 31 日にセキュリティ担当の分身（Claude Opus 4.6）による手動のコードレビューが 1 回あります。対象は認証と認可の中間処理、Amazon Cognito の連携、Stripe の連携、ログインの流れ、48 の API の入口、ファイルのアップロード、流量の制限、AWS CDK の 4 つのスタック、運営者の画面。手法は OWASP の上位 10 リスク（2021 年版）と、カード決済の安全基準 PCI DSS v4.0 の自己評価票 SAQ A への適合性の評価です[^secreview]。この報告書は `docs/security/` に残っていますが、その後の変更に追随していません。定期化もされていません。

## 何が効いて、何が見えていなかったか

まず、見えていなかったものを書きます。リポジトリの自動処理には `gitleaks` のような秘密情報の検出器がありません。ログに平文の秘密情報や個人情報が出る事故は 2026 年 9 月にも起きていて（おやカギコードと保護者のメールが CloudWatch に出た件）、これは静的検査では捕まらない不具合の型でした。ログの設計は [第Ⅱ部-13](errors-and-logs) で扱います。

セキュリティ設計書には「コミット前の検査: Biome の静的検査 + `svelte-check` + Vitest + Playwright の画面操作テスト」と書かれていますが、[第Ⅳ部-8](platform-session) で見たとおり、コミットのフックでの重い検査は退けられています。設計書のこの節は古いままです。

CodeQL の台帳は、うまくいった判断だと考えています。必須にできない現実と、「赤でも通す」を人の判断にしない規律を、台帳と解消の引き金で両立させました。`src/` を台帳に載せられない規則は、顧客が付く前の段階で受容する範囲を「顧客の経路以外」に限定する線で、この線は他の関門にも引くべきでした。

供給線の話は、生成AI固有ではありません。ただ、生成AIが書いた `target-branch: develop` の設定は「効いているはず」と扱われ、実効性は `SIGSEGV` で初めて検証されました。設定を書くことと、設定が効いていることを機械で言えることは別です。

## 持ち帰るもの

- 必須にできない検査は「赤でも通す」を人の判断にしない。受容する指摘を台帳に書き、顧客の経路は台帳に載せられなくする
- 依存の更新の向き先や自動処理の権限は、設定を書いたら効いていることを検査する 1 本を同時に書く
- 撤去した概念、直接参照、必須の環境変数の配布は、数秒で終わる検索の検査で再導入を止める。検出できない範囲はスクリプトの冒頭に書く

次の [第Ⅵ部-1](claude-md-hierarchy) からは、検査の外側にある生成AIへの指示書を扱います。常時読み込まれる 16 万バイトの指示が、何を守り、何を守れなかったかです。

[^codeqlyml]: CodeQL の自動処理。並行実行の設計（本番ブランチへのプッシュのコミットごとの走査を保全）、発火の条件と対象のパスの限定。出典: [.github/workflows/codeql.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/codeql.yml)

[^codeqlcheck]: CodeQL の新しい指摘 0 件を機械の条件にする検査。必須にしない経緯、統合 PR #4152 で `js/incomplete-url-substring-sanitization` を流しかけた実例、判定の規則（台帳、`src/` の禁止、`resolutionTrigger`、検査不能を落とす）。出典: [scripts/audit/check-codeql-alerts.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/audit/check-codeql-alerts.mjs)。台帳の本体は [scripts/audit/codeql-baseline.json](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/audit/codeql-baseline.json)

[^branchstrategy]: ブランチ戦略 §4「CodeQL の扱い」。必須にしない理由、代わりに満たすべき条件、検査の主体、台帳、`src/` の禁止（企画部の決裁 2026-08-01）、解消の引き金、未解決 0 件の条件への組み込み。出典: [docs/sessions/branch-strategy.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/sessions/branch-strategy.md)

[^depguard]: Dependabot の向き先のブランチを検証する検査。#3158 が本番ブランチへ直行し統合の監査で `SIGSEGV` を起こした経緯。出典: [scripts/check-dependabot-target-branch.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/check-dependabot-target-branch.mjs)

[^ciyml]: 自動検査の `deps-supply-chain-check` の処理。向き先の検査、ネイティブの部品の疎通確認、`SIGSEGV` を起こさない版の固定の静的な捕捉。出典: [.github/workflows/ci.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/ci.yml)

[^dependabot]: Dependabot の設定。項目ごとの `target-branch: develop`、脆弱性の経路が本番ブランチに直行する実測（2026-06-17 以降 70 件の内訳）、閉じている範囲の限定。出典: [.github/dependabot.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/dependabot.yml)

[^deprev]: 依存レビューの自動処理。発火の条件（本番ブランチと開発ブランチ、`package.json` とロックファイルの変更）。出典: [.github/workflows/dependency-review.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/dependency-review.yml)

[^automerge]: Dependabot の自動マージ。対象を `dependabot[bot]` に限定する理由、プルリクエストの作成者で判定する理由。出典: [.github/workflows/dependabot-auto-merge.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/dependabot-auto-merge.yml)

[^secscan]: 四半期の安全の走査。`npm audit` の実行と Issue の起票。出典: [.github/workflows/security-scan.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/security-scan.yml)。起票の規則は [scripts/security-findings-to-issues.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/security-findings-to-issues.mjs)、道具の位置付けは [docs/security/scan.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/security/scan.md)

[^secdesign]: セキュリティ設計書 §11.3 秘密情報の管理、§11.4 自動処理の安全（高い権限の部品の指紋での固定、網羅性の関門の既定で拒否、書き込みの種類の列挙の廃止、既定のトークンの前提の 2 層の担保、残る危険 3 点）と、コミット前の検査の記述。網羅性の関門は #3318 / #3457 / #3483 で手動追加を重ねた経緯の末に既定で拒否する方式になった。出典: [docs/design/14-セキュリティ設計書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/14-セキュリティ設計書.md)

[^licleak]: ライセンスキーの再導入を防ぐ検査。検出の型、`SUBSCRIPTION_PLAN` への改名、許可一覧の設計（転送の表の永久保持、コメントの行の許容）。出典: [scripts/check-license-key-leak.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/check-license-key-leak.mjs)

[^envaccess]: 環境変数の直接参照を禁じる検査。正本のファイル、経過措置の一覧の凍結。出典: [scripts/check-no-direct-env-access.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/check-no-direct-env-access.mjs)

[^newenv]: 必須化された環境変数の配布の証跡の検査。検出の範囲の 5 つの型、任意から必須への変化を見る理由（`CRON_SECRET` の 18 日）、検出できない範囲の明示。出典: [scripts/check-new-required-env.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/check-new-required-env.mjs)

[^shellguard]: シェルの失敗の素通りを守るテスト。`bash -e` の挙動、レーン判定で起きた実害、`set +e` の要求。出典: [tests/unit/architecture/ci-shell-fail-open-guard.test.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/ci-shell-fail-open-guard.test.ts)

[^secreview]: 2026-03-31 のセキュリティのコードレビューの報告書。対象の範囲、手法、脅威の想定。出典: [docs/security/security-code-review-2026-03.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/security/security-code-review-2026-03.md)
