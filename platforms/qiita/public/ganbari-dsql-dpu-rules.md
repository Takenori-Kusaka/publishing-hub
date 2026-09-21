---
title: "Aurora DSQL を行単位のアクセス制御なしで家族ごとに分ける：主キー先頭の家族の識別子、条件の無い問い合わせを落とす契約テスト、衝突だけの再試行、課金単位の 5 原則"
tags:
  - AWS
  - AuroraDSQL
  - PostgreSQL
  - drizzle
  - マルチテナント
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

家族ごとにデータを分ける子供向けのウェブアプリを、本番は Aurora DSQL で動かしています。PostgreSQL 互換のサーバレスの分散データベースで、固定費が無く、月 10 万 DPU（Aurora DSQL の課金単位）までは無料です。困るのは、PostgreSQL の行単位のアクセス制御（Row Level Security、RLS）を当てにできないことです。開発者が問い合わせに家族の条件を付け忘れても、データベースの側では何も起きず、他の家族の行がそのまま返ります。分離をデータベースに任せられないとき、何を組めば家族の間の漏洩を実効的に防げるのでしょうか。

要るのは、偽造できない家族の識別子、条件を注入する 1 か所、そして条件の欠落を落とす自動検査（CI）の 3 点です。コードに落とした仕組みは次の 5 つです。

- 複合の主キーの先頭に `family_id` を置く
- 条件の無い問い合わせを自動検査で落とす
- 接続の束（connection pool）をモジュールに 1 個だけ持つ
- 楽観的な並行制御（OCC）の衝突 `40001` だけを再試行する
- 課金単位に合わせて書き込みを束ねる

5 つのうち、家族の分離に当たるのは前の 2 つです。偽造できない識別子は Cognito の署名付きトークンが、条件を注入する 1 か所はアプリ層の単一強制点が担います。残りの 3 つは、Aurora DSQL の接続、並行の更新、課金への対処です。

