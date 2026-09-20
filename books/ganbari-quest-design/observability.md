---
title: "第Ⅲ部-5　監視と通知 ― 17 本の alarm、届いて初めて監視、沈黙する障害"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

本番の CloudWatch alarm は、2026 年 8 月まで宛先が 0 件でした。SNS の topic に subscription が無く、鳴っても誰にも届きません。同じ形の欠陥が、NUC のバックアップが 18 晩失敗しても通知 0 通、Lambda の incident 通知が一度も飛んでいない、と 3 つ並んで見つかりました。この章では、宛先ゼロが 4 か月続いた理由、その修正から生まれた「既定は届ける」の方針、そしてエラーにならないまま壊れている障害をどう見つけるかを扱います。読み終えたとき、「その程度の通知で本当によかったのか」という疑問に、私なりの答えが示せているはずです。

## 2 層の外形監視

稼働監視は 2 層に分かれています。L1 はアプリ層で、health-check Lambda が 1 時間ごとに `/api/health` を GET し、失敗と劣化を Discord に通知します。L2 はエッジ層で、CloudFront、Route 53、ACM、geoRestriction の障害を見る層ですが、これは作られていません[^awsdesign]。

L1 が CloudFront ではなく Lambda の Function URL を直接叩くのは、CloudFront に日本のみの geoRestriction が掛かっているためです。`us-east-1` の Lambda から公開ドメインを叩くと常に 403 になります。導入時の盲点で、Function URL に切り替えて「L1 = アプリ層の生存確認」に責務を絞りました。prober は依存の無い Node の https で書かれ、前回の通知状態を SSM に記憶して復旧時に通知し、週次のハートビートも送ります[^prober]。

## 17 本の alarm

OpsStack が定義する alarm は 17 本です。設計書の表は代表的な 10 本を載せ、残りは「本表に掲載しない」と明記しています[^awsdesign]。

| alarm | 条件 |
| --- | --- |
| Lambda-Errors | 5 分で 3 回以上 |
| Lambda-Throttles | 5 分で 1 回以上 |
| Lambda-Duration-p99 | 10 秒以上 |
| Lambda-URL-5xx | 5 分で 5 回以上 |
| CloudFront-5xx | 5xx 率 5% 以上 |
| CronDispatcherErrors | 5 分で 1 回以上 |
| EntitlementFailClosed | 15 分内の 2 つの 5 分 window で 1 件以上 |
| EntitlementFailClosedBurst | 同一 5 分 window に 3 件以上 |

最後の 2 本は同じ metric を異なる評価窓で見る対です。課金状態を DB から解決できないとき、アプリは古い Cookie の値で有料機能を通し続けないために context を発行せず、503 を返します（fail-closed）。この判断を PO が承認した前提は「起きたら気づけること」でした。継続判定の alarm は「15 分続く低頻度の障害」を捕まえますが、本番では「同一 5 分 window に 4 件、その後 1 時間平常」という burst が未通知のまま起きました。burst 用の alarm を足したのは、そのあとです[^alertpolicy]。

dashboard は 1 枚で、Lambda の呼び出しとエラー、Duration の p50 と p99、throttle と同時実行、alarm の状態を表示します[^opsstack]。

## 4 か月、誰にも届いていなかった

alarm の定義は 2026 年 3 月末からありました。SNS の topic もありました。無かったのは topic の subscription、つまり宛先です。alarm を作る作業と、alarm が届くことを確かめる作業は別で、前者だけを生成AIに任せると後者が抜けます。CloudFormation は「宛先の無い topic」を正常として deploy し、alarm は ALARM 状態になり、誰も見ないまま OK に戻ります。

気づいたのは 2026 年 8 月、NUC のバックアップが 18 晩失敗しても通知が 0 通だったときです。調べると、本番の CloudWatch alarm と Lambda の incident 通知も同じ状態でした。その間に本番で起きていた障害は、後述の cron の 401（稼働開始から 4 か月間成功ゼロ）と、AI 提案の 100% fallback（[第Ⅱ部-11](ai-suggest)）です。どちらも alarm が鳴る条件を満たしていませんでした。前者は cron dispatcher が非 2xx を throw しないため Lambda Errors に数えられず、後者は応答が 200 だったからです。つまり、宛先があっても届かなかった障害です。

その通知量でよかったのか、という問いには 2 つの答えがあります。顧客の側から見れば、よくありませんでした。AI 提案は 1 か月以上動かず、cron が担うリマインダーや保持期間の掃除は 4 か月止まっていました。ただし Pre-PMF の顧客数の下で、それが誰かの金やデータを失わせた記録はありません。運用の側から見れば、「宛先が無い」は最悪の状態ではありませんでした。最悪なのは、宛先を繋いだ直後に起きた「平常時から鳴り続ける」状態です。通知が捌けなくなり、本物の障害が同じ見た目で埋もれます。

