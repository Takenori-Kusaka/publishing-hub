---
title: "第Ⅴ部-5　見た目の回帰 ― pixelmatch 3 層、LP メトリクスの ratchet、スクリーンショットの証跡"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

生成AIが書く UI には、テストでは捕まらない壊れ方があります。動いているのに崩れている、デモ固有の表示が本番の画面に映り込んでいる、ダイアログが勝手に開いてスクリーンショットを覆っている。がんばりクエストでは、LP に載せる製品スクリーンショットがデモ経路で撮られて本番と乖離する事故が、PO の指摘で 8 回再発しました。この章では、その再発を止めた pixelmatch の 3 層、LP の寸法と語彙を刻む ratchet、そしてプルリクエストに添えるスクリーンショットの証跡を扱います。

## 6 件を比べて pixelmatch を選ぶ

ADR-0053 は、LP の visual regression に使う道具を 6 件比較しています。採用したのは `pixelmatch` で、Mapbox 製、MIT、PNG の pixel 単位比較の業界標準です。依存は `pngjs` だけで、コアは 110 行です。閾値 0.1 で知覚できる程度の差を拾い、画像あたりの diff が 10% を超えたら fail にします[^adr53]。

退けた 5 件の理由は、それぞれ短く書かれています。

| 選択肢 | 退けた理由 |
| --- | --- |
| jest-image-snapshot | 本リポジトリは vitest。内部は pixelmatch なので抽象化が厚いだけ |
| Playwright の `toHaveScreenshot()` | 撮影戦略が fixture 固定で、preview server + cookie 注入 + scroll の撮影 setup を再実装する必要がある。baseline の置き場も Playwright 固定 |
| Percy / Chromatic | 月 $149 からの SaaS。baseline が cloud 管理になり、git で追跡する SSOT と矛盾する |
| BackstopJS | Puppeteer 依存で runner が二重化する |
| 独自実装 | pixelmatch の 110 行を再実装する意味がなく、OSS 先調査ルールに反する |

デメリットも書かれています。2880×1800 の per-pixel 比較は CPU bound で画像あたり約 100ms、51 枚で約 5 秒。SSIM ではなく単純な pixel diff なので anti-aliasing の微差で誤検知しうる。これらを閾値で吸収する判断と、Pre-PMF のコスト（dev 依存 1 つ、bundle 増加 0）が並記されています[^adr53]。

## baseline は git で追跡する

比較の実体は `check-lp-visual-regression.mjs` です。CI が撮影した現状のスクリーンショットと、git で追跡する baseline を pixelmatch で比べ、画像ごとの diff PNG と JSON report を artifact に出します。解像度が違えば sharp で baseline 側に揃え、WebP は sharp で PNG に decode します。`--baseline-dir` と `--current-dir` を取る汎用の設計なので、LP 以外の層も同じスクリプトを再利用します[^checkvr]。

runbook は、`screenshot` という語の指す実体が 3 つあり、混同すると誤った更新操作につながると警告しています。

| 実体 | git 追跡 | 役割 |
| --- | --- | --- |
| baseline | 追跡する（SSOT） | 比較の正解。プルリクエストに同梱して更新する |
| current | 追跡しない | CI が撮影する現状。commit しない |
| PR 証跡 | 別 branch | レビューの Before / After。LP の baseline とは無関係 |

意図的な LP 変更のたびに gate は必ず fail します。fail 自体は設計どおりで、問題は更新の判断です。runbook は「意図的な変更なら baseline を更新して同梱」「偶発的な差分（フォントの rendering、撮影タイミング）なら更新せず原因を調べる」「意図しない回帰なら実装を直す」の 3 分岐だけを置き、多段の decision tree を作りません。`--threshold` での一時上書きや baseline の上書きで fail を隠すことは禁じられています。baseline にあって current に無い画像も「撮影漏れ」として fail し、baseline を消して missing を消す対処は LP truth の原則に反するとしています[^runbook]。

## 3 層に広げる

pixelmatch の適用は LP から始まり、アプリ本体の critical 画面に 3 層で広がりました。

| 層 | baseline の枚数 | 対象 | 扱い |
| --- | --- | --- | --- |
| LP | 53 | LP 全スクリーンショット（mobile + desktop） | hard-fail（diff > 10%） |
| child home | 5 | 4 つの年齢モードのホーム + バトル | warn |
| app | 9 | baby ホーム、admin の活動とチェックリスト、ページガイド open 状態 | warn |

3 層を合わせて、5 つの年齢モードのホームと admin の critical 画面、ページガイドの open 状態の見た目回帰を機械で検出します。app 層の撮影は決定的な環境で行います。本番ルートを `AUTH_MODE=anonymous` と `DATA_SOURCE=demo` で起動し、demo fixture のデータを描画する構成です。デモを本番ルートで動かす Multi-Lambda の設計と同型です[^docsclaude]。

