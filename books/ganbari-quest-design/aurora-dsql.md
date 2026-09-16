---
title: "第Ⅱ部-6　Aurora DSQL ― 見送りから移管へ、8 回の spike、DPU の 5 原則"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

本番のデータベースは Aurora DSQL です。PostgreSQL 互換のサーバレス分散 SQL で、scale-to-zero、固定費ゼロ、月 10 万 DPU の無料枠があります。2026-06-28 に「Pre-PMF では移管しない」と結論した評価が、3 日後に反転して移管が決まりました。この章では、その反転の理由、8 回の実機 spike で確定した制約、移管が返した技術負債、そして誇張しない性能評価を扱います。

## 見送り、そして反転

評価の発端は「NoSQL とリレーショナルのポリシー差が設計を恒常的に複雑化させている」という PO の問題意識でした。本番は DynamoDB、ローカルとデモは SQLite。二重の backend を維持するコストは定量化されています。DynamoDB の実装が 39 ファイル約 11,000 行で DB 層の 38%、1 概念につき interface 1 と実装 3 の 4 ファイル同期、スキーマ変更 1 回で 5〜6 か所の手動同期、同期漏れを守る専用の CI gate 2 本。過去には「DynamoDB 未実装のまま merge され、本番の write が消失して UI が『N 件登録』と偽装した」CRITICAL がありました[^rationale]。

それでも 6 月 28 日の結論は見送りでした。理由は 4 つです。コスト削減はゼロ（DynamoDB も同規模では実質 $0）。顧客価値を生まない純リファクタに本番データ移行のリスクを Pre-PMF で負うべきでない。DSQL は GA から約 1 年で未知数。OCC のリトライや 60 分の接続上限や 3,000 行のトランザクション上限の受容コスト。「保守性の価値は本物だが『今』ではない」[^rationale]。

7 月 1 日の追補が転換を記録しています。再評価のトリガー（大規模スキーマ変更の EPIC への相乗り、保守性への投資フェーズ）が発火し、加えて 2 つの forcing 要因がありました。auth のドメインが SQL の schema に無く SQL 化が不可避であること、そして活動記録が非トランザクションの部分コミットで correctness 上放置できないこと。決め手は「ゼロユーザー期 = データ移行が不要」で、見送りの前提そのものが崩れました[^rationale]。

## 8 つの致命リスクと 8 回の spike

着手前に、致命的リスク 8 点を一次ソースで多角検証しました。コスト、性能、スキーマ一本化、CDK、docs、テスト維持性、マルチテナントと IAM、プロダクトの本質。6 つは NOT-TRIGGERED、テスト維持性は部分 TRIGGERED（公式のローカルエミュレータが無い）、マルチテナントは条件付き GO でした[^research]。

調査の 2 本は独立に「Postgres 系なら Aurora Serverless v2 や RDS の方が RLS・移植・テストとも容易」と提言しました。しかし、scale-to-zero と月 0 円を絶対制約とする PO の判断で退けました。最小 ACU の idle 課金が制約に反します。DSQL の scale-to-zero が、コスト最優先の要件に唯一適合しました[^research]。

実機の spike は、使い捨てのクラスタを本番と同じ `us-east-1` に作り、検証後に削除しました。安全網として $1 の Budgets を先に作っています。結果は実エラーコード付きで記録されています[^research]。

| 検証 | 結果 |
| --- | --- |
| `ENABLE ROW LEVEL SECURITY` / `CREATE POLICY` | `0A000 unsupported`。RLS 非対応を実機で確定 |
| `SERIAL` の PK | `42704 type "serial" does not exist`。UUID 一択 |
| FK の `REFERENCES` | `0A000 FOREIGN KEY constraint not supported` |
| 同期の `CREATE INDEX` | `0A000`。`CREATE INDEX ASYNC` が必須 |
| 3,000 行 / 1 txn | commit 成功。3,001 行は `54000 transaction row limit exceeded` |
| 2 DDL / 1 txn、DDL + DML / 1 txn | どちらも `0A000` |
| OCC の並行 update | 片方の commit が `40001` |
| 接続確立（cold） | 約 1,450ms。Lambda の実行コンテキストでの接続再利用が必須 |

PoC 全体の TotalDPU は 3.53 で、無料枠の 0.0035%。「見積 ¥0 = 実測ほぼ ¥0」が一致し、結論は「サプライズなし」でした[^research]。Phase 1 の PoC はさらに、drizzle-kit の標準 migration 出力が DSQL にそのまま適用できないことを確定しました。FK の除去、`USING btree` の除去と ASYNC 化、1 文 1 txn、DDL と seed の分離が要り、カスタムの migration runner が必須になりました[^poc]。

