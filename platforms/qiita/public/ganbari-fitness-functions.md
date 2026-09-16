---
title: "vitest で書く Architecture fitness function：routes から DB を触らせない走査テスト、不採用記録の反証可能性、除外理由の実体判定"
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
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。使ったツールと用途は、末尾の「生成AIの利用について」に書いています。
:::

# はじめに

routes から DB を直接触らない。除外リストの理由を空にしない。不採用と記録した OSS を実は使っていない。こうしたルールは CLAUDE.md や設計書に散文で書けますが、守るのは人です。生成AIに実装を任せると、設計図を読んだうえで境界を破る頻度が人より高く、散文のルールは守られませんでした。

この記事は、そのルールを vitest の走査テストに encode した例を 4 つ、コードとともに紹介します。新しいツールは入れず、既存の vitest と Node の `fs` だけで書けます。設計の背景と、どこで止めたかの判断は正本に書きました。

- 正本（Zenn Books『生成AIに実装を任せて商用サービスを作る』）: [fitness function の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/fitness-functions) / [層の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/layered-architecture)
- 実装: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)
- vitest: [公式ドキュメント](https://vitest.dev/)

# 背景: 同じ class を 2 回見たら機械で止める

きっかけは export / import 機能でした。2 サイクル連続で blocker が出て、値域の個別パッチを繰り返した結果「1 つ直すと次が露見する」状態になりました。診断は、再発防止が人の注意に依存し、不変条件が E2E にしか表明されていないという構造の失敗です。決めた原則は 4 つです。

- バグ修正はまず失敗するテストから書く
- 同じ class が 2 回出たら class 全体を機械で lock する
- 重量レーンで落ちたら同じ条件を unit や lint に降ろす
- 散文の構造ルールは走査テストに encode する

# 基本形: routes から DB を触らせない

最初の適用は routes と DB の境界です。`src/routes` 配下のサーバ側ファイルを全部読み、raw ORM やテーブル定義や backend 固有の repository を import している route を列挙します。

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

動的 import を対象に含めているのは、レビューで穴が開いたからです。当初は静的な `import ... from` だけを見ていて、ある route が `import()` で raw ORM を呼んでいるのをすり抜けました。既知の違反は 1 件単位で baseline に明記し、拡大は不可、縮小のみ歓迎とします。今この配列は空です。

同じ形で、値の上限を刻む variant があります。デザインシステムの Base トークンを routes で直接使う既存の箇所が多数あり、0 件の hard guard は不可能でした。そこで現状の件数を上限にし、増えたら落ち、減らしたら定数を下げる ratchet にしています。

# facade は factory 経由だけ

DB の facade（`<name>-repo.ts`）は factory を通じてだけ backend の実装に到達するルールですが、ある facade が sqlite の実装を直接 import していました。本番の pg 系では表が未作成で throw し、WARN と「0 分」に化けていました。sqlite でしか再現しない class です。

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

最初の `it` は走査対象が 0 件の空振りを検出しています。走査テストは、ディレクトリの改名や glob のミスで対象が空になると、何も検査しないまま緑を返します。対象が十分にあることを assert する 1 行が、テストの生存確認です。

# 記録を反証可能にする

ADR 一覧には「調査したが不採用にした OSS」の表があります。ある OSS を不採用と記録した 1 週間後に採用したのに、表は不採用のまま残り、読んだ人が「未採用」と判断する逆向きの機能を果たしていました。表は、採用したら採用記録へ移すと自分で定めていましたが、移動は人の注意に依存していて発火しませんでした。

対策は、各行に「不在の証明」列を設け、「これがリポジトリに存在したら不採用は嘘」と言えるパスを宣言させることです。

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

見出しは前方一致で探します。完全一致にすると補足付きの見出しが見つからず、表 0 行として全 assert が空振りします。見つからないときは空文字を返さず throw します。「節が無い」と「節が空」を同一視すると、見出しの改名で guard が黙って消えるからです。不在を機械で言えない候補は、そもそも表に載せません。

# 除外理由を理由として成立させる

allowlist や baseline には `reason` の欄があります。欄が非空なら通す、では抜け道が残ります。`TODO` や `n/a` は非空ですが理由ではなく、機械が生成した検出理由をそのままコピーした欄も「なぜ免除してよいか」を誰も書いていません。判定は 1 か所に集め、複数の gate が同じ表を参照します。

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

この判定を置くきっかけも、fitness function 自身の穴でした。`reason` フィールドを持ちながら値を読む assertion が 0 件のリストが複数見つかり、しかも「正しい実装」として引用されていた当のファイルで、姉妹のリストの片方だけが非空を要求していました。先例が自分自身への反証になっていたわけです。gate ごとに stub の一覧を持つと、片方だけ `n/a` を通すドリフトが起きるので、SSOT を 1 つにします。

# 走査テストのコスト

リポジトリ全体を読むテストは、実行時間が入力サイズに比例します。既定の 5 秒 timeout のまま unit レーンに置くと、他の worker との CPU と FS の競合次第で落ちます。落ちても壊れてはいないので、毎回、本物の回帰なのか負荷なのかを切り分けることになります。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/route-db-boundary.test.ts
// #4085: repo 走査 test (実行時間が入力サイズに比例する)。既定 5s のままだと unit lane の
// 並列実行の負荷で落ち、「本物の回帰か負荷か」の切り分けが毎回発生するため file 単位で明示する。
// 区分は scripts/lib/ci/repo-scan-test-registry.mjs が SSOT (未宣言 / timeout 欠落は CI が fail)。
vi.setConfig({ testTimeout: 60_000 });
```

走査テストは registry で区分を宣言します。`repo` は明示 timeout が必須、`bounded` は入力が有界なので追加要求なしです。区分は gate 側が静的に判定した値と一致していなければ落ち、`bounded` と自己申告するだけでは timeout の要求を回避できません。

# どこで止めるか

fitness function には適用範囲があります。class の lock は、データ整合、課金、認可、日付境界、表示崩れといった顧客に見える不変条件にだけ適用し、CI の gate や hook や PR body の検査といった検証装置自身の不具合には適用しません。装置に lock を掛けると「装置を守る装置」が生まれ、それがまた新しい class の発生源になります。装置の不具合への処方は lock ではなく削減です。

振り返って、書いてよかったのは、顧客への約束をコードに置くもの、検査していないのに pass と出る class を止めるもの、記録の反証可能性を保つものの 3 種で、どれも人の注意では守れないものです。書式や網羅性を守るテストの多くは、後から警告に降格するか撤去しました。

# まとめ

- 散文の構造ルールは、既存の vitest と `fs` で走査テストに encode できます。静的 import だけでなく動的 import も見ます
- 既存の違反は baseline に 1 件単位で明記し、拡大不可の ratchet にします。0 件の hard guard が無理でも上限は刻めます
- 走査対象が 0 件の空振りと、見出しの改名による guard の消失を、テスト自身が検出します
- 除外理由は「非空」ではなく「実体」を要求し、判定の SSOT を 1 つにします
- 走査テストは timeout を明示し、区分を registry で宣言します
- lock を掛けるのは顧客に見える不変条件だけで、装置には掛けません

# 生成AIの利用について

この記事の作成には、生成AIの Claude（Anthropic の Claude Fable 5.1）を使いました。正本の該当章からの構成の検討、本文の下書きと改稿、コードの抜粋の照合、校正に使っています。筆者が内容を確認し、必要に応じて修正しました。公開した内容の責任は筆者が負います。
