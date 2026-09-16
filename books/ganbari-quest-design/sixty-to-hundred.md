---
title: "第Ⅳ部-5　60 点から 100 点へ ― band-aid サイクルの打破と shift-left"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

生成AIは 60 点から 80 点のものをすぐに出します。問題はそこから 100 点に寄せる工程で、修正が修正を呼び、直したはずの不具合が別の場所で再発します。この章では、その「モグラ叩き」を断つために定めた ADR-0061 の 5 原則、その原則が自らを縛りすぎて修正された経緯、そして「同じ種類の不具合を機械で止める」という発想が形だけの検査に負けた記録を扱います。

## モグラ叩きの構造

ADR-0061 の出発点は、export / import の機能で 2 サイクル連続して blocker が出たことでした。

> 日本語名・points 値域という 別 instance を都度パッチした結果、「1 つ直すと次が露見するモグラ叩き」になった。さらに #3163 のように 重量 e2e でしか露見せず develop 軽量レーンをすり抜ける回帰も繰り返した。
> これらは個別の見落としではなく、再発防止が「人の注意」依存で、不変条件が高レベル (e2e) にしか表明されていない構造的失敗である。[^adr61]

不具合の再発を防ぐ手段は「次は気をつける」しかなく、守るべき不変条件は重い E2E テストにしか書かれていない。だから同じ種類の不具合が安価な検査をすり抜け、統合の監査まで露見しない。ADR はこの構造を、不変条件をテストピラミッドの下位へ押し下げる規律の機械強制によって断とうとしました。

## 5 原則

1. failing-test-first。すべてのバグ修正は、まず失敗するテストを書き、それが緑になることで修正を証明する。Issue には 5 Whys による根本原因の記入を必須にする
2. same-class-N-times → 機械 guard 必須。同じバグの class が 2 回以上再発したら、次の修正は別の instance へのパッチでは Done にせず、CI gate、lint、property test、fitness function で class 全体を固定する
3. push-down-the-pyramid。重い検査が失敗するたび「同じ条件を unit や lint で捕捉できたか」を問い、可能なら下位層に降ろしてから緑にする
4. 構造不変条件の fitness function 化。CLAUDE.md の散文の構造ルール（routes から DB を直接呼ばない、Base トークンを routes で使わない、など）を lint や fitness function に encode し、PR の gate にする
5. accepted-residual gate。adversarial reviewer が生産する 3 件の反対理由を「3 件生産する」と「3 件 Issue 化する」に分離し、Pre-PMF で受容する残課題は Issue にせず統合 PR の本文に記録する

第 2 原則の発火条件は、あとから前倒しされました。「N 回再発したら」ではなく、同一 PR や同一の監査の中で同じ class の 2 件目に触れた時点で class を固定します。instance へのパッチを繰り返させず、最初に畳むためです[^adr61]。[第Ⅰ部-5](pre-pmf-scope) で見た「値が正しいことと効いていることは別」のテストや、[第Ⅰ部-6](legal-by-design) の保持期間の allowlist は、いずれもこの原則から生まれています。

## 原則が自分を縛りすぎた

第 2 原則は、2026-07-30 に適用範囲を限定されました。