## 既定は届ける

宛先を繋ぐと、次に「鳴りすぎ」が来ます。ここで通知を止める方向に倒すと監視が消えます。オーナーの判断は、鳴りすぎは握りつぶす理由ではなく、恒常的に起きる障害を早期回復や例外処理で直す理由だ、というものでした[^alertpolicy]。

方針は `ops-alert-policy.ts` に表として置かれ、既定は「届ける」です。鳴りすぎたときの対処は順に 3 つで、原因を直す、それでも平常時に鳴るなら閾値と評価期間を調整する、その作業が進行中の間だけ暫定的に抑止する。抑止には、何がどれくらいの頻度で鳴っているかの実測と、是正を進めている Issue か PR の番号が必須で、参照の無い抑止は CI が弾きます。OpsStack の作る alarm は全件をこの表に載せなければならず、載っていない alarm が増えると test は落ちます[^alertpolicy]。

17 本の alarm のうち、この方針の下で抑止されているものはありません。無料枠の 10 本を超えた 7 本は、[第Ⅲ部-1](serverless-cost) で見たとおり月 0.70 ドルの請求になります。監視を足すと請求が増える、という構造は、装置を足すことが安すぎる（[第Ⅳ部-8](platform-session)）問題の、AWS の請求という形の現れです。

![既定は届ける](/images/ganbari-quest-design/observability.png)

## 転送の失敗は投げずに数える

SNS と Discord の間には転送 Lambda があります。SNS の subscription filter でも近いことはできますが、判定根拠（何がどれくらい鳴っていて、どの Issue で直しているか）をコードに残せないため、方針表を読む Lambda を挟みます。`notify: false` の alarm も CloudWatch 上には存在し、転送 Lambda の log に「抑止した」ことが残ります[^forwarder]。

転送の失敗は、例外を投げずに数えます。理由は 3 つです。呼び出し元が SNS の非同期呼び出しで、例外を投げると Lambda が最大 2 回リトライし、複数 record のうち後ろだけ失敗した場合に前の record が再送されて同じ通知が重複する。失敗の検知を Lambda のリトライ意味論に依存させたくない。一方で握り潰したままにはせず、成否を構造化 log に出して metric 化し、失敗は専用の alarm で拾う。「落とさない」と「気づけない」を切り離す設計です[^forwarder]。

この専用 alarm には自己参照の限界があります。alarm 自身も同じ転送経路を通るため、Discord が完全に不達な間はこの通知も届きません。届くのは一部だけ落ちた場合で、実際に起きるのは主にこちらです。届かない場合の検知を通知に足すこと（外形監視）は Pre-PMF では過剰と判断し、metric を残すところまでとしています[^alertpolicy]。

## 顧客識別子を載せない

アプリからの Discord alert には、顧客識別子を載せません。Discord は外部の SaaS で、embed はチャットログとして永続化されます。alert は「何が起きたか」だけを送り、「誰に起きたか」は送りません。旧実装が持っていた `tenantId` の field は撤去され、型からも消してあります。callsite が渡せない、コンパイルで落ちる形です。調査の導線は失われていません。各 callsite は同じ内容を logger に tenantId 付きで出しており、alert に載る `requestId` から CloudWatch Logs で引けます[^discordalert]。

## 沈黙する障害

「エラーが飛ばないまま壊れている」種類の障害は、Lambda Errors や 5xx の alarm では表面化しません。runbook は 5 つの alert を並べています。課金状態を DB から解決できず認証済みユーザーが 503 を受けている（fail-closed の 2 本）。Stripe の webhook がアプリに届かず、支払い済みのプランは反映されていない。Stripe は配信成功として扱っているのにその event が台帳に無い（受け取って捨てている）。そしてその未達検知の cron 自体が失敗している[^silentrunbook]。

最後のものは、検知の検知です。cron dispatcher は非 2xx を throw しないため、cron の中の失敗は Lambda error の alarm では表面化しません。だから、検知の cron が失敗したことを別の alert で送ります。

同じ class に AI の fallback があります。AI 提案の呼び出しが全部落ちても、応答は HTTP 200 で、顧客と運営のどちらも画面からは気づけません。2026 年 8 月の本番障害では、base model の ID を on-demand で呼べず全リクエストが ValidationException になり、丸一日以上 100% fallback のまま、発見はオーナーの手動実行でした。alarm は「件数」と「率」の両方を掛けます。15 分の window で失敗 2 件以上かつ 50% 以上。単発の throttle や timeout は 1 件なので鳴らず、100% 壊れていれば 2 件目で鳴ります[^alertpolicy]。

