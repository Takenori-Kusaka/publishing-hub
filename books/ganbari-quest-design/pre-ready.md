---
title: "第Ⅴ部-1　pre-ready と CI hard-fail ― 手元で早く落とし、CI で確定する"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

第Ⅴ部は「どう作ったか」の 2 つ目で、第Ⅳ部で「80 点」と呼んだ品質ゲートの実体を 1 つずつ見ていきます。検証を人から機械へ寄せる、というのが第Ⅴ部の筋です。最初は、プルリクエストの Ready 化の前に手元で回す検査 CLI と、CI で hard-fail する検査の関係です。この 2 つの関係は 1 度ひっくり返っています。当初はローカルの検査を Ready の条件としていました。いまは CI を確定の根拠とし、ローカルは早く落とすための道具です。

## 5 パターンの事故から生まれた CLI

`npm run pre-ready` は 2026-05-01 の ADR-0030 で生まれました。直近 50 本の PR を観察して見つかった、5 パターンの事故が背景です[^adr30]。

1. CI の自己言及循環。PR テンプレートの「CI が全て通過している」チェックボックスを埋めるには CI の通過が必要だが、そのチェックボックス自体が CI の検出対象だったため、修正 Agent がこの 1 項目を埋めるためだけに動く事故が 6 本の PR で起きた
2. PR 本文の禁止語スキャンの範囲が AC マップに限られ、他の節に「予定」「別 PR」「follow-up」が混入した
3. 必須の節の見出しが完全一致でなく、開発者が括弧書きを削除して再 push した
4. Ready 化の時点では merge 可能でも、レビュー中に他の PR が merge されて conflict になる
5. 開発者がローカルの検査を回さないまま Ready 化し、CI で検出されて時間を失う

当時の QM の観察が引かれています。「追加 CI ゲートは天井に近い。`pre-ready` ローカルコマンドを 1 本作れば、開発者の『やり忘れ』は事前検出可能。CI は最終防衛線として現状維持で十分」[^adr30]。実装は純粋な Node の CLI で、既存の検査スクリプトを順次呼ぶ薄いオーケストレーターです。git の hook で自動実行する案は、[第Ⅳ部-8](platform-session) で見たとおり退けられました。

## 実行されない gate になった

この CLI は成長し、2026-07-30 の時点で 20 ステップ、通しで 1,350 秒かかるようになっていました。ADR-0030 の補追は、その結果をこう記録しています。

> 19 step のうち 14 step は変更内容に関係なく無条件実行されており、Ready 化のたびに 20 分超を要していた。結果として実際には実行されないか、実行しても待ち時間の間に別の作業へ移り結果を確認しない運用になっていた = 「実行されない gate」であり、gate として機能していなかった。CI は同じ検査を並列で回して数分で終わるため、判定根拠を CI に置く方が速く、かつ「実行したか」を人の申告に頼らずに済む。[^adr30]

判断は、Ready の必要条件を「CI の全 job が pass」に移し、ローカルの CLI を 6 ステップ、300 秒以内に縮小することでした。Ready のチェックリストからは「pre-ready 全 Step PASS」の項目を外しました。自己参照の deadlock を作るからです[^adr30]。

## 残した 6 ステップと選定基準

残した 6 ステップは、[第Ⅳ部-8](platform-session) で見た判断原則 v2 の類型 1（証跡の真正性）と類型 2（顧客に見える正しさ）のうち、安価なものです[^cli]。

| Step | 検査 | 類型 |
| --- | --- | --- |
| 9 | PR 本文の Ready チェックリスト、AC 証跡、禁止語 | 1 |
| 11b | UI 変更 PR のスクリーンショット embed | 1 |
| 1 | Biome（lint と整形） | 2 |
| 2 | svelte-check（型検査） | 2 |
| 7 | プラン文字列の直書き検査 | 2 |
| 7g | タイムゾーン依存の日付導出の検査 | 2 |

