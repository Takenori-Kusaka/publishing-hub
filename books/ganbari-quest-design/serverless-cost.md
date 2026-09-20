---
title: "第Ⅲ部-1　月額 1〜3 ドルで商用運用する ― 実測の内訳と、測る費用が最大の費目"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

個人が商用サービスを AWS に置くと、月にいくら掛かるのか。がんばりクエストの AWS は、認証、データベース、配信、メール、監視、デモ環境、検証環境を含めて、月 1〜3 ドルで動いています。では、その 1〜3 ドルは何に払っているのか。

顧客のリクエストを処理する部分には、1 円も払っていません。払っているのは固定費と、監視と、費用を測る費用です。

## 3 か月の実測

毎月 1 日の朝、費用の監査が自動で走り、前月の請求をサービス別に書き出します[^costaudit]。2026 年 6 月から 8 月の 3 回分を、そのまま並べます。数字は自動処理のログから引いたもので、丸めた以外の加工はしていません。

| サービス | 6 月 | 7 月 | 8 月 |
| --- | --- | --- | --- |
| Cost Explorer（費用の照会） | $0.53 | $0.19 | $1.53 |
| Route 53（ドメインの名前解決） | $0.51 | $0.51 | $0.51 |
| CloudWatch（監視） | $0.18 | $0.35 | $0.73 |
| ECR（コンテナイメージの保管） | $0.05 | $0.06 | $0.06 |
| S3（ファイルの保管） | $0.02 | $0.07 | $0.06 |
| DynamoDB（撤去済みのデータベース） | $0.015 | $0.012 | $0.001 |
| Firehose（ログの転送） | $0.0006 | $0.0036 | $0.0021 |
| AWS Backup（バックアップ） | $0.0002 | $0.0005 | $0.0013 |
| CloudFront（配信） | $0.0003 | $0.0011 | $0.0015 |
| Bedrock（生成AI。Claude Haiku 4.5 と Sonnet 4.6） | — | — | $0.0006 |
| Lambda / Cognito / Aurora DSQL / SES / SNS | $0 | $0 | $0 |
| 税 | $0.13 | $0.12 | $0.29 |
| 合計 | 約 $1.44 | 約 $1.32 | 約 $3.19 |

出典は GitHub Actions の実行ログです[^run06][^run07][^run08]。ドメインの年額は AWS の請求に含まれません。設計書は年額を 12 で割って月 117 円と見積もっています[^awsdesign]。

## 顧客に届く部分は 0 ドル

表で目を引くのは、顧客のリクエストを処理する部分がすべて 0 ドルであることです。Lambda は月 100 万リクエストの無料枠、Cognito は月 5 万人の利用者までの無料枠、Aurora DSQL は月 10 万 DPU（Aurora DSQL の課金単位）と 1GB の無料枠の中に収まっています。Aurora DSQL は使わないときの課金が無く、試作の実測では 1 日の使用量が 3.53 DPU、枠の 0.0035% でした[^dsqlstack]。

これは設計の結果でもあります。Lambda は ARM64（省電力の命令セット）で x86 より 20% 安く、常時待機（Provisioned Concurrency、あらかじめ起動しておく Lambda の機能）は採用せず、初回起動の遅れであるコールドスタートを許容しています。CloudFront は静的ファイルを S3 から配信して Lambda の呼び出しを減らし、Aurora DSQL への書き込みは 1 件ごとの最小課金を避けるために束ねます。書き込みの 5 原則は [第Ⅱ部-6](aurora-dsql) で扱います。

## 固定費は Route 53 と CloudWatch

掛かっているのは固定費です。Route 53 のドメインの管理単位が月 $0.50 で、これは 3 か月とも同じです。CloudWatch は 6 月の $0.18 から 8 月の $0.73 に増えました。CloudWatch の警報は 10 本まで無料で、超えた分は 1 本 $0.10 です。現在の監視のスタックは 17 本の警報を定義しているので、超過分 7 本で $0.70 になり、8 月の実測にほぼ等しい額です[^opsstack]。[第Ⅲ部-5](observability) で見るとおり、警報は 2026 年 8 月に大きく増えました。監視を足すと、その分だけ請求が増えます。

ECR は Lambda のコンテナイメージの保管で、本番用は最新 10 世代、検証環境用は 3 世代を保持します。検証環境の固定費はこの保管だけで、設計書は「待機中はほぼ 0 円、保管が月 $0.05〜0.15」と見積もっています[^awsdesign]。S3 と Firehose は、CloudWatch のログを S3 に退避する経路と、顧客の写真や書き出したデータの保管です。DynamoDB は 2026 年 7 月に撤去済みで、8 月の $0.001 は消さずに残した旧テーブルの残骸です。

Bedrock の $0.0006 は、AI 提案に使った Claude Haiku 4.5 と Sonnet 4.6 の 8 月分です。1 か月で 1 円未満。生成AIを前面に出さない設計は、費用の面でもこの規模に収まります。

## 測る費用が最大の費目

3 か月のうち 2 か月で最大の費目は、Cost Explorer です。6 月 $0.53、8 月 $1.53。Cost Explorer の照会は 1 回 $0.01 で無料枠がありません[^infraclaude]。月次の監査が呼ぶのは 2 回なので、それだけなら 2 セントです。残りの大半は、運営者の費用ページが呼んでいます。[第Ⅱ部-16](ops-console) で見るとおり、そのページは当月と前月の 2 回を照会し、キャッシュは Lambda のプロセス内にしか無いためコールドスタートのたびに消えます。