- 正本（Zenn の本『生成AIに実装を任せて商用サービスを作る』）: [家族を分ける章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/multi-tenancy) / [Aurora DSQL の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/aurora-dsql)
- 実装: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)
- Aurora DSQL の公式ページ: [Aurora DSQL](https://aws.amazon.com/rds/aurora/dsql/)

# 前提: 実機で確定した制約

使い捨てのクラスタで確かめた制約は次の 6 つで、エラーコードは実際に返ってきたものです。

| 試したこと | 返ってきたもの |
|---|---|
| `ENABLE ROW LEVEL SECURITY` / `CREATE POLICY` | `0A000 unsupported` |
| `SERIAL` の主キー | `42704 type "serial" does not exist` |
| `REFERENCES` による外部キー | `0A000 FOREIGN KEY constraint not supported` |
| 同期の `CREATE INDEX` | `0A000`（`CREATE INDEX ASYNC` が必要） |
| 1 トランザクションで 3,001 行 | `54000 transaction row limit exceeded` |
| 同じ行への並行の更新 | 片方のコミットが `40001` |

行単位のアクセス制御が無い、外部キーが無い、`SERIAL` が無い、並行の更新が衝突する。この 4 つが、以降の設計をすべて決めています。

# 設計方針: 共用のデータベースと、アプリ層の単一強制点

候補は 3 つありました。全家族で 1 つのデータベースを共用し、行単位のアクセス制御に頼る案は、上の表のとおり採れません。1 家族に 1 クラスタを専有させる案は、移行を家族の数だけ回すことになり、横断の集計もできないので見送りました。残った案が、共用のデータベースに全家族を載せ、信頼できる家族の識別子をアプリ層の 1 か所で全問い合わせに注入する方式です。

「信頼できる」の根拠は、家族の識別子が Cognito の署名付きトークンから導かれ、偽造できないことにあります。トークンの検証と所属の解決はリクエストの入口で 1 回だけ行い、データベースはトークンを読みません。残る危険は、開発者が `WHERE` の条件を書き忘れることです。そこを人の注意ではなく自動検査に持たせました。

# 家族の条件を自動検査で強制する

全テナント表は `family_id` を先頭に置く複合の主キーです。そのうえで、テナント表への `SELECT` / `UPDATE` / `DELETE` に `family_id` の条件が無ければ落ちる走査テストを置いています。構造や文書と実装の一致を検査するこの種のテストを、元の本にならって契約テスト（fitness function。API の契約テストとは別物）と呼びます。例外は閉じた許可一覧（allowlist）に理由付きで列挙します。「共通データらしい表」を緩い判定で通すと、新しい表が黙って条件なしで通るからです。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/dsql-tenant-predicate-fitness.test.ts
/** tenant 表 = PK 凍結 manifest (family_id 先頭) + auth 系 family スコープ表 (§6.6 manifest 例外)。 */
const TENANT_TABLES = new Set<string>([
	...Object.keys(PK_FREEZE_MANIFEST),
	// auth 5 表のうち family スコープのもの (manifest は「family_id 先頭 PK」でないため対象外だが、
	// テナントデータを含む以上 述語規律の対象。users はグローバルのため除外)
	'families',
	'memberships',
	'invites',
	'consents',
]);

/** グローバル表 (§3.4 allowlist 第 1-2 分類): family_id 述語自体が存在しない。 */
const GLOBAL_TABLES = new Set<string>([
	...Object.keys(GLOBAL_MASTER_PK_MANIFEST),
	'users',
	'email_login_lockouts',
]);
// ...
const PREDICATE_ALLOWLIST: AllowlistEntry[] = [
	// ── capability / global-UNIQUE lookup (§3.4 第 3 分類。後段の family_id 再スコープ義務あり) ──
	{
		file: 'viewer-token-repo.ts',
		table: 'viewer_tokens',
		marker: /WHERE\s+token\s*=/,
		reason: 'capability lookup: 共有リンク token 単点照合 (取得行 family_id へ再スコープ)',
	},
	{
		file: 'cloud-export-repo.ts',
		table: 'cloud_exports',
		marker: /WHERE\s+pin_code\s*=/,
		reason: 'capability lookup: export PIN 単点照合 (取得行 family_id へ再スコープ)',
	},
	// ...
];
```

テナント表の一覧は手書きせず、主キーを凍結した目録（manifest）から導いています。表を足したら目録に載せる必要があり、載せた瞬間に条件の検査対象になります。許可一覧の各行はファイル名、表名、照合する文字列の 3 つで 1 つの文を特定するので、「同じファイルの別の問い合わせ」が例外に紛れ込みません。

走査は Aurora DSQL の実装のディレクトリ（`src/lib/server/db/dsql`）配下の `.ts` を再帰的に集め、`sql` のタグ付きテンプレートの本文を 1 文ずつ取り出してから判定に掛けます。文ごとに参照している既知の表を拾い、グローバル表は飛ばし、テナント表なら `family_id` の条件か列があるかを見ます。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/dsql-tenant-predicate-fitness.test.ts
/** SQL 文から参照 tenant/global 表を抽出する (既知表名のみ。キーワード誤捕捉は無視される)。 */
function referencedTables(text: string): { table: string; kind: 'read' | 'insert' }[] {
	const found: { table: string; kind: 'read' | 'insert' }[] = [];
	const tableRe = /\b(?:FROM|JOIN|UPDATE|INTO)\s+([a-z_]+)/gi;
	let m = tableRe.exec(text);
	while (m) {
		const table = (m[1] ?? '').toLowerCase();
		if (TENANT_TABLES.has(table) || GLOBAL_TABLES.has(table)) {
			const kind = /\bINTO\b/i.test(m[0]) ? 'insert' : 'read';
			found.push({ table, kind });
		}
		m = tableRe.exec(text);
	}
	return found;
}

const HAS_FAMILY_PREDICATE = /family_id\s*(?:=|IN\s*\()/i;
const HAS_FAMILY_COLUMN = /family_id/i;
/**
 * 動的 WHERE fragment の命名規約: `${tenantWhere}` / `${sql.join(tenantConditions, ...)}` 等、
 * interpolation 式に tenant を含む fragment は「family_id 述語を内包する契約」として受理する。
 * fragment 構築側 (`sql\`family_id = ${tenantId}\``) が起点に family_id を積むことはコードレビュー
 * + 本規約の改名強制で担保 (無名 `${where}` は hard-fail するため、契約が命名で可視化される)。
 */
