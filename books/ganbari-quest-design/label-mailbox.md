---
title: "第Ⅳ部-2　label mailbox ― セッション間の受け渡しを GitHub に載せる"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

5 つのロールセッションは、互いを知りません。Claude Code のセッション間には直接の通信手段がなく、別のクローンで動くセッションに「次はあなたの番です」と伝える方法がありませんでした。この章では、その受け渡しを GitHub の label に載せた仕組みと、それが壊れた 2 つの事故、そして壊れを検出するテストを扱います。

## オーナーが 1 日 8 往復していた

仕組みが生まれる前、受け渡しはオーナーが手作業でしていました。運用文書は当時の状況をこう記録しています。

> そのため実運用では、オーナーが各セッションの発言を手でコピーして中継していた。1 日 8 往復の中継が発生し、以下が構造的に起きた。
> - 決定がセッション上にしか無い — PR body の「PO 承認条件 3 件」に GitHub 上の出典が無く、レビュアが検証できなかった（QM 指摘、2026-07-31）
> - 次に誰が動くかが GitHub から読めない — 各セッションは自分で仕事を拾えず、オーナーの中継待ちで停止する[^mailbox]

問題は手間だけではありません。決定がセッションの会話の中にしか残らず、GitHub から検証できないこと。そして、オーナーが不在の間は全セッションが止まることです。

設計方針は「新しい通信基盤を作らない」でした。GitHub はすでにメッセージバスとして動いています。足りないのは「次に誰が動くか」だけなので、それを label で機械可読にしました[^mailbox]。

## 9 種の label

label は 2 種類あり、混ぜると経路が塞がります。

宛先 label は 6 種で、「次に誰に用があるか」だけを表します。`state:needs-dev`、`state:needs-qm`、`state:needs-po`、`state:needs-audit`、`state:needs-platform`、`state:needs-owner` です。用件は含意しません。何の用かは Issue やプルリクエストのコメントに書きます。

工程 label は 3 種で、送り手の状態を表し、前提条件を含意します。`state:dev-done` は実装完了・CI 全緑・Ready 化済み、`state:qm-blocked` は QM が BLOCK と判定した、`state:ready-to-merge` は approve 済みです[^mailbox]。

設計原則は 5 つあります[^mailbox]。

1. GitHub がすでにモデル化しているものに label を作らない。approve の依頼は reviewer request を使う
2. label は状態であって指示ではない。`state:ready-to-merge` が付いていても、CI 緑は自分で確認する
3. 付けた側が意味に責任を持つ
4. 不可逆 4 操作だけはオーナーへ上げる
5. 語彙を増やさない

第 2 の原則には実例が添えられています。PO が label だけを見て merge 可と判断し、QM が CI の赤を理由に拒否した、というものです。label は実測を代替しません。

## 各セッションは自分の受信箱を polling する

各ロールのセッションは、起動直後に自分の受信箱を毎時チェックする cron を 1 本作ります。分はロールごとにずらします。Dev は 13 分、QM は 23 分、PO は 37 分、Platform は 43 分、監査は 47 分です。同時刻の集中を避け、また 0 分と 30 分を避けています[^mailbox]。

この cron には制約があります。セッション内のメモリにしか存在せず、Claude Code を終了すると消えます。7 日で自動失効し、セッションが待機中のときだけ発火します。つまり「オーナー不在の間に動く」用途では使えず、「セッションが生きている間、自分の仕事を自分で拾う」ための仕組みです[^mailbox]。恒久化するなら GitHub 側のワークフローから Discord へ通知する形になりますが、「実際に見落としが発生してから作る」と決めています。

## 事故 1: 経路が丸ごと無かった

label の運用は、2 度壊れました。1 つ目は、宛先 label が用件に縛られていた事故です。QM 宛の label が `state:dev-done`（実装完了・CI 全緑）でしか表現できなかったため、「完成していないと QM に送れない」状態になっていました。同時に、監査宛は「cut を渡した」に限定され、問い合わせに使えませんでした。2 つのロールが同じ日に困るまで、誰も気づきませんでした[^mailbox]。

対策として「宛先 label は用件を含意しない」という原則を追加し、用件で label を分けることをやめました。用件で分けると語彙が際限なく増えるからです。

## 事故 2: 復路が定義されていなかった

2 つ目は、受け取った側が対応を終えたあと何に移すか、つまり復路が未定義だった事故です。Dev が QM の差し戻しへ対応しても label は `state:qm-blocked` のまま残り、QM に戻らず停止しました。運用文書はこの失敗の形をこう書いています。

> 問い合わせは往復である。 工程 label（`dev-done` → `qm-blocked` / `ready-to-merge`）は一方向だが、問い合わせは答えが返らないと終わらない。`needs-qm` の 1 本目（回答したら問い合わせ元の state に戻す）を書かないと、#4149 の「対応済みなのに誰にも伝わらない」が問い合わせ側で再発する — 送り手は「戻ってこない」だけを観測し、QM は「答えたのに」と思う。[^mailbox]

対策は遷移表です。どの label を受け取ったら、対応後どの label へ移すかを、全組み合わせで表にしました。ここで興味深い判断があります。同じ種類の不具合が 2 回起きました。本書の後半で扱う「2 件目で class として扱い機械で止める」原則に従えば、label 遷移を機械で検査する guard を作るところです。しかし運用文書はそれをしませんでした。