> 適用対象の限定と停止条件 (2026-07-30 amendment): 原則 2 の class-lock は 顧客に見える不変条件 (データ整合 / 課金 / 認可 / 日付境界 / 表示崩れ) にのみ適用する。検証装置自身の不具合 (CI gate / hook / PR body 検査 / テンプレート整合) には適用しない。装置の不具合への処方は class-lock ではなく 装置の削減であり、選択肢は「消す」か「残す 8 本に入れる」の二択で「直す」を選ばない (#4121)。[^adr61]

根拠は実測です。2026-07-30 時点で、検証装置のコードは 51,607 行、製品コードは 67,687 行で、装置が製品の 0.76 倍に達していました。検査スクリプトは 63 本あり、うち 10 本は未参照でした。直近に merge した 20 本の PR のうち 12 本、60% が装置自身の修理でした。「同 class 4 例目」「6 例目」を名乗る Issue が open の 10% を占めていました[^adr61]。

装置に class-lock を掛けると「装置を守る装置」が生まれ、それがまた新しい class の発生源になります。この無限後退を止めるため、装置の不具合には第 2 原則を適用せず、装置そのものを減らすと決めました。[第Ⅳ部-1](one-human-many-sessions) の憲章 §0 と [第Ⅳ部-2](label-mailbox) の「class-lock を今回は作らない理由」は、いずれもこの修正の延長です。

## follow-up の踏み車

第 5 原則の背景には、別の実測があります。1 つのセッションで 19 本の PR を merge したのに、open の Issue は 140 件から 144 件へ増えました。調査の文書は「1 PR ≈ 1 follow-up の強い比例」を観察し、follow-up が merge という行為から機械的に生成されていると結論づけています。独立した不具合の自然発生では説明できません[^treadmill]。

真因の寄与度は 4 つに分解されています。

| 真因 | 寄与 | 内容 |
| --- | --- | --- |
| G2 無限 adversarial / over-filing | 約 40% | adversarial reviewer は Echoing 抑止のため必ず 3 件の反対理由を出す。監査文書がその全件を Issue 化すると規定していたため、PR が十分よくても 3 件が起票される |
| G3 tracker のバックログ化 | 約 30% | follow-up が close されず累積する |
| G1 band-aid / scope-split | 約 25% | 同じ class の欠陥を instance 単位でパッチする |
| G4 真の独立 defect | 約 5% | 正当に潰すべき不具合 |

真の不具合は 5% しかなく、残りは開発プロセスが生成していました。介入の第 1 位は、finding を起票前に blocking / class-lock 対象 / accepted-residual の 3 区分へ強制分類し、accepted-residual は Issue にせず PR 本文へ記録することでした。3 件生産する仕組みは Echoing 抑止のために維持し、変えるのは出力先だけです。severity が high 以上のものは residual にできません[^treadmill]。

[第Ⅳ部-3](maker-not-approver) で見た Adversarial Reviewer は、独立した判断を確保する装置でした。しかしその出力を無条件で Issue にすると、backlog を汚染する装置になります。同じ仕組みが、出力先の設計 1 つで薬になることも毒になることもある例です。

## 形の検査は形で破られる

第 2 原則を実践する中で、機械 guard が敗北した記録があります。子供のホーム画面で、活動の件数をストアに書き込み、画面を離れたら戻す、という配線が「生きていること」を守るテストです。テストを 3 回硬化し、3 回とも破られました。

> 「配線が生きていること」を守る test を 3 回硬化し、3 回とも抜けられた。 純関数と store の契約 test は緑のまま、それを呼ぶ側が呼ばなくなっても誰も気づかない。[^rationale18]

3 つの案が試されました。ソースを正規表現で読んで関数名の出現を確認する案は 3 通りで破られました。builder をアロー関数で包む、値を決め打ちで書く、cleanup を別名の定数にする、です。AST で呼び出しの形を確認する案は、import の alias 1 行で外れました。alias を解決して `$effect` のスコープに限定する案も 3 通りで破られました。到達しない分岐で return する、namespace import を使う、局所変数に再束縛する、です。破ったのは adversarial reviewer で、いずれも変異を当ててテストが緑のままであることを実測しています[^rationale18]。

> 共通の構造: v2 は 3 通り、v3 は 3 通り、v4 は 3 通りで破られた。形状検査には常に「次の形」がある。 そして硬化 1 周ごとに adversarial 1 周を消費した。[^rationale18]

採用されたのは、コンポーネントを実際に mount し、unmount をまたいでストアの値を読む振る舞いのテストです。呼んでいるかではなく、その結果どうなるかを見れば、書き方の自由度は問題になりません。

この記録は、本書で繰り返し出てくる fitness function の限界を示しています。構造の検査は「構造がこうなっている」ことは守れますが、「振る舞いがこうなる」ことは守れません。どちらを使うべきかは、守りたい不変条件が構造なのか結果なのかで決まります。

## Dev セッションのアンチパターン

原則の裏側には、Dev セッションが繰り返した行動の一覧があります。アンチパターンの文書から、生成AIに特有のものを引きます[^antipatterns]。

- 「scope 外」を言い訳に問題を放置する。レビューや実装中に気づいた問題は同じ PR で修正する。レビューの場が最も安く直せるタイミングだからです
- テストの assertion を弱める。`toBeTruthy()` や `.not.toBeNull()` への置換は、テストは通るが欲しい挙動を検証していない状態を作ります
- CI 通過前の Ready 化。原因が自分の変更でなくても、その場で修理 PR を出します
- Dev が自律的に QM を呼んで merge まで完結させる。役割の越境で、[第Ⅳ部-3](maker-not-approver) の分離を空洞化させます

QM の修正パターンの文書には、自己申告の限界も記録されています。Dev の self-review で「PASS」と宣言したのに QM の再レビューで実態は FAIL、という事象が 3 PR 連続で起きました。以後、各観点に機械検証のコマンドとローカルでの実行結果を必ず添付し、証跡のない「PASS」は偽の PASS と同等に扱います[^qmfix]。

## 横展開の忘れ

もう 1 つ、生成AIに特有の失敗があります。1 か所を変えると、並行して同じ概念を持つ場所が複数あり、そのどれかを忘れることです。機能変更の横展開を扱う文書には、実際の被害が書かれています。データベースのスキーマを変えるとき、テーブル定義、起動時の CREATE TABLE、構造変更とデータコピーを担う起動時マイグレーションの 3 つを同期する必要がありました。構造変更だけを行いデータコピーを忘れた結果、セルフホスト環境の利用者データが消失しました[^lateral]。

対策は、変更の種類ごとに横展開すべき SSOT 群を表にしておくことです。LP の訴求、法務文書、プリセット、データベース、チュートリアルのそれぞれについて、1 つを変えたらどこを見るかが列挙されています。本書の第Ⅵ部で扱う並行実装レジストリは、この表の発展形です。

## 60 点で止まる理由

この章の記録を通して見ると、60 点で止まる理由がはっきりします。AI は個別の不具合を直せます。しかし「同じ種類の不具合」を認識して class として潰すこと、検査が検査になっているかを疑うこと、直した結果として生まれる follow-up の総量を制御することは、放っておいてはできません。ADR-0061 の 5 原則は、その 3 つを人間の注意ではなく機構に落とす試みです。そして原則自身が自らを縛りすぎたとき、実測に基づいて適用範囲を絞りました。100 点に寄せる工程は、原則を書くことではなく、原則が生む副作用を測り続けることでした。

[^adr61]: ADR-0061「band-aid サイクル打破 + shift-left の機械強制」。コンテキスト、5 原則、原則 2 の発火の前倒し、2026-07-30 の適用対象の限定（装置コード 51,607 行 / 製品コード 67,687 行、check script 63 本、直近 20 PR 中 12 本が装置の修理）。出典: [docs/decisions/0061-band-aid-breaking-shift-left-mechanization.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0061-band-aid-breaking-shift-left-mechanization.md)

[^treadmill]: follow-up の踏み車の根本原因調査。19 PR merge で open が 140 → 144 に増えた観察、真因 G1〜G4 の寄与度、介入の優先順位。出典: [docs/research/2026-06-29-followup-treadmill-root-cause.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/research/2026-06-29-followup-treadmill-root-cause.md)

[^rationale18]: 配線の fitness function を形状検査から振る舞い検査へ変えた設計理由。3 案が adversarial reviewer に 9 通りで破られた実測。出典: [docs/rationale/18-wiring-fitness-shape-vs-behaviour-rationale.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/rationale/18-wiring-fitness-shape-vs-behaviour-rationale.md)

[^antipatterns]: Dev セッションのアンチパターン集。「scope 外」の放置禁止、assertion の弱体化禁止、CI 通過前の Ready 禁止、役割の越境禁止。出典: [docs/sessions/dev-process/anti-patterns.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/sessions/dev-process/anti-patterns.md)

[^qmfix]: QM の修正パターン集。Dev self-review の「PASS」が 3 PR 連続で実態 FAIL だった事象と、機械検証コマンドの添付義務。出典: [docs/sessions/dev-process/qm-fix-patterns.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/sessions/dev-process/qm-fix-patterns.md)

[^lateral]: 機能変更の横展開の文書。DB スキーマ変更で同期すべき SSOT 群と、データコピーを忘れて利用者データが消失した教訓。出典: [docs/sessions/dev-process/feature-change-lateral-spread.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/sessions/dev-process/feature-change-lateral-spread.md)