const HAS_TENANT_FRAGMENT = /\$\{[^}]*tenant[^}]*\}/i;
// ...
function collectViolations(statements: SqlStatement[]): Violation[] {
	const violations: Violation[] = [];
	for (const stmt of statements) {
		for (const { table, kind } of referencedTables(stmt.text)) {
			if (GLOBAL_TABLES.has(table)) continue; // グローバル表は述語対象外
			if (kind === 'insert') {
				if (INSERT_FAMILY_ID_EXEMPT.has(table)) continue;
				if (!HAS_FAMILY_COLUMN.test(stmt.text)) {
					violations.push({
						file: stmt.file,
						line: stmt.line,
						table,
						kind: 'INSERT (family_id 列欠如)',
						snippet: stmt.text.slice(0, 160).replace(/\s+/g, ' '),
					});
				}
				continue;
			}
			// ...
			const allowed = PREDICATE_ALLOWLIST.some(
				(a) => a.file === stmt.file && a.table === table && a.marker.test(stmt.text),
			);
			if (allowed) continue;
			if (HAS_FAMILY_PREDICATE.test(stmt.text)) continue;
			if (HAS_TENANT_FRAGMENT.test(stmt.text)) continue;
			violations.push({
				file: stmt.file,
				line: stmt.line,
				table,
				kind: 'SELECT/UPDATE/DELETE (family_id 述語欠如)',
				snippet: stmt.text.slice(0, 160).replace(/\s+/g, ' '),
			});
		}
	}
	return violations;
}
```

許可一覧の照合を条件の判定より先に置き、条件の差し込みは名前に `tenant` を含むもの（`${tenantWhere}` など）だけを条件ありとみなします。名前の無い `${where}` は落ちるので、条件を組み立てる側の約束が名前で見えるようになります。

許可一覧には、家族の識別子を持たず、閲覧リンクの文字列や暗証番号のような鍵だけで行を引く検索（capability lookup）も入ります。この例外には、もう 1 つ約束があります。閲覧リンクのトークンや暗証番号のような鍵だけで行を引いたら、取得した行の `family_id` に以降のアクセスを閉じ直してから、家族のデータを返します。共有リンクで家族 X の行を引いたあと、同じ鍵で家族 Y を読める経路を作らないためです。

# 接続の束はモジュールに 1 個だけ

Lambda では、接続ライブラリの `AuroraDSQLPool` をモジュールに 1 個だけ持ち、Drizzle ORM をそのまま被せます。権限トークンの生成と更新、接続先の名前からのリージョンの判定は接続ライブラリが肩代わりします。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/db/dsql/connection.ts
import { AuroraDSQLPool } from '@aws/aurora-dsql-node-postgres-connector';
import { drizzle } from 'drizzle-orm/node-postgres';
// ...
let _pool: AuroraDSQLPool | null = null;
let _db: DsqlDatabase | null = null;
// ...
export function getDsqlPool(): AuroraDSQLPool {
	if (_pool) return _pool;
	_pool = new AuroraDSQLPool(buildDsqlPoolConfig());
	return _pool;
}
// ...
export function getDsqlDb(): DsqlDatabase {
	if (_db) return _db;
	_db = drizzle(getDsqlPool(), { schema });
	return _db;
}
```

接続の確立を待つ上限は 5 秒に明示しています。既定は 0 で無期限に待つため、接続できないときに稼働確認（health check。データベースまで含めて動いているかの確認）が固まり、Function URL 全体が 502 に化けます。エラーにして 503 で失敗側に倒す方が、障害の原因を外から読めます。