> class-lock を今回は作らない理由: 「label が状態を持つが遷移の網羅性が保証されていない」は同 class 2 回目（orphan / 復路未定義）であり、ADR-0061 原則 2 なら機械 guard の対象になる。ただし ADR-0061 の適用対象限定（検証装置・運用装置自身の不具合には適用しない — 装置の class-lock は「装置を守る装置」を生み無限後退する、#4123）に該当するため、遷移表という定義で塞ぐ。[^mailbox]

運用装置の不具合に機械 guard を足すと、装置を守る装置が生まれ、無限に後退します。前章の憲章 §0 が「80 点で止める」と決めた背景も同じです。

## orphan: 誰の受信箱にも入っていない項目

label 運用の最大の失敗モードは「誰の受信箱にも入っていない open 項目」です。報告上は全員が「mailbox 空」になり、実際には複数件が止まっている状態と区別がつきません。

> 2026-07-31 の実例: Dev / QM とも「対応事項なし」と報告した時点で、着手すべき Issue が 5 件（`#3950` / `#4087` / `#3970` / `#4117` / `#4139`）滞留していた。全件 `state:*` 未付与だったため、どの mailbox にも現れなかった。[^mailbox]

検出のコマンドは運用文書に書かれており、PO の cron には必ず含めます。

```bash
# state:* が 1 つも付いていない open Issue / PR
gh issue list --state open --limit 100 --json number,title,labels \
  --jq '.[]|select([.labels[].name]|map(select(startswith("state:") or .=="status:on-hold" or .=="epic"))|length==0)|"ORPHAN ISSUE #\(.number) \(.title)"'
gh pr list --state open --limit 50 --json number,title,labels \
  --jq '.[]|select([.labels[].name]|map(select(startswith("state:") or .=="status:on-hold" or .=="epic"))|length==0)|"ORPHAN PR #\(.number) \(.title)"'
```

`status:on-hold` と `epic` を除外するのは、backlog 全件が毎回 orphan として報告されると本当に浮いているものが埋もれるからです。初回の運用では orphan が 16 件出ましたが、実際に配るべきだったのは 2 件でした[^mailbox]。

PO にはもう 1 つ義務があります。「mailbox 空」が 3 回連続したら、経路が壊れていると疑って生存確認をすることです。「受信箱が空であることは、仕事が無いことではなく渡す経路が壊れていることの兆候である方が多い」と運用文書は書いています[^mailbox]。

## 経路の欠落をテストで検出する

事故 1 の再発は、テストで防いでいます。運用文書そのものを読み、経路マトリクスに空欄がないこと、語彙表と本文が同じ 9 種を指していること、各ロールのファイルが新しい語彙を反映していることを検査します。

```ts
// tests/unit/architecture/label-mailbox-routes.test.ts
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
```

テストの冒頭には、守るものと守らないものが明記されています。守るのは文書間の drift で、守らないのは GitHub 上の label の実在です。「docs は SSOT だが GitHub API を CI で叩かない」、ネットワークに依存するテストにはしない、と線を引いています[^routestest]。

Markdown の運用文書をテストが読む、という形は奇妙に見えるかもしれません。しかしこのリポジトリでは、運用文書が SSOT であり、文書の整合性を機械で検査する例が随所にあります。本書の後半で扱う CI hard-fail 一覧の突合テストも同じ形です。

## Issue の運用

label mailbox は Issue と PR の両方に使いますが、憲章 §0 のルール 7 以降、Issue の役割は縮小しています。Issue にするのは顧客価値の作業単位とオーナーの手番が要るものだけで、装置やプロセスの改善は Issue を書かずにその場で PR を出します。

それでも Issue の品質基準は残っています。ADR-0003 は、ダイアログ管理の不具合が 4 回繰り返された（#543 → #611 → #633 → #671）ことから生まれました。

> 根本原因: Issue 起票者が症状の記述と曖昧な提案に終始し、根本原因の特定と構造的な解決策の設計を怠った。「ガード条件追加でも良い」「ステートマシンまたはキュー」のような選択肢を併記すると、開発チームは必ず工数の少ない方を選ぶ。[^adr03]

選択肢を併記すると、AI は工数の少ない方を選びます。Issue には根本原因と構造的な解決策を 1 つ書き、独自実装が 10 行を超えそうなら起票前に OSS や確立パターンを 2 件調査する、という規律がここから生まれています。

[^mailbox]: label mailbox の運用文書。§1 設計背景（1 日 8 往復の中継、決定がセッション上にしか無い問題）、§2 設計原則、§3.1 label 語彙（宛先 6 + 工程 3）を引用。さらに §3.1.1 遷移表と class-lock を作らない理由、§3.3 orphan の検出コマンドと 2026-07-31 の実例、§3.4 cron の作り方と制約、§5.1 「mailbox 空」3 回連続時の生存確認を引用。出典: [docs/sessions/label-mailbox.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/sessions/label-mailbox.md)

[^routestest]: label mailbox の経路を docs 側で検査するテスト。QM 宛の列が丸ごと空だった #4180 の背景、守るものと守らないものの線引き。出典: [tests/unit/architecture/label-mailbox-routes.test.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/label-mailbox-routes.test.ts)

[^adr03]: ADR-0003「Issue 起票・クローズ品質（根本原因 + 構造的解決）」。4 回繰り返されたダイアログ不具合と根本原因の分析。出典: [docs/decisions/0003-issue-quality-standard.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0003-issue-quality-standard.md)
