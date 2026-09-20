---
title: "第Ⅲ部-3　Lambda のコンテナで SvelteKit を動かす ― 起動確認の分離、定期実行の 30 秒、本番でだけ壊れた画像処理"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

SvelteKit のアプリは、普通の Node のサーバとしてビルドし、そのまま Lambda のコンテナイメージに詰めて動かしています。Lambda 用の書き換えはゼロです。Lambda 向けの書き直しを省くなら、何を代わりに払うのか。

払うのは、Lambda の制約をアプリの側で引き受けることです。起動の確認を稼働の確認から分けること、定期実行にも 30 秒の予算が掛かること、そして本番の Lambda でだけ現れる依存の欠落です。最後のものは、導入以来ずっと壊れていました。

## 4 段のコンテナ

コンテナの定義は 4 段です。依存の解決、SvelteKit のビルド、本番用の依存だけの再解決、そして実行環境。実行環境は `node:22-alpine` に、AWS が配る Lambda Web Adapter（Lambda のイベントを普通の HTTP に変換する部品）の 0.9.1 を拡張として置き、ビルドの出力と本番用の依存を写して `node index.js` を起動します[^dockerfile]。

Lambda の設定は 512MB、30 秒、ARM64（省電力の命令セット）です。ARM64 は x86 より 20% 安く、コールドスタート（初回起動の遅れ）はコンテナイメージの取得に依存します。起動を速める SnapStart はコンテナイメージの関数に対応していないため使えず、常時待機（Provisioned Concurrency）は採用していません。調査の記録は AWS の「コールドスタートは呼び出しの 1% 未満」を引き、イメージの縮小を別の課題としています[^research]。

Function URL（Lambda を HTTP で直接呼び出せる機能）は応答を溜めてから返す方式です。設計書には逐次送信と書かれた箇所が残っていますが、AWS CDK のコードは `InvokeMode.BUFFERED` で、デモの Lambda も同じです[^computestack]。

## 起動確認と稼働確認を分ける

Lambda Web Adapter は、プロセスが HTTP を受けられるようになるまで、決めたパスを繰り返し叩きます。本書ではこれを起動確認と呼びます。当初は、データベースへの実接続とスキーマの検証まで行う深い稼働確認を起動確認に使っていました。これはデータベース障害のときに「いつまでも起動しない」状態を生みます。アプリが返す 503 が外に出ず、Function URL 全体が 502 になり、障害の原因が見えなくなります。さらにコールドスタートの起動確認がデータベース接続に律速され、Lambda の初期化 10 秒の上限に触れて再初期化の繰り返しを誘発します。検証環境の実測では、起動確認込みの初期化が 3,315ms でした[^awsdesign]。

2026 年 7 月に起動確認は `/api/ready` に分けられました。プロセスが HTTP を受けられるかだけを見る浅い確認で、データベースには触りません。深い稼働確認 `/api/health` は監視専用に残し、外からの見張り、デプロイ後の疎通確認、NUC の Docker の稼働確認が使います。設計書はこれを Kubernetes の起動確認と生存確認の分離、AWS の「依存の深い検査を起動の条件に使うと、1 つの依存の障害が全体の遮断へ増幅される」という指針と同型の、確立した形として記録しています[^awsdesign]。

## 静的ファイルを Lambda に通さない

SvelteKit は `/_app/immutable/*` に内容のハッシュ付きのファイルを出します。当初は Lambda がこれも配信していました。CloudFront のキャッシュが冷えているとき、約 224 本のファイルが Lambda を一斉に直撃し、呼び出し数の上限の例外と HTTP/1.1 の接続の待ち行列の輻輳で、最も遅いもので 16 秒に達していました。ブラウザの通信記録の実測です[^awsdesign]。

段階的に直しました。1 つ目は CloudFront の Origin Shield（同じファイルの同時取得を 1 本にまとめる機能）です。2 つ目は S3 への切り出しで、デプロイ時に Docker イメージからブラウザ用のファイルを抽出し、S3 に置き、CloudFront だけが読める設定で配信します。Lambda が画面を組み立てるときに参照するのと同じビルドの成果物なので、HTML の中のハッシュと S3 のハッシュは同じになります。古いハッシュのファイルは消さずに残してデプロイ中の古い HTML を 403 にせず、30 日で剪定します[^awsdesign]。

