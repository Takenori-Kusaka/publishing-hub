---
title: "第Ⅱ部-12　課金 ― 23 回失敗したライセンスキー、Stripe を SSOT にする、4 列の契約状態"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

課金は、この製品で最も作り直された領域です。最初の設計はライセンスキーで、23 回失敗しました。2026 年 5 月にゼロベースで再設計し、Stripe の Subscription をプランの状態の SSOT にしました。この章では、なぜライセンスキーが失敗したか、業界標準をそのまま採る判断、webhook の冪等性、そして `families` の 4 列がどの組み合わせを許すかを 1 枚にした契約状態マトリクスを扱います。

## 23 回の失敗

再設計の方針書は、現状を「正しく購入してライセンスを紐づけられた実績がない未完成状態」と書いています。ライセンスキーは顧客が触れるコア機能で、購入の証とアクティベーションの鍵でした。その方式で 23 回失敗し、3 つの期限の SSOT が並存し、2 つの認可経路があり、設計書の TODO 6 件が 1.5 か月放置されている構造的問題が露見しました[^policy]。

基本方針は 6 つです。

1. 課金フローは差別化要素ではない。業界標準と Stripe 公式の推奨をそのまま採択し、独自設計しない
2. ライセンスキーを撤廃し、Stripe の Subscription をプラン状態の SSOT にする
3. 買い切りを廃止し、subscription に一本化する。NUC の「無制限」は課金ではなく Edition の配布形態として表現する
4. account-first。signup、login、checkout の順で、未ログイン購入と後紐づけは採らない
5. webhook が権限付与の SSOT。redirect や success_url では権限を付与しない
6. 任意タイミングのトライアル。カード登録なし、無料プランと共存、1 回制限は自社管理

原則 1 が、この方針書の核です。「コア価値は子供のゲーミフィケーション体験であり、購入フローで差別化しない」。[第Ⅱ部-1](stack-selection) の「OSS を先に探す」と同じ姿勢で、フローそのものを Stripe の SaaS ガイドから写しています[^policy]。

トライアルは 7 日で、カード登録なし。7 日後にカード未登録なら自動で cancel されて無料プランに戻り、登録済みなら課金が始まります。1 回制限は Stripe に built-in が無いため、家族単位で自社のフラグで管理します。Stripe 公式が「アプリ側で管理せよ」と明言している箇所です[^policy]。

## 「完了」のあとに 142 か所

ライセンスキーの撤廃は、一度「完了」と報告されました。その後、PO が 5 秒の grep で LP とアプリに「ライセンスキー」の言及が 125 ファイル以上残っていることを見つけました。アプリの `src/` に 142 か所（28 ファイル）、LP に 3 ファイル、メールのテンプレート。「Stripe Subscription に移行したはずの顧客接点で『ライセンスキー』を読ませ続ける意味破綻状態」で、「漏れたらそこだけやる」を繰り返した構造的失敗の集大成と書かれています[^licremoval]。

補強の要件定義には、設計書自身の自己矛盾の発見も記録されています。ある要件は「NUC edition ではライセンスキーだけが billing proof」と書いていましたが、上位の 2 つの SSOT は既に全廃を明記していました。NUC は「全機能無制限、課金なし」なので billing proof は不要で、その記述は stale でした。実コードの照合では、SaaS の認可は既に subscription ベースで、`licenseStatus` は `tenant.stripeSubscriptionId` と `tenant.status` から計算され、ライセンスキーを読んでいませんでした。撤廃は「移行」ではなく「冗長層の除去」でした[^licremoval]。

[第Ⅳ部-4](definition-of-done) で見た「全対応完了」の 10 項目検証は、この事故が起点の 1 つです。[第Ⅴ部-7](security-scans) で見た「ライセンスキーの再導入禁止」の grep は、再発を機械で止める装置です。

## webhook の冪等性