## 返した技術負債

rationale の追補は、移管が返した負債を before と after で表にしています[^rationale]。

| 負債 | before | after |
| --- | --- | --- |
| backend の分岐 | 3 backend、約 11,000 行、CI gate 2 本、同期 5〜6 か所 | 単一の論理モデル、約 1.2〜1.3 万行を削除 |
| 採番 | surrogate の int PK 43 / 46 表、`counter.ts` の hot-item 採番、辞書順の `padId` | UUID v4。counter と padId を撤廃 |
| テナント分離 | `tenant_id` が 15 / 46 表のみ、no-op の `_tenantId` | 全テナント表に `family_id` 先頭の複合 PK、fitness function で機械強制 |
| 残高の二重実装 | BALANCE item と SUM の二重管理 | `children.total_point` の派生列を単一 SSOT、記録 txn 内で更新 |
| 記録の原子性 | 5 表以上を非トランザクションの best-effort で書き、部分コミット | core 5 行を単一 txn（all-or-nothing）、optional は独立 |
| auth の SQL 不在 | tenant / user / membership / invite / consent が DynamoDB 専用、role を 2 item に二重書き | リレーショナル 5 表、owner ≤ 1 を生成列の UNIQUE で DB 強制、consent は追記のみ |
| 集計の場所 | 全件転送してアプリ側の JS で集計 | SQL の `GROUP BY` |

最大の効果は correctness だと書かれています。部分コミットの根絶、owner ≤ 1 の DB 強制、backup の round-trip の機械保証、consent の改竄防止。「動くが静かに壊れる」class の構造的欠陥を、設計段階で封鎖しました[^rationale]。

## 誇張しない性能評価

rationale には「対外的にも誇張しない」と題した性能の節があります。生の point-lookup は DynamoDB がやや優位で、DSQL は cold の Lambda で接続確立の約 500ms の tail が genuine な退行。warm のクエリは in-region で数 ms とほぼ同等。集計と JOIN は DSQL が優位。書込競合は同一行の write-write だけが 40001 で、異なる行はゼロ。総合すると「速度は wash からわずかに悪化。速度は移管の理由ではない」[^rationale]。

対外コミュニケーション用の 1 行も用意されています。要約すると、DSQL 移管は性能やコストの最適化ではありません。NoSQL 単一テーブル由来の構造的な技術負債を約 1.2〜1.3 万行規模で返還し、正しさと保守性を取り戻す投資です[^rationale]。本書もこの 1 行に従います。

staging の実測は、OCC の retry が正しく効くことを示しています。retry 無しで 8 並行の活動記録を同一 child の共有行に書くと、40001 が 8 件中 7 件。`withOccRetry` 込みで日次上限 1 なら exactly-once（成功 1、ALREADY_RECORDED 7、台帳 1 行）。無制限なら lost update ゼロ。活動記録 1 回は約 0.1 DPU で、1 家族が月 300 回記録しても約 30 DPU、$0.00024 です[^research]。

## DPU の 5 原則

DSQL の課金は DPU（処理バイト + CPU 秒）で、行数課金ではありません。write のトランザクションには最小 0.05 WriteDPU が適用され、小さい write を N 回に分けると内容にかかわらず 0.05 × N が課金されます。WriteDPU は ReadDPU の約 27 倍のコスト密度で、スキャンした全行が課金対象です。ADR-0065 は「規約の目的は正常時の節約ではなく、事故（full scan や N+1 の常態化）の構造的防止」と位置づけ、5 原則を置きました[^adr65]。

1. フルスキャン禁止。全クエリは `WHERE family_id = ...` を先頭に持つ複合 PK の prefix でアクセスする
2. N+1 禁止。同一操作の複数 write は単一 txn にまとめる。ループ内の `await repo.insert()` は禁止
3. secondary index は既定で張らない。全 index が write の課金対象で、統計未反映時は「張れば効く」が成立しない
4. hot key の write を作らない。UUID v4 で分散する
5. 一括処理は 3,000 行 / 10MiB のチャンクと冪等な upsert

原則 1 は [第Ⅱ部-7](multi-tenancy) のテナント述語の fitness と同一の強制点で、原則 2 はループ内の逐次 write を TS の AST で検出する fitness で、既存分は baseline に pin する ratchet です。原則 3〜5 は定量判断を要するため機械 gate にせず、レビュー基準に留めています[^adr65]。