![顧客のリクエストの流れ。CloudFront が画面は Lambda へ、静的ファイルは S3 へ振り分け、EventBridge の定期実行は中継役の Lambda を経てアプリの Lambda に届く](/images/ganbari-quest-design/lambda-sveltekit.png)

## 定期実行のための 128MB

Lambda Web Adapter は HTTP のイベントしか処理しません。EventBridge（AWS の予定実行の仕組み）のイベントを直接受けられないため、薄い中継役の Lambda（128MB、5 分、ARM64）を置いています。これが EventBridge のイベントを HTTP の POST に変換し、Function URL の定期実行の入口を認証トークン付きで呼びます[^dispatcher]。

仕事は 11 本で、予定の正本は 1 つの予定表のファイルです。AWS CDK の EventBridge の規則、中継役の入口の一覧、アプリ側の実ファイルは、単体テストが 3 方向で突き合わせます。予定表に載るが予定では動かない入口は、理由と追跡先を必須とする除外の一覧に登録します[^awsdesign]。NUC は AWS を経由せず、`node-cron` のコンテナが同じ予定表を読んで全部の仕事を動かします[^scheduler]。

この構成には、見落としやすい制約があります。全部の仕事の実処理は Function URL の向こうの SvelteKit の Lambda で走るため、中継役の制限時間が 5 分でも、実質の上限は 30 秒です。設計書は「定期実行だから長く走れる、という前提で設計してはならない」と書いています。データ量に比例する仕事は、30 秒の予算内で処理できる分だけ処理して残りは次回へ持ち越す、という規約です。時間の予算は既定 20 秒で、残り 10 秒は認証、前処理、着手した項目の完走、応答の組み立てのための余裕です。持ち越しは件数をログと応答に必ず含めます。黙った持ち越しは禁止です[^awsdesign]。

Function URL には、もう 1 つ制約があります。クエリ文字列のスラッシュを拒否するため、SvelteKit の名前付きのフォーム送信先（`?/login` のような形）が届きません。CloudFront の関数でクエリのスラッシュを符号化して通しています。検証環境にも CloudFront が要るのはこのためで、これが無いと検証環境ではログインとサインアップのどちらもできません[^awsdesign]。

定期実行の認証で 4 か月間 401 が返り続けていた事故は、[第Ⅴ部-4](fitness-functions) で扱いました。中継役の試運転は「環境変数の検証だけで、HTTP の送信の手前で終わる」設計で、疎通確認が実際の経路を叩いていなかったことが 4 か月の理由です。

## 本番の Lambda でだけ壊れていた画像処理

**狙い。** 子供のアバターに、保護者が好きな画像を使えるようにしました。画面は「5MB 以下の JPEG / PNG / WebP を選択してください」と案内し、サイズ、形式、先頭バイトを検証してから画像を作り直して保存します。

**起きたこと。** 2026 年 9 月、本番でアバターの画像を上げると、どのファイルを選んでも 500 になっていました。ファイルは何も悪くありません。検証はすべて通過し、そのあとの画像の作り直しで落ちていました[^sharppr]。

**なぜ。** 依存の区分です。画像処理の sharp が開発用の依存（`devDependencies`）にありました。Lambda のイメージの本番用の依存は開発用を除いて解決するため、動作環境ごとの実行ファイルが落ちます。一方で sharp の JavaScript 本体は Vite が束ねるので存在し、読み込みだけが走って失敗します。NUC は開発用も込みで解決するので無傷で、AWS の Lambda だけの障害でした。しかも sharp を入れて以来ずっと壊れていて、本番でアバターを上げた人がいなかったため露見しませんでした[^sharppr]。

**変えたこと。** sharp を本番用の依存に移し、型止めを置きました。アプリの実行時に読み込む先である機械語の部品が開発用のままなら、自動検査で落ちるテストです。判定の軸は「束ねられるか」です。Svelte のように Vite が束ねるものは開発用のままで正しいので、対象を、依存の固定ファイル上で CPU や基本ソフトの制約付きの成果物を持つ部品に限定しています[^sharppr]。

この型が自動検査で原理的に検出できなかった理由も、プルリクエストに書かれています。単体テスト、画面操作テスト、Storybook、NUC はすべて開発用の依存が入った環境で走り、落ちるのは Lambda だけです。真因が読めたのは、その朝に入ったログの文脈出力の修正のおかげでした。それ以前は例外も保存先の識別子も本番から見えませんでした[^sharppr]。

