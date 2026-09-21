---
title: "一人と Claude Code の 5 つの部署のセッションで開発する：GitHub のラベルを受信箱にし、手元の検査は安い順に落とし、自動検査の一覧は文書と突き合わせる"
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
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。
:::

# はじめに

開発者は一人ですが、リポジトリには企画部（PO）、開発部（Dev）、品質保証部（QM）、監査部、基盤部（Platform）の 5 つの部署のセッションがあり、それぞれ別の複製リポジトリ（clone）で動いています。部署は人ではなく、Claude Code のセッションに与えた役割です。一人なのに、なぜ部署を分けるのでしょうか。

生成AIは、自分で書いた変更を自分で承認して取り込んでしまいます。それを人の注意ではなく仕組みで止めるためです。実装を任せると実装の費用は下がりますが、検証と判断の費用は下がりません。作る側と認める側を、セッションと GitHub のアカウントの両方で分けました。この体制を回す仕組みは 3 つです。セッション間の受け渡しを GitHub のラベルに載せる仕組み、その経路の欠落を運用文書のテストで検出する仕組み、手元の検査を安い順に落として自動検査（CI）で確定する仕組みです。

- 正本（Zenn の本『生成AIに実装を任せて商用サービスを作る』）: [5 つの部署の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/one-human-many-sessions) / [受信箱の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/label-mailbox) / [手元の検査の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/pre-ready)
- 実装: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)
- GitHub のコマンドラインツール `gh`: [cli.github.com](https://cli.github.com/)

# 設計方針: 手順ではなく決定権で境界を引く

部署の境界は「誰が何をやるか」ではなく「誰が何を決めるか」で引きます。企画部が決めるのは、着手の可否、作業の優先順位、顧客に見える文言と価格の方針です。開発部が決めるのは、どう作るか、どの部品を使うか、テストをどう書くかです。品質保証部は個別の変更を取り込んでよいかを、監査部は開発ブランチ（develop）から本番ブランチ（main）への統合の可否を決めます。

取り返しのつかない 4 つの操作、つまり本番データの削除、本番へのデプロイ、課金の書き込み、データベース構造の変更だけは、常に人間のオーナーが決めます。判定は「自分の職掌か」ではなく「この操作が含まれるか」で行い、気づいた人が誰でもオーナー宛てのラベルを付けます。

一人で全部署を演じていても、この境界は守ります。企画部のセッションが開発部のセッションに着手順を個別に指示し始めると、開発部の自律が消えて企画部が詰まりの原因になるからです。

# 受け渡しは GitHub のラベルに載せる

Claude Code のセッション間には通信手段がありません。別の複製リポジトリで動くセッションに「次はあなたの番です」と伝える方法が要ります。新しい通信基盤は作らず、GitHub のラベルで「次に誰が動くか」を機械可読にしました。各部署が自分宛てのラベルの付いた一覧を見に行くこの仕組みを、正本にならって受信箱（label mailbox）と呼びます。

ラベルは 2 種類です。宛先のラベルは 6 つで、「次に誰に用があるか」だけを表し、用件を含みません。

- `state:needs-dev` / `state:needs-qm` / `state:needs-po`
- `state:needs-audit` / `state:needs-platform` / `state:needs-owner`

工程のラベルは `state:dev-done` / `state:qm-blocked` / `state:ready-to-merge` の 3 つで、送り手の状態と前提条件を表します。

9 種それぞれの意味、付ける人、次に動く部署の表は [`docs/sessions/label-mailbox.md`](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/sessions/label-mailbox.md) の §3.1 にあります。

運用の原則は 5 つです。GitHub がすでに持っている仕組み（承認の依頼は GitHub のレビュー依頼）にラベルを重ねない。ラベルは状態であって指示ではなく、`state:ready-to-merge` が付いていても自動検査の緑は自分で確かめる。付けた側が意味に責任を持つ。取り返しのつかない 4 操作だけはオーナーへ上げる。語彙を増やさない。

2 つ目の原則には実例があります。企画部がラベルだけを見てマージ可と判断し、品質保証部が自動検査の失敗を理由に拒みました。ラベルを見ても、自動検査の結果を見たことにはなりません。

# 各セッションは自分の受信箱を見に行く

ラベルは GitHub のリポジトリに 9 種を先に作っておきます（`gh label create <ラベル名>`）。各部署のセッションは、起動直後に自分の受信箱を毎時見に行く定期実行を 1 本作ります。作り方は Claude Code の定期実行の機能 `CronCreate` で、分をずらした毎時の予定と、受信箱を見る命令の列を渡します。開発部の定期実行に渡す中身は、次の `gh` の命令の列です。

```bash
# 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/sessions/label-mailbox.md
gh issue list --label "state:needs-dev" --state open --json number,title --jq '.[]|"着手 #\(.number) \(.title)"'
gh pr list --label "state:needs-dev" --state open --json number,title --jq '.[]|"着手PR #\(.number) \(.title)"'
gh pr list --label "state:qm-blocked" --state open --json number,title --jq '.[]|"BLOCKED #\(.number) \(.title)"'
gh pr list --search "review-requested:@me is:open" --json number,title --jq '.[]|"REVIEW依頼 #\(.number) \(.title)"'
gh issue list --state open --limit 100 --json number,title,labels --jq '.[]|select([.labels[].name]|map(select(startswith("state:") or .=="status:on-hold" or .=="epic"))|length==0)|"ORPHAN #\(.number) \(.title)"'
```

Issue とプルリクエストの両方を見るのが要点です。`gh pr list --label` は Issue を返さず、`gh issue list --label` はプルリクエストを返しません。

分は部署ごとにずらします。開発部は 13 分、品質保証部は 23 分、企画部は 37 分、基盤部は 43 分、監査部は 47 分で、同時刻の集中と 0 分・30 分を避けます。作った定期実行はそのセッションの中にだけ存在し、Claude Code を閉じれば消えます。「オーナー不在の間に動く」用途には使えず、「セッションが生きている間に自分の仕事を自分で拾う」ための仕組みです。

# 宛先なしを検出する

受信箱の運用の最大の失敗は、誰の受信箱にも入っていない未完了の項目です。正本にならって宛先なし（orphan）と呼びます。全員が「受信箱は空」と報告しているのに、実際には複数件が止まっている状態と区別がつきません。上の命令の列の最後の行がその検出で、`state:` で始まるラベルが 1 つも付いていないもののうち、`status:on-hold` と `epic` の付いていないものを列挙します。

`status:on-hold` と `epic` を除くのは、着手予定の無い項目が毎回まとめて並ぶと、本当に浮いているものが埋もれるからです。着手順に入っていないものには `status:on-hold` を付けておきます。

企画部には義務が 1 つ加わります。「受信箱は空」が 3 回続いたら、仕事が無いのではなく渡す経路が壊れていると疑い、各受信箱の件数と直近のマージを見て生存確認をすることです。

# 経路の欠落を運用文書のテストで検出する

ラベルの運用は 2 度壊れました。1 度目は、品質保証部宛てのラベルが「実装完了」しか無く、完成していないものを品質保証部に送れなかった事故です。2 度目は、受け取った側が対応を終えたあと何に移すかが未定義で、開発部が差し戻しに対応してもラベルが `state:qm-blocked` のまま止まった事故です。

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

守るのは文書どうしのずれで、経路の表に空欄が無いこと、語彙の表と本文が同じ 9 種を指すこと、各部署の指示書が語彙を反映することです。守らないのは GitHub 上のラベルの実在で、ネットワークに依存するテストにはしません。

2 度目には機械の検査を作りませんでした。運用の道具の不具合に検査を足すと「道具を守る道具」が生まれて際限なく増えるため、遷移の表という定義で塞いでいます。

# 手元の検査は安い順に落とす

プルリクエストをレビュー待ち（Ready for review）にする前、手元で回す一括検査の命令があります。当初は 20 段階で通しの所要が 20 分を超え、実際には実行されないか、待っている間に別の作業へ移って結果を見ないままでした。関門として機能していなかったのです。レビュー待ちの判定根拠を自動検査の全処理の通過に移し、手元の一括検査は 6 段階に縮めました。

6 段階の実行順は番号順ではなく、「判定に要する時間と参照する情報の量」で並べ替えます。

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

各段階は定義に `costClass` を持ち、未登録の値は例外で落ちます。段階の番号はプルリクエストの本文や Issue から広く参照されるので変えず、実行順だけを入れ替えます。番号順に実行していたころは、本文の体裁の誤り 1 つを検出するのに、型検査とテストの完走を待たされていました。

6 段階それぞれの検査の中身は [`scripts/pre-ready.mjs`](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/pre-ready.mjs#L853) の `buildSteps` にあります。

もう 1 つの事前確認が分岐元の鮮度です。分岐元が進んだ差分に、プルリクエストの雛形や検査スクリプトとその読み込みの連鎖が含まれていれば止めます。手元は古い基準、自動検査は新しい基準で判定することになり、手元の合格が根拠にならないからです。含まれていなければ注記だけで止めません。連鎖に実在するファイルだけを個別に列挙するのは、ディレクトリごと一括で指定すると、手元が一度も読まないファイルの変更で全プルリクエストが止まるからです。理由の分からない停止は、関門への信頼を削って迂回を誘発します。

# 自動検査で止まる検査の一覧を文書と突き合わせる

自動検査で止める検査（hard-fail）は、リポジトリの最上位の指示書 `CLAUDE.md` に列挙してあります。手書きの列挙は、`ci.yml` へ段階が足されるたびに静かに古くなり、「この検査は自動検査に無い」と読んだ担当がレビュー待ちにして 1 往復を無駄にしました。そこで指示書の目印で囲んだ区画と `ci.yml` の実測を、両方向で突き合わせるテストを置きました。

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

検出するのは 5 つです。`ci.yml` にあって指示書に無い段階。指示書にあって `ci.yml` に無い段階。指示書と除外の一覧のどちらからも漏れた処理。理由になっていない除外の理由。目印の区画の欠落や 0 件一致です。止める検査かどうかは、`continue-on-error: true` と `|| true` のどちらも付いていない段階であることを実測で決めます。

除外の理由は「空でなければ通す」にしません。`TODO` や `n/a` のような定型の埋め草と、機械が書いた検出の理由の写しは理由として認めない判定を 1 か所に集め、生成する側と検査する側が同じ表を参照します。

# まとめ

- 部署の境界は決定権で引き、取り返しのつかない 4 操作だけを人間に上げます。作る側と認める側は、セッションと GitHub のアカウントの両方で分けます
- 受け渡しは宛先 6 と工程 3 のラベルに載せ、各セッションが自分の受信箱を `gh` で見に行きます。ラベルは状態であって指示ではありません
- 宛先なしの検出を企画部の定期実行に必ず入れ、「受信箱は空」が続いたら経路の故障を疑います
- 運用文書が正本なら、文書どうしのずれはテストで守れます。GitHub の API は叩きません
- 手元の検査は安い順に並べて早く落とし、レビュー待ちの判定は自動検査に置きます。自動検査の一覧は実測と突き合わせ、除外の理由は実体を要求します

部署を 5 つに分けた出発点は、生成AIが自分の変更を自分で承認して取り込んだ事故でした。変更を作る者と、それを認める者は分けます。開発者が一人でも、セッションと GitHub のアカウントを別にすれば、この 2 つは分けられます。この考え方は、[Zenn の本の終盤の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/principles)にまとめました。

動いているサービス: [がんばりクエスト](https://www.ganbari-quest.com/)