LP の撮影スクリプトには、2026-05-17 の切り替えが記録されています。従来は `/demo/<mode>/<path>` を撮影していたため、デモ専用の「きょうのミッション」セクションが映り込み、本番のダッシュボードから乖離していました。切り替え後は本番ルートを demo fixture で描画し、`selectedChildId` の cookie と `?screenshot=all` を pre-set して、子供切替への redirect を回避します。`?screenshot=all` は、本番の NUC ユーザーが見る演出（マイルストーンの告知など）を撮影時に強制表示する mode で、これも 8 回再発への構造的対策の一部です[^capturehp]。

child home と app の 2 層は「初回は warn、安定後に hard-fail へ昇格判断」と workflow に書かれたまま、昇格していません。LP の gate は main 向けプルリクエストだけで発火する重量レーンなので、develop 向けの通常のプルリクエストでは走りません[^lpvryml]。

![3 層に広げる](/images/ganbari-quest-design/visual-regression.png)

## 寸法と語彙を刻む

見た目の回帰は pixel だけではありません。LP は「圧縮したのに次のプルリクエストでまた伸びる」問題を抱えていました。`measure-lp-dimensions.mjs` は Playwright で LP を描画し、寸法と語彙を数値で刻みます。

| 指標 | 閾値 | 意図 |
| --- | --- | --- |
| mobileHeight | 15,000 px | 引き上げ禁止 |
| desktopHeight | 8,000 px（7,800 で警告） | 同上 |
| forbiddenTerms | 0 | 開発者語彙と射幸性語彙の追加禁止 |
| ctaVariants | 3 以下 | 「無料で始める」「デモを見る」「ログイン」の 3 種のみ |
| presetActivityCountClaimedMin | 120 以上 | 訴求値 ≤ 実数。活動名のユニーク数で裏取り |
| dead anchor | 0 | 内部リンクの id が実在すること |

禁止語には 2 系統あります。1 つは `git clone`、`docker compose`、`AWS`、`OSS`、`サーバー` のような開発者語彙で、トップページだけで検査します。もう 1 つは「ガチャ」「抽選」「コンプリート」「射幸」のような射幸性の語彙で、法務文書を含む全ページで検査します。後者は [第Ⅰ部-2](anti-engagement) で見た原則の、LP 側の機械強制です[^measure]。

プリセット活動数の裏取りには、2026 年 9 月の修正があります。activity-pack は男の子と女の子の variant が同名の活動を重複して持つため、延べ件数の 325 に対し、ユニークは 129 種でした。延べで数えると、選べる種類を 2 倍以上に見せる訴求が CI 緑で通ります。閾値の基準をユニーク数に変えました[^docsclaude]。dead anchor の検査も同じ月の追加で、静的 HTML は id を消してもリンクが 200 を返すため HTTP の到達性では捕まらず、実測で 4 本が黙ってページ先頭に着地していました[^measure]。

累積の gate もあります。プルリクエスト単体では閾値内でも、複数を merge すると超えることがあるため、`origin/main` を dry-run で merge した状態を計測します。ただし、かつてあった LP の削除残骸検査と inline style 検査は 2026 年 8 月に script ごと削除され、対応する baseline の JSON は読み手を失ったまま残っています。docs はこれを「機械強制は無い。レビューで担保する」と正直に書いています[^docsclaude]。

## プルリクエストの証跡

見た目の変更を含むプルリクエストには、Before / After のスクリーンショットを添える規律があります。撮影は `capture.mjs` で、`--pr <N>` を付けると出力先の設定、mobile と desktop の preset、サーバの自動起動と停止、PR 本文用の Markdown 生成までを自動化します。汎用 CLI にしたのは、使い捨てスクリプトを `scripts/` に増やさない原則のためです[^capture]。

証跡には、証跡を偽装する経路が生まれます。2026 年 5 月、あるプルリクエストで Before と After が完全に同一の画像のまま 3 ラウンド続き、オーナーの判断で close されました。原因は rebase 後に `screenshots` branch を更新し忘れたことです。対策として、PR 本文に埋め込まれた画像の Blob SHA が Before と After で一致していれば「偽装」として hard-fail する gate が入りました[^blobsha]。

この gate には、その後に見つかった穴があります。Before / After のペアが 0 件だと `skip` で通していたため、ファイルの命名を変えるだけで検査が黙って消えました。実測では、20 枚のスクリーンショットを埋め込んだプルリクエストで 1 ペアも検査されていません。現在は「スクリーンショットが埋め込まれているのにペア 0 件なら fail」です。Before と After が同一なのが正しい場合（差分が現れる時間帯の外で撮影した等）は、12 文字以上の理由を宣言します。表示条件が環境に依存して撮れない場合は、実在する Storybook story のパスを本文に書くことが必須で、「原理的に撮れない」を「見た目を確認しなくてよい」にしない設計です[^routesclaude]。

