---
title: "第Ⅱ部-16　運営者の画面 ― 常設の収集を持たず、開いたときだけ数える"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

運営者だけが入る画面 `/ops` には、指標、分析、コホート、費用、書き出し、顧客が付いたかを問うアンケートの 6 ページがあります。顧客には見えませんが、「何を測るか」は製品の判断そのものです。子供のデータを扱う製品で、運営のために何をどこまで集めてよいのでしょうか。

常設の収集は持ちません。運営者が画面を開いたときだけ、本番のデータベースから数えます。外部の分析サービスにも送りません。そして測る対象には、顧客の指標だけでなく、自分たちの規律が守られているかも含めます。

## 常設の収集を持たない

分析の方針は、外部の分析サービスを使わず、常時の出来事の収集も持たないことです。当初は DynamoDB に定着の出来事を集め続け、日次の定期実行で集計し、常設の画面が参照していました。企画部の方針は「必要なときだけ分析し、常設の収集と画面は顧客が付く前の段階では過剰」で、Aurora DSQL への移行に合わせて必要時だけの方式にしました。元になるのは Aurora DSQL の本体のデータ（家族、子供、活動のログ、解約の理由）で、実行の契機はログイン済みの運営者が画面を開いたときだけです。外部への送信はゼロで、ブラウザに許す接続先を自分のサーバだけに制限する設定が構造的に保証します[^awsdesign]。

定着までの段階は、登録、初めての子供の登録、初めての活動、7 日の継続の 4 段です。旧設計の 4 段目は「初めてのごほうびの演出」でしたが、画面の表示だけの出来事でデータに痕跡が無く、Aurora DSQL から導けないため落とし、定着の本質である 7 日の継続に置き換えました。集計は 1 発の SQL で、[第Ⅱ部-6](aurora-dsql) の「問い合わせを行数ぶん繰り返さない」に従います[^ondemand]。

## コホートと生涯価値

コホートの分析は、月ごとのコホートについて 1 日、7 日、14 日、30 日、60 日、90 日の継続率と、累計の顧客生涯価値を出します。計算式は事業計画書と整合させた実測値です[^cohort]。

解約の判定は [第Ⅱ部-12](billing) で見た契約状態の「契約終了」で、指標を出す部品はすべて判定の関数を経由します。既知の残課題も同じ設計書にあります。コホートの分母が無料を含む全家族で、分子が有料の解約で、母集団がそろっていません。退会は行ごと消えるため観測できません。

指標のまとめのページは、5 つを並列に取得します。指標、価格の見直しの引き金、管理者の迂回の計測、Stripe とのプランのずれ、契約状態の監査です。プランのずれは Stripe の API を 1 回照会し、失敗しても例外を投げず報告に載せます。他の項目を巻き添えにせず、かつ「0 件」に見せないためです[^opspage]。

## 管理者の迂回を数える

[第Ⅳ部-3](maker-not-approver) で見た「作った者と認める者は別」の規律には、計測があります。GitHub の API から直近の数か月のマージ済みプルリクエストを取り、レビューの判定が空のまま管理者の権限でマージされたものを月ごとに集計します。GitHub のトークンが未設定なら空のデータを返し、画面は「データを取得できず」と表示します[^bypass]。

事後の検証もあります。日次の自動処理が、管理者の迂回でマージされたプルリクエストに自己レビューの証跡の節が含まれているかを確かめ、欠けているプルリクエストに追記を求めるコメントを投稿します。止めはしません。マージ後の取り消しは運用上難しいため、事後の追記を促します。当初は毎時でしたが、日次に緩めました[^bypassyml]。

契約状態の監査は、運営者の画面を開くたびに本番の全行を分類し、表に無い状態の在庫を出します。[第Ⅱ部-12](billing) で見たとおり、Stripe からの通知の処理のテストは「これから書く行」しか見ないため、既に不正な既存の行はこの監査だけが検出します[^opspage]。

## 費用のページが Cost Explorer を呼ぶ

**狙い。** `/ops/costs` で、当月と前月の AWS の費用をサービスごとに見られること。

**起きたこと。** 実装は AWS の費用の照会 API である Cost Explorer を呼び、プロセス内のキャッシュを 1 日持ちます[^opsservice]。[第Ⅲ部-1](serverless-cost) で見た「測るコストが最大の費目」の説明がここにあります。Cost Explorer の API はリクエスト 1 回 $0.01 で、キャッシュは Lambda のプロセス内なのでコールドスタートのたびに消えます。費用のページを開くたびに当月と前月の 2 回、コールドスタートの後なら必ず呼びます。8 月の Cost Explorer の $1.53 は、この画面の閲覧とコールドスタートの積です。

