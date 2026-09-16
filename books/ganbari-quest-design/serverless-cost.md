---
title: "第Ⅲ部-1　月額 1〜3 ドルで商用運用する ― 実測の内訳と、測るコストが最大の費目"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

がんばりクエストの AWS は、認証、データベース、CDN、メール、監視、デモ環境、staging を含めて、月 1〜3 ドルで動いています。この章では、毎月 1 日に自動で走る監査 workflow が残した 3 か月分の実測を、費目ごとに公開します。数字は run のログから引いたもので、丸めた以外の加工はしていません。読み終えたときに、フルサーバレスで商用サービスを持つときのお金が、どこにかかり、どこにかからないかが分かるはずです。

## 3 か月の実測

`cost-audit.yml` は毎月 1 日の UTC 0 時に走り、前月の費用をサービス別に出力します[^costaudit]。2026 年 6 月から 8 月の 3 回分です。

| サービス | 6 月 | 7 月 | 8 月 |
| --- | --- | --- | --- |
| AWS Cost Explorer | $0.53 | $0.19 | $1.53 |
| Amazon Route 53 | $0.51 | $0.51 | $0.51 |
| Amazon CloudWatch | $0.18 | $0.35 | $0.73 |
| Amazon ECR | $0.05 | $0.06 | $0.06 |
| Amazon S3 | $0.02 | $0.07 | $0.06 |
| Amazon DynamoDB | $0.015 | $0.012 | $0.001 |
| Amazon Kinesis Firehose | $0.0006 | $0.0036 | $0.0021 |
| AWS Backup | $0.0002 | $0.0005 | $0.0013 |
| Amazon CloudFront | $0.0003 | $0.0011 | $0.0015 |
| Amazon Bedrock（Claude Haiku 4.5 / Sonnet 4.6） | — | — | $0.0006 |
| AWS Lambda / Cognito / Aurora DSQL / SES / SNS | $0 | $0 | $0 |
| 税 | $0.13 | $0.12 | $0.29 |
| 合計 | 約 $1.44 | 約 $1.32 | 約 $3.19 |

出典は GitHub Actions の run ログです[^run06][^run07][^run08]。ドメインの年額は AWS の請求に含まれません。設計書は年額を 12 で割って月 117 円と見積もっています[^awsdesign]。

## 顧客に届く部分は 0 ドル

表で目を引くのは、顧客のリクエストを処理する部分がすべて 0 ドルであることです。Lambda は月 100 万リクエストの無料枠、Cognito は 5 万 MAU の無料枠、Aurora DSQL は月 10 万 DPU と 1GB の無料枠の中に収まっています。DSQL は scale-to-zero で idle の課金が無く、PoC の実測では 1 日の TotalDPU が 3.53、枠の 0.0035% でした[^dsqlstack]。

これは設計の結果でもあります。Lambda は ARM64 で x86 より 20% 安く、Provisioned Concurrency は採用せず cold start を許容しています。CloudFront は静的アセットを S3 から配信して Lambda の呼び出しを減らし、DSQL の書き込みは 1 トランザクションごとの最小課金を避けるために束ねます。DSQL の 5 原則は、アプリケーションアーキテクチャの部で扱います。

## 固定費は Route 53 と CloudWatch

かかっているのは固定費です。Route 53 の hosted zone が月 $0.50 で、これは 3 か月とも同じです。CloudWatch は 6 月の $0.18 から 8 月の $0.73 に増えました。CloudWatch の alarm は 10 本まで無料で、超えた分は 1 本 $0.10 です。現在の OpsStack は 17 本の alarm を定義しているので、超過分 7 本で $0.70 になり、8 月の実測にほぼ等しい額です[^opsstack]。[第Ⅲ部-5](observability) で見るとおり、alarm は 2026 年 8 月に大きく増えました。監視を足すと、その分だけ請求が増えます。

ECR は Lambda のコンテナイメージの保管で、本番 repo が最新 10 世代、staging repo が 3 世代を保持します。staging の固定費はこの repo だけで、設計書は「idle ≈ 0 円、ECR repo が月 $0.05〜0.15」と見積もっています[^awsdesign]。S3 と Firehose は、CloudWatch Logs を S3 に archive する経路と、顧客の写真や export の保管です。DynamoDB は 2026 年 7 月に撤去済みで、8 月の $0.001 は RETAIN で残した旧テーブルの残骸です。

Bedrock の $0.0006 は、AI 提案に使った Claude Haiku 4.5 と Sonnet 4.6 の 8 月分です。1 か月で 1 円未満。AI を前面に出さない設計は、コストの面でもこの規模に収まります。

## 測るコストが最大の費目

3 か月のうち 2 か月で最大の費目は、AWS Cost Explorer です。6 月 $0.53、8 月 $1.53。Cost Explorer の API はリクエスト 1 回 $0.01 で無料枠がありません[^infraclaude]。月次の監査 workflow が呼ぶのは 2 回なので、それだけなら 2 セントです。残りは調査のために手元から呼んだ分ですが、誰が何回呼んだかの記録はありません。

