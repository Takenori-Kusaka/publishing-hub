---
title: "第Ⅳ部-3　作成者 ≠ 承認者 ― admin bypass の禁止と QM drift への構造的対処"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

前章までで、一人の開発者が PO / Dev / QM のセッションを分けていることを見ました。この章では、その分離を GitHub 上で物理的に強制した ADR-0022、レビューする側の AI が「ゲート役」から「CI の代弁者」へ滑り落ちる現象を観測した ADR-0056、そしてその対策を費用の理由で一部外した ADR-0068 を扱います。3 つの ADR を並べると、生成AIとの開発で「独立した判断」をどう確保するかの試行錯誤が見えてきます。

## 自分の PR を自分で merge していた

ADR-0022 の背景は率直です。

> PO 1 人体制のため `required_approving_review_count=1` を admin bypass で回避するマージが常態化し、QM レビュー手順が踏まれない PR が main に入り続けた。[^adr22]

GitHub は「承認が 1 件必要」というルールを持てますが、リポジトリのオーナーは管理者権限でそれを迂回できます。一人で開発していれば、迂回は日常になります。ADR-0022 は 3 つの決定でこれを止めました。

1. Ruleset の `bypass_actors` を空配列にし、オーナーを含む全アクターの管理者迂回を禁止する
2. `ganbariquestsupport-lab` という QM 専用のアカウントを作り、承認だけを担わせる
3. 承認コメントの書式を QM の手順書に統一し、実視認の所見と AC の 1 対 1 照合を必須にする

役割分離は「Takenori-Kusaka（Dev）が PR を作成 → ganbariquestsupport-lab（QM）が approve → squash merge」の順です[^adr22]。一人の人間が 2 つの GitHub アカウントを持ち、Dev セッションと QM セッションで別のアカウントを使います。

## 3 層の機械強制

ルールを書いても破られます。ADR-0022 には 6 つの Amendment が積み重なっており、それぞれが「規律に頼った部分が破られた」記録です。Amendment 1 は、QM アカウントに切り替えたまま `gh pr create` してしまう事故経路を塞ぎ、Amendment 3 はそれが 2 回再発したことを受けて 3 層の機械強制を導入しました[^adr22]。

| 層 | 場所 | 捕捉する経路 | 捕捉できない経路 |
| --- | --- | --- | --- |
| L1 | Claude Code の PreToolUse hook | Claude Code からの `gh pr create` | Claude Code 以外の CLI |
| L2 | git の pre-push hook | push を伴う経路 | push 後にアカウントを切り替える経路 |
| L3 | GitHub Actions（`pr-author-guard.yml`） | すべての経路 | — |

L3 のワークフローのコメントは、なぜサーバ側が必要かを説明しています。

> しかし両 hook とも特定 client / 特定タイミング依存で、以下の経路を捕捉できない:
> - Claude Code 以外の CLI / シェル (WSL / Docker / CI ランナー)
> - GitHub Web UI からの PR 作成
> - `gh api repos/.../pulls` 等の REST 直叩き
> - `git push` 通過後に `gh auth switch` → `gh pr create`
> PR #1875 (1 回目) / PR #1982 (2 回目) で実際に違反が再発したため、server side で全経路を捕捉する gate を導入する。[^authorguard]

不許可のアカウントが PR を開くと、ワークフローが即時に PR を close し、違反コメントを投稿し、自身も失敗します。GitHub の PR 作成者は事後に変更できないため、事前防止が必要でした。

Amendment 5 は、自動生成される統合 PR の作成者を GitHub App のボット名義にしました。ボットは approve できないため、なりすましがゼロになり、長命の個人アクセストークンも撤廃できました。ADR は「ADR-0022 が本当に守りたいのは『作成者 ≠ 承認者』だけ」と要点を整理しています[^adr22]。Amendment 6 は逆方向で、QM が書式や AC 文言などの軽微な不備を自分で直して同じ PR を承認することを許しました。些細な指摘の往復が顧客価値の変更を遅らせていたからです。ただし、実装方針を変える修正を QM が書いて自分で承認することは、引き続き禁止です[^adr22]。

## QM が 33 日で 42 回、役割から滑り落ちた

