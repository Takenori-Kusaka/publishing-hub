---
title: "SvelteKit を adapter-node のまま Lambda のコンテナで動かし、AWS CDK で検証環境を本番と同じクラスから組んで月 1〜3 ドルで運用する"
tags:
  - AWS
  - lambda
  - SvelteKit
  - awscdk
  - CloudFront
private: false
updated_at: ''
id: null
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

:::note info
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。
:::

# はじめに

SvelteKit のアプリを AWS Lambda で動かすとき、Lambda 専用のアダプタに乗り換えるか迷います。がんばりクエストは、`adapter-node` でビルドした普通の Node.js のサーバを、そのままコンテナイメージに詰めています。受け口は AWS が配る Lambda Web Adapter（Lambda のイベントを普通の HTTP に変換する部品）です。Lambda 向けの書き換えはゼロで、同じイメージが家庭内サーバの Docker でも動きます。書き直しを省くなら、代わりに何を払うのでしょうか。

代わりに払うのは、Lambda の制約をアプリの側で吸収する手間です。起動の確認を稼働の確認から分けること、定期実行にも 30 秒の予算が掛かること、本番の Lambda でだけ現れる依存の欠落です。この構成で商用のサービスを運用して、AWS の請求は月 1〜3 ドルでした。

- 正本（Zenn の本『生成AIに実装を任せて商用サービスを作る』）: [Lambda の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/lambda-sveltekit) / [AWS CDK の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/cdk-stacks) / [費用の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/serverless-cost)
- 実装: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)
- SvelteKit の `adapter-node`: [公式ドキュメント](https://svelte.dev/docs/kit/adapter-node)

# 技術選定理由: なぜ adapter-node と Lambda Web Adapter か

Lambda 専用のアダプタを使えばコールドスタート（初回起動の遅れ）は縮む可能性があります。それでも `adapter-node` を選んだのは、家庭内に置く小型 PC（NUC）での自前運用と AWS で同じビルドの成果物を使いたかったからです。1 つのイメージが Lambda でも家庭内の Docker でも動くことを、コールドスタートの短縮より優先しました。

Lambda はメモリ 512MB、制限時間 30 秒、命令セットは省電力の ARM64 で動かしています。ARM64 は x86 より 2 割安く、常時待機（Provisioned Concurrency）は使わずコールドスタートを許容しています。起動を速める SnapStart はコンテナイメージの関数に対応していないので、選択肢にありません。

# コンテナの定義: 4 段

依存の解決、SvelteKit のビルド、本番用の依存だけの再解決、実行環境の 4 段です。実行環境は `node:22-alpine` に、公開の ECR から取得した Lambda Web Adapter を拡張として置きます。抜粋は後半の 2 段で、2 段目の `npm run build` の出力を 4 段目が写します。できたイメージは ECR に置き、AWS CDK の定義がそれを `latest` の札で参照します。

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

`npm ci --omit=dev` の段には、落とし穴が 1 つあります。実行時に読み込む部品が `devDependencies` にあると、この段で落ちます。画像処理の `sharp` がまさにそれでした。JavaScript 本体は Vite が束ねるので存在し、動作環境ごとの実行ファイルだけが無い状態になります。手元とテストは開発用の依存込みで動くため、壊れるのは本番の Lambda だけで、しかも `sharp` を入れて以来ずっと壊れていました。対策は `dependencies` への移動と、ロックファイルを読んで判定するテストです。CPU や基本ソフト（OS）の制約付きの成果物を持つ部品が `src/**` の実行時の読み込み先にあれば、自動検査（CI）で落とします。

# AWS CDK の Lambda 定義

AWS CDK 側はコンテナイメージの関数を ECR から作り、Function URL（Lambda を HTTP で直接呼び出せる機能）を応答を溜めてから返す方式で公開します。CloudFront が前に立つので、Function URL 自体の認証は `NONE` です。

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

Function URL は公開されたままなので、CloudFront の地域制限（geo restriction）は URL を直接叩けば迂回できます。対策として、CloudFront から Lambda へ共有の秘密の値（shared secret）をヘッダーで送り、管理系のパスはそのヘッダーを要求します。秘密の値を配る引数は省略可能にしていません。省略できると「ヘッダーを付け忘れた配信」を型で表現できてしまい、その配備は黙って動くからです。

# 起動確認と稼働確認を分ける

Lambda Web Adapter は起動時に決めたパスを繰り返し叩き、要求が通るまで、つまりプロセスが HTTP を受けられる状態になるまで待ちます。元の本にならって、プロセスが HTTP を受けられるかの確認を起動確認（readiness check）、データベースまで含めて動いているかの確認を稼働確認（health check）と呼びます。起動確認にデータベースへの実接続を含む深い稼働確認を使うと、データベース障害のときにいつまでも起動しない状態になります。アプリが返すはずの 503 は外に出ず、Function URL 全体が 502 になり、原因が見えません。コールドスタートの起動確認もデータベース接続に律速され、初期化の 10 秒上限に触れて再初期化の繰り返しを誘発します。

起動確認は `/api/ready` に分けました。見るのはプロセスが HTTP を受けられるかだけで、データベースには触らない浅い確認です。深い `/api/health` は監視専用に残し、デプロイ後の疎通確認と外からの見張りが使います。コンテナの定義の `AWS_LWA_READINESS_CHECK_PATH=/api/ready` がその設定です。

# 静的ファイルを Lambda に通さない

SvelteKit のビルドは、内容のハッシュを名前に含むファイルを `/_app/immutable/*` に出力します。これを Lambda が配信していると、CloudFront のキャッシュが冷えたときに大量のファイルが Lambda を一斉に直撃し、呼び出し数の上限の例外と接続の待ち行列の輻輳で、最も遅い応答が十数秒に達しました。

対策は 2 段です。まず CloudFront の Origin Shield で、同じファイルの同時取得を 1 本にまとめます。次にデプロイ時に Docker イメージから `/app/client` を抽出して S3 に置き、CloudFront だけが読める設定で配信します。抽出元は Lambda が画面を組み立てるときに参照するのと同じビルドの成果物なので、HTML が指すハッシュと S3 に置いたファイルのハッシュが食い違いません。古いハッシュのファイルは `prune: false` で残してデプロイ中の古い HTML が 403 を踏まないようにし、30 日で剪定します。

イメージからの抽出は [`.github/workflows/deploy.yml`](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/deploy.yml#L198-L221) の抽出の段、S3 への配置は [`infra/lib/network-stack.ts`](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/lib/network-stack.ts#L308) の `BucketDeployment` にあります。

# 定期実行は中継役の Lambda が HTTP に変換する

Lambda Web Adapter は HTTP のイベントしか処理しません。EventBridge のイベントは受けられないので、128MB の薄い中継役（cron dispatcher）の Lambda を置きます。中継役が EventBridge の内容を、Function URL の `/api/cron/:job` への `POST` に変換します。

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

この構成の制約は、実処理が SvelteKit 側の Lambda で走るため、中継役の制限時間が 5 分でも実質の上限は 30 秒なことです。データ量に比例する仕事は、30 秒の予算で処理できる分だけ処理し、残りを次回へ持ち越す規約です。持ち越した件数はログと応答の両方へ必ず出し、黙った持ち越しを禁じています。

もう 1 つ、Function URL はクエリ文字列のスラッシュを拒否します。SvelteKit の名前付きのフォーム送信先（`?/login` の形）が届かないので、CloudFront の関数（CloudFront Functions）でクエリのスラッシュを符号化して通しています。検証環境（staging）にも CloudFront が要るのはこのためです。

関数はクエリのキーに含まれるスラッシュだけを `%2F` に置き換えます。`?/login` の `/login` は値ではなくキーだからです。配信の既定の振る舞い（default behavior）に、閲覧者の要求（viewer request）の段階で関連付けます。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/lib/network-stack.ts
		const cfFunctionCode = `
function handler(event) {
  var request = event.request;
  var qs = request.querystring;
  var newQs = {};
  for (var key in qs) {
    var encodedKey = key.replace(/\\//g, '%2F');
    newQs[encodedKey] = qs[key];
  }
  request.querystring = newQs;
  return request;
}
`;

		const queryFixFn = new cloudfront.Function(this, 'QuerySlashEncodeFn', {
			functionName: `${prefix}-query-slash-encode`,
			code: cloudfront.FunctionCode.fromInline(cfFunctionCode),
			runtime: cloudfront.FunctionRuntime.JS_2_0,
		});
// ...
			defaultBehavior: {
				// ...
				functionAssociations: [
					{
						function: queryFixFn,
						eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
					},
				],
			},
```

# 本番と検証環境を同じクラスで組む

検証環境専用のスタックのクラスは書きません。各スタックが省略可能な `envConfig` の引数を持ち、既定値が本番の設定なので、フラグの無い合成では本番のテンプレートが変わりません。差分は 1 ファイルの 2 つの定数に閉じます。

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

本番のテンプレートが変わらないことは 3 重に守ります。省略可能な引数と既定値で差分をゼロにする設計、合成時に物理名を確かめる単体テスト、デプロイの前に資源の置き換え（Replacement）を検知する関門です。

スタック間の値の受け渡しは、CloudFormation の公開値（cross-stack export。あるスタックが別のスタックに向けて公開する値）を避けて SSM のパラメータで行います。CloudFormation は使用中の公開値を消せず、値も変えられません。テーブル 1 つを撤去するのに、取り込む側の参照を外すデプロイと公開する側の値を消すデプロイの 2 回が要り、途中で巻き戻しも踏みました。以後、公開値の名前と `Fn::ImportValue` は許可一覧（allowlist）との集合一致で検査し、増やせない歯止め（ratchet）にしています。

# 実測: 顧客に届く部分は 0 ドル

毎月 1 日に走る監査の自動処理が、前月の費用をサービス別に出力します。

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
| Cost Explorer（費用の照会） | $0.53 | $0.19 | $1.53 |
| Route 53（ドメインの名前解決） | $0.51 | $0.51 | $0.51 |
| CloudWatch（監視） | $0.18 | $0.35 | $0.73 |
| ECR（コンテナイメージの保管） | $0.05 | $0.06 | $0.06 |
| S3（ファイルの保管） | $0.02 | $0.07 | $0.06 |
| Lambda / Cognito / Aurora DSQL / SES / SNS | $0 | $0 | $0 |
| 税込みの合計 | 約 $1.44 | 約 $1.32 | 約 $3.19 |

顧客のリクエストを処理する部分は、すべて無料枠に収まっています。Lambda は月 100 万リクエスト、Cognito は月 5 万人の利用者、Aurora DSQL は月 10 万 DPU（Aurora DSQL の課金単位）の枠です。掛かっているのは固定費で、Route 53 のドメインの管理単位と、無料の 10 本を超えた CloudWatch アラーム（警報）です。

Cost Explorer が最大の費目になった月は 2 回あります。照会は 1 回 1 セントで無料枠を持たず、運営者向けの費用のページが当月と前月の 2 回を問い合わせるうえ、そのキャッシュは Lambda のプロセス内にあってコールドスタートのたびに消えるためです。費用を知りたいときは月次の監査のログを読み、足りなければ AWS Budgets の閾値を下げる方が安く済みます。

# まとめ

- `adapter-node` と Lambda Web Adapter の組み合わせなら、SvelteKit の書き換え無しで Lambda に載り、同じイメージが自前運用でも動きます
- 起動確認は浅い確認に向け、深い稼働確認は監視に回します。データベース障害を「いつまでも起動しない」に変換しないためです
- `npm ci --omit=dev` の段は、本番でしか壊れない依存の区分の誤りを生みます。ロックファイルから機械で判定する方が確実です
- 定期実行は中継役で HTTP に変換し、実処理の 30 秒の予算を設計の前提に置きます
- 検証環境は同じスタックのクラスに省略可能な設定を渡して組み、本番のテンプレートの不変をテストで守ります
- 月額の大半は監視と「測る費用」です。顧客に届く部分は無料枠に収まります

画像処理の欠落は、単体テストと画面操作テスト（E2E）と自動検査のすべてが緑のまま、顧客が本番でアバターの画像を上げるまで誰にも見えませんでした。テストが緑でも、顧客に届いたことにはなりません。完了は、確認項目が埋まったかではなく、本番で顧客に届いたかで決めます。この考え方は、[Zenn の本の終盤の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/principles)にまとめました。

動いているサービス: [がんばりクエスト](https://www.ganbari-quest.com/)
