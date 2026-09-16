---
title: "第Ⅵ部-3　ADR の削除主義 ― 10 枠に収まらなかった 37 本、150 行の上限、renumber、月 1 の棚卸"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

ADR（Architecture Decision Record）は、生成AIが最も気前よく書く文書です。決定のたびに 1 本、テンプレートに沿って、数分で。7 か月で書かれた ADR は 70 本を超え、そのうち 35 本が削除されました。この章では、「常時参照される ADR は 10 本まで」という目標がどう立てられ、どう達成されなかったか、そして archive ではなく削除を選んだ判断を扱います。

## 増える速度

2026-04-30 時点で active な ADR は 25 本、archive も 25 本でした。5 月末には active が 44 本に増えます。1 か月で 19 本。6 月末に 36 本、7 月末に 36 本、そして 2026-09-16 現在は 37 本です。archive は 5 月末の 28 本から 7 月末に 6 本へ減りました[^counts]。

| 時点 | active | archive |
| --- | --- | --- |
| 2026-04-30 | 25 | 25 |
| 2026-05-31 | 44 | 28 |
| 2026-06-30 | 36 | 28 |
| 2026-07-31 | 36 | 6 |
| 2026-09-16 | 37 | 6 |

削除された ADR は、git の履歴で数えると 35 本です。ADR の一覧は「削除済み ADR の番号は再利用しない」と定め、何を削除しどこへ移したかは `git log --diff-filter=D` で追う、と書いています[^adrreadme]。

## 10 枠

2026-04-20 の #1262 で、ADR は全体を作り直されました。目標は「active-primary ≤ 10」と、1 本あたりの上限です。150 行、7 セクション。根拠は Miller の 7±2 で、毎週以上参照するルールとして記憶し得る現実的な上限、5 分以内に通読できる分量、と説明されています。番号は振り直され、ADR-0001 は旧 0003、ADR-0008 は旧 0035 でした[^adrreadme]。

一覧の見出しは今も「TOP 10 active」です。その表には 37 行あります。ボリューム上限の表は「分類 A（毎週レベルで参照される常時参照ルール / gate）active ADR 総数 ≤ 10 件を目安」と書き、10 は分類 A だけの目安で、横断ポリシーや技術選定根拠は active に残す、と補足しています。目標は「10 本」から「常時参照される 10 本」に読み替えられました[^adrreadme]。

「10 枠超過時の義務」も定められています。10 枠が埋まった状態で新規追加するなら、役目を終えた既存 1 件以上を同 PR で削除するか supersede する。同梱なしの PR は CI で fail させる。ただし CI の実装は「follow-up で別 Issue 化」のまま、実装されていません[^adrreadme]。

## archive から削除へ

当初の運用は archive でした。役目を終えた ADR を `docs/decisions/archive/` に移す。5 月末の archive は 28 本で、active の 44 本と合わせて 72 本が読める場所にありました。

2026-05-22 の #2440 が、これを削除主義に変えます。完了済みの migration、採択されなかった調査、完遂済みの 1 回限りの決定記録は、archive ではなく削除する。履歴は git で追跡する。archive は「移行期の残存」として 6 本だけが残り、それぞれに保全理由が書かれています。E2E の helper が「ADR-0030 D-2〜D-5」を参照している、src の 30 か所が「ADR-0040 Px」を参照している、本番の ops UI が GitHub URL でリンクしている、といった理由です[^adrreadme]。

削除主義には、対になる規則があります。「削除済み ADR の番号は再利用しない」「過去 PR / commit の ADR 番号参照は更新しない」。そして「archive 一覧」の 6 本は、再活性化するときに active から 1 本削除する。1-in-1-out の archive 版です。

![archive から削除へ](/images/ganbari-quest-design/adr-deletionism.png)

## 上限を超えた ADR

150 行の上限を超える ADR は、月 1 棚卸で「分離を判断する」とされています。0056（QM drift の構造的対処）、0049（履歴保持期間）、0010（Pre-PMF スコープ判断）の 3 本です。DSQL 系の 0063、0064、0065 は統合の可否が未決です[^adrreadme]。

