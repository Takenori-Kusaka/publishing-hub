---
title: "DynamoDB から Aurora DSQL へ移した経緯：3 日で覆った見送り、実機検証で確定した制約、drizzle-kit の出力を Aurora DSQL に通す変換層"
tags:
  - AWS
  - AuroraDSQL
  - DynamoDB
  - drizzle
  - PostgreSQL
private: true
updated_at: ''
---

:::note info
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。
:::

# はじめに

本番のデータベースを DynamoDB から Aurora DSQL に移しました。速さや安さのためではありません。1 つの表に全部を入れる設計に由来する構造的な負債を返し、正しさと保守性を取り戻すための移行です。移行の判断は一度「見送り」と結論し、3 日後に反転しています。3 日で覆った判断は、何が変わったから覆ったのでしょうか。

見送りの根拠になっていた前提が 3 日のうちに崩れ、移行しない理由が無くなったからです。

- 正本（Zenn の本『生成AIに実装を任せて商用サービスを作る』）: [Aurora DSQL の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/aurora-dsql) / [データモデリングの章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/data-modeling)
- 実装: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)
- Aurora DSQL の公式ページ: [Aurora DSQL](https://aws.amazon.com/rds/aurora/dsql/)

# 背景: 2 つのデータベース実装を維持する費用

発端は「キーと値で持つデータベースと、表で持つ関係データベースの流儀の差が、設計を恒常的に複雑にしている」という問題意識でした。本番は DynamoDB、手元とデモは SQLite です。1 つの概念につき窓口の型 1 つと実装 3 つの 4 ファイルを同期し、表の定義の変更のたびに複数の箇所を手で揃え、同期の漏れを守る専用の自動検査を 2 本持っていました。過去には、DynamoDB 側が未実装のままマージされ、本番の書き込みが消失したのに画面が『N 件登録』と偽った重大な事故もありました。

# 技術選定理由: 見送り、そして反転

最初の結論は見送りでした。理由は 4 つです。

1. 費用の削減はゼロ。DynamoDB も同じ規模なら実質 0 ドル
2. 顧客の価値を生まない純粋な作り直しに、本番データの移行の危険を顧客が付く前の段階で負うべきでない
3. Aurora DSQL は一般提供から約 1 年で未知数
4. 楽観的な並行制御の再試行、60 分の接続の上限、トランザクションの行数の上限を受け入れる費用

見送りを結論した設計理由の記録への 3 日後の追記が、転換を記録しています。再評価の引き金（大規模な表の定義の変更への相乗り、保守性への投資の段階）が発火したうえに、移行を避けられなくする要因が 2 つありました。認証のドメインが SQL の定義に無く SQL 化が避けられないこと、そして活動の記録がトランザクションを使わない部分的なコミットで正しさの面で放置できないことです。決め手は、利用者がゼロの時期にはデータの移行そのものが不要という事実で、見送りの前提が崩れました。

調査は、PostgreSQL 系なら Aurora Serverless v2 や RDS の方が行単位のアクセス制御と移植とテストのどれも容易だと提言していました。退けたのは、使わないときは 0 まで縮むことと月 0 円を譲れない制約にしたからです。最小容量の待機に課金される方式がこの制約に反し、Aurora DSQL だけが適合しました。

# 実機で確定した制約

着手前に、使い捨てのクラスタを本番と同じリージョンに作り、1 ドルの予算の警報を先に置いて確かめました。結果は実際のエラーコード付きで残っています。

| 試したこと | 返ってきたもの |
|---|---|
| `ENABLE ROW LEVEL SECURITY` / `CREATE POLICY` | `0A000 unsupported` |
| `SERIAL` の主キー | `42704 type "serial" does not exist` |
| `REFERENCES` による外部キー | `0A000 FOREIGN KEY constraint not supported` |
| 同期の `CREATE INDEX` | `0A000`（`CREATE INDEX ASYNC` が必要） |
| 2 つの表の定義文を 1 トランザクションで | `0A000` |
| 表の定義文と書き込みを 1 トランザクションで | `0A000` |
| 同じ行への並行の更新 | 片方のコミットが `40001` |
| コールドの接続の確立 | 約 1,450ms |

試作全体の `TotalDPU` は 3.53 で、無料枠の 0.0035% でした。「見積 0 円 = 実測ほぼ 0 円」が一致し、費用の驚きはありませんでした。

# drizzle-kit の出力を Aurora DSQL に通す変換層

確定した制約のうち、いちばん実装に響いたのは、`drizzle-kit` の標準の移行の出力がそのままでは Aurora DSQL に適用できないことです。外部キーの除去、`USING btree` の除去と非同期化、1 文 1 トランザクション、表の定義文とデータの操作文の分離が要り、自前の移行スクリプトを書きました。変換は純粋な関数で、実行は実行部が担います。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/db/dsql/migration/transform.ts
// 変換 6 責務 (検証 2 の実 error code に 1:1 対応):
//   1. FK 除去          — `ALTER TABLE ADD CONSTRAINT … FOREIGN KEY` / inline `REFERENCES` を除去
//                         (実測: 0A000 `unsupported ALTER TABLE ADD CONSTRAINT` /
//                          `FOREIGN KEY constraint not supported`)。参照整合は app 層 relations()+fitness。
//   2. ASYNC index 化   — `CREATE (UNIQUE) INDEX … USING btree` → `CREATE (UNIQUE) INDEX ASYNC …`
//                         (実測: 0A000 `USING not supported` / `please use CREATE INDEX ASYNC`)。
//   3. ASYNC build poll — runner.ts が担う (本モジュールは asyncIndexName を抽出して橋渡し)。
//   4. 1 DDL/txn         — runner.ts が各文を autocommit で適用 (本モジュールは文単位に分割)。
//                         (実測: 0A000 `multiple ddl statements not supported in a transaction`)。
//   5. SERIAL/SEQUENCE   — SERIAL は reject (UUID PK 前提)。明示 SEQUENCE は CACHE≥65536 or =1 のみ許容。
//                         (実測: 42704 `type "serial" does not exist` /
//                          0A000 `CREATE SEQUENCE is not supported without an explicit cache size`)。
//   6. DDL/DML 非混在    — 各文を kind (ddl/dml) 付きで source 順 statements に保持し、runner が
//                         per-statement autocommit で適用 (同一 txn に混在させない、#3928)。
//                         (実測: 0A000 `ddl and dml are not supported in the same transaction`)。
// ...
export interface DsqlStatement {
	/** 適用する単一 SQL 文 (末尾 `;` なし)。 */
	sql: string;
	/**
	 * `CREATE (UNIQUE) INDEX ASYNC` の場合の index 識別子 (引用を外した実名。空白/ハイフンを含みうる)。
	 * runner が適用後に sys.jobs INDEX_BUILD=completed を poll するために使う (責務 3、F3)。
	 */
	asyncIndexName?: string;
}
```

想定外の入力は失敗側に倒します。手書きの SQL や関数の本体は変換の対象外で、黙って誤変換して通すより、明示的に例外で止まるか Aurora DSQL の適用時のエラーで止まる方を選んでいます。実行部は各文を元の順に 1 文ずつコミットして適用し、非同期の索引は作成の完了を待ってから次に進みます。

# 外部キーが無いデータベースで参照整合を守る

外部キーが無いので、参照整合は 4 つの手段に分類し直しました。参照先のキーを複合の主キーに含め、行が存在しなければ書けない構造にする。生成列に一意制約の索引を張り、データベースに物理的に拒否させる。アプリの層の単一強制点で書き込みの経路が保証する。そして存在の保証が無い弱い参照です。

「オーナーは家族に 1 人以下」という不変条件は、2 番目の手段でデータベースが拒否します。役割がオーナーの行だけ `family_id` が入る生成列に一意制約を張ると、同じ家族の 2 人目のオーナーは `23505` で物理的に弾かれます。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/db/dsql/schema.ts
// memberships — user × family の関係 (role の 1 行 SSOT、Dynamo の 2 item 二重書きを廃止)。
// owner_guard: role='owner' の行だけ family_id が入る STORED 生成列。UNIQUE により
// 同一 family の 2 人目 owner INSERT/UPDATE は 23505 で物理拒否 (owner ≤ 1、spike#3/#6 F6)。
export const memberships = pgTable(
	'memberships',
	{
		familyId: uuid('family_id').notNull(),
		userId: uuid('user_id').notNull(),
		role: text('role').notNull().$type<Role>(),
		ownerGuard: uuid('owner_guard')
			.generatedAlwaysAs(
				(): ReturnType<typeof sql> => sql`CASE WHEN role = 'owner' THEN family_id END`,
			)
			.unique(),
		invitedBy: uuid('invited_by'),
		joinedAt: timestamp('joined_at', { mode: 'string', withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		primaryKey({ columns: [t.familyId, t.userId] }),
		// findUserTenants (session 3 連 lookup の起点) 用 secondary (§6.6)。
		index('memberships_user_id_idx').on(t.userId),
		check('memberships_role_ck', enumCheck(t.role, ROLES)),
	],
);
```

DynamoDB の時代は、役割を 2 つの項目へ二重に書いていました。関係データベースにすると、役割は 1 行の正本になり、不変条件はデータベースが守ります。

# 主キーは作成後に変えられないので凍結する

Aurora DSQL では主キーが物理的な配置で、作成後に変更できません。全テナント表の主キーは凍結の一覧で固定し、一覧と設計書の表と Drizzle ORM の定義の 3 つが一致することを契約テスト（構造や文書と実装の一致を検査するテスト。正本にならってこう呼びます）が検査します。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/db/pk-freeze-manifest.ts
export const PK_FREEZE_MANIFEST = {
	// ── Child 集約 (§3) ──
	// children は linchpin: child_id が下記 ~30 表の複合 PK 先頭。UUID v4 (§P3 時刻列を PK に入れない)。
	children: ['family_id', 'child_id'],
	child_activities: ['family_id', 'child_id', 'activity_id'],
	// activity_logs / point_ledger: UUID v4 random で hot-partition ゼロ。
	// created_at は PK に入れない (sort 用途のみ = identity でない、§11.2 判断⑬訂正)。
	activity_logs: ['family_id', 'child_id', 'log_id'],
	point_ledger: ['family_id', 'child_id', 'ledger_id'],
	statuses: ['family_id', 'child_id', 'category_id'],
	// ...
```

`family_id` を先頭に置く複合の主キーと UUID v4 で特定の区画への集中を避け、時刻の列は主キーに入れません。主キーを変えるには、設計書の表と凍結の一覧の同時更新と、移行の設計判断の記録が要り、そこだけは人の手で止める点にしています。

# 移行が返した負債

移行前と移行後を並べると、移行の目的が見えます。

| 負債 | 移行前 | 移行後 |
|---|---|---|
| データベース実装の分岐 | 3 実装、自動検査 2 本、複数箇所の手動の同期 | 1 つの論理モデル |
| 採番 | 代理の整数の主キーと、1 か所に集中する採番 | UUID v4 |
| 家族の分離 | `tenant_id` が一部の表だけ | 全テナント表に `family_id` 先頭の複合の主キー、契約テストで機械強制 |
| 残高 | 残高の行と合計の二重管理 | 派生列を単一の正本にし、記録のトランザクション内で更新 |
| 記録の原子性 | 複数の表をトランザクション無しに書き、部分的なコミット | 中核の行を 1 つのトランザクション、任意の行は独立 |
| 認証 | DynamoDB 専用、役割を 2 項目に二重書き | 関係データベースの表、オーナー 1 人以下をデータベースが強制、同意は追記のみ |
| 集計 | 全件を転送してアプリ側で集計 | SQL の `GROUP BY` |

得たものの中で最も大きいのは正しさです。部分的なコミットは起こせなくなり、オーナー 1 人以下はデータベースが拒み、バックアップの往復は機械が保証し、同意は改竄できません。動いているのに静かに壊れる型の欠陥を、設計の段階で締め出しました。

# 誇張しない性能評価

性能は移行の理由ではありません。1 行の読み出しは DynamoDB がやや優位で、Aurora DSQL はコールドの Lambda での接続の確立が遅い側の裾として本物の退行です。温まった状態の問い合わせは同一リージョン内で数ミリ秒とほぼ同等、集計と結合は Aurora DSQL が優位、書き込みの競合は同じ行への書き込み同士だけが `40001` で、異なる行ではゼロ。総合すると「速度はほぼ互角からわずかに悪化。速度は移行の理由ではない」で、対外的にもそう書くと決めています。

Aurora DSQL には公式の手元用の模擬環境が無く、テストは PGlite で走ります。楽観的な並行制御や行数の上限は再現できないので、静的な検査と検証環境の実測で補っています。

# まとめ

- 見送りと反転はどちらも正しい判断でした。変わったのは状況の理解で、「利用者がゼロの時期は移行の費用が最小」という前提が決め手です
- 制約は実機で確かめ、エラーコード付きで残します。行単位のアクセス制御が無い、外部キーが無い、`SERIAL` が無い、索引は非同期、1 文 1 トランザクション、楽観的な並行制御
- `drizzle-kit` の出力は変換層を通します。変換は純粋な関数、想定外は失敗側に倒します
- 外部キーが無い分の参照整合は、複合の主キー、生成列と一意制約、アプリの層の単一強制点、弱い参照の 4 つに分類します
- 主キーは凍結し、一覧と設計書と定義の一致を自動検査で検査します
- 移行の目的は正しさで、性能ではありません。速いとも安いとも書きません

主キーの凍結の一覧は、設計書の表と Drizzle ORM の定義と一致していなければ契約テストが落ち、設計書に無い主キーは実装にも存在できません。正本の原則で言えば「設計書を実装の正本にする。書かれていない仕様は存在しない仕様として扱う」の実例です。10 条の全体は [原則の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/principles) にあります。

動いているサービス: [がんばりクエスト](https://www.ganbari-quest.com/)
