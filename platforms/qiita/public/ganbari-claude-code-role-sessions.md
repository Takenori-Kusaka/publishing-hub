---
title: "一人と Claude Code の 5 つのロールセッションで開発する：GitHub の label を受信箱にし、手元の検査は安い順に落とし、CI の一覧は doc と突合する"
tags:
  - ClaudeCode
  - GitHub
  - 生成AI
  - 開発プロセス
  - vitest
private: true
updated_at: ''
---

:::note info
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。使ったツールと用途は、末尾の「生成AIの利用について」に書いています。
:::

# はじめに

開発者は一人ですが、リポジトリには PO、Dev、QM、監査、Platform の 5 つのロールがいて、それぞれ別のクローンと別の Claude Code セッションで動いています。生成AIに実装を任せると実装のコストは下がりますが、検証と判断のコストは下がりません。AI は自分の成果物を自分で承認しがちなので、作る側と承認する側をセッションと GitHub アカウントの両方で分けました。

この記事は、その体制を回すために置いた 3 つの仕組みを、コピーして試せる形でまとめたものです。セッション間の受け渡しを GitHub の label に載せる仕組み、その経路の欠落を docs のテストで検出する仕組み、そして手元の検査を安い順に落として CI で確定する仕組みです。体制の背景や事故の詳細は正本に書きました。

