---
title: "第Ⅱ部-16　運営者のコンソール ― on-demand の分析、コホート、admin bypass の計測、DynamoDB を見続ける週報"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

`/ops` は運営者だけが入る画面で、KPI、分析、コホート、費用、export、PMF のアンケートの 6 ページがあります。この章では、常設の収集を持たない on-demand の分析、コホート別の残存率、admin bypass の merge を数える計測、契約状態の監査、そして撤去したはずの DynamoDB を今も読もうとする週報を扱います。運営の画面は顧客に見えませんが、「何を測るか」は製品の判断そのものです。

## 常設の収集を持たない

分析基盤の方針は、外部の SaaS の analytics を採用せず、always-on の event 収集も持たないことです。当初は DynamoDB に activation の event を継続収集し、日次の cron で集計し、常設の dashboard が参照していました。PO の方針は「必要時のみ分析、常設収集と dashboard は Pre-PMF で過剰」で、DSQL への移行に合わせて on-demand 化しました。導出元は DSQL の main data（families、children、activity_logs、cancellation_reasons）で、実行の契機は認証済みの ops が画面を開いたときだけ。外部送信はゼロで、CSP の `connect-src 'self'` が構造的に保証します[^awsdesign]。

Activation Funnel は、signup、初回の子供登録、初回の活動、7 日の継続の 4 段です。旧設計の 4 段目は「初回の報酬演出」でしたが、純粋な UI の view event でデータの痕跡が無く、DSQL から導出できないため落とし、engagement の本質である 7 日の retention に置き換えました。集計は単一の SQL 1 発で、[第Ⅱ部-6](aurora-dsql) の N+1 禁止に従います[^ondemand]。

## コホートと LTV

コホートの分析は、月次のコホートごとに Day 1、7、14、30、60、90 の残存率と累計の LTV を出します。LTV の計算式は事業計画書と整合させた実測値です[^cohort]。

チャーンの判定は [第Ⅱ部-12](billing) で見た契約状態の S5 で、KPI の service はすべて判定関数を経由します。既知の残課題も同じ設計書にあります。cohort の分母が無料を含む全テナント、分子が有料の解約で、母集団が揃っていません。退会は行ごと消えるため観測できません。

KPI のサマリーページは、5 つを並列に取得します。KPI、価格のトリガー、admin bypass の計測、Stripe との plan の drift、契約状態の監査。plan の drift は Stripe の API を 1 回照会し、失敗しても throw せず報告に載せます。他のセクションを巻き添えにせず、かつ「0 件」に見せないためです[^opspage]。

## admin bypass を数える

[第Ⅳ部-3](maker-not-approver) で見た「作成者 ≠ 承認者」の規律には、計測があります。GitHub の API から直近 N か月の merged PR を取り、reviewDecision が空の admin bypass の merge を月次で集計します。GitHub の token が未設定なら空データを返し、dashboard は「データ取得できず」と表示します[^bypass]。

事後の検証もあります。日次の workflow が、admin bypass で merge された PR に Self-Review の証跡の節が含まれているかを検証し、欠落した PR に追記要求のコメントを投稿します。block はしません。事後の merge を revert することは運用上困難なため、事後の追記を促します。当初は毎時でしたが、日次に緩和されました[^bypassyml]。

契約状態の監査は、`/ops` を開くたびに本番の全行を分類し、表に無い状態の在庫を出します。[第Ⅱ部-12](billing) で見たとおり、webhook の handler のテストは「これから書く行」しか見ないため、既に不正な既存行はこの監査だけが検出します[^opspage]。

## 費用のページが Cost Explorer を呼ぶ

`/ops/costs` は、当月と前月の AWS の費用をサービス別に表示します。実装は Cost Explorer の API を呼び、プロセス内のキャッシュを 1 日持ちます[^opsservice]。

ここに、[第Ⅲ部-1](serverless-cost) で見た「測るコストが最大の費目」の説明があります。Cost Explorer の API はリクエスト 1 回 $0.01 で、キャッシュは Lambda のプロセス内なので cold start のたびに消えます。費用のページを開くたびに当月と前月の 2 回、cold start 後なら必ず呼びます。infra の CLAUDE.md は「`/ops` からのリアルタイムクエリ禁止」と書き、cost-review の skill は API の直接呼び出しを禁止していますが、費用のページはその規律の外に残っていました。8 月の Cost Explorer の $1.53 は、この画面の閲覧と cold start の積です。

