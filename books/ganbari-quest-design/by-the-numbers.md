---
title: "第Ⅷ部-1　数字で見る 7 か月 ― commit、PR、Issue、モデルの遷移、prompt、token、そして費用"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

第Ⅷ部は、数字と学びです。ここまでの 7 部で「何を作り、どう作ったか」を見ました。最後の 4 章では、それを数えて失敗を並べ、原則に畳んで残ったものを書きます。この章は、2026-02-19 から 09-16 までの 210 日を、git、GitHub、そして著者の手元にある Claude Code のログから数えます。数えられるものと数えられないものを分け、推定は推定と書きます。取り方はすべて脚注にあります。

## 量

| 項目 | 値 | 出典 |
| --- | --- | --- |
| commit（main に到達） | 2,985 | git |
| commit（全 branch、squash 前を含む） | 6,189 | git |
| PR | 2,397（merge 2,238。main 向け 1,229、develop 向け 1,009） | GitHub |
| Issue | 2,564（close 2,533、open 31） | GitHub |
| `src/` のファイル | 1,096（TypeScript と Svelte で約 19.9 万行） | git |
| テストファイル | 1,102 | git |
| 番号付き設計書 / ADR / runbook | 46 / 37 / 23 | git |
| workflow / skill / script | 33 / 26 / 92 | git |

1 日あたり、main の commit が 14、merge された PR が 10.7、Issue の起票が 12.2 です。人が書いた commit は共著記録で 444 で、全体の 15% です[^git]。

## 月ごとの波

| 月 | commit（main） | commit（全 branch） | PR merge | Issue 起票 | prompt |
| --- | --- | --- | --- | --- | --- |
| 2026-02 | 22 | 22 | 0 | — | 90 |
| 2026-03 | 361 | 505 | 29 | — | 622 |
| 2026-04 | 957 | 1,869 | 652 | — | 1,830 |
| 2026-05 | 396 | 619 | 380 | 37 | 875 |
| 2026-06 | 377 | 582 | 367 | 370 | 741 |
| 2026-07 | 373 | 463 | 358 | 276 | 857 |
| 2026-08 | 384 | 1,911 | 341 | 291 | 771 |
| 2026-09（16 日まで） | 115 | 218 | 111 | 26 | 212 |

commit は 4 月と 8 月に山があります。main に到達した数は 4 月の 957 が最大ですが、squash 前の全 branch で数えると 8 月が 1,911 で 4 月に並びます。8 月は [第Ⅶ部-2](branch-strategy-evolution) の develop 二層の下で、branch 上の commit が squash されて main に 384 として届いた月です。同じ量の仕事が、見える数で 5 分の 1 になっています[^git]。

Issue の起票は直近 1,000 件だけを取れたので、5 月末からです。prompt は著者の Claude Code の履歴で、がんばりクエストの作業ディレクトリに向けたものを数えました。作業ディレクトリはロール別の clone を含めて 8 か所に分かれていて、合計 5,998 件、全プロジェクトの 8,288 件の 72% です[^prompts]。

## 速さ

直近 1,000 件の PR（2026-06-15 から 09-13）は、作成から merge までの中央値が 1.9 時間、p25 が 0.8 時間、p75 が 13.6 時間です。サイズの中央値は 240 行、p75 は 596 行。作成者は Takenori-Kusaka が 917、dependabot が 57、統合 bot が 26 です[^gh]。

直近 1,000 件の Issue（05-30 から 09-13）は、作成から close までの中央値が 110.7 時間、p25 が 31.5 時間、p75 が 306.4 時間です。1,000 件のうち wontfix が 98、duplicate が 47。[第Ⅳ部-2](label-mailbox) で見た `state:*` の label は 251 件に付いています[^gh]。

PR の 1.9 時間は、[第Ⅳ部-1](one-human-many-sessions) の QM セッションが毎時レビューする体制の実測です。Issue の 110 時間は、起票から着手までの待ちを含みます。

## モデルの遷移

commit の共著記録に現れる Claude のモデルは、7 つです。

| モデル | commit | 初出 | 最盛期 |
| --- | --- | --- | --- |
| Opus 4.6 | 1,233 | 2026-02 | 4 月（全 branch で 1,802） |
| Opus 4.7 | 1,135 | 2026-04 | 5 月 |
| Sonnet 4.6 | 288 | 2026-04 | 4 月 |
| Opus 4.8 | 1,227 | 2026-06 | 6 月 |
| Fable 5 | 896 | 2026-06 | 7 月 |
| Opus 5 | 1,386 | 2026-07 | 8 月 |
| Sonnet 5 / Fable 5.1 | 35 / 109（全 branch） | 2026-07 / 2026-09 | — |