もう 1 つの証跡がスクリーンショットと同一プロセスで取得した DOM です。ある修正で、スクリーンショットと実機が乖離している事故が起きました。以後、UI のプルリクエストでスクリーンショットを添えるときは、対応する `.dom.html` へのリンクを 1 つ以上含めることを要求します。同じ gate は、GitHub 上で表示できないローカルパスの参照と、修正前 / 修正後のラベルの欠落も検査します[^sscheck]。

## 今ならこうする

3 層のうち hard-fail は LP だけです。child home と app は warn のまま 4 か月が過ぎました。warn の gate は、[第Ⅳ部-8](platform-session) の「実行されない gate」と同じで、落ちても誰も見ません。昇格するか消すかを決めるべきでした。

一方で、baseline を git に置く判断は正しかったと考えています。SaaS の diff レビュー UI は便利ですが、baseline が cloud にあると「LP の見た目は実装の事実である」という原則が守れません。プルリクエストの diff に baseline の画像が含まれることで、レビューする側は「見た目を変えた」ことを差分として読めます。

スクリーンショットの証跡は、偽装と検査漏れの往復でした。同一画像、ペア 0 件で skip、ローカルパス、ラベル欠落。証跡を要求する gate は、証跡の形式を見ることはできても、証跡が実機を映しているかは見られません。DOM の併記は、その限界に対する部分的な答えです。

[^adr53]: ADR-0053「LP visual regression: pixelmatch」。6 件比較の各選択肢の概要・メリット・デメリット・Pre-PMF コスト、決定の 5 つの根拠。出典: [docs/decisions/0053-lp-visual-regression-pixelmatch.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0053-lp-visual-regression-pixelmatch.md)

[^checkvr]: visual regression の比較スクリプト。目的、設計（sharp による解像度合わせと WebP decode、diff PNG と JSON report）、CLI オプション、関連ファイル。出典: [scripts/check-lp-visual-regression.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/check-lp-visual-regression.mjs)

[^runbook]: LP visual regression baseline 更新の runbook。3 つの「screenshot」の対比、設計原則、更新コマンド、更新の判断基準の 3 分岐、CI 失敗時の triage、撮影漏れの扱い、app 層の同型運用。出典: [docs/runbooks/lp-visual-regression-baseline.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/runbooks/lp-visual-regression-baseline.md)

[^docsclaude]: docs 配下の CLAUDE.md。§LP メトリクス ratchet の閾値表（プリセット活動数のユニーク数基準、dead anchor）、削除済み検査の残置、§visual regression 3 層の表と app 層の撮影環境。出典: [docs/CLAUDE.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/CLAUDE.md)

[^capturehp]: LP 用スクリーンショットの撮影スクリプト。冒頭コメントの 2026-05-17 の切り替え（`/demo/<mode>` 撮影による乖離、本番ルートを demo fixture で描画、cookie と `?screenshot=all` の pre-set）。出典: [scripts/capture-hp-screenshots.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/capture-hp-screenshots.mjs)

[^lpvryml]: LP visual regression の workflow。目的、過去の課題（8 回再発）、段階運用（warn-only ではなく hard-fail）、trigger（main 向けプルリクエストと main push）。出典: [.github/workflows/lp-visual-regression.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/lp-visual-regression.yml)

[^measure]: LP の寸法と語彙を計測するスクリプト。`THRESHOLDS`、開発者語彙と射幸性語彙の 2 系統の禁止語とページ別の適用、dead anchor の検査。出典: [scripts/measure-lp-dimensions.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/measure-lp-dimensions.mjs)

[^capture]: 汎用スクリーンショット CLI。`--pr` による自動化の範囲、フロースタンプシート。出典: [scripts/capture.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/capture.mjs)

[^blobsha]: Before / After の Blob SHA 一致を検出する gate。`--pr` を黙殺していた不具合の是正、内部 refactor exempt のラベル。出典: [scripts/check-ss-blob-sha-uniqueness.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/check-ss-blob-sha-uniqueness.mjs)

[^routesclaude]: routes 配下の CLAUDE.md。§rebase 後の screenshots branch push 必須（3 ラウンド偽装と close）、§SS の命名規約と「検査できなかった」ときの扱い（ペア 0 件で skip の実測、宣言の一覧、Storybook story 参照の必須化）。出典: [src/routes/CLAUDE.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/routes/CLAUDE.md)

[^sscheck]: スクリーンショット添付の品質 gate。ローカルパス禁止、修正前 / 修正後ラベル、DOM スナップショット併記、スキップ判定、段階適用フラグ。出典: [scripts/check-pr-screenshot.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/check-pr-screenshot.mjs)