Stripe の webhook は at-least-once の配送で、同一の event.id が複数回到達することが正規の動作です。当初の実装は署名検証のあと event.id を検査せずに handler を呼んでいました。放置すると、checkout 完了の重複で welcome メールが 2 通と entitlement の二重適用、支払い失敗の重複で past_due と active の遷移の振動、subscription 削除の重複で解約と再活性化の振動が起きます[^webhook]。

対処は event.id の dedup table で、handler 横断の機構を dispatcher の入口 1 か所に置き、全 event 型を一律に処理します。event 型別に dedup を分散させると 8 か所に散在し、将来の追加時の漏れの温床になるためです。購読する event は 5 種から 8 種に増え、ダウングレードの予約の終了、Portal での予約取消、期末の適用完了を検知します[^webhook]。

webhook が届かない沈黙は、[第Ⅲ部-5](observability) で見た「沈黙する障害」の alert が検知します。Stripe が配信成功として扱っているのにその event が台帳に無い「受け取って捨てている」状態も、別の alert です。

## 4 列の契約状態

課金の設計文書は 47 本あります。機能軸（解約・dunning・プラン変更・復帰・冪等性）では網羅されていました。しかし `families` の 4 列（status・plan・stripe_subscription_id・plan_expires_at）の組み合わせとして許される状態の一覧が無く、軸をまたぐ矛盾がレビューで検出できませんでした。実際に `grace_period` の二重定義、チャーンを書き手のいない状態で数える、といった欠陥が実際に複数起きました[^matrix]。

| 状態 | status | plan | sub | 意味 |
| --- | --- | --- | --- | --- |
| S1 未課金 | active | なし | なし | サインアップ直後、トライアル |
| S2 課金中 | active | あり | あり | 正常な有料契約 |
| S3 支払い失敗猶予 | grace_period | あり | あり | dunning 中。有料機能は維持 |
| S4 停止 | suspended | あり | あり | Stripe が unpaid や paused。復帰しうる |
| S5 契約終了 | suspended | なし | なし | 解約が確定した終端 |

原則は 3 つです。`status` は Stripe の状態を写したもので、退会の状態ではない（退会は別の表が持つ別軸）。`plan` と `stripe_subscription_id` は同時に生きるか同時に消えるかで、片方だけ残る状態は不正。導出値に新しい分岐を足す前に、この表に行を足せるかを先に確認する[^matrix]。

チャーンの判定は S5 で、`suspended` は S4 も兼ねるため `status` 単独では判定できません。判定関数を SSOT にし、KPI の service はすべてそれを経由し、直接比較は fitness function が禁止します。設計書は既知の残課題も書いています。退会は行ごと消えるため KPI から観測できない。当月チャーンの時刻軸が `updated_at` に依存し、過去に解約したテナントが当月に再計上されうる。解約時刻を持つ列が無い限り構造的に解けない[^matrix]。

4 列を書く経路は 9 か所で、実読して表にしています。checkout 完了、invoice の支払い、支払い失敗、subscription の更新、subscription の削除、そしてアプリ内の解約と取消は「書かない」（Stripe に期末解約を予約するだけで、期末に webhook が S5 へ移す）。表に無い状態の検出は、CHECK 制約ではなくドメイン層の判定関数と定期監査を採りました。DSQL は ALTER の後付けに制約があり、「不正状態を書き込む経路を塞ぐのが先で、DB 側で弾いても書き手の bug は残る」からです。webhook handler の書き込み後の状態を分類して assert するテストが「意図と効果の乖離」を落とし、`/ops` を開くたびに本番の行を分類する監査が既存の不正行を検出します[^matrix]。

![4 列の契約状態](/images/ganbari-quest-design/billing.png)

## 解約、ダウングレード、猶予

アプリ内の解約には、理由のヒアリングが必須です。3 分類と自由記述を保存し、Stripe の Customer Portal へ渡す前段で呼びます。引き止め UI は出しません。離脱のトリガーになるからで、[第Ⅰ部-2](anti-engagement) の原則です。「卒業」を選ばれた場合もポジティブに祝います[^cancellation]。