## DynamoDB を見続ける週報

毎週月曜の朝 9 時に、Discord へ運営レポートが届きます。AWS の費用、テナントの統計、Stripe の売上を集めて整形します。テナントの統計の step は、DynamoDB の `ganbari-quest` テーブルを scan します[^weekly]。

DynamoDB のテーブルは、[第Ⅲ部-2](cdk-stacks) で見たとおり 2026 年 7 月に CloudFormation の管理から外れ、RETAIN で orphan として残っています。週報はそのテーブルを毎週読み、DSQL に移行した本番のテナント数ではなく、移行前に凍結された数を報告しています。費用の内訳にも DynamoDB の行が残ります。誰も止めていない装置が、古い真実を毎週届けています。

## 今ならこうする

on-demand の分析は、正しい判断でした。常設の収集は、子供のデータを増やし、cron を増やし、dashboard を増やします。「ops が画面を開いたときだけ」は、コストと privacy の両方を最小にします。[第Ⅰ部-6](legal-by-design) で見た「収集しないデータ」の原則の、運営側の実装です。

admin bypass の計測は、規律を数字にしたものです。[第Ⅳ部-3](maker-not-approver) の「作成者 ≠ 承認者」は、bypass が 0 でなければ守られていません。数字が dashboard に出ることで、bypass は「例外」から「記録される事実」になりました。

費用のページと週報は、この本で何度も見た形の再現です。設計書と skill は禁じているのに、コードは呼んでいる。テーブルは撤去したのに、workflow は読んでいる。どちらも「動いている」ので落ちません。[第Ⅴ部-4](fitness-functions) の「記録を反証可能にする」は、こういう残骸のためにありました。DynamoDB の scan を残した週報は、この章を書くために原典を読んで初めて見つかりました。

[^awsdesign]: AWSサーバレスアーキテクチャ設計書 §7.2 アナリティクス基盤。採用方針、on-demand 集計サービス、`/ops/analytics` の可視化、CSP との整合、Pre-PMF のスコープ。出典: [docs/design/13-AWSサーバレスアーキテクチャ設計書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/13-AWS%E3%82%B5%E3%83%BC%E3%83%90%E3%83%AC%E3%82%B9%E3%82%A2%E3%83%BC%E3%82%AD%E3%83%86%E3%82%AF%E3%83%81%E3%83%A3%E8%A8%AD%E8%A8%88%E6%9B%B8.md)

[^ondemand]: on-demand の marketing 分析サービス。背景（always-on 収集の撤去）、read-only の 2 指標、旧 step ④ の drop。出典: [src/lib/server/services/analytics-ondemand-service.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/services/analytics-ondemand-service.ts)

[^cohort]: コホート別 LTV とチャーン率の推移。計測ポイント、月次コホートの型。出典: [src/lib/server/services/cohort-analysis-service.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/services/cohort-analysis-service.ts)

[^opspage]: KPI サマリーページの load。5 つの並列取得、plan drift の扱い、契約状態の監査。出典: [src/routes/ops/+page.server.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/routes/ops/%2Bpage.server.ts)

[^bypass]: admin bypass merge の月次メトリクス集計。GitHub API からの取得、token 未設定時の扱い。出典: [src/lib/server/services/admin-bypass-metrics-service.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/services/admin-bypass-metrics-service.ts)

[^bypassyml]: admin bypass の証跡検査 workflow。日次への緩和、block しない理由。出典: [.github/workflows/admin-bypass-evidence.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/admin-bypass-evidence.yml)

[^opsservice]: ops サービスの AWS 費用取得。Cost Explorer の呼び出しと 1 日のプロセス内キャッシュ。出典: [src/lib/server/services/ops-service.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/services/ops-service.ts)。費用ページは [src/routes/ops/costs/+page.server.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/routes/ops/costs/%2Bpage.server.ts)

[^weekly]: 週次の運営レポート workflow。Cost Explorer、DynamoDB の scan、Stripe の売上、Discord への整形。出典: [.github/workflows/weekly-report.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/weekly-report.yml)
