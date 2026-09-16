---
title: "Aurora DSQL を RLS 無しでマルチテナントに使う：family_id 複合 PK、述語の fitness function、OCC retry、DPU の 5 原則"
tags:
  - AWS
  - AuroraDSQL
  - PostgreSQL
  - drizzle
  - マルチテナント
private: true
updated_at: ''
---

:::note info
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。使ったツールと用途は、末尾の「生成AIの利用について」に書いています。
:::

# はじめに

家族ごとにデータを分ける子供向けの Web アプリを、本番は Aurora DSQL で動かしています。DSQL は PostgreSQL 互換のサーバレス分散 SQL で、scale-to-zero と無料枠があります。ただし、行レベルセキュリティ（RLS）を使えません。テナントの分離を DB エンジンに任せられないので、アプリ層で「実効力のある」分離を組む必要がありました。

この記事は、そのために置いた仕組みのうち、コードで再現できる部分をまとめたレシピです。設計の経緯と実測は正本に書いたので、ここではコードと手順に絞ります。

- 複合 PK の先頭に `family_id` を置く
- 述語の無いクエリを CI で落とす
- 接続を 1 個の pool に固定する
- OCC の 40001 だけを retry する
- DPU の課金単位に合わせて write を束ねる

- 正本（Zenn Books『生成AIに実装を任せて商用サービスを作る』）: [テナント分離の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/multi-tenancy) / [Aurora DSQL の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/aurora-dsql)
- 実装: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)
- Aurora DSQL の公式ページ: [Amazon Aurora DSQL](https://aws.amazon.com/rds/aurora/dsql/)

# 前提: 実機で確定した制約

設計の前に、使い捨てのクラスタで確かめた制約を並べます。エラーコードは実際に返ってきたものです。

| 試したこと | 返ってきたもの |
|---|---|
| `ENABLE ROW LEVEL SECURITY` / `CREATE POLICY` | `0A000 unsupported` |
| `SERIAL` の主キー | `42704 type "serial" does not exist` |
| `REFERENCES` による外部キー | `0A000 FOREIGN KEY constraint not supported` |
| 同期の `CREATE INDEX` | `0A000`（`CREATE INDEX ASYNC` が必要） |
| 1 トランザクションで 3,001 行 | `54000 transaction row limit exceeded` |
| 同じ行への並行 update | 片方の commit が `40001` |

RLS が無い、外部キーが無い、SERIAL が無い、OCC で衝突する。この 4 つが、以降の設計をすべて決めています。

# 設計方針: pool 方式とアプリ層の単一強制点

候補は 3 つありました。RLS 付きの pool 方式は、上の表のとおり採れません。家族ごとにクラスタを分ける silo 方式は、migration を家族の数だけ回すことになり、横断の集計もできないので見送りました。残った案が、1 つの pool に全家族を載せ、信頼できる tenantId をアプリ層の 1 か所で全クエリに注入する方式です。

「信頼できる」の根拠は、tenantId が Cognito の署名付き JWT から導かれ、偽造できないことにあります。JWT の検証と membership の解決はリクエストの入口で 1 回だけ行い、DB は JWT を読みません。残るリスクは開発者の WHERE の書き忘れです。そこを人の注意ではなく CI に持たせました。

# テナントの述語を CI で強制する

全テナント表は `family_id` を先頭に置く複合 PK です。そのうえで、テナント表への SELECT / UPDATE / DELETE に `family_id` の述語が無ければ CI を落とす走査テストを置いています。例外は閉じた allowlist に理由付きで列挙します。「グローバルっぽい表」を緩い判定で通すと、新しい表が黙って述語なしで通るからです。

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

テナント表の一覧は手書きせず、PK を凍結した manifest から導いています。表を足したら manifest に載せる必要があり、載せた瞬間に述語の検査対象になります。allowlist の各行は file・table・marker の 3 つで 1 つの SQL 文を特定するので、「同じファイルの別のクエリ」が例外に紛れ込みません。

capability lookup の例外には、もう 1 つ約束があります。token や PIN のような鍵だけで行を引いたら、取得した行の `family_id` に以降のアクセスを再スコープしてから、テナントのデータを返します。共有リンクの token で家族 A の行を引いたあと、その token で家族 B を読める経路を作らないためです。

# 接続は module scope に 1 個だけ

Lambda では、connector の `AuroraDSQLPool` を module scope に 1 個だけ持ち、drizzle をそのまま被せます。IAM token の生成と更新、hostname からの region の判定は connector が肩代わりします。

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

接続確立の timeout は 5 秒に明示しています。pg の既定は 0 で無期限に待つため、接続できないときに health probe が hang し、Function URL 全体が 502 に化けます。error にして 503 で fail-close する方が、障害の原因を外から読めます。

接続に使う role は admin ではありません。実行時は `DbConnect` の権限だけを持つ専用の Postgres role で、DDL と GRANT を管理する credential は別に分けてアプリの実行経路から到達できないようにします。追記のみの表（同意、ポイント台帳、各種 log）には UPDATE の GRANT を与えません。DELETE は退会や保持期間の掃除が正当に発行するため除外せず、「改竄不能、削除可能」の非対称にしています。

# OCC の 40001 だけを bounded retry する

DSQL は snapshot isolation でロックを取らず、commit 時に同じ行への write-write 衝突を `40001` で返します。これは「トランザクション全体をやり直せ」の合図なので、その場合だけ再実行します。

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

`40001` 以外を retry しないのが要点です。たとえば `23505` の重複キーを retry すると、二重付与の温床になります。retry は冪等性を保証しないので、渡す関数が再実行可能であることは呼び出し側の契約です。

staging で確かめた挙動も書いておきます。retry 無しで 8 並行の記録を同じ子供の共有行に書くと、ほとんどが `40001` で落ちます。`withOccRetry` を通すと、日次上限が 1 の活動では成功 1 と「記録済み」7 に収束し、上限が無い活動では lost update がゼロになります。

# DPU の 5 原則と、原則 2 を AST で見張る

DSQL の課金は DPU（処理バイトと CPU 秒）で、行数課金ではありません。write のトランザクションには最小 0.05 WriteDPU が掛かるので、小さな write を N 回に分けると内容にかかわらず 0.05 × N が課金されます。WriteDPU は ReadDPU の約 27 倍のコスト密度で、スキャンした全行が課金の対象です。そこで規約を 5 つ置きました。

1. フルスキャンをしない。全クエリは複合 PK の prefix である `WHERE family_id = ...` から入る
2. N+1 をしない。同じ操作の複数 write は 1 つのトランザクションに束ね、ループ内の `await repo.insert()` を禁じる
3. secondary index は既定で張らない。すべての index が write の課金対象になる
4. hot key を作らない。UUID v4 で分散させる
5. 一括処理は 3,000 行と 10MiB のチャンクに分け、冪等な upsert にする

原則 1 は、前の節の述語の fitness function と同じ検査で担保されます。原則 2 は TypeScript の AST を走査するテストで見張ります。ループの本体にある `await` のうち、呼び出し先の method 名が write 系の prefix に一致するものを数え、既存の違反は baseline に pin して増やせない ratchet にしています。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/dsql-loop-sequential-write-fitness.test.ts
const WRITE_METHOD_RE =
	/^(insert|create|upsert|update|delete|purge|remove|record|save|persist|issue|archive|restore|copy|mark|import|set|add|assign|increment|decrement)[A-Z_0-9]/;
```

この正規表現には、後から足した動詞が 2 つあります。`purge` と `assign` です。どちらも「write なのに verb を一覧に載せておらず、ratchet に入らなかった」ことに気づいて足しました。verb の一覧で write を判定する方式の弱点はここにあり、一覧の網羅は人が保ちます。helper 関数を経由した write や `Promise.all` で並べた write は静的には追えないので、そこはレビュー基準に残しています。

原則 3 から 5 は定量の判断が要るため、機械の gate にせずレビューの基準に留めています。

# コストの alarm は 2 本だけ

無料枠は月 10 万 DPU と 1GB のストレージです。alarm は、TotalDPU の日次合計が無料枠のペースを超えたとき、ストレージが 0.8 GiB を超えたときの 2 本に限定しています。CloudWatch の alarm は 10 本まで無料なので、可観測性の metric は dashboard で見て枠を温存します。

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

AWS Budgets は $1 で置いています。DSQL の課金は RDS の配下に計上されるので、フィルターは RDS のサービスで括り、実質「課金が発生したら知る」設定です。実際の請求は、この構成で運用した 3 か月とも DSQL は $0 でした。

# まとめ

- RLS が無い DB でのテナント分離は、「信頼できる tenantId」と「述語を注入する 1 か所」と「述語の欠落を落とす CI」の 3 点で組みます。例外は閉じた allowlist に理由付きで置きます
- pool は module scope に 1 個で、接続 timeout は明示します。実行時の role は最小権限で、追記のみの表には UPDATE の GRANT を与えません
- retry するのは `40001` だけです。business error を retry すると二重付与になります
- DPU の課金単位に合わせ、write は束ねてループ内の逐次 write を AST で数えます。verb の一覧を保つのは人の仕事です
- alarm は無料枠の 10 本に収め、コストの門は DPU とストレージの 2 本と $1 の Budgets で足ります

# 生成AIの利用について

この記事の作成には、生成AIの Claude（Anthropic の Claude Fable 5.1）を使いました。正本の該当章からの構成の検討、本文の下書きと改稿、コードの抜粋の照合、校正に使っています。筆者が内容を確認し、必要に応じて修正しました。公開した内容の責任は筆者が負います。