モデルは、Anthropic が出すたびに乗り換えました。乗り換えの判断は記録されていません。共著記録が、いつ何を使っていたかの、たった 1 つの証拠です[^git]。

## token

token は、Claude Code が手元に残す JSONL のログから数えられます。ただし、ログは 30 日で整理されるため、2026-08-07 から 09-16 までの 21 日分しかありません。全期間の値は、この標本から推定するしかありません[^tokens]。

21 日分の実測は、こうです。

| 項目 | 値 |
| --- | --- |
| セッション | 36 |
| assistant の turn | 88,352 |
| ツール呼び出し | 86,158（Bash 71,469、Edit 4,323、Read 3,445、Write 3,228） |
| 出力 token | 4,281 万 |
| 思考 token | 1,146 万 |
| キャッシュ読み取り token | 263.9 億 |
| キャッシュ作成 token | 5.57 億 |
| 入力 token（キャッシュ外） | 103 万 |

ロール別では、QM が 56,174 turn（64%）、Dev が 24,653、PO が 5,577、監査が 1,834、Platform が 114 です。モデル別では、Opus 5 が 64,464 turn、Sonnet 5 が 10,856、Fable 5 が 10,010、Fable 5.1 が 2,659 です。QM がこれほど多いのは、毎時のレビューと fix の往復が turn として積まれるためです[^tokens]。

1 日あたりに直すと、出力 token が約 204 万、turn が約 4,200、ツール呼び出しが約 4,100 です。全期間 210 日に単純に掛けると、出力 token は約 4.3 億、キャッシュ読み取りは約 2,600 億になります。ただし 8 月は commit が最多の月で、この標本は忙しい方に偏っています。全期間の実値はこれより少ないと考えるのが自然です。

キャッシュ読み取りが出力の 600 倍あることは、[第Ⅵ部-1](claude-md-hierarchy) の「常時ロードされる 16 万バイト」の実測です。毎 turn、同じ文脈が読み直されます。

## 費用

| 費目 | 額 | 備考 |
| --- | --- | --- |
| Claude Code | Claude Max の定額 × 7 か月 | 従量ではない。token が増えても請求は変わらない |
| AWS | 6 月 1.44 ドル、7 月 1.32 ドル、8 月 3.19 ドル | [第Ⅲ部-1](serverless-cost) の実測 |
| Bedrock（AI 提案） | 月 0.0006 ドル | Haiku 4.5 と Sonnet 4.6。[第Ⅱ部-11](ai-suggest) |
| Gemini（画像生成、brief） | 少額の従量 | [第Ⅱ部-17](image-assets)。金額の記録なし |

開発の費用は、ほぼ Claude Max の定額です。定額の意味は、[第Ⅵ部-1](claude-md-hierarchy) で見た #4210 の逼迫にあります。週間のリミットがあり、枯渇すればリリースが止まる。金額ではなく、リミットが制約でした。

顧客数、売上、家族の実使用は、この本には書きません。[第Ⅰ部-5](pre-pmf-scope) で見たとおり Pre-PMF の段階で、それらは判断の材料であって公開の材料ではありません。

## 従量で払っていたら

定額の意味を測るために、21 日分の token を公開の API 単価で換算します。単価は 2026 年 9 月時点の Claude API の一覧から取り、キャッシュ書き込みは 5 分の単価で見ます[^pricing]。

| モデル | turn | 換算（ドル） | うちキャッシュ読み取り |
| --- | --- | --- | --- |
| Opus 5 | 64,464 | 約 13,700 | 約 10,300 |
| Fable 5 | 10,010 | 約 2,900 | 約 1,900 |
| Sonnet 5 | 10,856 | 約 800 | 約 570 |
| Fable 5.1 | 2,659 | 約 600 | 約 250 |
| 合計 | 87,989 | 約 18,000 | 約 13,000 |

