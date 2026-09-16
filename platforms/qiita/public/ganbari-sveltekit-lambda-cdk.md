---
title: "SvelteKit を adapter-node のまま Lambda コンテナで動かし、CDK で staging を同じクラスから組んで月 $1〜3 で運用する"
tags:
  - AWS
  - lambda
  - SvelteKit
  - awscdk
  - CloudFront
private: true
updated_at: ''
---

:::note info
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。使ったツールと用途は、末尾の「生成AIの利用について」に書いています。
:::

# はじめに

SvelteKit のアプリを AWS Lambda で動かすとき、Lambda 専用の adapter に乗り換えるか迷います。本稿の構成は、`adapter-node` でビルドした Node のサーバをそのままコンテナイメージに詰め、AWS の Lambda Web Adapter で HTTP に変換するものです。Lambda 向けの書き換えはゼロで、同じイメージが家庭内サーバの Docker でも動きます。

この構成で商用のサービスを運用して、AWS の請求は月 1〜3 ドルでした。記事の後半では、CDK で本番と staging を同じクラスから組む方法と、費目ごとの実測を載せます。設計の経緯や事故の詳細は正本に書いたので、ここでは再現できるコードと手順に絞ります。

- 正本（Zenn Books『生成AIに実装を任せて商用サービスを作る』）: [Lambda の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/lambda-sveltekit) / [CDK の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/cdk-stacks) / [コストの章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/serverless-cost)
- 実装: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)
- SvelteKit の adapter-node: [公式ドキュメント](https://svelte.dev/docs/kit/adapter-node)

# 技術選定: なぜ adapter-node と Web Adapter か

Lambda 専用の adapter を使えば cold start は縮む可能性があります。それでも adapter-node を選んだのは、NUC のセルフホストと AWS で同じビルド成果物を使いたかったからです。1 つのイメージが Lambda でも家庭内の Docker でも動くことを、cold start の数十 ms より優先しました。

Lambda の設定は 512MB、30 秒、ARM64 です。ARM64 は x86 より 2 割安く、Provisioned Concurrency は使わず cold start を許容しています。SnapStart はコンテナイメージの関数に対応していないので選択肢にありません。

# Dockerfile: 4 つの stage

依存の解決、SvelteKit のビルド、本番依存だけの再解決、runtime の 4 stage です。runtime は `node:22-alpine` に、公開 ECR から取得した Web Adapter を extension として置きます。

```dockerfile
# 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/Dockerfile.lambda
# Stage 3: Production dependencies only (smaller image)
FROM node:22-alpine AS prod-deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
# ...
RUN npm ci --omit=dev

# Stage 4: Lambda runtime
FROM node:22-alpine AS runtime

# Lambda Web Adapter: converts Lambda events to HTTP requests
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

WORKDIR /app

# Copy SvelteKit build output + production dependencies only
COPY --from=build /app/build/ ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

# Lambda Web Adapter settings
ENV PORT=3000
ENV HOST=0.0.0.0
ENV AWS_LWA_PORT=3000
# ...
ENV AWS_LWA_READINESS_CHECK_PATH=/api/ready
ENV AWS_LWA_INVOKE_MODE=buffered
ENV NODE_ENV=production

CMD ["node", "index.js"]
```

`npm ci --omit=dev` の stage には、落とし穴が 1 つあります。実行時に import するのに `devDependencies` に置かれた package は、この stage で落ちます。画像処理の `sharp` がまさにそれで、JS 本体は Vite が bundle するので存在し、platform 依存の binary だけが無い状態になりました。ローカルとテストは dev 依存込みで動くため、壊れるのは本番の Lambda だけです。対策は `dependencies` への移動と、lock ファイルを読んで `cpu` / `os` / `libc` の制約付き成果物を持つ package が `src/**` の実行時 import 先にあれば落とすテストです。

# CDK の Lambda 定義

CDK 側はコンテナイメージの関数を ECR から作り、Function URL を buffered モードで公開します。CloudFront が前に立つので、Function URL の認証は NONE です。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/lib/compute-stack.ts
		// --- Lambda: SvelteKit via Lambda Web Adapter ---
		this.fn = new lambda.DockerImageFunction(this, 'SvelteKitFn', {
			functionName: `${prefix}-app`,
			code: lambda.DockerImageCode.fromEcr(props.repository, {
				tagOrDigest: 'latest',
			}),
			memorySize: 512,
			timeout: cdk.Duration.seconds(30),
			architecture: lambda.Architecture.ARM_64,
// ...
		// Lambda Function URL (public, CloudFront will be in front)
		this.functionUrl = this.fn.addFunctionUrl({
			authType: lambda.FunctionUrlAuthType.NONE,
			invokeMode: lambda.InvokeMode.BUFFERED,
		});
```

Function URL は公開されたままなので、CloudFront の地域制限は URL を直接叩けば迂回できます。対策として、CloudFront から origin へ共有 secret を header で送り、管理系の path はその header を要求します。secret を配る props は optional にしていません。optional にすると「header を付け忘れた distribution」を型で表現できてしまい、その配備は黙って動くからです。

# readiness と health を分ける

Web Adapter は、プロセスが HTTP を受けられるようになるまで readiness の path を polling します。ここに DB への実接続を含む深い health check を使うと、DB 障害のときに「never-ready」になります。アプリが返すはずの 503 は外に出ず、Function URL 全体が 502 になり、原因が見えません。cold start の readiness も DB 接続に律速され、init の 10 秒上限に触れて再 init のループを誘発します。

そこで readiness は `/api/ready` に分けました。プロセスが HTTP を受けられるかだけを見る shallow な probe で、DB には触りません。深い `/api/health` は監視専用に残し、deploy 後の smoke と外部の prober が使います。Dockerfile の `AWS_LWA_READINESS_CHECK_PATH=/api/ready` がその設定です。

# 静的アセットを Lambda に通さない

SvelteKit は `/_app/immutable/*` に content-hash 付きのアセットを出します。これを Lambda が配信していると、エッジの cache が冷えたときに大量のチャンクが Lambda を一斉に直撃し、`TooManyRequestsException` と接続キューの輻輳で最遅の応答が十数秒に達しました。

対策は 2 段です。まず CloudFront の Origin Shield で、同一アセットの同時 fetch を 1 本に collapse します。次に deploy 時に Docker イメージから `/app/client` を抽出して S3 に置き、CloudFront が OAC 経由で配信します。Lambda が SSR で参照するのと同じビルド成果物なので、HTML の hash と S3 の hash は同じになります。旧 hash は `prune: false` で残して deploy 中の旧 HTML が 403 を踏まないようにし、30 日の lifecycle で剪定します。

# cron は dispatcher Lambda が HTTP に変換する

Web Adapter は HTTP のイベントしか処理しません。EventBridge のイベントは受けられないので、128MB の薄い dispatcher Lambda を置きます。dispatcher が EventBridge のペイロードを、Function URL の `/api/cron/:job` への POST に変換します。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/lambda/cron-dispatcher/index.ts
// SSOT: schedule-registry.ts (inlined for CDK tsconfig rootDir compatibility)
// Matches the `endpoint` field in schedule-registry.ts exactly.
const KNOWN_ENDPOINTS: Record<string, string> = {
	// ...
	'retention-cleanup': '/api/cron/retention-cleanup',
	'trial-notifications': '/api/cron/trial-notifications',
	// ...
	'lifecycle-emails': '/api/cron/lifecycle-emails',
	// ...
	'export-build': '/api/cron/export-build',
	// ...
	'stripe-webhook-delivery-check': '/api/cron/stripe-webhook-delivery-check',
	// ...
};
```

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/lib/compute-stack.ts
			this.cronDispatcherFn = new lambdaNode.NodejsFunction(this, 'CronDispatcherFn', {
				functionName: `${prefix}-cron-dispatcher`,
				entry: path.join(__dirname, '..', 'lambda', 'cron-dispatcher', 'index.ts'),
				handler: 'handler',
				runtime: lambda.Runtime.NODEJS_22_X,
				architecture: lambda.Architecture.ARM_64,
				memorySize: 128,
				timeout: cdk.Duration.minutes(5),
```

この構成の制約は、実処理が SvelteKit 側の Lambda で走るため、dispatcher の timeout が 5 分でも実質の上限は 30 秒なことです。データ量に比例するジョブは、30 秒の予算で処理できる分だけ処理し、残りを次回へ持ち越す規約です。持ち越した件数は log と応答の両方へ必ず出し、silent な持ち越しを禁じています。

もう 1 つ、Function URL はクエリ文字列のスラッシュを拒否します。SvelteKit の名前付き form action（`?/login` の形）が届かないので、CloudFront Function でクエリのスラッシュを encode して通しています。staging にも CloudFront が要るのはこのためです。

# 本番と staging を同じクラスで組む

staging 専用の stack class は書きません。各 stack が optional な `envConfig` prop を持ち、既定値が本番の設定なので、context 無しの synth では本番のテンプレートが変わりません。差分は 1 ファイルの 2 つの定数に閉じます。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/lib/env-config.ts
export interface GqEnvConfig {
	/** 環境名 ('prod' | 'staging')。stack 内の環境分岐に使う */
	readonly envName: 'prod' | 'staging';
	/** 物理リソース名 prefix (table / Lambda / log group / pool / bucket / ECR repo) */
	readonly resourcePrefix: string;
	/** SSM パラメータ prefix (例: '/ganbari-quest' / '/ganbari-quest-staging') */
	readonly ssmPrefix: string;
	// ...
	readonly enableBackup: boolean;
	/** demo Lambda (ADR-0048) を構築するか。staging は不要 */
	readonly enableDemoLambda: boolean;
	/** cron-dispatcher + EventBridge Rules (#1376) を構築するか。staging は不要 */
	readonly enableCronDispatcher: boolean;
	/** CloudWatch Logs → Firehose → S3 の log archiving を構築するか。staging は不要 */
	readonly enableLogArchiving: boolean;
	/** stateful リソース (table / bucket / ECR / pool) の RemovalPolicy */
	readonly removalPolicy: cdk.RemovalPolicy;
}
// ...
/** 現行 prod 値 (default)。値を変えると prod template が変わるため変更禁止 (ADR-0019) */
export const PROD_ENV_CONFIG: GqEnvConfig = {
	envName: 'prod',
	resourcePrefix: 'ganbari-quest',
	ssmPrefix: '/ganbari-quest',
	enableBackup: true,
	enableDemoLambda: true,
	enableCronDispatcher: true,
	enableLogArchiving: true,
	removalPolicy: cdk.RemovalPolicy.RETAIN,
};

/** AWS staging (#2873)。idle≈¥0 (Lambda リクエスト課金 / 固定費 = ECR repo のみ) */
export const STAGING_ENV_CONFIG: GqEnvConfig = {
	envName: 'staging',
	resourcePrefix: 'ganbari-quest-staging',
	ssmPrefix: '/ganbari-quest-staging',
	enableBackup: false,
	enableDemoLambda: false,
	enableCronDispatcher: false,
	enableLogArchiving: false,
	removalPolicy: cdk.RemovalPolicy.DESTROY,
};
```

本番テンプレートが変わらないことは 3 重に守ります。optional props と既定値による diff ゼロの設計、synth 時に物理名を assert する unit test、deploy 時の Replacement 検知 gate です。

stack 間の値の受け渡しは、cross-stack の export を避けて SSM パラメータで行います。CloudFormation は使用中の export を消せず、値も変えられません。テーブル 1 つを撤去するのに、consumer 側の import を外す deploy と producer 側の export を消す deploy の 2 回が要り、途中で rollback も踏みました。以後、export 名と `Fn::ImportValue` は allowlist との集合一致で検査し、増やせない ratchet にしています。

# 実測: 顧客に届く部分は $0

毎月 1 日に走る監査 workflow が、前月の費用をサービス別に出力します。

```yaml
# 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/cost-audit.yml
          aws ce get-cost-and-usage \
            --time-period "Start=$LAST_MONTH_START,End=$LAST_MONTH_END" \
            --granularity MONTHLY \
            --metrics "UnblendedCost" \
            --group-by Type=DIMENSION,Key=SERVICE \
            --query 'ResultsByTime[0].Groups[?Metrics.UnblendedCost.Amount!=`0`].{Service:Keys[0],Cost:Metrics.UnblendedCost.Amount}' \
            --output table 2>/dev/null || echo "Cost Explorer not available"
```

2026 年 6 月から 8 月の 3 回分です。

| サービス | 6 月 | 7 月 | 8 月 |
|---|---|---|---|
| AWS Cost Explorer | $0.53 | $0.19 | $1.53 |
| Amazon Route 53 | $0.51 | $0.51 | $0.51 |
| Amazon CloudWatch | $0.18 | $0.35 | $0.73 |
| Amazon ECR | $0.05 | $0.06 | $0.06 |
| Amazon S3 | $0.02 | $0.07 | $0.06 |
| Lambda / Cognito / Aurora DSQL / SES / SNS | $0 | $0 | $0 |
| 税込みの合計 | 約 $1.44 | 約 $1.32 | 約 $3.19 |

顧客のリクエストを処理する部分は、すべて無料枠に収まっています。Lambda は月 100 万リクエスト、Cognito は 5 万 MAU、DSQL は月 10 万 DPU の枠です。かかっているのは固定費で、Route 53 の hosted zone と、無料枠の 10 本を超えた CloudWatch の alarm です。

Cost Explorer が最大の費目になった月は 2 回あります。API はリクエスト 1 回 $0.01 で無料枠を持たず、運営画面が当月と前月の 2 回を問い合わせるうえ、そのキャッシュは Lambda のプロセス内にあって cold start のたびに消えるためです。費用を知りたいときは月次監査のログを読み、足りなければ Budgets の閾値を下げる方が安く済みます。

# まとめ

- adapter-node と Lambda Web Adapter の組み合わせなら、SvelteKit の書き換え無しで Lambda に載り、同じイメージがセルフホストでも動きます
- readiness は shallow な probe に向け、深い health check は監視に回します。DB 障害を「never-ready」に変換しないためです
- `npm ci --omit=dev` の stage は、本番でしか壊れない依存の区分ミスを生みます。lock ファイルから機械で判定する方が確実です
- cron は dispatcher で HTTP に変換し、実処理の 30 秒予算を設計の前提に置きます
- staging は同じ stack class に optional な設定を渡して組み、本番テンプレートの不変を test で守ります
- 月額の大半は監視と「測るコスト」です。顧客に届く部分は無料枠に収まります

# 生成AIの利用について

この記事の作成には、生成AIの Claude（Anthropic の Claude Fable 5.1）を使いました。正本の該当章からの構成の検討、本文の下書きと改稿、コードの抜粋の照合、校正に使っています。筆者が内容を確認し、必要に応じて修正しました。公開した内容の責任は筆者が負います。