接続に使う役割は管理者ではありません。実行時は接続の権限 `DbConnect` だけを持つ専用の PostgreSQL の役割で、表定義の変更と権限の付与を管理する資格は別に分け、アプリの実行経路から到達できないようにします。追記のみの表（同意、ポイントの台帳、各種のログ）には `UPDATE` の権限を与えません。`DELETE` は退会や保持期間の掃除が正当に発行するため除外せず、「改竄できない、削除はできる」の非対称にしています。

# 衝突の 40001 だけを、回数を限って再試行する

Aurora DSQL はロックを取らず、コミット時に同じ行への書き込み同士の衝突を `40001` で返します。これは「トランザクション全体をやり直せ」の合図なので、その場合だけ再実行します。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/db/dsql/occ-retry.ts
const DEFAULTS: Required<OccRetryOptions> = { maxAttempts: 3, baseDelayMs: 10 };

/** SQLSTATE 40001 (serialization failure / DSQL OC000) か。抽出は dsql-errors.ts (分類集約点) に委譲。 */
export function isOccConflict(err: unknown): boolean {
	return sqlstateOf(err) === '40001';
}

/** fn を実行し、40001 のみ bounded retry する。他エラーは即 rethrow。 */
export async function withOccRetry<T>(fn: () => Promise<T>, opts?: OccRetryOptions): Promise<T> {
	const { maxAttempts, baseDelayMs } = { ...DEFAULTS, ...opts };
	let lastError: unknown;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (err) {
			if (!isOccConflict(err)) throw err;
			lastError = err;
			if (attempt < maxAttempts) {
				const delay = baseDelayMs * 2 ** (attempt - 1) + Math.random() * baseDelayMs;
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
	}
	throw lastError;
}
```

`40001` 以外を再試行しないのが要点です。たとえば `23505` の重複キーを再試行すると、二重付与の温床になります。再試行は冪等性を保証しないので、渡す関数が再実行できることは呼び出し側の契約です。

検証環境（staging）の実測では、再試行なしで 8 並行の記録を同じ子供の共有行に書くと、ほとんどが `40001` で落ちます。`withOccRetry` を通すと、日次の上限が 1 の活動では成功 1 と「記録済み」（`ALREADY_RECORDED`）7 に収束し、上限が無い活動では更新の消失がゼロになります。

# 課金単位の 5 原則と、原則 2 を構文木で見張る

Aurora DSQL の課金は処理したバイト数と CPU 秒で決まり、行数の課金ではありません。書き込みのトランザクションには最小 0.05 の書き込みの課金単位が掛かるので、小さな書き込みを何回にも分けると、内容にかかわらず回数分の 0.05 が課金されます。書き込みの課金単位は読み出しの約 27 倍の費用密度で、走査した全行が課金の対象です。規約は 5 つです。

1. 全件走査をしない。全問い合わせは複合の主キーの先頭部分である `WHERE family_id = ...` から入る
2. 1 件ずつ何度も書かない。同じ操作の複数の書き込みは 1 つのトランザクションに束ね、ループの中の `await repo.insert()` を禁じる
3. 二次索引は既定で張らない。すべての索引が書き込みの課金の対象になる
4. 特定の区画に書き込みが集中する鍵（hot partition）を作らない。UUID v4 で分散させる
5. 一括処理は 3,000 行と 10MiB の塊に分け、既存の行は更新し、無い行は挿入する冪等な書き込みにする

原則 1 は、前の節の契約テストと同じ検査で担保されます。原則 2 は TypeScript の構文木（AST）を走査するテストで見張ります。ループの本体にある `await` のうち、呼び出し先のメソッド名が書き込み系の動詞で始まるものを数え、既存の違反は基準値（baseline）として固定して増やせない歯止め（ratchet）にしています。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/dsql-loop-sequential-write-fitness.test.ts
const WRITE_METHOD_RE =
	/^(insert|create|upsert|update|delete|purge|remove|record|save|persist|issue|archive|restore|copy|mark|import|set|add|assign|increment|decrement)[A-Z_0-9]/;
```

この正規表現には、後から足した動詞が 2 つあります。`purge` と `assign` です。どちらも「書き込みなのに動詞を一覧に載せておらず、歯止めに入らなかった」ことに気づいて足しました。動詞の一覧で書き込みを判定する方式の弱点はここにあり、一覧の網羅は人が保ちます。補助関数を経由した書き込みや `Promise.all` で並べた書き込みは静的には追えないので、そこはレビューの基準に残しています。

構文木は `typescript` パッケージの Compiler API で組んでいます。ループの判定と基準値の全体は [`tests/unit/architecture/dsql-loop-sequential-write-fitness.test.ts`](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/dsql-loop-sequential-write-fitness.test.ts) にあります。

原則 3 から 5 は定量の判断が要るため、機械の関門にせずレビューの基準に留めています。

# 費用の警報は 2 本だけ

無料枠は月 10 万の課金単位と 1GB の保存容量です。警報（CloudWatch アラーム）は、`TotalDPU` の日次の合計が無料枠のペースを超えたとき、保存容量が 0.8 GiB を超えたときの 2 本に限定しています。CloudWatch の警報は 10 本まで無料なので、観測の指標はダッシュボードで見て枠を温存します。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/lib/dsql-stack.ts
		// 無料枠 10 万 DPU/月 ≈ 3,225 DPU/日 (research doc 閾値)。日次 Sum で超過を検知。
		const totalDpuAlarm = new cloudwatch.Alarm(this, 'TotalDpuDaily', {
			metric: new cloudwatch.Metric({
				namespace: 'AWS/AuroraDSQL',
				metricName: 'TotalDPU',
				dimensionsMap: dim,
				statistic: 'Sum',
				period: cdk.Duration.days(1),
			}),
			threshold: 3225,
			evaluationPeriods: 1,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			alarmDescription:
				'DSQL TotalDPU が無料枠ペース (10万 DPU/月 ≈ 3,225/日) を超過 (#3431。DPU 単価: Write は Read の約 27 倍) 一次対応: docs/runbooks/dsql-alert-response.md',
		});
		totalDpuAlarm.addAlarmAction(alarmAction);
```

AWS Budgets は 1 ドルで置いています。Aurora DSQL の課金は RDS の配下に計上されるので、絞り込みは RDS のサービスで括り、実質「課金が発生したら知る」設定です。実際の請求は、この構成で運用した 3 か月とも Aurora DSQL は 0 ドルでした。

# まとめ

- 行単位のアクセス制御が無いデータベースでの家族の分離は、「偽造できない識別子」と「条件を注入する 1 か所」と「条件の欠落を落とす自動検査」の 3 点で組みます。例外は閉じた許可一覧に理由付きで置きます
- 接続の束はモジュールに 1 個で、接続を待つ上限は明示します。実行時の役割は最小権限で、追記のみの表には `UPDATE` の権限を与えません
- 再試行するのは `40001` だけです。業務のエラーを再試行すると二重付与になります
- 課金単位に合わせて書き込みは束ね、ループの中の逐次の書き込みを構文木で数えます。動詞の一覧を保つのは人の仕事です
- 警報は無料の 10 本に収め、費用の関門は課金単位と保存容量の 2 本と 1 ドルの予算で足ります

条件の無い問い合わせを禁じる規則は、設計書に書いただけでは守られませんでした。守られるようになったのは、契約テストが落とすようになってからです。規則は書いておくだけでは守られず、自動検査かテストが落とすか、構造の上で書けなくするかのどれかにして、初めて守られます。この考え方は、[Zenn の本の終盤の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/principles)にまとめました。

動いているサービス: [がんばりクエスト](https://www.ganbari-quest.com/)
