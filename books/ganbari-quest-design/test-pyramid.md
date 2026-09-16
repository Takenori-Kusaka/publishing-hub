---
title: "第Ⅴ部-3　テスト ― ratchet、assertion の浸食禁止、7 つの Playwright 設定"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

生成AIはテストを書きます。しかし、テストが通るように実装を直すのではなく、テストが通るようにテストを直す誘惑にも、AI は簡単に負けます。この章では、テストの品質が下がる方向の変更を機械で止める 2 つの ADR、テストの並列実行が壊した信頼性、そして 7 つの Playwright 設定に分かれた E2E の構成を扱います。

## 48 時間で 2 回下がった閾値

ADR-0005 のコンテキストは、こう始まります。

> 2026-04-01 にカバレッジ閾値を lines: 48 / functions: 37 に引き上げたが、48 時間以内に 2 回引き下げられた（#0216, #0276-#0278 の機能追加時）。コメントには「テスト追加で再度引き上げ予定」と記載されたが、引き上げは一度も実行されていない。[^adr05]

同じ時期に、他の劣化も確認されました。Critical な修正に E2E テストがない。アプリのバグをテスト側のヘルパーで隠蔽する。`test.skip()` の濫用。サービス層のテストがサービスを呼ばず DB を直接操作している。レアリティ分布のテストが実装の重みを呼ばず独自の乱数で自己参照している。結果として、4 回の既知の回帰がすべてテストで検出できませんでした[^adr05]。

決定は 3 つです。カバレッジ閾値の引き下げを CI で禁止する。機能追加 PR にカバレッジ差分のチェックを課す。テスト回避パターンを禁止する。閾値の検査は、origin/main の設定と PR の設定を比較し、1 つでも下がっていれば `BLOCKED` を出して exit 1 します[^ratchet]。引き下げるただ 1 つの方法は、ADR に理由を記録し、日付つきの復元計画を同時にコミットすることです。

閾値は現在、lines 38、functions 27、branches 35、statements 32 です[^viteconfig]。目標の 80 には遠く、テスト設計書の目標値とも乖離しています。しかしこの数値は「今より下げない」ための ratchet であり、設計書の目標は別の話です。上げるのは人の判断で、下げるのは機械が止めます。

## assertion の浸食を禁止する

ADR-0006 は、テストではなく本番コードの guard を対象にします。「一時的に」guard を緩める変更が恒久化する現象を、Diane Vaughan のチャレンジャー号事故の分析にちなんで Normalization of Deviance と呼び、禁止する 5 項目を定めています[^adr06]。

1. throw を含む production guard を warn に落とす変更。fail-closed から fail-open へのサイレントな格下げ
2. `NODE_ENV === 'test'` などで本体コードの assertion を skip する分岐の混入
3. `ALLOW_LEGACY_*` / `DISABLE_*` / `SKIP_*` の既定値を true にする変更
4. health check、retry、timeout を根本原因が未解明のまま増やす変更
5. `.skip` / `.todo` / `@ts-expect-error` / `eslint-disable` の追加

5 番目には条件があります。追加するなら、Issue 番号、責任者、期限の 3 点セットをコメントに書きます。境界の判別法は 1 行です。

> その緩和を取り消すときの owner と deadline が PR 本文に書かれているか。書かれていない緩和はすべて禁止。書かれている緩和は許容。[^adr06]

[第Ⅳ部-3](maker-not-approver) の逃げ口上の救済策、[第Ⅳ部-4](definition-of-done) の残 NG の受容宣言と同じ構造です。禁じているのは緩和ではなく、責任者と期限のない緩和です。安全の検査を削除する PR には、その assertion が追加された過去の PR 番号、当時の脅威モデル、それが今どう変わったかを必須で書かせます。Chesterton's Fence、柵を取り除く前になぜ立てられたかを知れ、という原則です。

## 並列実行が偽の red を作る

