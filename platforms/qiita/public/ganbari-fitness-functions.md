---
title: "Vitest で書く契約テスト：画面の経路からデータベースを触らせない走査テスト、不採用記録の反証可能性、除外理由の実体判定"
tags:
  - vitest
  - TypeScript
  - SvelteKit
  - アーキテクチャ
  - テスト
private: true
updated_at: ''
---

:::note info
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。
:::

# はじめに

画面の経路からデータベースを直接触らない。除外の一覧の理由を空にしない。不採用と記録した道具を実は使っていない。こうした決まりは生成AIへの指示書や設計書に散文で書けますが、守るのは人です。生成AIに実装を任せると、設計図を読んだうえで境界を破る頻度が人より高く、散文の決まりは守られませんでした。散文の決まりは、どうすれば機械で守れるのでしょうか。

決まりをテストにします。構造や運用文書と実装の一致を検査するテストを、正本にならって契約テストと呼びます。Neal Ford らの fitness function の訳で、API の仕様を検証する契約テストとは別物です。新しい道具は入れず、既存の Vitest と Node.js のファイル走査だけで書けます。ここでは 4 つの例をコードとともに並べます。設計の背景と、どこで止めたかの判断は正本に書きました。

- 正本（Zenn の本『生成AIに実装を任せて商用サービスを作る』）: [契約テストの章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/fitness-functions) / [5 つの層の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/layered-architecture)
- 実装: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)
- Vitest: [公式ドキュメント](https://vitest.dev/)

# 設計方針: 同じ型の不具合を 2 回見たら機械で止める

きっかけは書き出しと取り込みの機能でした。2 サイクル連続で止める指摘が出て、値の範囲を個別に当て布した結果「1 つ直すと次が露見する」状態になりました。診断は、再発の防止が人の注意に頼り、不変条件が画面操作テストにしか書かれていないという構造の失敗です。決めた原則は 4 つです。

- 不具合の修正はまず失敗するテストから書く
- 同じ型の不具合が 2 回出たら、型ごと機械で止める（正本にならって型止めと呼びます）
- 重い検査の列で落ちたら、同じ条件を単体テストや静的検査に降ろす
- 散文の構造の決まりは走査するテストにする

# 基本形: 画面の経路からデータベースを触らせない

最初の適用は画面の経路とデータベースの境界です。`src/routes` 配下のサーバ側のファイルを全部読み、Drizzle ORM やテーブル定義やデータベース実装に固有の取得部品を読み込んでいる経路を列挙します。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/route-db-boundary.test.ts
// server 専用 route module (load / actions / endpoint)。client (.svelte) は対象外。
const SERVER_ROUTE_FILES = new Set(['+server.ts', '+page.server.ts', '+layout.server.ts']);

// 禁止 import specifier (raw ORM / table 定義 / 生 client / backend 固有 repo 実装)。
// routes は `$lib/server/db/<facade>` (例 point-repo) か `$lib/server/services/*` 経由で DB に触れる。
const FORBIDDEN_IMPORT_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
	{ pattern: /['"]drizzle-orm['"]/, reason: 'raw ORM (drizzle-orm) を route で直接使用' },
	{
		// `db/schema` module 本体のみ (table 定義)。`db/schema-validator` 等の
		// 別 module を巻き込まないよう module 末尾 (quote / slash) を anchor する。
		pattern: /\$lib\/server\/db\/schema(?=['"/])/,
		reason: 'テーブル定義 (db/schema) を route で直接 import',
	},
	{
		pattern: /\$lib\/server\/db\/client/,
		reason: '生 DB client (db/client) を route で直接 import',
	},
	// ...
];

// 静的 import/export: `import ... from '...'` / `export ... from '...'`
const STATIC_IMPORT_LINE = /^\s*(?:import|export)\b[^\n]*\bfrom\s+['"][^'"]+['"]/;
// ...
const DYNAMIC_IMPORT_LINE = /\b(?:import|require)\s*\(/;

/** 静的 import / 動的 import / require のいずれかで module を取り込む行を抽出する。 */
function isImportLike(line: string): boolean {
	return STATIC_IMPORT_LINE.test(line) || DYNAMIC_IMPORT_LINE.test(line);
}

function walkServerRouteFiles(dir: string, acc: string[]): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = resolve(dir, entry.name);
		if (entry.isDirectory()) {
			walkServerRouteFiles(full, acc);
		} else if (SERVER_ROUTE_FILES.has(entry.name)) {
			acc.push(full);
		}
	}
	return acc;
}
```

動的な読み込みを対象に含めているのは、レビューで穴が開いたからです。当初は静的な `import ... from` だけを見ていて、ある経路が `import()` で Drizzle ORM を呼んでいるのをすり抜けました。既知の違反は 1 件単位で基準値に明記し、拡大は不可、縮小のみ歓迎とします。今この配列は空です。

同じ形で、値の上限を刻む変種があります。デザインシステムの基礎の色トークンを画面の経路で直接使う既存の箇所が多数あり、0 件で止める検査は不可能でした。そこで現状の件数を上限にし、増えたら落ち、減らしたら定数を下げる歯止めにしています。

# 窓口は選択関数の経由だけ

データベースの窓口（`<name>-repo.ts`）は選択関数を通じてだけ実装に到達する決まりですが、ある窓口が SQLite の実装を直接読み込んでいました。本番の PostgreSQL 系では表が未作成で例外になり、警告のログと「0 分」の表示に化けていました。SQLite でしか再現しない型の不具合です。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/db-facade-backend-parity.test.ts
const STATIC_IMPORT_SPECIFIER = /\b(?:import|export)\b[^;'"]*?\bfrom\s*(['"])([^'"\n]+)\1/g;
const DYNAMIC_IMPORT_SPECIFIER = /\b(?:import|require)\s*\(\s*(['"`])([^'"`\n]+)\1\s*\)/g;
const FORBIDDEN =
	/^(?:\.\/(?:sqlite|dsql|demo)\/|\.\/client$|\$lib\/server\/db\/(?:sqlite|dsql|demo)\/|\$lib\/server\/db\/client$)/;

function importSpecifiers(source: string): string[] {
	const out: string[] = [];
	for (const m of source.matchAll(STATIC_IMPORT_SPECIFIER)) out.push(m[2] ?? '');
	for (const m of source.matchAll(DYNAMIC_IMPORT_SPECIFIER)) out.push(m[2] ?? '');
	return out;
}

const facades = readdirSync(DB_DIR).filter((f) => f.endsWith('-repo.ts'));

describe('db facade は factory 経由でのみ backend に到達する (#4719 / #4680 class)', () => {
	it('facade file が存在する (走査対象 0 件の空振り検出)', () => {
		expect(facades.length).toBeGreaterThan(10);
	});

	it.each(
		facades,
	)('[F1] %s は backend 実装 (sqlite / dsql / demo / client) を直 import しない', (f) => {
		const src = readFileSync(resolve(DB_DIR, f), 'utf8');
		const bad = importSpecifiers(src).filter((s) => FORBIDDEN.test(s));
		expect(
			bad,
			`${f} が backend 実装を直 import している: ${bad.join(', ')} — getRepos() 経由に直す (本番 pg では sqlite 固定 facade が壊れる、#4719)`,
		).toEqual([]);
	});

	it.each(facades)('[F2] %s は getRepos() 経由で委譲する', (f) => {
		const src = readFileSync(resolve(DB_DIR, f), 'utf8');
		expect(src.includes('getRepos()'), `${f} が factory (getRepos) を使っていない`).toBe(true);
	});
```

最初の `it` は走査対象が 0 件の空振りを検出しています。走査するテストは、ディレクトリの改名や対象の指定の誤りで対象が空になると、何も検査しないまま緑を返します。対象が十分にあることを断定する 1 行が、テストの生存確認です。

# 記録を反証できるようにする

設計判断の記録の一覧には「調べたが採らなかった道具」の表があります。ある道具を不採用と記録した 1 週間後に採用したのに、表は不採用のまま残り、読んだ人が「未採用」と判断する逆向きの機能を果たしていました。表は、採用したら採用記録へ移すと自分で定めていましたが、移動は人の注意に依存していて発火しませんでした。

対策は、各行に「不在の証明」の列を設け、「これがリポジトリに存在したら不採用は嘘」と言えるパスを宣言させることです。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/oss-rejection-record-falsifiable.test.ts
const REJECTION_HEADING = '### OSS 調査済み・不採用記録';
const ADOPTION_HEADING = '### OSS 採用記録';
/** 不在の証明列のヘッダ名。表の契約そのものなので定数で固定する。 */
const ABSENCE_PROBE_COLUMN = '不在の証明';
// ...
function sectionOf(markdown: string, heading: string): string {
	const lines = markdown.split(/\r?\n/);
	const start = lines.findIndex((l) => l.trim().startsWith(heading));
	if (start === -1) {
		throw new Error(
			`docs/decisions/README.md に見出し "${heading}" が見つかりません。` +
				'改名した場合は本テストの定数も同時に更新してください (guard が空振りするため)。',
		);
	}
	const rest = lines.slice(start + 1);
	const end = rest.findIndex((l) => /^#{2,3} /.test(l));
	return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}
```

見出しは前方一致で探します。完全一致にすると補足付きの見出しが見つからず、表 0 行として全断定が空振りします。見つからないときは空文字を返さず例外で落とします。「節が無い」と「節が空」を同一視すると、見出しの改名で検査が黙って消えるからです。不在を機械で言えない候補は、そもそも表に載せません。

# 除外の理由を理由として成立させる

許可一覧や基準値には `reason` の欄があります。欄が空でなければ通す、では抜け道が残ります。`TODO` や `n/a` は空ではありませんが理由ではなく、機械が生成した検出の理由をそのまま写した欄も「なぜ免除してよいか」を誰も書いていません。判定は 1 か所に集め、複数の関門が同じ表を参照します。

```javascript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/lib/ci/reason-declaration.mjs
export const MIN_REASON_LENGTH = 12;

/** 理由として認めない定型 stub (小文字化して完全一致で判定)。 */
export const STUB_REASONS = new Set([
	'todo',
	'tbd',
	'n/a',
	'na',
	'-',
	'—',
	'なし',
	'後で書く',
	'あとで書く',
	'理由',
	'wip',
	'fixme',
]);

/**
 * 理由文字列に実体があるかを判定する。
 *
 * @param {string} reason
 * @returns {boolean}
 */
export function isSubstantiveReason(reason) {
	const trimmed = (reason ?? '').trim();
	return (
		trimmed.length >= MIN_REASON_LENGTH &&
		!STUB_REASONS.has(trimmed.toLowerCase()) &&
		!/^[-—\s]*$/.test(trimmed)
	);
}
```

この判定を置くきっかけも、契約テスト自身の穴でした。`reason` の欄を持ちながら値を読む断定が 0 件の一覧が複数見つかり、しかも「正しい実装」として引用されていた当のファイルで、姉妹の一覧の片方だけが空でないことを要求していました。先例が自分自身への反証になっていたわけです。関門ごとに埋め草の一覧を持つと、片方だけ `n/a` を通すずれが起きるので、正本を 1 つにします。

# 走査するテストの費用

リポジトリ全体を読むテストは、実行時間が入力の大きさに比例します。既定の 5 秒の時間切れのまま単体テストの列に置くと、他の実行単位との CPU とファイル入出力の競合次第で落ちます。落ちても壊れてはいないので、毎回、本物の回帰なのか負荷なのかを切り分けることになります。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/route-db-boundary.test.ts
// #4085: repo 走査 test (実行時間が入力サイズに比例する)。既定 5s のままだと unit lane の
// 並列実行の負荷で落ち、「本物の回帰か負荷か」の切り分けが毎回発生するため file 単位で明示する。
// 区分は scripts/lib/ci/repo-scan-test-registry.mjs が SSOT (未宣言 / timeout 欠落は CI が fail)。
vi.setConfig({ testTimeout: 60_000 });
```

走査するテストは台帳で区分を宣言します。`repo` は明示の時間切れが必須、`bounded` は入力が有界なので追加の要求なしです。区分は関門の側が静的に判定した値と一致していなければ落ち、`bounded` と自己申告するだけでは時間切れの要求を回避できません。

# どこで止めるか

契約テストには適用範囲があります。型止めは、データの整合、課金、認可、日付の境界、表示の崩れといった顧客に見える不変条件にだけ適用し、自動検査の関門やフックやプルリクエストの本文の検査といった検証の道具自身の不具合には適用しません。道具に型止めを掛けると「道具を守る道具」が生まれ、それがまた新しい不具合の型の発生源になります。道具の不具合への処方は型止めではなく削減です。

振り返って、書いてよかったのは、顧客への約束をコードに置くもの、検査していないのに合格と出る型を止めるもの、記録の反証可能性を保つものの 3 種で、どれも人の注意では守れないものです。書式や網羅性を守るテストの多くは、後から警告に降格するか撤去しました。

# まとめ

- 散文の構造の決まりは、既存の Vitest とファイル走査で契約テストにできます。静的な読み込みだけでなく動的な読み込みも見ます
- 既存の違反は基準値に 1 件単位で明記し、拡大不可の歯止めにします。0 件で止められなくても上限は刻めます
- 走査対象が 0 件の空振りと、見出しの改名による検査の消失を、テスト自身が検出します
- 除外の理由は「空でない」ではなく「実体」を要求し、判定の正本を 1 つにします
- 走査するテストは時間切れを明示し、区分を台帳で宣言します
- 型止めを掛けるのは顧客に見える不変条件だけで、道具には掛けません

設計図は最初からあり、生成AIはそれを読んで書いていました。それでも境界は破られ、守られるようになったのは境界を越えた瞬間に落ちるテストを置いてからです。正本の原則で言えば「原則は書くだけでは守られない。自動検査が落とすか、テストが落とすか、構造上できないかのいずれかにする」の実例です。10 条の全体は [原則の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/principles) にあります。

動いているサービス: [がんばりクエスト](https://www.ganbari-quest.com/)