この費目があるため、リポジトリには「費用を見る」ための規律があります。費用を確かめるスキルは照会のコマンドを禁止し、使ってよいのは月次の監査の出力、AWS Budgets（予算の警報）、事業計画書の原価予測表だけとしています[^costreview]。インフラの指示書は、定期取得を 1 日 1 回に制限し、運営画面からの即時参照と自動検査からの呼び出しを原則禁止にしています[^infraclaude]。8 月の $1.53 は、この規律の外に残った画面が生んだ実測です。

## 予算と設計書の見積もり

2026 年 4 月 9 日の費用の管理計画書は、目標を月 $10 以下、予算の警報を $50 と書いています。損益分岐点は「有料の利用者 30 人、月 $100 の収益で AWS $10 をまかなう」です[^costplan]。実際の監視のスタックが置いている予算は月 $5 で、実績 50%、実績 80%、予測 100% の 3 段階で通知します[^awsdesign]。計画書の $50 は古い値のまま残っています。

設計書の見積もりは、リクエストが無いときで月 $0.60、1,000 家庭で $0.80 です[^awsdesign]。実測の $1.3〜3.2 との差は、監視と Cost Explorer です。見積もりは「顧客に届く部分」を正しく当て、「運用のために足したもの」を数えていませんでした。

計画書の規模ごとの表（100 人で $1、10,000 人で $45）は DynamoDB を前提に書かれたもので、Aurora DSQL に移行した現在は根拠が変わっています。表は更新されていません[^costplan]。

## 見積もりは古び、実測は新しくなる

3 つの数字が、書いた時点では正しく、その後の変更に追随しませんでした。予算の閾値、規模ごとの表、リクエストが無いときの見積もりです。一方で、毎月 1 日の監査が貼る実測は、何もしなくても新しくなります。費用の設計書は、見積もりを書く場所ではなく、実測を貼る場所にした方が役に立ちました。

警報の本数にも学びがあります。17 本のうち 7 本が有料で、月 $0.70 です。金額は小さいのですが、「監視を足すと請求が増える」構造は、[第Ⅳ部-8](platform-session) で見る「装置を足すことが安すぎる」問題を、AWS の請求という形で見せています。無料枠の 10 本に収める設計を最初にしていれば、何を監視するかを選ぶ判断が早く来たはずです。

## 持ち帰るもの

- 費用の照会は手で叩かない。月 1 回の監査のログを読み、足りなければ予算の警報の閾値を下げる方が安く済む
- 監視の警報には無料枠がある。枠を超える前に「何を監視するか」を選ぶ判断を置く
- 費用の設計書には見積もりではなく実測を貼る。見積もりは書いた日に古び、実測は毎月新しくなる

次の章では、この 1〜3 ドルのインフラを定義している AWS CDK のコードを扱います。生成AIが書いたインフラで最も高くついたのは、コードそのものではなく、CloudFormation の「使用中の値は消せない」という制約でした。

[^costaudit]: 月次の費用とリソースの監査（自動処理）。CloudFormation のリソース数、Lambda / S3 / ECR / Cognito / CloudWatch の一覧、前月と当月の Cost Explorer の集計、管理から外れたリソースの検出。出典: [.github/workflows/cost-audit.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/cost-audit.yml)

[^run06]: 2026 年 6 月分の監査の実行（2026-07-01 実行）。出典: [GitHub Actions run 28484804412](https://github.com/Takenori-Kusaka/ganbari-quest/actions/runs/28484804412)

[^run07]: 2026 年 7 月分の監査の実行（2026-08-01 実行）。出典: [GitHub Actions run 30675194195](https://github.com/Takenori-Kusaka/ganbari-quest/actions/runs/30675194195)

[^run08]: 2026 年 8 月分の監査の実行（2026-09-01 実行）。出典: [GitHub Actions run 33462033899](https://github.com/Takenori-Kusaka/ganbari-quest/actions/runs/33462033899)

[^awsdesign]: AWSサーバレスアーキテクチャ設計書。監視のスタックの予算（月 $5、3 段階）、AWS の検証環境の費用（待機中はほぼ 0 円、コンテナイメージの保管のみ）、費用の試算（リクエストが無いとき $0.60、1,000 家庭 $0.80、ドメイン 117 円）。出典: [docs/design/13-AWSサーバレスアーキテクチャ設計書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/13-AWSサーバレスアーキテクチャ設計書.md)

[^dsqlstack]: Aurora DSQL のスタックの費用の前提。無料枠 10 万 DPU / 月と 1GB、使わないときの課金なし、試作の実測 3.53 DPU、「100 円 / 月を超えない」の機械検知。出典: [infra/lib/dsql-stack.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/lib/dsql-stack.ts)

[^opsstack]: 監視のスタックの AWS CDK 定義。名前を持つ警報は 17 本。出典: [infra/lib/ops-stack.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/lib/ops-stack.ts)

[^infraclaude]: インフラ配下の生成AIへの指示書。Cost Explorer の使用制限（25 回 / 秒、$0.01 / 回、12〜24 時間の反映遅延、1 日 1 回上限、即時参照と自動検査からの呼び出しの禁止）。出典: [infra/CLAUDE.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/CLAUDE.md)

[^costreview]: 費用を確かめるスキル。使ってよい情報源と禁止コマンド、1 年目の原価枠（月 1,500 円）。出典: [.claude/skills/cost-review/SKILL.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.claude/skills/cost-review/SKILL.md)

[^costplan]: 費用の管理計画書（2026-04-09）。サービス別の目標と警報の閾値、$50 の予算、規模ごとの表、損益分岐点。出典: [docs/design/35-コスト管理計画書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/35-コスト管理計画書.md)