テストの信頼性を壊したのは、テストの中身ではなく実行の仕方でした。Vitest の設定には、テストファイルを直列に実行する `fileParallelism: false` があり、その理由が書かれています。並列のトランスパイルが CPU と I/O で競合し、5,000 ミリ秒のタイムアウトを頻発させていたこと、threads pool は CDK のテストでクラッシュしたこと、公式ドキュメントが共有リソース（DB）を持つ構成で直列を推奨していることです[^viteconfig]。直列化で実行時間は最大 7 倍に悪化しましたが、タイムアウトの削減による信頼性を優先しました。

[第Ⅳ部-6](parallel-agents) で見た並走の害、つまり結果が根拠として使えなくなることが、ここでも当てはまります。テストが落ちたとき、実装のせいか負荷のせいか切り分けられなければ、その結果は使えません。

Storybook のインタラクションテストは、明示的な opt-in（`STORYBOOK_TESTS=true`）のときだけ Vitest の構成に入ります。並列実行時に Chromium への接続が不安定になり、無関係なユニットテストまで巻き添えでタイムアウトさせていたからです[^viteconfig]。

## 7 つの Playwright 設定

E2E テストは、1 つの設定ではなく 7 つの設定ファイルに分かれています。

| 設定 | 対象 | 特徴 |
| --- | --- | --- |
| `playwright.config.ts` | 通常の E2E | worker 2 本、それぞれ別ポートと別の SQLite ファイル |
| `playwright.matrix.config.ts` | 実行モード × プラン状態の 4 組み合わせ | 4 つの dev server（ポート 5201〜5204）、worker 1 |
| `playwright.cognito-dev.config.ts` | 認証を要する画面 | 全ロールの `storageState` を事前保存して使い回す |
| `playwright.demo.config.ts` | デモ Lambda 固有の動作 | 匿名認証 + デモデータのサーバをポート 5180 で起動 |
| `playwright.aws.config.ts` / `playwright.production.config.ts` | deploy 後の smoke | 実環境の URL を叩く |

通常の E2E で worker を 2 本に制限しているのは、SQLite の競合によるダイアログのクリックの race を防ぐためです。各 worker には `e2e-worker-${i}.db` が注入され、データベースを共有しません[^pwconfig]。

matrix の設定は、実行モードとプランの状態の組み合わせを検証します。デモモードでは書き込みが常に拒否される、local-debug でプランが family なら家族の招待が許可される、本番モードでトライアル切れならアップグレードの CTA が出る、といった境界です[^matrix]。CI では重量レーン、つまり main 向けの PR と main への push でだけ走ります。

このほか、a11y の検査は `@axe-core/playwright` で WCAG 2.2 AA の critical と serious の違反が 0 件であることを機械で検証し、既知の違反は rule id 単位で baseline に固定しています。

## 「表示された」を「動いた」と読まない

E2E の書き方にも、事故から生まれた規律があります。テストの運用文書は、初顧客レビューの直前の出来事を記録しています。

> 初顧客レビュー直前、実ユーザーが marketplace 取込ダイアログを 1 分操作しただけで「追加ボタン無反応・キャンセル不能」(機能 dead-end) を発見した。一方 E2E `admin-unified-import-hub.spec.ts` は ダイアログが render される / testid visible だけを assert して PASS。「追加 click → 活動が増える」= ユーザーの goal 完遂を一度も検証していなかった (render proxy は緑、goal 完遂は壊れている)。[^testsclaude]

以後、クリックや入力や送信を伴う E2E は、操作後に結果の反映（UI、状態、永続化）を必ず検証します。「表示されている」だけの assertion は、インタラクティブな動線では禁止です。[第Ⅳ部-4](definition-of-done) の「検査できなかったのに pass」と同じ class で、検査が対象を見ているように見えて見ていない状態を止めます。

## 本番と同じデータベースで検証する