ダウングレードは、上限を超えるリソースを親が選んでアーカイブする方式です。自動ではなく保護者の選択制で、上限内に収まる選択だけが成立します[^downgrade]。退会は soft delete で、プラン別の猶予期間内なら復元できます。無料は 0 日で即時、スタンダードは 7 日、家族は 30 日です[^grace]。

Stripe のエラーメッセージには顧客の PII が含まれることがあり、Discord や監視へ送る前に redact します。当初の実装は 3 種の bypass で false negative を起こしました。全角英数やキリル文字の look-alike で email の正規表現がマッチしない、punycode のドメインで latin のドメインの正規表現が bypass される、カード番号の空白区切りを 16 桁の正規表現が捕捉しない。adversarial なレビューが security 軸の critical として検出し、3 種すべてに対応しました[^piiredaction]。

## 今ならこうする

ライセンスキーの 23 回は、「課金フローで差別化しない」という判断が無かったことの代償です。独自の鍵、独自の期限、独自の認可経路。それぞれは動いていましたが、組み合わせが破綻しました。Stripe の SaaS ガイドをそのまま写した再設計は、独自性を捨てることで正しさを得ました。

契約状態マトリクスは、47 本の設計文書があっても 1 枚の表が無ければ矛盾は見つからない、という教訓です。生成AIは機能軸で文書を書きます。webhook の handler ごと、フローごと。列の組み合わせという横断の視点は、人が「1 枚にせよ」と要求するまで現れませんでした。

「完了」のあとに 142 か所が残っていた事故は、[第Ⅳ部-4](definition-of-done) の起点です。完了を宣言する側と検証する側が同じ AI では、grep 1 回の検証さえ抜けます。

[^policy]: ライセンスキー撤廃と Stripe Subscription SSOT 化の方針書。背景と課題（23 回の失敗、3 SSOT と 2 認可経路）、スコープ、基本方針 6 つ、業界標準フロー、トライアル設計、lifetime 廃止。出典: [docs/design/billing-redesign/billing-redesign-policy.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/billing-redesign/billing-redesign-policy.md)

[^licremoval]: license key 完全全廃の要件定義。「完了」報告後の 142 か所、FR-5 の自己矛盾、認可モデルは「冗長層の除去」。出典: [docs/design/billing-redesign/phase1-license-key-removal-final-requirements.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/billing-redesign/phase1-license-key-removal-final-requirements.md)

[^webhook]: Stripe webhook の冪等性 DB 設計。at-least-once による 3 つの振動、dispatcher 入口 1 か所の dedup、購読 event の 5 → 8 種。出典: [docs/design/billing-redesign/phase5-webhook-idempotency-architecture.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/billing-redesign/phase5-webhook-idempotency-architecture.md)

[^matrix]: 契約状態マトリクス。設計背景（47 本の文書に無かった 1 枚の表）、設計原則 3 つ、S1〜S6、チャーンの判定と残課題、遷移トリガー 9 か所、表に無い状態を検出する手段の決定。出典: [docs/design/billing-redesign/contract-state-matrix.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/billing-redesign/contract-state-matrix.md)

[^cancellation]: 解約理由ヒアリングの service。3 分類と自由記述、anti-engagement の原則。出典: [src/lib/server/services/cancellation-service.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/services/cancellation-service.ts)

[^downgrade]: ダウングレード前の超過リソースの選択アーカイブ。出典: [src/lib/server/services/downgrade-service.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/services/downgrade-service.ts)

[^grace]: プラン別の削除後グレースピリオド。出典: [src/lib/server/services/grace-period-service.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/services/grace-period-service.ts)

[^piiredaction]: Stripe のエラーメッセージの PII redaction。3 種の bypass と対応。出典: [src/lib/server/stripe/pii-redaction.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/stripe/pii-redaction.ts)
