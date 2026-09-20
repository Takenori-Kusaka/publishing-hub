---
title: "第Ⅱ部-2　5 つの層と 4 つのデータベース実装 ― 画面からデータベースに触らせない構造と、それを守るテスト"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

アプリは 5 つの層に分かれ、上の層は下の層にだけ依存します。画面は 71 ページと 108 本の API、サービスは 121 本、データ取得の窓口の型（インターフェース）は 38 本です。層に分ける設計は珍しくありません。設計図は 2026 年 4 月からあり、生成AIはそれを読んで書いていました。それでも境界は何度も破られました。設計図を読める生成AIに、層の境界を守らせるには何が要るのでしょうか。

守るのは設計図ではなく、境界を越えた瞬間に落ちるテストでした。境界を破った 3 つの事故と、事故のあとに置かれたテストを順に見ます。

## 5 つの層

| 層 | 場所 | 責務 |
| --- | --- | --- |
| 1 画面 | `src/routes/` | ファイルの配置がそのまま URL になる。業務の処理を書かない |
| 2 機能と部品 | `src/lib/features/`、`src/lib/ui/` | 機能単位の画面部品と、Ark UI を包んだ基本部品 |
| 3 ドメイン | `src/lib/domain/` | 用語辞書、レベル計算、連続記録、年齢帯。サーバとブラウザの両方で使える純粋な関数 |
| 4 サービス | `src/lib/server/services/` | 業務の処理 |
| 5 データ取得 | `src/lib/server/db/` | データベースの実装を隠す窓口 |

画面の層の決まりは短いものです。`+page.svelte` に業務の処理を書かない。データの取得は `+page.server.ts` の `load` で行う。画面部品の中で直接 `fetch` しない。`<style>` は 50 行以下で、行内の見た目の指定は動的な値だけ。サービスの層の決まりは「`+server.ts` からデータベース接続層を直接呼ばず、必ずサービスを経由する」です[^archdoc]。

設計パターンは 4 つです。データベースの実装ごとに取得の処理をまとめる部品（Repository）、実装を選んで返す選択関数（Factory）、それらを 1 つの入口にまとめる窓口（Facade）、そして後処理のフックです。フックは、活動を記録したあとに走る副作用（スタンプ、レベル判定、通知）を、実行時の読み込みと例外の捕捉で疎に結びます。1 つのフックが失敗しても、記録そのものは止まりません[^archdoc]。

## 4 つのデータベース実装

データ取得の層は、環境変数 `DATA_SOURCE` でデータベースの実装を切り替えます。

| 値 | 実装 | 用途 |
| --- | --- | --- |
| `sqlite` | better-sqlite3 | 手元の開発とテスト |
| `dsql` | Aurora DSQL | AWS の本番 |
| `pglite` | PGlite | NUC での自前運用。Aurora DSQL 用の実装を再利用する |
| `demo` | メモリ上の見本データ | デモ環境 |

窓口となる `<name>-repo.ts` が選択関数を呼び、選択関数が環境変数に応じた実装を返します。設計書の図には `dynamodb/` のディレクトリが残っていますが、DynamoDB の実装は 2026 年 7 月に撤去され、33 本の実装と分岐が消えました[^backend]。

![画面はサービスだけを呼び、サービスは窓口だけを呼び、窓口の先で選択関数が環境変数に応じてデータベースの実装を選ぶ。契約テストが画面からデータベースへの直接の読み込みを止める](/images/ganbari-quest-design/layered-architecture.png)

## 本番でだけ壊れる

**狙い。** 実装の判定は、環境変数の値を見る 1 つの関数に寄せてありました。Aurora DSQL かどうかを返す関数です。

**起きたこと。** その関数が `pglite` を既定の `sqlite` として扱っていました。NUC では、活動の記録と取り消しを 1 つのトランザクションで行う経路、識別子の形式（UUID）の検査、置き換え取り込みの PostgreSQL 向けの手順がすべて無効になっていました。手元の SQLite でも本番の Aurora DSQL でも再現せず、NUC の PGlite でだけ起きます[^backend]。

同じ月に、もう 1 つ見つかりました。使用時間の記録の窓口が、SQLite の実装を直接読み込んでいました。本番の PostgreSQL 系では表が作られておらず例外になり、警告のログと「0 分」の表示に化けていました[^facadetest]。

**なぜ。** 判定を「Aurora DSQL か、それ以外か」の 2 値で書いたため、PGlite が「それ以外」に落ちました。窓口が実装を直接読み込んだのは、窓口の決まりが文書にしか無かったからです。