## ログの行き先

アプリの log は CloudWatch Logs に 30 日保持され、課金経路の post-mortem の SSOT と位置づけられています。全 log event は subscription filter で Firehose に流れ、GZIP で S3 に archive されます。CDK の GA L2 construct を使い、L1 と手動の IAM role 2 本で約 60 行だったものが約 20 行になりました[^computestack]。CloudFront のアクセスログは S3 に 3 日だけ保持し、cookie は記録せず、リアルタイムログと分析基盤は作りません[^awsdesign]。

log に何を書くかは、別の問題です。2026 年 9 月に、おやカギコードと保護者のメールアドレスが CloudWatch に平文で出ていることが見つかりました。ログの設計と PII のマスクは [第Ⅱ部-13](errors-and-logs) で扱います。

## 今ならこうする

宛先ゼロは、この製品で最も長く続いた欠陥の 1 つです。[第Ⅴ部-4](fitness-functions) の「検査していないのに pass と出る class」と同じ形が、監視にもありました。deploy の後に alarm の宛先を検証する step が入ったのは、[第Ⅲ部-4](deploy-gates) で見たとおりです。次に同じ規模のものを作るなら、alarm を 1 本書く前に「届いたことを確かめる smoke」を 1 本書きます。

「既定は届ける」の方針表は、うまくいった判断です。alarm を減らす圧力と増やす圧力の両方を、理由付きの 1 つの表で受け止めています。生成AIは alarm を書きたがり、また鳴りすぎると止めたがります。どちらの圧力にも、実測と是正の参照を要求する表が、判断の置き場になりました。

「その通知量でよかったのか」への私の答えは、こうです。よくなかった。しかし、通知の本数を増やすことは答えではありませんでした。届くことを確かめる 1 本と、沈黙する障害（応答が 200 のまま壊れる、cron が失敗しても throw しない）を数える alarm の方が、17 本の閾値の調整より効きました。

[^awsdesign]: AWSサーバレスアーキテクチャ設計書。§3.4 OpsStack（alarm の代表表、dashboard、Budgets、外部ヘルスチェック prober の 2 層と Function URL 直叩きの理由）、§3.5 NetworkStack（アクセスログの 3 日保持）。出典: [docs/design/13-AWSサーバレスアーキテクチャ設計書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/13-AWSサーバレスアーキテクチャ設計書.md)

[^prober]: 外部ヘルスチェックの prober Lambda。1 時間ごとの実行、Function URL 直叩きの理由、scope 外の層、SSM による状態記憶と週次ハートビート。出典: [infra/lambda/health-check/index.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/lambda/health-check/index.ts)

[^alertpolicy]: alarm の通知方針 SSOT。既定「届ける」、オーナーの 2026-08-07 の言葉、抑止の 3 段の順序と条件、no-silent-gap、各 alarm の理由（entitlement の burst、AI fallback の件数と率、転送失敗 alarm の自己参照の限界）。出典: [infra/lib/ops-alert-policy.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/lib/ops-alert-policy.ts)

[^opsstack]: OpsStack の CDK 定義。17 本の alarm、dashboard の widget、SNS、Budgets。出典: [infra/lib/ops-stack.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/lib/ops-stack.ts)

[^forwarder]: SNS から Discord への転送 Lambda。Lambda を挟む理由、抑止した通知が log に残ること、転送失敗を投げずに数える 3 つの理由。出典: [infra/lambda/ops-alert-forwarder/index.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/lambda/ops-alert-forwarder/index.ts)。運用手順は [docs/runbooks/ops-alert-notification.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/runbooks/ops-alert-notification.md)

[^discordalert]: アプリからの Discord alert。顧客識別子を載せない設計、`requestId` による調査の導線、redaction の単一化。出典: [src/lib/server/discord-alert.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/discord-alert.ts)

[^silentrunbook]: 沈黙する障害の alert 一次対応 runbook。5 つの alert と通知経路、entitlement fail-closed の意味と発火条件。出典: [docs/runbooks/silent-failure-alert-response.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/runbooks/silent-failure-alert-response.md)

[^computestack]: ComputeStack の log 設定。30 日保持、CloudWatch Logs から Firehose 経由で S3 への archive（GA L2 construct）。出典: [infra/lib/compute-stack.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/lib/compute-stack.ts)