[第Ⅳ部-7](audit-team) で見たとおり、実機の監査で最も重要だった class は「SQLite で動くが本番のデータベースでは違う」でした。この class は、テストの基盤でも対処されています。

セルフホスト用の PGlite は、本番の Aurora DSQL と同じ pg-core のスキーマを持つため、DSQL 用のリポジトリ実装をそのまま再利用します。接続先とトランザクションの実行だけを差し替え、SQL を書くコードは共有します[^testsclaude]。統合テストは PGlite の上で、本番と同じ SQL を実行できます。

PGlite には制約もあります。データディレクトリを 1 つのプロセスが占有するため、稼働中のディレクトリに別のプロセスから接続すると locked でクラッシュします。この制約は、バックアップの設計に影響しました。

> 取得しただけの tarball は復元可能性ゼロ検証。本モジュールは 取得物を実際に別 PGlite へ復元して検証が通ったものだけをバックアップとして確定する (verify-then-commit)。[^pglitebackup]

「取れている」と「復旧できる」は別物です。バックアップは、復元した DB の全テーブルに `count(*)` が通ること、migration の記録が存在すること、journal の全項目が適用済みであることの 3 段で検証されてから確定します。この設計は第Ⅱ部で扱いますが、「検査が検査になっているか」を問う姿勢は、テストの章と同じ根から出ています。

## テストに期待すること

この章の設計を並べると、テストに期待しているものが「不具合の検出」だけではないことが分かります。閾値の ratchet は、AI がテストを削る方向の変更を止めます。assertion の浸食禁止は、guard を緩める変更に責任者と期限を要求します。直列実行は、テストの結果を根拠として使える状態に保ちます。render-only の禁止は、テストが対象を見ているように見えて見ていない状態を止めます。生成AIとの開発で、テストは「実装が正しいことの証明」であると同時に、「AI が自分に都合よく品質を定義し直すことへの歯止め」でもあります。

[^adr05]: ADR-0005「テスト品質 ratchet」。48 時間で 2 回下がった閾値、同時期の劣化パターン、3 つの決定、禁止するテスト回避パターンの表。出典: [docs/decisions/0005-test-quality-ratchet.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0005-test-quality-ratchet.md)

[^ratchet]: カバレッジ閾値の引き下げを検出して CI を止めるスクリプト。出典: [scripts/check-coverage-threshold.js](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/check-coverage-threshold.js)

[^viteconfig]: Vitest の設定。カバレッジ閾値の現在値、`fileParallelism: false` の理由、Storybook テストの明示的 opt-in。出典: [vite.config.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/vite.config.ts)

[^adr06]: ADR-0006「Safety Assertion Erosion Ban」。禁止 5 項目、Fail-Closed 原則、境界の判別法、例外手続き、Chesterton's Fence 欄。出典: [docs/decisions/0006-safety-assertion-erosion-ban.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0006-safety-assertion-erosion-ban.md)

[^pwconfig]: 通常の E2E の Playwright 設定。worker 2 本と worker ごとの SQLite ファイル、cognito-dev 専用 spec の除外、headless Chromium での自動スリープ検証の対策。出典: [playwright.config.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/playwright.config.ts)

[^matrix]: 実行モード × プラン状態の matrix E2E の設定。4 つのシナリオとポート、重量レーンでの実行条件。出典: [playwright.matrix.config.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/playwright.matrix.config.ts)

[^testsclaude]: テストの運用文書。render-only の assertion を禁止した経緯（初顧客レビュー直前の dead-end）、PGlite が DSQL のリポジトリ実装を verbatim に再利用する設計、a11y の baseline、demo Lambda E2E。出典: [tests/CLAUDE.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/CLAUDE.md)

[^pglitebackup]: PGlite のバックアップ。単一プロセス占有の制約、verify-then-commit の 3 段検証。出典: [src/lib/server/db/pglite/backup.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/db/pglite/backup.ts)
