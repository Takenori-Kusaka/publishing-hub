---
title: "第Ⅱ部-7　RLS の無い DB でテナントを分ける ― 信頼できる tenantId、単一強制点、fitness function"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

がんばりクエストのテナントは家族です。子供のデータを扱うため、家族間の漏洩は絶対に許されません。ところが本番 DB の Aurora DSQL は、PostgreSQL の行レベルセキュリティ（RLS）に対応していません。この章では、DB エンジンの強制が無い環境でテナント分離を「実効力のある」ものにした 5 つの仕組み、cookie に焼き込んだ課金状態が 24 時間古いままになる事故、そして同じ種類の不具合が 3 回再発してから機械で止めた経緯を扱います。

## 3 つの案

ADR-0063 は 3 案を比較しています[^adr63]。

| 案 | 内容 | 判定 |
| --- | --- | --- |
| A | pool + PostgreSQL RLS。アプリが WHERE を書き忘れても DB が漏洩を止める | DSQL は RLS 非対応（実機で `0A000`）。採用不可 |
| B | silo。1 家族 = 1 cluster、per-tenant の IAM で物理分離 | 全 cluster への N 回 migration、サインアップごとの provisioning、横断集計不能。Pre-PMF に過剰 |
| C | pool + 信頼できる claim と context + アプリ層の単一強制点 + fitness function | 採用 |

案 C の前例は acts_as_tenant（Rails）と PostHog の `team_id` です。判断の背景には、現状の DynamoDB も結局アプリ層の強制であり、RLS の不在は移行で「非悪化」だという認識があります。「実効力」の源泉は、tenantId が Cognito の署名で偽造不能な点にあり、悪意ある cross-tenant の read は成立しません。残るリスクは開発者の WHERE 書き忘れで、それを機械強制で閉じます[^adr63]。

## 5 つの仕組み

物理モデルの §3.4 は、代替防御線を 5 つに整理しています[^m3]。

1. `family_id` 列を全テナント表の複合 PK の先頭に置く。UUID と複合で hot key を避ける
2. 信頼できる tenantId を確立する。Cognito の JWT を検証したあと membership を解決し、署名付きの context cookie に載せる。DB は JWT を読まない。`hooks.server.ts` が検証済みの tenantId を確定する
3. tenant-scoped な repository を単一強制点にする。生クエリの発行を境界の外で禁止し、`WHERE family_id = :ctx` の注入を 1 か所に集約する
4. fitness function。`family_id` の述語が無い SELECT / UPDATE / DELETE を CI で hard-fail する
5. cross-tenant の E2E。家族 A の token で家族 B のリソースを叩き、403 か空を assert する

fitness function の例外は、閉じた allowlist で明示列挙されます。グローバルな master（カテゴリ・スタンプ・プラン）、tenant 非依存の auth（users、メールのロック）、そして global-UNIQUE な capability lookup です。lookup に入るのは viewer の token・cloud export の pin・push の endpoint・招待の token hash です。「グローバルっぽい表」を open に判定せず列挙するのは、新しい表が silent に述語なしで通るのを防ぐためです[^tenantfitness]。

capability lookup には、もう 1 つの不変条件が付きます。「surrogate id や capability キー単独での row fetch は、取得行の `family_id` を確定し以降の全アクセスを当該 family_id に再スコープするまで、テナントデータを返してはならない」。viewer の token で家族 X の共有リンクを引いたあと、その token で家族 Y のデータを読めてはなりません[^m3]。

![5 つの仕組み](/images/ganbari-quest-design/multi-tenancy.png)

## 接続と権限

Lambda は connector の `AuroraDSQLPool` を module scope に 1 個だけ持ち、drizzle を無改変で被せます。connector が IAM token の自動生成と更新（60 分期限、新規の物理接続ごとに fresh な token）、hostname からの region の判定を肩代わりします。warm で約 4ms、cold で約 120ms の接続確立を PoC で実証しました[^connection]。

接続に使う role は、admin ではありません。アプリの実行時は専用の最小権限の Postgres role `app_user` で、`DbConnect` の IAM 権限だけを持ちます。migration と GRANT の管理は別の credential `DbConnectAdmin` で、アプリの実行経路から到達不能に保ちます。GRANT を防御線に名指す以上、接続の role モデルは物理設計の責務だと設計書は書いています。admin で接続すると GRANT の bypass で残高の改竄や同意の削除が素通りするからです[^m3]。

追記のみの表（同意、ポイント台帳、ステータス履歴、各種 log）には UPDATE の GRANT を与えません。UPDATE は deny-by-default で、`UPDATE_ALLOWED_TABLES` に明示列挙した表にだけ付与し、どちらの集合にも無い未分類の新表は追記のみの側に倒れます。DELETE は除外しません。退会、retention の掃除、child の削除が正当な業務経路として DELETE を発行するからです。「改竄不能、削除可能」の非対称です[^m3]。