CLI のヘルプには、外した検査の行き先が明記されています。cspell やライセンスキー漏洩検査などは CI の `lint-and-test` job で、vitest は 2 shard の `unit-test` job で、LP の寸法計測は別のワークフローで、それぞれ hard-fail のまま走り続けます。撮影の案内を表示するだけだった step は「検査ではなかった」として撤去されました。外した 14 のうち大半は、その後の削減でスクリプトごと削除されています[^cli]。

## 安い順に落とす

6 ステップの実行順は、Step 番号順ではありません。

> Step 番号は PR body / docs / Issue から広く参照されるため変更しない。実行順だけを「判定に要する時間と参照する情報の量」で並べ替える。同一クラス内は上記の番号順を保つ。
>   1) meta      PR body / メタ情報だけを見る    — Step 9
>   2) static    静的テキスト / 単一ファイル検査 — Step 1 / 7 / 7g
>   3) typecheck 型検査                          — Step 2
>   4) ui        SS 系                           — Step 11b[^cli]

この順序が決まった背景も、テストのコメントに残っています。Step 番号順にそのまま実行していたため、PR 本文の体裁ミス 1 つ、つまりファイルを 1 行も読まない検査の検出に、vitest と svelte-check の完走を待たされて 23 分を捨てていました[^ordertest]。順序を変えても検査の集合と合否の条件は変わらないこと、将来 step を足しても順序が崩れないこと（コストクラスの未登録は throw）を、テストが固定しています。

## base の鮮度

もう 1 つの preflight が base の鮮度です。手元で検査を通しても、base branch が進んでいれば CI は別の基準で判定します。ただし base は 1 日に何度も進むため、進んでいるだけで止めると無駄な rebase が多発します。

判定は 2 段階です。base が進んだ差分に「pre-ready の検査基準」、つまり PR テンプレート、テンプレートの節の定義、検査スクリプトとその import 閉包が含まれていれば BLOCK します。手元は旧基準、CI は新基準で判定するため、手元の PASS が成立しないからです。含まれていなければ警告の注記だけで止めません[^cli]。

検査基準の列挙にも設計があります。

> ディレクトリ prefix (`scripts/` / `scripts/lib/ci/`) で一括指定すると、pre-ready が一度も読まない script の変更まで BLOCK する。実際 `scripts/lib/ci/` 13 file のうち pre-ready の import 閉包に入るのは 4 file だけで、残り 9 file (ページガイド撮影ヘルパー等) を直しただけで全 PR の pre-ready が止まっていた。手元と CI で読む SSOT が食い違うという止める根拠が成立しない file で止めるのは「理由の分からない BLOCK」であり、gate への信頼を削って迂回行動を誘発する。[^cli]

閉包に実在するファイルだけを個別に列挙し、列挙の漏れと余分は、実際の import 閉包と両方向で突き合わせるテストが検出します。「理由の分からない BLOCK は迂回行動を誘発する」という一文は、この部の全体を貫く設計思想です。

## CI で hard-fail する検査の一覧を機械で守る

CI 側の hard-fail する検査は、ルートの CLAUDE.md に列挙されています。この列挙は、かつて手書きで、静かに古くなっていました。

