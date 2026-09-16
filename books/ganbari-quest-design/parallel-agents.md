---
title: "第Ⅳ部-6　並列 Agent の運用 ― teammate の使いどころと、並走が壊すもの"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

生成AIのセッションは、subagent を起動して仕事を分担できます。並列にすれば速くなるように見えます。この章では、がんばりクエストがどこまで並列化を許し、どこで禁じたか、そして並走が実際に何を壊したかの実測を扱います。結論を先に書くと、並列化で速くなるのは「読む・調べる・書く」だけで、検証は速くならず、teammate の報告は届かないことがあります。

## 3 つの並列化手段

運用文書は、並列化の手段を 3 つに整理しています[^teams]。

| 手段 | 特徴 | 限界 |
| --- | --- | --- |
| subagent | 呼び出し元にだけ結果を返す | agent 同士が会話できない。互いの発見を突き合わせられない |
| 別クローン・別セッション（PO / Dev / QM / 監査） | 完全に独立 | セッション間の直接通信手段が無い。GitHub の label を mailbox にして凌いでいる |
| Agent Teams | 独立した context window を持つ teammate が、共有タスクリストと mailbox で直接メッセージを送れる | 後述の制約 |

Agent Teams は 2 つの中間にあり、「複数の仮説を並列に検証し、互いに反証させる」形の調査ができます。subagent は結果を返すだけで、A の発見を B が引き取って潰す、という往復が起きません。

## ロールを跨ぐ team は組まない

最も重要な制約は、team をロールごとに独立して構築し、ロールを跨がないことです。Dev のセッションが QM の teammate を起動する、という構成は禁止です。

> gh アカウントが lead のものになる。teammate は lead の作業ディレクトリ・環境で動く。Dev クローン（`Takenori-Kusaka`）から spawn した teammate は、QM を名乗っても `ganbariquestsupport-lab` にはならない。PR を作った本人が approve できる状態が生まれ、ADR-0022 が空洞化する[^teams]

teammate は lead の環境、権限、GitHub の認証を継承します。[第Ⅳ部-3](maker-not-approver) で見た「作成者 ≠ 承認者」は GitHub アカウントの分離で担保されているため、同じ環境で動く teammate に別のロールを演じさせても分離は成立しません。5 つの team は互いを知らず、受け渡しは引き続き label mailbox で行います。Agent Teams はロール間通信の代替ではなく、1 ロール内の並列化手段です[^teams]。

## 重い検証を並列化しても速くならない

2 つ目の制約は、テストや型検査を並列化する目的で teammate を使わないことです。理由は `heavy` lock にあります。

> `heavy` lock はマシン全体で 1 本である。
> `heavy = pre-ready / vitest / playwright test / svelte-check / npm run test|check|e2e`
> teammate を 5 人にしても、この 5 種は 1 本ずつ順番に流れる。 残り 4 人は hook に exit 2 で止められて待つだけで、トークンだけ消費する。[^teams]

この lock は、並走が実際に結果を壊した経験から生まれました。並走の管理を扱う文書は、2026 年 7 月末の実測を表にしています[^concurrency]。

| 日時 | 事象 | 影響 |
| --- | --- | --- |
| 2026-07-26 | 同一 worktree を 2 セッションが相互に上書き | 作業消失 |
| 2026-07-26 | 同じ PR の pre-ready が 2 本同時に起動 | 片方は必ず捨てられる純粋な無駄 |
| 2026-07-27 | 重い検証が 8 本並走（pre-ready 4 本、vitest 4 本） | 全員の結果が汚染 |
| 2026-07-27 | 単独なら 17 分の全ユニットテストが並走時 29 分、タイムアウト 5 件（assertion の失敗は 0 件） | 負荷が偽の red を作る |

> 並走の害は「遅くなる」ではない。結果そのものが根拠として使えなくなることである。落ちても通っても、それが実装のせいなのか負荷のせいなのか切り分けられない。この汚染された結果を引用すると誤診が下流へ伝播する。[^concurrency]

対策は、リポジトリの外に置いた lock ファイルと、それを強制する PreToolUse hook です。lock は `~/.buzz/.locks/<key>.lock` にあり、checkout や worktree が複数あっても同じマシンなら同じ lock を見ます。TTL は 60 分です[^concurrency]。

lock の実装にも落とし穴がありました。lock の持ち主を hook の親プロセスの ID で判定していたところ、hook の親プロセスは呼び出しごとに生成と消滅を繰り返す短命なプロセスでした。実測では、同じセッションの lock 5 本がすべて別の持ち主 ID を記録し、取得の 1 分後には全て「死亡」と判定されていました。再入の判定が効かず、解放が常に no-op になり、lock が取得直後から失効する、という三重の破綻で「排他はまったく成立していなかった」と文書は記しています。「hook が入っている」ことと「排他が効いている」ことは別です[^concurrency]。修正後は、祖先のプロセスツリーを辿って常駐のセッションプロセスを持ち主にしています。

もう 1 つの設計判断は fail closed です。lock ディレクトリが読めない、lock ファイルが壊れているなど、排他が成立しているか判定できない状態では、通さずに block します。判定できないまま重い検証を走らせると、汚染された結果を根拠に使ってしまうからです[^concurrency]。[第Ⅳ部-4](definition-of-done) で見た「検査できなかったのに pass」の逆を、ここでも徹底しています。