**読者のリポジトリでは。** 本番のイメージを作るときに開発用の依存を除いているなら、実行時に読み込む部品が本番用の側にあるかを、依存の固定ファイルから機械で確かめてください。テストは全部、開発用の依存が入った環境で走っています。

同じ形の事故はコンテナの定義にもあります。依存の解決時に走るスクリプトが読み込む部品を追加したとき、コンテナ定義の `COPY` が追随せず、部品が見つからずに解決が落ちました。`COPY` と読み込みの整合は契約テストが確かめています[^dockerfile]。

## 同じイメージが 2 つの環境で動く

普通の Node のサーバとして動かす判断は、正しかったと考えています。Lambda 専用の書き方をすればコールドスタートは縮んだかもしれませんが、NUC と同じビルドの成果物を使えることの方が、この製品では価値がありました。1 つのイメージが AWS でも家庭内サーバでも動きます。

30 秒の予算は、設計の前提に置くべきでした。定期実行を Function URL に通す構成を選んだ時点で決まっていた制約ですが、持ち越しの規約が入ったのは 3 か月後です。

画像処理の事故は、生成AIが書く依存の区分を人が見ていなかった例です。開発用か本番用かの違いは、テストではなく本番でだけ現れます。本番でしか現れない型に対しては、テストを増やすのではなく、依存の固定ファイルの構造から機械で判定する方が確実でした。

## 持ち帰るもの

- 起動の確認と稼働の確認を分ける。データベースに触る深い確認を起動の条件にすると、1 つの依存の障害が全体の遮断になる
- 定期実行の実処理が HTTP の向こうで走るなら、予算はその HTTP の制限時間で決まる。持ち越しは件数を必ず出す
- 本番のイメージから開発用の依存を除くなら、実行時に読み込む部品の区分を依存の固定ファイルから機械で確かめる

次の章では、このイメージを本番に送り出すデプロイの前後に置いた関門を扱います。人はボタンを押しません。だから関門が人の判断の代わりをします。

[^dockerfile]: Lambda 用のコンテナ定義。4 段の構成、依存解決時のスクリプトへの `COPY` の追随（再発防止と契約テスト）、Lambda Web Adapter の設定、起動確認のパス。出典: [Dockerfile.lambda](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/Dockerfile.lambda)

[^research]: デモ用の Lambda を分ける構成の詳細設計。コールドスタートの体験の検証（AWS の数値、SnapStart の非対応、常時待機の試算）。出典: [docs/research/2097-multi-lambda-merged-system-design.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/research/2097-multi-lambda-merged-system-design.md)

[^computestack]: 計算のスタックの AWS CDK 定義。Lambda のメモリ、制限時間、命令セット、Function URL の `InvokeMode.BUFFERED`、定期実行の中継役、デモの Lambda、ログの退避。出典: [infra/lib/compute-stack.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/lib/compute-stack.ts)

[^awsdesign]: AWSサーバレスアーキテクチャ設計書。計算のスタック（起動確認と稼働確認の分離、定期実行の一覧、30 秒での打ち切り）、配信のスタック（静的ファイルの S3 への切り出し、通信記録の実測）、AWS の検証環境（Function URL のクエリの制約と CloudFront の関数）。出典: [docs/design/13-AWSサーバレスアーキテクチャ設計書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/13-AWSサーバレスアーキテクチャ設計書.md)

[^dispatcher]: 定期実行の中継役の Lambda。EventBridge から HTTP の POST への変換、入口の一覧、試運転の契約。出典: [infra/lambda/cron-dispatcher/index.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/lambda/cron-dispatcher/index.ts)

[^scheduler]: NUC の定期実行のコンテナ。`node-cron` で予定表を動かす構成、時刻帯のデータを入れる理由。出典: [Dockerfile.scheduler](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/Dockerfile.scheduler)

[^sharppr]: sharp の緊急修正のプルリクエスト。真因（開発用の依存と本番用だけの解決）、NUC が無傷だった理由、導入以来壊れていたこと、型止めのテストと判定の軸、変異による確認。出典: [PR #4957](https://github.com/Takenori-Kusaka/ganbari-quest/pull/4957)。テスト本体は [tests/unit/architecture/src-runtime-imports-are-prod-deps.test.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/src-runtime-imports-are-prod-deps.test.ts)