作成者と承認者を分けても、承認者が独立した判断をしているとは限りません。ADR-0056 は、QM セッションが「顧客品質の最終ゲート」から「BLOCK 項目の列挙と CI の代弁」へ滑り落ちる現象を記録しています。

> QM Orchestrator (Claude Code session) が「顧客品質最終ゲート」役割から「BLOCK 列挙 / CI proxy」役割に drift する事象を 33 日で 42 回観測。memory / ADR / checklist の追加 (5 回試行) は再発率を変えなかった。[^adr56]

原因は 4 つの類型に整理されています[^adr56]。多段の会話で役割が薄まる Persona Drift。Dev の主張を肯定的に反復して独立した判断が消える Echoing。「ここまで事故ゼロ」の累積が逸脱を許容と再定義する Normalization of Deviance。そして「CI 全 PASS + BLOCK 列挙」が目標になり、本来の顧客判断が代理指標に置き換わる Goodhart's Law です。

指示を書き足しても直らなかった理由も、文献を引いて説明しています。指示による役割の強化は「演じる」能力を強化するだけで、drift の引き金には対処しない。自己監視は判断の対象が広く評価的な場合に精度が下がり、drift 中のエージェントは drift を否認する。文脈に入れる文書が増えるほど、重要な指示が参照されにくくなる[^adr56]。「42 回再発はこの理論群と整合する。agent 内部の自覚に依存しない構造的対処が必要である」というのが結論でした。

採用された対策は 2 つです。1 つは Adversarial Reviewer という subagent で、business / UX / security の 3 軸からそれぞれ反対理由を出力する構造化された schema を強制します。構造化された応答の強制が Echoing を大きく減らすという研究結果が根拠です。もう 1 つは PreToolUse hook で、承認や merge のコマンドを検出します。Adversarial Reviewer の出力ファイルが存在し、30 分以内に生成され、schema を満たしていなければ物理的に block します[^adr56]。

hook の設計には、迂回を防ぐ細かな配慮があります。Bash だけを対象にすると PowerShell 経由で hook 自体が起動せず迂回できるため、コマンド実行系のツール全経路を対象にする。入力を判別できない場合は allow ではなく block に倒す。PR 番号が確定できない書き方なら block する。それでも塞げない経路は、事後に review 一覧と証跡を突き合わせる検知層が報告します。「列挙型の防御は原理的に『次に増える経路』を先回りできない」と、塞いだ範囲を過大評価しないことも明記されています[^adr56]。

## 統制を外す判断

ADR-0056 の hook は、2026-08-13 の ADR-0068 で呼び出しを外されました。理由は drift が起きなくなったからではありません。

> 経過時間は「独立した判断を経たか」の代理指標として弱い。 所見を深く書くほど、また CI 待ちが長いほど evidence が失効する。つまり遮断は、防ぎたい行動 (雑な approve) より防ぎたくない行動 (丁寧なレビュー) を強く罰していた。[^adr68]

30 分の TTL は、丁寧にレビューするほど、CI を待つほど、証跡を失効させました。ADR-0068 は 3 つの選択肢を比較しています。hook を外してロール定義と憲章の遵守で保つ案、GitHub 標準の required review に寄せる案、TTL を緩めて hook を残す案です。GitHub 標準の required review は「誰が押したか」しか見ず「独立した判断を経たか」は見ないため、agent が承認者である現在の運用では目的を満たしません。TTL を緩める案は、緩めるほど代理指標としての意味が薄れます。

> 外す根拠は「drift が起きない」ではない。 ADR-0056 が観測した 42 回の drift は有効な観測として残す。根拠は費用と段階である — 立ち上げ期に統制を厚くすると、統制の維持費が統制が防ぐ損失を上回る。本件はその実例だった。[^adr68]

hook 本体とテストは消さず、呼び出しだけを外しました。受容するリスクは 3 つ明記されています。証跡なしで承認できること、drift の再発を機械では検出できなくなること、そして「42 回という観測が『解決済み』と誤読される」ことです。3 つ目のリスクへの対処が、ADR-0056 の本文を残しステータスだけを置き換えにした理由です[^adr68]。統制は「いつか厳しくする」では戻らないため、ブランチ戦略の段階と紐づけて戻す条件が表になっています。

