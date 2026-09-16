---
title: "DynamoDB から Aurora DSQL へ移した経緯：3 日で覆った見送り、実機 spike で確定した制約、drizzle-kit の出力を DSQL に通す変換層"
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
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。使ったツールと用途は、末尾の「生成AIの利用について」に書いています。
:::

# はじめに

本番の DB を DynamoDB から Aurora DSQL に移しました。速さや安さのためではありません。NoSQL の単一テーブル由来の構造的な負債を返し、正しさと保守性を取り戻すための移管です。この記事は、その判断の経緯と、移管で確定した DSQL の制約、そして制約に合わせて書いたコードをまとめたものです。

移管の判断は一度「見送り」と結論し、3 日後に反転しています。何が変わって覆ったのかは、同じ判断へ直面する人の参考になるので、先に書きます。設計プロセスの詳細やテナント分離の仕組みは正本に書きました。

- 正本（Zenn Books『生成AIに実装を任せて商用サービスを作る』）: [Aurora DSQL の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/aurora-dsql) / [データモデリングの章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/data-modeling)
- 実装: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)
- Aurora DSQL の公式ページ: [Amazon Aurora DSQL](https://aws.amazon.com/rds/aurora/dsql/)

# 背景: 二重の backend を維持するコスト

発端は「NoSQL とリレーショナルのポリシー差が設計を恒常的に複雑化させている」という問題意識でした。本番は DynamoDB、ローカルとデモは SQLite です。1 つの概念につき interface 1 と実装 3 の 4 ファイルを同期し、スキーマ変更のたびに複数箇所を手で揃え、同期漏れを守るための CI gate を 2 本持っていました。過去には、DynamoDB 側が未実装のまま merge され、本番の write が消失したのに UI は「登録しました」と表示する重大な事故もありました。

# 見送り、そして反転

それでも最初の結論は見送りでした。理由は 4 つです。

1. コスト削減はゼロ。DynamoDB も同じ規模なら実質 $0
2. 顧客価値を生まない純リファクタに、本番データ移行のリスクを Pre-PMF で負うべきでない
3. DSQL は GA から約 1 年で未知数
4. OCC のリトライ、60 分の接続上限、トランザクションの行数上限を受け入れるコスト

3 日後の追補が転換を記録しています。再評価のトリガー（大規模スキーマ変更の EPIC への相乗り、保守性への投資フェーズ）が発火したうえに、2 つの forcing 要因がありました。auth のドメインが SQL の schema に無く SQL 化が不可避なこと、そして活動記録が非トランザクションの部分コミットで correctness 上放置できないことです。決め手は、ゼロユーザー期にはデータ移行そのものが不要という事実で、見送りの前提が崩れました。

調査は「Postgres 系なら Aurora Serverless v2 や RDS の方が RLS・移植・テストとも容易」と提言していました。退けたのは、scale-to-zero と月 0 円を譲れない制約にしたからです。最小 ACU の idle 課金がこの制約に反し、DSQL の scale-to-zero だけが適合しました。

# 実機 spike で確定した制約

着手前に、使い捨てのクラスタを本番と同じリージョンに作り、$1 の Budgets を先に置いて確かめました。結果は実際のエラーコード付きで残っています。

| 試したこと | 返ってきたもの |
|---|---|
| `ENABLE ROW LEVEL SECURITY` / `CREATE POLICY` | `0A000 unsupported` |
| `SERIAL` の主キー | `42704 type "serial" does not exist` |
| `REFERENCES` による外部キー | `0A000 FOREIGN KEY constraint not supported` |
| 同期の `CREATE INDEX` | `0A000`（`CREATE INDEX ASYNC` が必要） |
| 2 つの DDL を 1 トランザクションで | `0A000` |
| DDL と DML を 1 トランザクションで | `0A000` |
| 同じ行への並行 update | 片方の commit が `40001` |
| cold の接続確立 | 約 1,450ms |

PoC 全体の TotalDPU は 3.53 で、無料枠の 0.0035% でした。「見積 ¥0 = 実測ほぼ ¥0」が一致し、コストのサプライズはありませんでした。

# drizzle-kit の出力を DSQL に通す変換層

確定した制約のうち、いちばん実装に響いたのは、drizzle-kit の標準の migration 出力がそのままでは DSQL に適用できないことです。FK の除去、`USING btree` の除去と ASYNC 化、1 文 1 トランザクション、DDL と DML の分離が要り、カスタムの migration runner を書きました。変換は純関数で、実行は runner が担います。

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

想定外の入力は fail-close にします。手書きの SQL や function body は変換の対象外で、黙って誤変換して通すより、明示的に throw するか DSQL の適用時の error で止まる方を選んでいます。runner は各文を source 順に autocommit で適用し、ASYNC の index は build の完了を poll してから次に進みます。

# FK が無い DB で参照整合を守る

外部キーが無いので、参照整合は 4 つの手段に分類し直しました。複合 PK に参照先のキーを含めて構造的に存在を保証する。生成列と UNIQUE index で DB に物理強制させる。app 層の単一強制点で書込パスが保証する。そして存在保証の無い弱参照です。

「owner は家族に 1 人以下」という不変条件は、2 番目の手段で DB が拒否します。role が owner の行だけ `family_id` が入る生成列に UNIQUE を張ると、同じ家族の 2 人目の owner は `23505` で物理的に弾かれます。

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

DynamoDB の時代は role を 2 つの item に二重書きしていました。リレーショナルにすると、role は 1 行の SSOT になり、不変条件は DB が守ります。

# PK は作成後に変えられないので凍結する

DSQL では PK が物理レイアウトで、作成後に変更できません。全テナント表の PK は manifest で凍結し、manifest と設計書の表と drizzle の schema の 3 つが一致することを fitness function が検査します。

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

`family_id` を先頭に置く複合 PK と UUID v4 で hot partition を避け、時刻列は PK に入れません。PK を変えるには、設計書の表と manifest の同時更新と migration の ADR が要り、そこだけは人手で止める点にしています。

# 移管が返した負債

before と after を並べると、移管の目的が見えます。

| 負債 | before | after |
|---|---|---|
| backend の分岐 | 3 backend、CI gate 2 本、複数箇所の手動同期 | 単一の論理モデル |
| 採番 | surrogate の整数 PK と hot item での採番 | UUID v4 |
| テナント分離 | `tenant_id` が一部の表だけ | 全テナント表に `family_id` 先頭の複合 PK、fitness function で機械強制 |
| 残高 | BALANCE の item と SUM の二重管理 | 派生列を単一 SSOT にし、記録のトランザクション内で更新 |
| 記録の原子性 | 複数の表を非トランザクションで書き、部分コミット | core の行を単一トランザクション、optional は独立 |
| auth | DynamoDB 専用、role を 2 item に二重書き | リレーショナルな表、owner ≤ 1 を DB 強制、同意は追記のみ |
| 集計 | 全件転送してアプリ側で集計 | SQL の `GROUP BY` |

最大の効果は correctness です。部分コミットの根絶、owner ≤ 1 の DB 強制、backup の round-trip の機械保証、同意の改竄防止。「動くが静かに壊れる」class の欠陥を、設計の段階で封鎖しました。

# 誇張しない性能評価

性能は移管の理由ではありません。生の point-lookup は DynamoDB がやや優位で、DSQL は cold の Lambda で接続確立の tail が genuine な退行です。warm のクエリは in-region で数 ms とほぼ同等、集計と JOIN は DSQL が優位、書込競合は同じ行の write-write だけが `40001` で、異なる行はゼロ。総合すると「速度は wash からわずかに悪化」で、対外的にもそう書くと決めています。

限界も書いておきます。DSQL には公式のローカルエミュレータが無く、テストは PGlite で走ります。OCC や行数の上限は再現できないので、静的な guard と staging の実測で補っています。

# まとめ

- 見送りと反転はどちらも正しい判断でした。変わったのは状況の理解で、「ゼロユーザー期は移行コストが最小」という前提が決め手です
- 制約は実機で確かめ、エラーコード付きで残します。RLS 無し、FK 無し、SERIAL 無し、ASYNC index、1 文 1 トランザクション、OCC
- drizzle-kit の出力は変換層を通します。変換は純関数、想定外は fail-close です
- FK が無い分の参照整合は、複合 PK、生成列と UNIQUE、app 層の単一強制点、弱参照の 4 つに分類します
- PK は凍結し、manifest と設計書と schema の一致を CI で検査します
- 移管の目的は正しさで、性能ではありません。速いとも安いとも書きません

# 生成AIの利用について

この記事の作成には、生成AIの Claude（Anthropic の Claude Fable 5.1）を使いました。正本の該当章からの構成の検討、本文の下書きと改稿、コードの抜粋の照合、校正に使っています。筆者が内容を確認し、必要に応じて修正しました。公開した内容の責任は筆者が負います。