**なぜ。** `infra` 配下の生成AIへの指示書は運営者の画面からの実時間の照会を禁じ、費用のレビューのスキルは API の直接の呼び出しを禁じています。しかし、費用のページはその規律の外に残っていました。規律は生成AIの手作業を縛りますが、既に書かれたコードは縛りません。「動いている」ので落ちません。

**変えたこと。** 画面は改修せず、開かない運用で対処しています。費用を知りたいときは、毎月 1 日の監査の自動処理のログを読めば足りるからです。この画面が規律の外にあることは、この本を書くために原典を読んで初めて分かりました。

**読者のリポジトリでは。** 指示書で禁じている呼び出しを、コードで検索してみてください。禁止より前に書かれたコードは、禁止を知りません。

## 効いたか

必要なときだけ数える方式は、正しい判断でした。常設の収集は、子供のデータを増やし、定期実行を増やし、画面を増やします。「運営者が画面を開いたときだけ」は、コストとプライバシーの両方を最小にします。[第Ⅰ部-6](legal-by-design) で見た「収集しないデータ」の原則の、運営側の実装です。

管理者の迂回の計測は、規律を数字にしたものです。「作った者と認める者は別」は、迂回が 0 でなければ守られていません。数字が画面に出ることで、迂回は「例外」から「記録される事実」になりました。

費用のページは、この本で何度も見た形の再現です。設計書とスキルは禁じているのに、コードは呼んでいる。[第Ⅴ部-4](fitness-functions) の「記録を反証できる形にする」は、こういう残骸のためにありました。

## 持ち帰るもの

- 運営の指標は、常設で集めず、必要なときに本体のデータから数える。集めなければ守る必要も無い
- 自分たちの規律（作った者と認める者は別、など）が守られているかを、顧客の指標と同じ画面で数える
- 指示書で禁じたことを、コードで検索する。禁止より前に書かれたコードは残っている

次の章では、コードではなく画像を生成AIに作らせた記録を扱います。

[^awsdesign]: AWSサーバレスアーキテクチャ設計書の分析基盤の節。採用の方針、必要時だけの集計の部品、分析ページの可視化、接続先の制限との整合、顧客が付く前の段階での範囲。出典: [docs/design/13-AWSサーバレスアーキテクチャ設計書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/13-AWS%E3%82%B5%E3%83%BC%E3%83%90%E3%83%AC%E3%82%B9%E3%82%A2%E3%83%BC%E3%82%AD%E3%83%86%E3%82%AF%E3%83%81%E3%83%A3%E8%A8%AD%E8%A8%88%E6%9B%B8.md)

[^ondemand]: 必要時だけ動く販促の分析の部品。背景（常時の収集の撤去）、読み取りだけの 2 指標、旧 4 段目の除去。出典: [src/lib/server/services/analytics-ondemand-service.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/services/analytics-ondemand-service.ts)

[^cohort]: コホートごとの顧客生涯価値と解約率の推移。計測の点、月ごとのコホートの型。出典: [src/lib/server/services/cohort-analysis-service.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/services/cohort-analysis-service.ts)

[^opspage]: 指標のまとめのページの読み込み。5 つの並列の取得、プランのずれの扱い、契約状態の監査。出典: [src/routes/ops/+page.server.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/routes/ops/%2Bpage.server.ts)

[^bypass]: 管理者の迂回によるマージの月ごとの集計。GitHub の API からの取得、トークン未設定時の扱い。出典: [src/lib/server/services/admin-bypass-metrics-service.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/services/admin-bypass-metrics-service.ts)

[^bypassyml]: 管理者の迂回の証跡を検査する自動処理。日次への緩和、止めない理由。出典: [.github/workflows/admin-bypass-evidence.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/admin-bypass-evidence.yml)

[^opsservice]: 運営者向けの部品の AWS の費用の取得。Cost Explorer の呼び出しと 1 日のプロセス内のキャッシュ。出典: [src/lib/server/services/ops-service.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/services/ops-service.ts)。費用のページは [src/routes/ops/costs/+page.server.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/routes/ops/costs/%2Bpage.server.ts)