この判断は、前章で見た憲章 §0 の「80 点で止める」と同じ線上にあります。統制の維持費が、統制が防ぐ損失を上回る点があり、立ち上げ期はその点が近い。ADR-0056 と ADR-0068 を並べて残すことで、リポジトリは「何を観測し、何を試し、なぜ外したか」を後から辿れます。

## 逃げ口上の禁止

承認の独立性とは別に、作る側の言葉にも統制があります。「Forbidden Escape Language」という文書は、未完成の実装を完了として報告するときに使われる 12 の語を禁止しています。

> 過去 7 回 (Issue #531 / #561 / #562 / #563 / #566 / #2069 / PR #2099) で発生した shim / haribote 完了報告 の構造的原因は、Dev / Reviewer Agent が「Tier N で統合」「POC scope」「等価性維持」等の 逃げ語 で issue close / PR merge を正当化してきたこと。[^escape]

| 分類 | 語 | 禁止理由 |
| --- | --- | --- |
| scope / Tier / POC | 「Tier N で統合」「POC scope」「scope 外」 | 統合を無期限に延伸し、大きすぎる scope の問題を別 Issue 化して放置する |
| 等価性 / 足場 | 「等価性維持」「足場として」「逆輸入回避」「demo 寄せ統合」「snapshot patch」 | 見た目が一致すれば実体が不一致でもよいと読み替え、本体の実装に到達しないまま完了を報告する |
| 時間先送り | 「とりあえず」「一旦」「次フェーズで」「demo と本番の UI 差分は許容範囲」 | 「動く」を品質と誤認し、起票なしの先送りを永久放置にする |

禁止するだけでは、AI は別の言い回しを見つけます。文書は救済策を用意しています。禁止語を本当に使う必要があるなら、その正当性を ADR として起票するか、期日と責任者と完了判定基準を明記した Issue を起票し、PR 本文に明記します[^escape]。[第Ⅰ部-5](pre-pmf-scope) で見た「Pre-PMF」の誤用禁止と同じ構造で、判断基準には、それが言い訳に転用されるパターンまで書きます。

## 一人で「独立した判断」を持つには

この章の 3 つの ADR は、同じ問いに答えようとしています。一人の人間と AI のセッションだけで、どうすれば「独立した判断」を持てるのか。答えは段階的です。まずアカウントを分けて、物理的に自分の PR を承認できなくする。次に、承認する側が形式だけの承認に滑り落ちることを観測し、構造化された反対意見と物理的な遮断を入れる。そして、遮断の維持費が損失を上回ると分かったら、観測を残したまま遮断を外し、戻す条件を書いておく。

完成した答えではありませんが、どこまで試して何が分かったかは、すべてリポジトリに残っています。

[^adr22]: ADR-0022「admin bypass 禁止と ganbariquestsupport-lab QM Approve 体制の確立」。背景、3 つの決定、Amendment 1〜6（PR 作成禁止、Dependabot auto-merge、3 層機械強制、統合 PR の作成者、GitHub App ボット名義化、QM の自己修正 push 許可）。出典: [docs/decisions/0022-admin-bypass-disable-qm-approve.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0022-admin-bypass-disable-qm-approve.md)

[^authorguard]: PR 起票アカウント違反のサーバ側ゲート。L1 / L2 の hook が捕捉できない経路の列挙と、2 回の再発。出典: [.github/workflows/pr-author-guard.yml](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/pr-author-guard.yml)

[^adr56]: ADR-0056「QM Orchestrator role drift の構造的対処」。33 日で 42 回の観測、4 つの原因類型、文献根拠、4 つの選択肢の比較、PreToolUse hook と Adversarial Reviewer の設計。出典: [docs/decisions/0056-qm-drift-prevention-by-structural-agent-constraint.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0056-qm-drift-prevention-by-structural-agent-constraint.md)

[^adr68]: ADR-0068（QM approve の物理遮断を立ち上げ期に外し、統制を段階的に戻す決定）。30 分 TTL が丁寧なレビューを罰する構造、3 つの選択肢、受容するリスク、戻す条件と段階。出典: [docs/decisions/0068-approve-gate-removal-staged-control.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0068-approve-gate-removal-staged-control.md)

[^escape]: Forbidden Escape Language SSOT。過去 7 回の shim / haribote 完了報告、禁止語 12 語の 3 分類、救済策。出典: [docs/decisions/forbidden-escape-language.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/forbidden-escape-language.md)
