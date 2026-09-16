---
title: "第Ⅲ部-3　Lambda のコンテナイメージで SvelteKit を動かす ― Web Adapter、readiness、cron、sharp"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

SvelteKit のアプリは、`adapter-node` でビルドした Node のサーバをそのまま Lambda のコンテナイメージに詰め、AWS の Lambda Web Adapter で HTTP に変換して動かしています。Lambda 用の書き換えはゼロです。この章では、その構成と、構成が生む制約を扱います。readiness と health の分離、cron のための小さな Lambda、30 秒の実行時間予算、そして本番の Lambda でだけ壊れていた画像処理ライブラリの話です。

## 4 段の Dockerfile

`Dockerfile.lambda` は 4 つの stage です。依存の解決、SvelteKit のビルド、本番依存だけの再解決、そして runtime。runtime は `node:22-alpine` に、公開 ECR から取得した Lambda Web Adapter 0.9.1 を extension として置き、ビルド出力と本番依存をコピーして `node index.js` を起動します[^dockerfile]。

Lambda 側の設定は 512MB、30 秒、ARM64 です。ARM64 は x86 より 20% 安く、cold start はコンテナイメージの取得に依存します。SnapStart はコンテナイメージの関数に対応していないため使えず、Provisioned Concurrency は採用していません。研究文書は AWS 公式の「cold start は呼び出しの 1% 未満」を引き、イメージサイズの削減を別途の課題としています[^research]。

Function URL は buffered モードです。設計書には RESPONSE_STREAM と書かれた箇所が残っていますが、CDK のコードは `InvokeMode.BUFFERED` で、demo の Lambda も同じです[^computestack]。

## readiness と health を分ける

Web Adapter は、プロセスが HTTP を受けられるようになるまで readiness の path を polling します。当初は深い health check（DB への実接続とスキーマの検証）を readiness に使っていました。これは DB 障害のときに「never-ready」を生みます。アプリが返す fail-close の 503 が外に出ず、Function URL 全体が 502 になり、障害の原因が見えなくなります。さらに cold start の readiness が DB 接続に律速され、Lambda の init 10 秒上限に触れて再 init のループを誘発します。staging の実測では、probe 込みの Init が 3,315ms でした[^awsdesign]。

2026 年 7 月に readiness は `/api/ready` に分けられました。プロセスが HTTP を受けられるかだけを見る shallow な probe で、DB には触りません。深い `/api/health` は監視専用に残し、外部の prober、deploy 後の smoke、NUC の Docker healthcheck が使います。設計書はこれを Kubernetes の readiness と liveness の分離、AWS Builders' Library の「依存の deep check を起動 gate に使うと単一依存の障害が全遮断へ増幅される」と同型の確立パターンとして記録しています[^awsdesign]。

## 静的アセットを Lambda に通さない

SvelteKit は `/_app/immutable/*` に content-hash 付きのアセットを出します。当初は Lambda がこれも配信していました。エッジの cache が cold のとき、約 224 本のチャンクが Lambda を一斉に直撃し、`TooManyRequestsException` と HTTP/1.1 の接続キューの輻輳で最遅 16 秒に達していました。HAR の実測です[^awsdesign]。

段階的に直しました。解決策 A は CloudFront の Origin Shield で、同一アセットの同時 fetch を 1 本に collapse します。解決策 B は S3 への offload で、deploy 時に Docker イメージから `/app/client` を抽出し、`BucketDeployment` で S3 に置き、CloudFront が OAC 経由で配信します。Lambda が SSR で参照するのと同一のビルド成果物なので、HTML の hash と S3 の hash は同じになります。旧 hash は `prune: false` で残して deploy 中の旧 HTML を 403 にせず、30 日の lifecycle で剪定します[^awsdesign]。

![静的アセットを Lambda に通さない](/images/ganbari-quest-design/lambda-sveltekit.png)

## cron のための 128MB

Web Adapter は HTTP のイベントしか処理しません。EventBridge のイベントを直接受けられないため、薄い dispatcher Lambda（128MB、5 分、ARM64）を置いています。これが EventBridge のペイロードを HTTP POST に変換し、Function URL の `/api/cron/:job` を Bearer token 付きで呼びます[^dispatcher]。

ジョブは 11 本で、スケジュールの SSOT は `schedule-registry.ts` です。CDK の EventBridge rule、dispatcher の endpoint 一覧、`src/routes/api/cron/*` の実ファイルは、unit test が 3 方向で突合します。registry に載るがスケジュール駆動しない endpoint は、理由と追跡 Issue を必須とする除外リストに登録します[^awsdesign]。NUC のセルフホストは AWS を経由せず、`Dockerfile.scheduler` の node-cron コンテナが同じ registry を読んで全ジョブを駆動します[^scheduler]。

この構成には、見落としやすい制約があります。全ジョブの実処理は Function URL の SvelteKit Lambda で走るため、dispatcher の timeout が 5 分でも、実質の上限は 30 秒です。設計書は「cron だから長く走れる、という前提で設計してはならない」と書き、データ量に比例するジョブは 30 秒予算内で処理できる分だけ処理して残りを次回に持ち越す self-limiting を規約にしています。時間予算は既定 20 秒で、残り 10 秒は認証、前処理、着手済み item の完走、レスポンスの直列化のためのヘッドルームです。持ち越しは件数を log とレスポンスに必ず含めます。silent な持ち越しは禁止です[^awsdesign]。

Function URL には、もう 1 つ制約があります。クエリ文字列のスラッシュを拒否するため、SvelteKit の名前付き form action（`?/login` のような形）が届きません。CloudFront Function でクエリのスラッシュを encode して通しています。staging にも CloudFront が要るのはこのためで、これが無いと staging ではログインとサインアップのどちらもできません[^awsdesign]。