## 課金状態を token に焼き込まない

tenantId と並んで、当初は課金状態（licenseStatus、plan、tenantStatus）も context の cookie に焼き込まれていました。cookie の TTL は owner で 24 時間あり、Stripe の webhook や解約や再開が DB を更新しても、ブラウザの cookie が切れるまで UI と権限は古いまま固定されました。実害は両方向です。支払い済みの顧客が最大 24 時間有料機能を使えない。解約済みの顧客が最大 24 時間有料機能を使えてしまう[^entitlement]。

2026 年 7 月の対応で、token には tenantId・role・childId だけを持たせ、課金状態は毎リクエスト DB から引くようになりました。リクエスト単位のキャッシュで DB アクセスは 1 回に抑え、解約と再開の書き込み直後にはキャッシュを無効化して次のリクエストで再解決させます。DB から引けないときは、古い値で有料機能を通し続けないために context を発行せず 503 を返します。[第Ⅲ部-5](observability) で見た fail-closed の alarm は、この判断の観測点です[^entitlement]。

## 3 ラウンド再発した uuid

DSQL への切り替えで、id が数値から uuid になりました。cookie に残っていた旧数値の `selectedChildId`（`'3'` のような値）が uuid 列の WHERE に直達すると、Postgres が 22P02（invalid input syntax for type uuid）を throw します。route の graceful な not-found 処理を貫通して 500 になります。同じ class が 3 ラウンド再発しました[^uuidguard]。

個別のメソッドに guard を配線する修正を 2 回繰り返したあと、fitness function に切り替えました。uuid 形式の判定の hand-rolled な regex は `pg-uuid.ts` の 1 か所だけ（別実装は observability を迂回する）。guard を使う各 module は、警告の log を同数以上呼ぶ（silent な guard の禁止）。人の注意が「新しい経路で guard を書き忘れる」「観測点の無い guard を足す」を防げなかったため、2 つの不変条件を CI で hard-fail にしました[^uuidguard]。

NUC のセルフホストは単一テナントで、tenantId は固定の UUID です。旧 backend では固定文字列 `'local'` でしたが、新 schema の `family_id` は uuid 型なので、そのままでは全クエリが parse error になります。cutover 後は不変で、変更はデータの孤立を招くと書かれています[^localtenant]。

## 今ならこうする

RLS が無いことは、移行で失ったものではなく、最初から無かったものです。DynamoDB の時代も分離はアプリ層でした。違いは、それが「規律」だったか「機械強制」だったかです。DSQL への移行は、fitness function・閉じた allowlist・GRANT の deny-by-default を持ち込み、分離を検査可能にしました。

uuid の 3 ラウンドは、[第Ⅳ部-5](sixty-to-hundred) の class-lock がなぜ要るかの実例です。1 回目の修正で「この経路にも guard が要る」と学び、2 回目で「観測点も要る」と学び、3 回目で「人の注意では足りない」と学びました。3 回目まで待つ必要はありませんでした。

[^adr63]: ADR-0063「DSQL pool マルチテナント分離」。3 案の比較、5 つの決定、NUC との両立、再検討トリガー。出典: [docs/decisions/0063-dsql-pool-multitenant-isolation.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0063-dsql-pool-multitenant-isolation.md)

[^m3]: M3 物理データモデル §3.4 テナント分離の物理強制。5 つの代替防御線、fitness function の閉じた allowlist、capability lookup の再スコープ義務、実行時接続ロールモデル（`app_user`、UPDATE の deny-by-default、DELETE の非対称）。出典: [docs/design/dsql/m3-physical-model.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/dsql/m3-physical-model.md)

[^tenantfitness]: `family_id` 述語の fitness function。tenant 表と global 表の分類、閉じた allowlist の 3 分類。出典: [tests/unit/architecture/dsql-tenant-predicate-fitness.test.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/dsql-tenant-predicate-fitness.test.ts)

[^connection]: DSQL の接続層。connector の singleton pool、IAM token の自動更新、OCC retry の役割分担、IAM role の前提、採用しない fallback。出典: [src/lib/server/db/dsql/connection.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/db/dsql/connection.ts)

[^entitlement]: テナントの課金状態を DB から解決する SSOT。cookie に焼き込んでいた背景と両方向の実害、毎リクエスト解決とキャッシュ。出典: [src/lib/server/auth/tenant-entitlement.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/auth/tenant-entitlement.ts)

[^uuidguard]: uuid guard の SSOT と observability を機械保証する fitness。3 ラウンドの再発、2 つの不変条件。出典: [tests/unit/architecture/dsql-uuid-guard-ssot-fitness.test.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/dsql-uuid-guard-ssot-fitness.test.ts)

[^localtenant]: NUC 単一テナントの tenantId の SSOT。固定 UUID と不変の理由。出典: [src/lib/server/auth/local-tenant.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/auth/local-tenant.ts)