**変えたこと。** 判定を「PostgreSQL 系（Aurora DSQL と PGlite）か、SQLite か」の 2 値にし、`isPgBackend()` の 1 関数に寄せました。Aurora DSQL と PGlite を個別に分岐しません[^backend]。窓口に対しては、テストが 3 つの条件を検査します。窓口は `./sqlite/`、`./dsql/`、`./demo/` を読み込まない。選択関数 `getRepos()` を少なくとも 1 回呼ぶ。窓口の型ごとに 3 つの実装ファイルが揃っている[^facadetest]。

**読者のリポジトリでは。** 実装を切り替える判定が「A か、それ以外か」の形なら、3 つ目の実装が来たときにどちらへ落ちるかを確かめてください。

## 層を自動検査が守る

「画面からデータベースに触らない」は、生成AIへの指示書に散文で書かれていました。守るのは人でした。[第Ⅴ部-4](fitness-functions) で見るとおり、2026 年 6 月にこれは走査するテストになりました。`src/routes` 配下の全ファイルから、`drizzle-orm` や表の定義や実装固有の取得部品への読み込みを列挙します。品質保証部のレビューで、実行時の読み込みによるすり抜けが見つかり、対象に加わりました[^routedb]。

窓口の一致のテスト、実装判定の 1 関数化、画面の境界のテスト。3 つとも 2026 年 6 月から 8 月に、事故のあとで置かれました。層の設計図は 4 月からあり、生成AIはそれを読んで書いていました。それでも境界は破られました。

## 認可の 3 軸

すべてのリクエストは `hooks.server.ts` を通ります。961 行の処理は 9 段です。保守中かどうかの判定。CloudFront からの合言葉の検査（[第Ⅲ部-2](cdk-stacks)）。流量の制限。旧 URL の転送。デモの実行モード。経路の認可。おやカギコードの関門。セキュリティ用のヘッダーの付与。リクエストのログ。この順に進みます。合言葉の検査を流量の制限より前に置くのは、迂回の試行で制限の枠を消費させないためと、ヘッダーの比較 1 回が最も安い判定だからです[^hooks]。

認可は「経路 × 役割 × 契約状態」の 3 軸です。役割はオーナー、保護者、子供の 3 つ。経路の保護の決まりは上から順に照合し、最初に一致したものを適用します。`/admin/**` はオーナーと保護者、`/child/**` は子供を含む 3 役割、`/ops/**` は Cognito の運営者グループです。`/api/cron/**` と `/api/stripe/webhook` は認可層の許可一覧に載せたうえで、経路の側が合言葉と署名で検証します[^security]。

照合には、前方一致の落とし穴が記録されています。`/ops` に素朴な前方一致を使うと、`/opsedit` のような実在しない経路も巻き込みます。ファイルの冒頭に、綴りを直してはいけない負例として残されています[^authorization]。

識別子の取り違えにも防護があります。認証基盤が返す利用者の識別子（`sub`）は、アプリのデータベースの `users.user_id` ではありません。所属、招待、子供の表はすべてアプリの利用者の識別子を参照します。認証基盤の識別子を渡すと一致する行が無く、「削除したのに消えない」「本人の判定が効かない」が静かに起きます。データベースを触る経路は必ず `requireAppUserId()` からアプリの利用者の識別子を取り、Cognito 以外の認証で引けない場合は 401 で拒否します。引けないときに認証基盤の識別子で代用する道は作りません[^guards]。

## 使われていなかった判定層

**狙い。** 機能の可否の判断を 1 か所に集める層があります。`can()` は外部への読み書きを持たない純粋な関数で、「この機能はどの実行モードとどのプランで使えるか」の正本になるはずでした[^capabilities]。

**起きたこと。** 2026 年 9 月の監査で、この層の 3 つの機能がプランの条件を独自に持っていることが見つかりました。しかも本番から一度も呼ばれておらず、家族への招待の可否は「家族プラン以外は拒否」で、プラン上限の判定を担う別のサービスの「スタンダードは 4 人まで招待可」と正反対でした。配線した瞬間にスタンダードの契約者の招待が 403 になる地雷です[^capabilities]。

**なぜ。** 設計として正しい層を作り、そこに正しそうな判断を書き、呼び出す側を配線しなかったからです。呼ばれないコードは、間違っていても落ちません。

**変えたこと。** 3 件を削除し、プランの判定の正本をプラン上限のサービス 1 本に戻しました[^capabilities]。「配線の確認は実装の確認ではない」という [第Ⅳ部-5](sixty-to-hundred) の言葉は、この事故から出ました。