> CLAUDE.md は #4121 (pre-ready を 6 step に絞った時点) の一覧を「以下がその全部である」「ここに挙がっていない検査は CI にも無い」と断定したまま置かれていた。その後 ci.yml には #3877 (`lint:typed`) / #3878 (`lint:svelte`) / #3969 / #3978 / #4015 / #4085 … と hard-fail step が足され続けたが、doc は一度も追随していない。ci.yml を触る PR は CLAUDE.md を開かないので、列挙は step が増えるたびに静かに古くなる。
> 実害 (PR #4603): 担当は CLAUDE.md の断定から「`lint:svelte` は CI に無い」と判断して Ready 化し、`lint-and-test` が `svelte/no-useless-children-snippet` で fail → 1 往復。doc の誤りがそのまま PR 往復のコストになる。[^ssottest]

対策のテストは、CLAUDE.md の marker block と `ci.yml` の実測を両方向で突合します。検出するのは 5 つです。ci.yml に含まれ doc から漏れた step（列挙漏れ）。doc に残り ci.yml から消えた step（陳腐化）。ci.yml の job が doc と除外リストのどちらからも漏れている状態（job 新設の silent gap）。除外リストの理由が理由として成立していないもの。marker block の欠落や 0 件マッチ（検査の空振り）です[^ssottest]。[第Ⅳ部-2](label-mailbox) の label mailbox の経路テストと同じ形で、運用文書が SSOT であることを機械で守ります。

hard-fail の判定は、`ci.yml` の中で `continue-on-error: true` と `|| true` のどちらも付いていない step であることを実測で決めます。そして CLAUDE.md にはこう書かれています。「本ブロックが保証するのは `ci.yml` の範囲だけ」。他のワークフローは突合の対象外なので、`gh pr checks` で個別に見る、と限界を明記しています[^claudemd]。

## 除外の理由を理由として成立させる

allowlist、baseline、免除リストには「reason」の欄があります。欄が埋まっていれば通す、では抜け道が残ります。除外理由の判定を 1 か所に集めたモジュールは、その理由をこう書いています。

> - `TODO` / `n/a` / `-` は非空だが理由ではない。非空チェックだけだと抜け道が残る (#3956)
> - guard 自身の生成物で埋まった reason も理由ではない。`--update-baseline` は検出理由（「どこからも import されていません」= 機械が書いた現象の説明）を免除理由の欄にコピーしていた。「なぜ免除してよいか」を誰も書いていないのに欄は埋まる状態で、reason 機構が形骸化する
> 現象の説明 (detection reason) と免除の正当化 (exclusion reason) は別物である。[^reason]

定型の stub（todo、tbd、n/a、未定、なし など）は完全一致で弾き、機械が生成した文字列の marker と 8 文字未満の短さも弾きます。生成側と検査側が同じ表を参照するため、「生成は止めたが既存データは通る」片肺の状態になりません。

## 手元と CI の役割分担

この章の設計を一言でまとめると、手元は「早く落とす」、CI は「確定する」です。手元の検査は 300 秒以内で安い順に落ち、base の鮮度を見て手元の判定が無効になる条件だけを止めます。CI の検査は列挙が機械で守られ、除外の理由は理由として成立するかを検査されます。生成AIが自分で「検査を通した」と申告する余地を、両側から狭めています。

[^adr30]: ADR-0030「`npm run pre-ready` CLI 採用と pre-push hook 非採用」。5 パターンの事故、QM の観察、CLI の設計、2026-07-30 の補追（1,350 秒の実測、「実行されない gate」、Ready 判定の CI への移行）。出典: [docs/decisions/0030-pre-ready-cli-and-no-pre-push-hook.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0030-pre-ready-cli-and-no-pre-push-hook.md)

[^cli]: pre-ready CLI のヘルプとソース。6 step の選定基準、cheap-fail-first の実行順、外した検査の行き先、base 鮮度の preflight と検査基準ファイルの列挙方針。出典: [scripts/pre-ready.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/pre-ready.mjs)

[^ordertest]: pre-ready の実行順が cheap-fail-first であることと、変更集合の base 解決を固定するテスト。Step 番号順の実行で 23 分を捨てていた経緯。出典: [tests/unit/scripts/pre-ready-order-and-base.test.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/scripts/pre-ready-order-and-base.test.ts)

[^ssottest]: CLAUDE.md の「CI で hard-fail する検査」の列挙を `ci.yml` の実測と突合するテスト。手書きの列挙が静かに古くなり PR 往復を生んだ経緯と、検出するもの 5 つ。出典: [tests/unit/docs/ci-hard-fail-check-list-ssot.test.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/docs/ci-hard-fail-check-list-ssot.test.ts)

[^claudemd]: ルートの CLAUDE.md。§「CI `ci.yml` で hard-fail する検査」の marker block と、保証範囲が `ci.yml` に限られる旨の注記。出典: [CLAUDE.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/CLAUDE.md)

[^reason]: 除外理由が理由として成立しているかを判定する SSOT モジュール。stub の一覧、機械生成の文字列の marker、8 文字未満の判定。出典: [scripts/lib/ci/exclusion-reason.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/lib/ci/exclusion-reason.mjs)