## ガードレールと backup

DsqlStack は alarm を 2 本に限定しています。TotalDPU が日次 3,225（月 10 万のペース）を超えたら、ClusterStorageSize が 0.8 GiB を超えたら。可観測性の metric は alarm ではなく dashboard で見て、無料枠の 10 本を温存します。Budgets は $1 で、実質「課金が発生したら知る」設定です[^dsqlstack]。[第Ⅲ部-1](serverless-cost) で見たとおり、3 か月の DSQL の請求は $0 でした。

backup は AWS Backup の日次 full snapshot で、7 日保持、02:00 UTC。DSQL は PITR に対応せず、RPO は直近の日次 backup の時刻です。秒単位の細かい復元はアプリ層の論理 backup が担います。復元は新しい cluster への復元で、DSQL の行だけ戻しても顧客の復元にはならず、S3 のアバター写真と録音も同じ plan で復元して初めて完了します。月額は実測 1.35 MiB で約 $0.0005、7 日保持のまま cluster が約 190 MiB になるまで 10 円未満です[^restore]。

alarm が鳴ったときの一次対応も runbook にあります。TotalDPU の超過は、直近の deploy、restore の多重実行、cron の異常連打、フルスキャン系クエリの混入、OccConflicts の同時増を順に疑います[^alertrunbook]。

## 今ならこうする

見送りの判断も、反転の判断も、どちらも正しかったと考えています。6 月 28 日の評価は「コストが動機にならない」と「Pre-PMF で純リファクタのリスクを負わない」を正しく見抜き、7 月 1 日の反転は「ゼロユーザー期は移行コストが最小」という前提の変化を正しく捉えました。判断が変わったのは、状況の理解が変わったからで、3 日で覆したことは欠点ではありません。

rationale が「誇張しない」性能評価を残したことは、この本の書き方にも影響しています。移管の目的は速さや安さではなく、正しさでした。それを速いとも安いとも書かない規律が、設計文書の側にありました。

限界は、DSQL に公式のローカルエミュレータが無いことです。テストは PGlite で走り、OCC や 3,000 行の制約は再現できません。それらは静的な guard と staging の実測で補っています。[第Ⅲ部-7](nuc-selfhost) で見たとおり、PGlite はテスト基盤から NUC の本番 DB にまでなりました。

[^rationale]: Aurora DSQL 移管評価の設計経緯。発端、現状の複雑さの定量化、調査結果、代替案と棄却理由、2026-06-28 の採用案、追補（判断転換、返還した技術負債の表、効果、正直なパフォーマンス評価、対外コミュニケーション用の 1 行）。出典: [docs/rationale/13-aurora-dsql-migration-evaluation-rationale.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/rationale/13-aurora-dsql-migration-evaluation-rationale.md)

[^research]: Aurora DSQL 採用の研究文書。§1 コストガードレール、§2 コネクション、§9 de-risking の 8 点判定、§10 テナント分離、§11.1 実機 spike の結果表と実測コスト、§11.2 staging 実測。出典: [docs/research/2026-06-28-aurora-dsql-adoption.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/research/2026-06-28-aurora-dsql-adoption.md)

[^poc]: Phase 1 PoC の実測結果。drizzle-kit の出力が適用不可であることと回避策、生成列と UNIQUE による owner ≤ 1 の物理強制。出典: [docs/research/dsql-poc-phase1-results-2026-07-05.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/research/dsql-poc-phase1-results-2026-07-05.md)

[^adr65]: ADR-0065「DSQL DPU コスト規約」。課金の前提と実測、3 つの選択肢、5 原則、機械強制の適用状況と静的検出の限界。出典: [docs/decisions/0065-dsql-dpu-query-rules.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0065-dsql-dpu-query-rules.md)

[^dsqlstack]: DSQL stack の CDK 定義。コスト前提、2 本の alarm と閾値、$1 の Budgets、AWS Backup の plan。出典: [infra/lib/dsql-stack.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/lib/dsql-stack.ts)

[^restore]: DSQL と S3 の復元 runbook。2 層 backup の役割分担、full snapshot のみで PITR 無し、月額コスト設計、S3 backup の前提。出典: [docs/runbooks/dsql-restore.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/runbooks/dsql-restore.md)

[^alertrunbook]: DSQL の alarm 閾値超過時の一次対応。出典: [docs/runbooks/dsql-alert-response.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/runbooks/dsql-alert-response.md)