この費目があるため、リポジトリには「コストを見る」ための規律があります。cost-review の skill は `aws ce get-cost-and-usage` と `get-cost-forecast` を禁止し、使ってよいのは月次監査の出力、AWS Budgets のアラート、事業計画書の原価予測表だけとしています[^costreview]。infra の CLAUDE.md は、定期取得を 1 日 1 回に制限し、運営画面からのリアルタイム参照と CI からの呼び出しを原則禁止にしています[^infraclaude]。8 月の $1.53 は、この規律が守られなかった月の実測でもあります。

## 予算と設計書の見積もり

2026-04-09 のコスト管理計画書は、目標を月 $10 以下、AWS Budgets のアラートを $50 と書いています。損益分岐点は「有料ユーザー 30 人、月 $100 の収益で AWS $10 をカバー」です[^costplan]。実際の OpsStack が置いている Budgets は月 $5 で、実績 50%、実績 80%、予測 100% の 3 段階で通知します[^awsdesign]。設計書の $50 は古い値のまま残っています。

設計書の見積もりは、リクエストが無いときで月 $0.60、1,000 家庭で $0.80 です[^awsdesign]。実測の $1.3〜3.2 との差は、監視と Cost Explorer です。見積もりは「顧客に届く部分」を正しく当て、「運用のために足したもの」を数えていませんでした。

計画書のスケーリング表（100 ユーザーで $1、10,000 ユーザーで $45）は DynamoDB を前提に書かれたもので、DSQL に移行した現在は根拠が変わっています。表は更新されていません[^costplan]。

## 今ならこうする

まず、Cost Explorer を手で叩かないことです。費用を知りたいときは月次監査のログを読めばよく、それで足りないなら Budgets の閾値を下げる方が安く済みます。

次に、alarm の本数です。17 本のうち 7 本が有料で、月 $0.70 です。金額は小さいのですが、「監視を足すと請求が増える」構造は、[第Ⅳ部-8](platform-session) の「装置を足すことが安すぎる」と同じ問題を、AWS の請求という形で見せています。無料枠の 10 本に収める設計を最初にしていれば、何を監視するかを選ぶ判断が早く来たはずです。

最後に、設計書の数字です。$50 の予算、DynamoDB 前提のスケーリング表、$0.60 の見積もり。どれも書いた時点では正しく、その後の変更に追随していません。コストの設計書は、実測を貼る場所にした方が、見積もりを書く場所にするより役に立ちます。

[^costaudit]: 月次のコストとリソースの監査 workflow。CloudFormation の resource 数、Lambda / S3 / ECR / Cognito / CloudWatch の inventory、前月と当月の Cost Explorer 集計、orphan リソースの検出。出典: [.github/workflows/cost-audit.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/cost-audit.yml)

[^run06]: 2026 年 6 月分の監査 run（2026-07-01 実行）。出典: [GitHub Actions run 28484804412](https://github.com/Takenori-Kusaka/ganbari-quest/actions/runs/28484804412)

[^run07]: 2026 年 7 月分の監査 run（2026-08-01 実行）。出典: [GitHub Actions run 30675194195](https://github.com/Takenori-Kusaka/ganbari-quest/actions/runs/30675194195)

[^run08]: 2026 年 8 月分の監査 run（2026-09-01 実行）。出典: [GitHub Actions run 33462033899](https://github.com/Takenori-Kusaka/ganbari-quest/actions/runs/33462033899)

[^awsdesign]: AWSサーバレスアーキテクチャ設計書。§3.4 OpsStack の Budgets（月 $5、3 段階）、§4.3 AWS staging のコスト（idle ≈ 0 円、ECR repo のみ）、§6 コスト試算（無リクエスト時 $0.60、1,000 家庭 $0.80、ドメイン 117 円）。出典: [docs/design/13-AWSサーバレスアーキテクチャ設計書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/13-AWSサーバレスアーキテクチャ設計書.md)

[^dsqlstack]: DSQL stack のコスト前提。無料枠 10 万 DPU / 月と 1GB、scale-to-zero、PoC 実測 TotalDPU 3.53、「100 円 / 月を超えない」の機械検知。出典: [infra/lib/dsql-stack.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/lib/dsql-stack.ts)

[^opsstack]: OpsStack の CDK 定義。`alarmName` を持つ alarm は 17 本。出典: [infra/lib/ops-stack.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/lib/ops-stack.ts)

[^infraclaude]: infra 配下の CLAUDE.md。§AWS Cost Explorer API 使用制限（25 回 / 秒、$0.01 / リクエスト、12〜24 時間の反映遅延、1 日 1 回上限、リアルタイム参照と CI 呼び出しの禁止）。出典: [infra/CLAUDE.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/CLAUDE.md)

[^costreview]: cost-review skill。使ってよい情報源と禁止コマンド、Year 1 の原価枠（月 1,500 円）。出典: [.claude/skills/cost-review/SKILL.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.claude/skills/cost-review/SKILL.md)

[^costplan]: コスト管理計画書（2026-04-09）。サービス別の目標とアラート閾値、$50 の Budgets、スケーリング表、損益分岐点。出典: [docs/design/35-コスト管理計画書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/35-コスト管理計画書.md)