21 日で約 1 万 8 千ドル、1 日あたり約 850 ドルです。キャッシュ書き込みを 1 時間の単価で見ると約 2 万ドルになります。この 21 日が 7 か月のあいだ同じ密度で続いたと仮定すると、210 日で約 18〜20 万ドル、1 ドル 150 円なら約 2,700〜3,000 万円です。標本は commit が最多の 8 月を含み、忙しい側に偏っているので、実値はこれより少ないはずです。それでも桁は変わりません。

内訳で目を引くのは、費用の 7 割がキャッシュ読み取りであることです。出力 token の費用は全体の 6% しかありません。毎 turn、常時ロードの指示書と会話の履歴が読み直され、その量が費用を決めています。[第Ⅵ部-1](claude-md-hierarchy) で 16 万バイトを減らした判断は、従量で払っていれば請求額の話でした。定額では、週間のリミットの話です。

もう 1 つ、ロール別の turn です。QM が 64% を占めます。レビューと fix の往復が、そのまま turn として積まれるからです。従量なら、レビューの費用が実装の費用の 2 倍という数字が出ます。

## 数えられないもの

数えられなかったものを書いておきます。

- 2026-08-06 以前の token。ログが整理されていて残っていません。`stats-cache.json` に 1〜4 月の日次の message 数（4 月は 30,338 message、28,610 tool call）がありますが、他のプロジェクトを含み、token ではありません
- 人が費やした時間。prompt の 5,998 件が近似ですが、1 件あたりの時間は分かりません
- 「AI が書いた行」と「人が書いた行」の区別。commit の共著記録は commit 単位で、行単位ではありません。共著に人の名が無い commit も、人が読んで承認しています

## 今ならこうする

数えるなら、初日から数えるべきでした。token のログは 30 日で消えます。7 か月の全期間を持っているのは git と GitHub だけで、それは「何が起きたか」を持ちますが「何を費やしたか」を持ちません。日次でログを別の場所に写す 1 行の cron があれば、この章の「推定」は「実測」になっていました。

数字で見て分かったのは、1 日 14 commit と 10 PR という速度が、7 か月ほぼ一定だったことです。モデルが 7 回変わっても、branch 戦略が 3 回変わっても、速度は変わりませんでした。変わったのは、[第Ⅴ部-1](pre-ready) と [第Ⅶ部-4](actions-portfolio) で見た「何を通すか」の方です。

[^git]: git の実測。commit は `git rev-list --count main` と `git log --format=%ad --date=format:%Y-%m`。全 branch は `git log --all` を SHA で重複除去。共著は `git log --format=%b | grep -i co-authored-by`。ファイル数は各月初の tree を `git ls-tree` で数えた（2026-09-16、main 3af6c2e）。出典: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest/tree/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0)

[^gh]: GitHub の実測。総数は search API（`is:pr is:merged base:main` 等）、cycle time と close 時間は `gh pr list` / `gh issue list` の直近 1,000 件から算出（2026-09-16）。出典: [Pull requests](https://github.com/Takenori-Kusaka/ganbari-quest/pulls?q=is%3Apr+is%3Amerged)、[Issues](https://github.com/Takenori-Kusaka/ganbari-quest/issues?q=is%3Aissue)

[^prompts]: 著者の Claude Code の履歴（`~/.claude/history.jsonl`）を、作業ディレクトリのパスに `ganbari` を含むものと全体で月別に数えた。集計スクリプトは Gemini CLI に書かせ、入力は読むだけで、移動と削除はしていない。出典: [Claude Code のドキュメント](https://code.claude.com/docs/en/overview)

[^pricing]: Claude API の単価（2026 年 9 月）。Opus 5 は入力 5 ドル、出力 25 ドル、キャッシュ読み取り 0.5 ドル、キャッシュ書き込み 6.25 ドル（5 分）/ 10 ドル（1 時間）、いずれも 100 万 token あたり。Sonnet 5 は 2 / 10 / 0.2 / 2.5 / 4、Fable 5 は 10 / 50 / 1 / 12.5 / 20、Fable 5.1 は 10 / 50 / 0.25 / 12.5 / 20 ドル。出典: [Claude API の pricing](https://platform.claude.com/docs/en/about-claude/pricing)

[^tokens]: 著者の Claude Code のセッションログ（`~/.claude/projects/` 配下の JSONL）の `message.usage` を、`message.id` で重複除去して集計した。対象はがんばりクエストの 5 つのロールの作業ディレクトリ、期間は残っていた 2026-08-07 から 09-16 の 21 日分。出典: [Claude Code のドキュメント](https://code.claude.com/docs/en/overview)