## トークンの残量

3 つ目の制約は費用です。teammate 1 人ごとに context window が独立し、トークンは線形に増えます。3 人で約 3〜4 倍です。週間の上限が枯渇すると全レーンが止まり、hotfix も打てなくなります。運用文書の定めは 3 つです[^teams]。残量がリリース 1 回分（約 15%）を割ったら teammate を起動しない。どうしても並列化するなら 1 人まで。かつ「成果物がファイルに残る仕事」に限る。

「逼迫時に最も高くつくのは空振り」だと文書は書いています。teammate が出力を返さず lead が引き取ると、同じ仕事へ 2 回払うことになるからです。

## 報告は届かないことがある

teammate の使い方には、2026-08-01 の初回実運用で分かった 4 つの注意があります[^teams]。

1 つ目は、成果物がファイルに残る仕事を振ることです。

> 実測: 名前を付けた teammate 3 名のうち、2 名は報告テキストが lead に届かなかった（idle 通知のみ）。うち 1 名（`charter-wiring`）は 5 ファイルを正しく編集し終えていた — lead が `git diff` を見なければ「何もしていない」と誤判定するところだった。[^teams]

読み取り専用の調査でも、出力先のファイルを指定します。同じ構成で「結果をファイルに書き出せ」と指示し直したところ、468 行の調査結果が問題なく受け取れました。

2 つ目は、完了を lead が自分で確認することです。`git diff` やファイルの存在で見ます。「終わった」という報告が来ないことと、終わっていないことは別です。

3 つ目は、teammate の出力を実物と突き合わせることです。

> 実測: teammate が `docs/codebase-map.md` に 存在しない Issue 番号を書いた（番号自体は実在するが完全に別件）。lead が `gh issue view` で確認しなければ、そのまま SSOT に入っていた。
> teammate は推測で埋める。 lead が「実測していないことを断定しない」規律を持っていても、teammate はそれを継承しない。[^teams]

4 つ目は、1 度に振る量を絞り、空振り 2 回で引き取ることです。「12 件を裏取りして 3 分類で判定」は一度に投げる量ではありませんでした。4 件に絞っても出力が出ず、lead が自分で調べたところ数分もかからず終わりました[^teams]。

本書の執筆でも、この規律を使いました。設計書や ADR の要約は Gemini に振り、出力先をファイルに指定し、数値や Issue 番号は原典で裏を取っています。

## worktree と push の落とし穴

subagent を並列に使うときの実務上の注意も、文書に蓄積されています[^parallelops]。

隔離された worktree は生成時に `node_modules` を持ちません。依存が欠落したまま検査を回すと、変更と無関係な大量のエラーが出て「品質ゲートを通した」証跡が空振りします。対策として、検査の CLI は着手前に依存の存在を検査し、欠落していれば「worktree では先に `npm ci`」の案内付きで止まります。

複数の Agent が同じ branch に push すると、ローカルの参照が古くなり、push に失敗した Agent が「push 済み」と報告することがあります。教訓の欄にはこうあります。

> 教訓: 4 Agent が "push 済" 報告したが、後続 Agent は local ref が stale で force-with-lease reject され push 失敗していた。各 Agent は「stale で reject」と認識せず「push 済」と報告していた。[^parallelops]

対策は GitHub API で remote の実 SHA を取得し、Agent の報告と突き合わせることです。Agent の報告は trust but verify、つまり信頼するが検証します。

stacked PR、つまり feature branch を base にした PR は採用しません。GitHub Actions のワークフローとゲートは base が develop か main のときにしか動かず、積み重ねた PR では検証が走らないからです[^parallelops]。並列に作った変更は、直列で develop に merge します。

## 並列化の正しい使いどころ

この章の制約を裏返すと、並列化の効く場面が見えます。読み取り専用の調査を 10 件以上に分担するとき、独立した新規モジュールをフロントエンドとバックエンドで分けて実装するとき、複数の仮説を互いに反証させたいときです。監査ロールが「Agent Teams と最も相性がよい」とされる理由は、8 つの領域を独立した観点で並列に調べて結果を集約する形と、teammate の割り当てがそのまま対応するからです。次の章でその監査チームを扱います。

[^teams]: Agent Teams の運用文書。3 つの並列化手段、ロールを跨がない理由、重い検証を並列化しない理由、トークン残量が逼迫したときの判断基準、2026-08-01 の初回実運用で得た振り方の注意（報告が届かない、推測で埋める、空振り 2 回で引き取る）。出典: [docs/sessions/agent-teams.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/sessions/agent-teams.md)

[^concurrency]: 同一マシン上の複数エージェントの排他を扱う文書。2026-07-26 / 27 の実測表、`heavy` lock の実体と TTL、持ち主の生存判定が破綻していた経緯、fail closed の設計。出典: [docs/sessions/agent-concurrency.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/sessions/agent-concurrency.md)

[^parallelops]: 並列 Agent 運用の実務メモ。worktree の `npm ci`、push 済み報告の検証、stacked PR を採用しない理由。出典: [docs/sessions/dev-process/parallel-agent-ops.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/sessions/dev-process/parallel-agent-ops.md)