cron の認証層で 4 か月間 401 が返り続けていた事故は、[第Ⅴ部-4](fitness-functions) で扱いました。dispatcher の dryRun は「env の検証だけで HTTP POST の手前で return する」設計で、smoke が実経路を叩いていなかったことが 4 か月の理由です。

## 本番の Lambda でだけ壊れていた sharp

2026 年 9 月、本番でアバター画像をアップロードすると、どのファイルを選んでも 500 になっていました。画面は「5MB 以下の JPEG / PNG / WebP を選択してください」と案内していましたが、ファイルは何も悪くありません。サイズ、MIME、マジックバイトの検証はすべて通過し、そのあとの画像の re-encode で落ちていました[^sharppr]。

真因は依存の区分です。画像処理の `sharp` が `devDependencies` にありました。Lambda イメージの本番依存は `npm ci --omit=dev` で作るため、platform binary の `@img/sharp-linuxmusl-arm64` が落ちます。一方で `sharp` の JS 本体は Vite が bundle するので存在し、ローダーだけが走って失敗します。NUC は dev 込みの `npm ci` なので無傷で、AWS の Lambda だけの障害でした。しかも sharp を導入して以来ずっと壊れていて、本番でアバターをアップロードした人がいなかったため露見しませんでした[^sharppr]。

修正は `sharp` を `dependencies` に移すことと、class の lock です。`src/**` の実行時 import 先であるネイティブ package が `devDependencies` のままなら CI で落ちるテストを足しました。判定の軸は「bundle できるか」です。`svelte` のように Vite が bundle するものは dev のままで正しいので、対象を lock 上で `cpu` / `os` / `libc` の制約付き成果物を持つ package に限定しています[^sharppr]。

PR の本文には、この class が CI で原理的に検出できなかった理由が書かれています。unit、e2e、storybook、NUC はすべて dev 依存が入った環境で走り、落ちるのは Lambda だけです。真因が読めたのは、その朝に入った logger の context 出力の修正のおかげでした。それ以前は例外と storageKey のどちらも本番から見えませんでした[^sharppr]。

同じ形の事故は Dockerfile の COPY にもあります。`npm ci` の prepare script が static import するモジュールを追加したとき、Dockerfile の COPY が追随せず `ERR_MODULE_NOT_FOUND` で `npm ci` が落ちました。COPY と import の整合は fitness function が検証しています[^dockerfile]。

## 今ならこうする

adapter-node と Web Adapter の組み合わせは、正しかったと考えています。Lambda 用の adapter を使えば cold start は縮んだかもしれませんが、NUC のセルフホストと同じビルド成果物を使えることの方が、この製品では価値がありました。1 つのイメージが AWS でも家庭内サーバでも動きます。

30 秒の予算は、設計の前提に置くべきでした。cron を Function URL に通す構成を選んだ時点で決まっていた制約ですが、self-limiting の規約が入ったのは 3 か月後です。dispatcher から長時間の Lambda を直接 invoke する案は、バックログが定常化した時点で再検討すると設計書に書かれています。

sharp の事故は、生成AIが書く依存の区分を人が見ていなかった例です。`npm install --save-dev` と `--save` の違いは、テストではなく本番でだけ現れます。本番でしか現れない class に対しては、テストを増やすのではなく、lock ファイルの構造から機械で判定する方が確実でした。

[^dockerfile]: Lambda 用の Dockerfile。4 stage の構成、prepare script の COPY 追随（`ERR_MODULE_NOT_FOUND` の再発防止と fitness function）、Web Adapter の設定、readiness path。出典: [Dockerfile.lambda](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/Dockerfile.lambda)

[^research]: Multi-Lambda demo の詳細設計。§3 cold start UX 検証（AWS 公式の数値、SnapStart 非対応、Provisioned Concurrency の試算）。出典: [docs/research/2097-multi-lambda-merged-system-design.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/research/2097-multi-lambda-merged-system-design.md)

[^computestack]: ComputeStack の CDK 定義。Lambda の memory / timeout / architecture、Function URL の `InvokeMode.BUFFERED`、cron dispatcher、demo Lambda、log archiving。出典: [infra/lib/compute-stack.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/lib/compute-stack.ts)

[^awsdesign]: AWSサーバレスアーキテクチャ設計書。§3.3 ComputeStack（LWA readiness と health の分離、cron ジョブ一覧、30 秒 self-limiting）と §3.5 NetworkStack（`/_app/immutable/*` の S3 offload、HAR 実測）を引用。§4.3 AWS staging（Function URL のクエリ制約と CloudFront Function）も引用。出典: [docs/design/13-AWSサーバレスアーキテクチャ設計書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/13-AWSサーバレスアーキテクチャ設計書.md)

[^dispatcher]: cron dispatcher Lambda。EventBridge から HTTP POST への変換、endpoint の一覧、dryRun の契約。出典: [infra/lambda/cron-dispatcher/index.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/lambda/cron-dispatcher/index.ts)

[^scheduler]: NUC の scheduler コンテナ。node-cron で registry を駆動する構成、tzdata を入れる理由。出典: [Dockerfile.scheduler](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/Dockerfile.scheduler)

[^sharppr]: sharp の hotfix PR。真因（devDependencies と `npm ci --omit=dev`）、NUC が無傷だった理由、sharp 導入以来壊れていたこと、class lock のテストと判定軸、mutation での確認。出典: [PR #4957](https://github.com/Takenori-Kusaka/ganbari-quest/pull/4957)。テスト本体は [tests/unit/architecture/src-runtime-imports-are-prod-deps.test.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/src-runtime-imports-are-prod-deps.test.ts)