0056 は 2026-08-13 に 0068 で supersede されました。QM approve の物理遮断を「立ち上げ期は外す」というオーナーの判断です。superseded になった 0056 は削除されず、active の一覧に「観測 42 件は有効なまま。hook 呼び出しのみ撤去」として残っています。削除主義の例外で、決定は置き換わったが観測は生きている、という状態です[^adr68]。

月 1 棚卸の規則は docs/CLAUDE.md にあります。毎月最終週、active 件数、各 ADR の行数、context の前提が現状と乖離していないか、supersede chain の整合、README の表と実ファイルの照合。「次回予定: 2026-06 最終週（本ルール初回適用）」と書かれたまま、その行は更新されていません。棚卸の結果は 7 月まで README に「棚卸レポート」として 11 節積み上がり、[第Ⅵ部-1](claude-md-hierarchy) で見た #4374 で削除されました[^docsclaude]。

## OSS を先に探す表

ADR の README には、ADR ではない表が 2 つあります。「OSS 採用記録」と「OSS 調査済み・不採用記録」です。[第Ⅱ部-1](stack-selection) で見た「独自実装の前に OSS を 2 件探す」ルールの成果物で、採用の表は 9 行、不採用の表は 0 行です。

不採用の表が 0 行なのは、[第Ⅴ部-4](fitness-functions) で見た「不在の証明」列のためです。Graphify は 2026-07-29 に不採用と記録され、8 月に採用されました。しかし表は不採用のまま残り、「未採用」と誤答し続けました。#4395 で採用記録へ移され、同時に「不在の証明」列と、その列のパスの存在で fail する test を加えました。表が腐っても誰も気づけない、を機械で検出する試みです[^adrreadme]。

## 今ならこうする

「10 本」は達成されませんでした。25 本から 44 本に増え、37 本で落ち着いています。しかし、この数字を失敗と読むと正確さを欠きます。AI は ADR を安く書きます。決定のたびに書けてしまう環境で、総数を目標にすると、書かない圧力になります。削除主義は、書くことを止めずに、残す本数を絞る方法でした。

効いたのは、archive を廃止したことです。archive は「読める場所にある古い決定」で、AI はそれを読んで古い決定に従います。削除すれば、読めるのは git だけです。git は AI が自発的には読みません。この非対称が、削除主義の実効です。

もう 1 つ効いたのは、「現状の正解」と「経緯」の分離を ADR にも適用したことです。棚卸レポートは経緯です。README に積むと常時ロードされ、bytes を食います。[第Ⅵ部-1](claude-md-hierarchy) の 42K から 22K への削減は、ここから来ています。

10 枠超過時の CI gate は作られていません。作るべきかどうか、私は疑っています。第Ⅳ部で見た「装置を増やさない」原則の方が、いまは優先です。ADR を減らす装置を増やすのは、矛盾に近い。

[^counts]: 各月末の active と archive の本数は `git ls-tree` で数えた。削除数は `git log --diff-filter=D --name-only -- 'docs/decisions/*.md'`。出典: [docs/decisions/](https://github.com/Takenori-Kusaka/ganbari-quest/tree/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions)

[^adrreadme]: ADR 一覧。テンプレート、OSS 先調査ルール、OSS 採用記録と不採用記録（不在の証明）、ボリューム上限ルール（削除主義）、新規 ADR 追加 gate、10 枠超過時の義務、archive 運用ルール、renumber 規約、一覧（TOP 10 active、37 行）、archive 一覧（6 本）。出典: [docs/decisions/README.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/README.md)

[^adr68]: ADR-0068「QM approve の物理遮断を立ち上げ期は外す」（ADR-0056 を置き換え）。出典: [docs/decisions/0068-approve-gate-removal-staged-control.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0068-approve-gate-removal-staged-control.md)

[^docsclaude]: docs/CLAUDE.md §ADR 管理、§ADR 月 1 棚卸（頻度、チェック項目、次回予定 2026-06）。出典: [docs/CLAUDE.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/CLAUDE.md)