**読者のリポジトリでは。** 判断を集約する層を作ったら、その層が本番の経路から呼ばれているかを検索してください。呼ばれていない正しい層は、配線した日に事故を起こします。

## 効いたか、足りなかったか

5 層と 4 つのデータベース実装の設計は、そのまま残します。Aurora DSQL への移行、PGlite への切り替え、デモの分離が、どれも窓口と選択関数の境界の内側で完結したことが、この設計の価値です。画面とサービスは、どのデータベースで動いているかを知りません。

足りなかったのは、境界を守るテストを置く時期です。層を決めた 2026 年 4 月の時点で、画面の境界のテストと窓口の一致のテストは書けました。書かなかったのは、生成AIが設計図を守ると思っていたからです。守りませんでした。設計図を読める生成AIに対しても、境界は落ちるテストで表現する。これが第Ⅱ部を通じて繰り返す学びです。

## 持ち帰るもの

- 層の境界は、生成AIへの指示書に書くだけでなく、境界を越える読み込みを列挙して落ちるテストにする。設計した日に書ける
- 実装の切り替えは 1 つの関数に寄せ、「A か、それ以外か」の判定を避ける。3 つ目の実装は「それ以外」に落ちる
- 判断を集約する層を作ったら、本番の経路から呼ばれているかを確かめる。呼ばれない層は間違っていても落ちない

次の章では、5 層のうち画面の層を支えるデザインシステムを見ます。色、部品、用語の 3 つを「同じものを 2 か所に書かない」形に揃えた構造です。

[^archdoc]: ソフトウェアアーキテクチャ設計書。5 つの層と各層の決まりとサービスの一覧、データ取得の層（窓口と選択関数）、設計パターン（窓口、選択関数、正面、フック）。出典: [docs/design/24-ソフトウェアアーキテクチャ設計書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/24-%E3%82%BD%E3%83%95%E3%83%88%E3%82%A6%E3%82%A7%E3%82%A2%E3%82%A2%E3%83%BC%E3%82%AD%E3%83%86%E3%82%AF%E3%83%81%E3%83%A3%E8%A8%AD%E8%A8%88%E6%9B%B8.md)

[^backend]: データベース実装の切り替えを 1 か所で解決する関数。4 つの `DATA_SOURCE`、DynamoDB 実装の撤去、`isPgBackend()` に寄せた理由（NUC でだけ壊れていた同じ型の不具合）。出典: [src/lib/server/db/backend.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/db/backend.ts)。選択関数は [src/lib/server/db/factory.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/db/factory.ts)

[^facadetest]: 窓口とデータベース実装の一致を検査するテスト。使用時間の記録の窓口が実装を直接読み込んでいた実害、3 つの検査条件。出典: [tests/unit/architecture/db-facade-backend-parity.test.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/db-facade-backend-parity.test.ts)

[^routedb]: 画面の層とデータベースの境界を検査する契約テスト。出典: [tests/unit/architecture/route-db-boundary.test.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/route-db-boundary.test.ts)

[^hooks]: 全リクエストの前処理。各段（保守中の判定、合言葉の検査、流量の制限、旧 URL、デモ、認可、おやカギコードの関門、ヘッダー、ログ）と、合言葉の検査を流量の制限の前に置く理由。出典: [src/hooks.server.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/hooks.server.ts)

[^security]: セキュリティ設計書の認可の節。役割の体系、経路の保護の一覧、3 軸の判定、セッションを持たない外部からの呼び出しの扱い。出典: [docs/design/14-セキュリティ設計書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/14-%E3%82%BB%E3%82%AD%E3%83%A5%E3%83%AA%E3%83%86%E3%82%A3%E8%A8%AD%E8%A8%88%E6%9B%B8.md)

[^authorization]: 役割と経路の認可の一覧。上から順の照合、前方一致の負例。出典: [src/lib/server/auth/authorization.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/auth/authorization.ts)

[^guards]: 認証の防護の関数。`requireAppUserId()` と、認証基盤の識別子をアプリの利用者の識別子と取り違える実害。出典: [src/lib/server/auth/guards.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/auth/guards.ts)

[^capabilities]: 機能の可否を決める層。純粋な関数の設計、プランの条件を置かない理由（未配線で二重定義だった 3 件と、スタンダードの招待が 403 になる地雷）。出典: [src/lib/policy/capabilities.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/policy/capabilities.ts)