- 正本（Zenn Books『生成AIに実装を任せて商用サービスを作る』）: [ロールセッションの章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/one-human-many-sessions) / [label mailbox の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/label-mailbox) / [pre-ready の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/pre-ready)
- 実装: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)
- GitHub CLI: [cli.github.com](https://cli.github.com/)

# 設計方針: 手順ではなく決定権で境界を引く

ロールの境界は「誰が何をやるか」ではなく「誰が何を決めるか」で引きます。PO が決めるのは、着手の可否、backlog の順序、顧客に見える文言と価格の方針です。Dev が決めるのは、どう作るか、いつ誰がやるか、使う OSS とテストの書き方です。QM は個別の PR を merge してよいかを、監査は develop から main への統合可否を決めます。

不可逆な 4 つの操作、つまり本番データの削除、本番 deploy、課金の書き込み、スキーマ変更だけは、常に人間のオーナーが決めます。判定は「自分の職掌か」ではなく「この操作が含まれるか」で行い、気づいた人が誰でもオーナー宛の label を付けます。

一人で全ロールを演じていても、この境界は守ります。PO セッションが Dev セッションに着手順を指示し始めると、Dev の self-management が消えて PO がボトルネックになるからです。

# 受け渡しは GitHub の label に載せる

Claude Code のセッション間には通信手段がありません。別のクローンで動くセッションに「次はあなたの番です」と伝える方法が要ります。新しい通信基盤は作らず、GitHub の label で「次に誰が動くか」を機械可読にしました。

label は 2 種類です。宛先 label は 6 つで、「次に誰に用があるか」だけを表し、用件は含意しません。

- `state:needs-dev` / `state:needs-qm` / `state:needs-po`
- `state:needs-audit` / `state:needs-platform` / `state:needs-owner`
工程 label は `state:dev-done` / `state:qm-blocked` / `state:ready-to-merge` の 3 つで、送り手の状態と前提条件を表します。

運用の原則は 5 つです。GitHub がすでにモデル化しているもの（approve の依頼は reviewer request）に label を作らない。label は状態であって指示ではなく、`state:ready-to-merge` が付いていても CI の緑は自分で確認する。付けた側が意味に責任を持つ。不可逆 4 操作だけはオーナーへ上げる。語彙を増やさない。

2 つ目の原則には実例があります。PO が label だけを見て merge 可と判断し、QM が CI の赤を理由に拒否しました。label は実測を代替しません。

# 各セッションは自分の受信箱を polling する

各ロールのセッションは、起動直後に自分の受信箱を毎時チェックする cron を 1 本作ります。Dev の cron に渡すプロンプトの中身は、`gh` のコマンド列です。

```bash
# 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/sessions/label-mailbox.md
gh issue list --label "state:needs-dev" --state open --json number,title --jq '.[]|"着手 #\(.number) \(.title)"'
gh pr list --label "state:needs-dev" --state open --json number,title --jq '.[]|"着手PR #\(.number) \(.title)"'
gh pr list --label "state:qm-blocked" --state open --json number,title --jq '.[]|"BLOCKED #\(.number) \(.title)"'
gh pr list --search "review-requested:@me is:open" --json number,title --jq '.[]|"REVIEW依頼 #\(.number) \(.title)"'
gh issue list --state open --limit 100 --json number,title,labels --jq '.[]|select([.labels[].name]|map(select(startswith("state:") or .=="status:on-hold" or .=="epic"))|length==0)|"ORPHAN #\(.number) \(.title)"'
```

Issue と PR の両方を見るのがポイントです。`gh pr list --label` は Issue を返さず、`gh issue list --label` は PR を返しません。

分はロールごとにずらします。Dev は 13 分、QM は 23 分、PO は 37 分、Platform は 43 分、監査は 47 分で、同時刻の集中と 0 分・30 分を避けます。この cron はセッション内のメモリにしか無く、Claude Code を終了すると消え、7 日で失効し、セッションが待機中のときだけ発火します。「オーナー不在の間に動く」用途には使えず、「セッションが生きている間に自分の仕事を自分で拾う」ための仕組みです。

# orphan を検出する

label 運用の最大の失敗は、誰の受信箱にも入っていない open 項目です。全員が「mailbox 空」と報告しているのに、実際には複数件が止まっている状態と区別がつきません。上のコマンド列の最後の行がその検出で、`state:*` が 1 つも付いていない open のうち、`status:on-hold` と `epic` の付いていないものを列挙します。

`status:on-hold` と `epic` を除外するのは、backlog 全件が毎回 orphan として並ぶと、本当に浮いているものが埋もれるからです。着手順に入っていないものには `status:on-hold` を付けておきます。

PO には義務が 1 つ加わります。「mailbox 空」が 3 回続いたら、仕事が無いのではなく渡す経路が壊れていると疑い、各受信箱の件数と直近の merged を見て生存確認をすることです。

# 経路の欠落を docs のテストで検出する

label の運用は 2 度壊れました。1 度目は QM 宛の label が「実装完了」でしか表現できず、完成していないと QM に送れなかった事故です。2 度目は、受け取った側が対応を終えたあと何に移すかが未定義で、Dev が差し戻しに対応しても label が `state:qm-blocked` のまま止まった事故です。

1 度目の再発は、運用文書そのものを読むテストで防いでいます。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/label-mailbox-routes.test.ts
// tests/unit/architecture/label-mailbox-routes.test.ts
// #4180 — 宛先 label が用件に縛られて経路が塞がるのを、docs 側で検出する。
// ...
const MAILBOX = 'docs/sessions/label-mailbox.md';

/** 宛先 label 6 種 (§3.1)。ここを増減させたら本 test も一緒に直す。 */
const ADDRESS_LABELS = [
	'state:needs-dev',
	'state:needs-qm',
	'state:needs-po',
	'state:needs-audit',
	'state:needs-platform',
	'state:needs-owner',
];

/** 工程 label 3 種 (§3.1)。前提条件を含意する特殊形。 */
const STAGE_LABELS = ['state:dev-done', 'state:qm-blocked', 'state:ready-to-merge'];

describe('#4180 label mailbox の経路', () => {
	const doc = readFileSync(MAILBOX, 'utf8');

	it('語彙は宛先 6 + 工程 3 の 9 種で、すべて §3.1 に載っている', () => {
		const vocabSection = doc.slice(doc.indexOf('### §3.1 label 語彙'), doc.indexOf('### §3.1.1'));
		for (const label of [...ADDRESS_LABELS, ...STAGE_LABELS]) {
			expect(vocabSection, `${label} が §3.1 の語彙表にありません`).toContain(label);
		}
		// 見出しに件数を書いている以上、件数と中身がズレたら落とす
		expect(vocabSection).toContain('9 種');
	});
```

守るのは docs 間の drift で、経路マトリクスに空欄が無いこと、語彙表と本文が同じ 9 種を指すこと、各ロールのファイルが語彙を反映することです。守らないのは GitHub 上の label の実在で、ネットワークに依存するテストにはしません。

2 度目には機械の guard を作りませんでした。運用装置の不具合に guard を足すと「装置を守る装置」が生まれて無限に後退するため、遷移表という定義で塞いでいます。

# 手元の検査は安い順に落とす

PR を Ready にする前、手元で回す検査 CLI があります。当初は 20 ステップで通しの所要が 20 分を超え、実際には実行されないか、待っている間に別の作業へ移って結果を見ないままでした。gate として機能していなかったのです。Ready の判定根拠を CI の全 job pass に移し、手元の CLI は 6 ステップに縮めました。

6 ステップの実行順は Step 番号順ではなく、「判定に要する時間と参照する情報の量」で並べ替えます。

```javascript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/pre-ready.mjs
export const STEP_COST_CLASSES = /** @type {const} */ ([
	'meta', // PR body / メタ情報だけを見る。ファイルを読まない
	'static', // 静的テキスト / 単一ファイル検査
	'typecheck', // 型検査
	'test', // テスト実行
	'browser', // ヘッドレスブラウザでの実測
	'ui', // SS 系 (撮影 / embed 検証)
]);
// ...
export function orderSteps(steps) {
	assertStepShapes(steps);
	const rank = (/** @type {{ costClass: string }} */ s) => STEP_COST_CLASSES.indexOf(s.costClass);
	// index を tiebreaker にして安定ソートを明示 (Array#sort の安定性に依存しない)
	return steps
		.map((step, index) => ({ step, index }))
		.sort((a, b) => rank(a.step) - rank(b.step) || a.index - b.index)
		.map(({ step }) => step);
}
```

各 step は定義に `costClass` を持ち、未登録の値は throw します。Step 番号は PR 本文や Issue から広く参照されるので変えず、実行順だけを入れ替えます。番号順に実行していたころは、PR 本文の体裁ミス 1 つを検出するのに型検査とテストの完走を待たされていました。

もう 1 つの preflight が base の鮮度です。base が進んだ差分に、PR テンプレートや検査スクリプトとその import 閉包が含まれていれば止めます。手元は旧基準、CI は新基準で判定するため、手元の PASS が成立しないからです。含まれていなければ注記だけで止めません。閉包に実在するファイルだけを個別に列挙するのは、ディレクトリの prefix で一括指定すると、手元が一度も読まないファイルの変更で全 PR が止まるからです。理由の分からない BLOCK は、gate への信頼を削って迂回を誘発します。

# CI で落ちる検査の一覧を doc と突合する

CI で hard-fail する検査は、ルートの `CLAUDE.md` に列挙してあります。手書きの列挙は、`ci.yml` へ step が足されるたびに静かに古くなり、「この検査は CI に無い」と読んだ担当が Ready 化して 1 往復を無駄にしました。そこで doc の marker block と `ci.yml` の実測を両方向で突合するテストを置きました。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/docs/ci-hard-fail-check-list-ssot.test.ts
/** step 単位で列挙する job。ここだけは「全 hard-fail step が doc に並ぶ」ことを要求する。 */
const STEP_ENUMERATED_JOB = 'lint-and-test';
// ...
const EXCLUDED_JOBS: Record<string, string> = {
	changes:
		'paths-filter で後続 job の実行要否を出力するだけの分岐 job。落ちる検査を 1 つも持たない',
	'lint-and-test':
		'step 単位で列挙する job なので、job 名の列挙対象からは外す (上のブロックが担う)',
	'e2e-merge-reports': 'blob report を HTML に結合するだけの後処理。合否判定は e2e-test 側が持つ',
	'ci-gate': '他 job の結果を集約して 1 つの required context にするゲート。固有の検査を持たない',
	'integration-evidence':
		'統合 PR (release/* → main) 専用の証跡生成 job。個別 PR の Ready 化判断で読む対象ではない',
};
```

検出するのは 5 つです。`ci.yml` にあって doc に無い step。doc にあって `ci.yml` に無い step。doc と除外リストのどちらからも漏れた job。理由になっていない除外理由。marker block の欠落や 0 件マッチです。hard-fail の判定は `continue-on-error: true` と `|| true` のどちらも付いていない step であることを実測で決めます。

除外理由は「非空なら通す」にしません。`TODO` や `n/a` のような定型の stub と、機械が書いた検出理由のコピーは理由として認めない判定を 1 か所に集め、生成側と検査側が同じ表を参照します。

# まとめ

- ロールの境界は決定権で引き、不可逆 4 操作だけを人間に上げます。作る側と承認する側は、セッションと GitHub アカウントの両方で分けます
- 受け渡しは宛先 6 と工程 3 の label に載せ、各セッションが自分の受信箱を `gh` で polling します。label は状態であって指示ではありません
- orphan の検出を PO の cron に必ず入れ、「mailbox 空」が続いたら経路の故障を疑います
- 運用文書が SSOT なら、文書間の drift はテストで守れます。GitHub API は叩きません
- 手元の検査は安い順に並べて早く落とし、Ready の判定は CI に置きます。CI の一覧は実測と突合し、除外理由は実体を要求します

# 生成AIの利用について

この記事の作成には、生成AIの Claude（Anthropic の Claude Fable 5.1）を使いました。正本の該当章からの構成の検討、本文の下書きと改稿、コードの抜粋の照合、校正に使っています。筆者が内容を確認し、必要に応じて修正しました。公開した内容の責任は筆者が負います。
