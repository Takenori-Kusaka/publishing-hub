---
title: "第Ⅶ部-1　モノレポと生成物の置き場 ― tmp/、screenshots ブランチ、履歴の書き換え、30MB を 24 回 commit する"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

第Ⅶ部は「どう作ったか」の最後で、リポジトリそのものと Git の運用を扱います。第Ⅳ〜Ⅵ部で決めた体制と検証と文脈は、最終的にリポジトリの形に現れます。この章は、1 つのリポジトリにアプリ・CDK・LP・設計書を同居させた判断と、生成AIが量産する生成物（スクリーンショット、調査メモ、ロゴ候補、ナレッジグラフ）をどこに置くかの判断です。判断の記録は `.gitignore` の 160 行にあります。

## 1 つのリポジトリ

トップレベルのディレクトリは 12 個です。`src/`（SvelteKit）・`infra/`（CDK と NUC の構成）・`site/`（LP の静的 HTML）・`docs/`・`tests/`・`scripts/`（92 本）。`static/`・`drizzle/`・`actions/`（GitHub Actions の composite action）・`eslint-plugin-local/`・`data/`・`graphify-out/`。別リポジトリに分けたものはありません[^codebasemap]。

分けなかった理由は、書かれていません。最初の commit の時点で `docs/design/` と `src/` の構想が同じ CLAUDE.md にあり、2026-03-17 に `deploy.yml` が入ったとき CDK も同じ場所に置かれました。結果として、この本で見た機構の多くはモノレポを前提にしています。[第Ⅲ部-8](lp-delivery) の LP の文言は `labels.ts` から生成され、[第Ⅵ部-2](design-doc-ssot) の「設計書の更新は Done 基準」は同じ PR で設計書とコードを変えることを求めます。[第Ⅴ部-4](fitness-functions) の fitness function は、docs のパスを test が読みます。リポジトリを分けていたら、どれも別の仕組みが要りました。

一人と AI のセッションが相手なら、モノレポの不利益（権限の分離、ビルドの分離）はほぼありません。利益（1 つの PR で全部を変える）だけが残ります。

## 生成物の行き先

生成AIは、コード以外のものを大量に作ります。7 か月で作られた生成物の行き先は 5 つに分かれました。

![生成物の行き先](/images/ganbari-quest-design/monorepo-and-artifacts.png)

1 つ目は main です。設計書、ADR、runbook、そして [第Ⅵ部-4](graphify) の `graphify-out/`。「現状の正解」として参照され続けるものです。

2 つ目は orphan の branch です。`screenshots` branch は 2026-04-27 に「init: screenshots orphan branch」で作られ、PR の証跡のスクリーンショットだけを 5,175 ファイル持っています。main の履歴には入らず、PR の本文から raw URL で参照されます。[第Ⅴ部-6](pr-body-gates) で見た「SS の blob SHA の一意性」gate は、この branch を読みます[^ssbranch]。

3 つ目は GitHub 自体です。PR の証跡は「GitHub PR に直接アップロードすること。git 管理不要」で、`docs/pr-screenshots/` は ignore されています。Issue の本文、PR の本文、GitHub の CDN が置き場です[^gitignore]。

4 つ目は `tmp/` です。調査メモ、監査の evidence、一時的な script。`.gitignore` の「Temporary files」に `tmp/` と `.scratch/` があり、この本を書いている publishing-hub の clone も `tmp/` の下にあります。[第Ⅵ部-2](design-doc-ssot) の research 配置規律は、one-off の調査を `docs/research/` に commit せず、結論だけを設計書に内包して詳細は git に委ねる、と定めています。`tmp/` はその「委ねない」側の受け皿です[^docsclaude]。

5 つ目は削除です。それも、履歴からの削除です。

## 履歴を書き換える

`.gitignore` には、こういう行があります。「Logo candidates (deleted from history via git filter-repo in #1443)」「一時 screenshots / 旧 PR アセット / 孤児 sound は履歴から filter-repo で抹消済み（main 追跡禁止）」[^gitignore]。

2026-04-04 の #379 は「不要ファイル・ディレクトリの削除 + git 履歴からの除去」で、[第Ⅵ部-2](design-doc-ssot) で見た最初の入力 `docs/input/first-input.md` はこのとき消えました。2026-04-24 の #1443 は、[第Ⅱ部-17](image-assets) で見たロゴ候補 18 枚のディレクトリを git filter-repo で履歴ごと削除しました。asset-catalog がそのディレクトリを参照し続けているのに main に無いのは、このためです[^issue1443]。

履歴の書き換えは、リポジトリ全体の force push です。その 6 日後の 2026-04-30、ADR-0026 が「致命修正コミットの force push による消失防止」を決めました。契機は PR #1717 で、QM の再レビューが 2 度同じ欠陥を検出し、調べると remote の HEAD が force push されて 1 度目の修正が完全に消えていました。決定は、Branch Ruleset の `require_last_push_approval`、致命修正を静的に検査する CI、そして `--force-with-lease` の必須化と `--force` の禁止です[^adr26]。

2 つの判断は同じ月にあります。履歴を書き換えて生成物を消す判断と、履歴の書き換えで修正が消えるのを防ぐ判断。矛盾ではなく、同じ問題の両面です。AI は生成物を大量に作り、そのうち不要になったものは履歴からも消したくなります。しかし同じ操作が、必要なものも消します。ADR-0026 は「やむを得ず force push が必要な場合は PO に事前通知」と書き、filter-repo をその例外に位置づけました。

このリポジトリは公開されています。公開リポジトリの履歴の書き換えは、clone した人の履歴と食い違います。7 か月の間に、それを気にする外部の clone は無かった、というのが実情だと思います。オーナーの見方は逆で、書き換えたことより、git で管理すべきでないファイルが多数履歴に残ってしまったこと自体が問題だ、というものです。

## 30MB を 24 回

リポジトリの pack は 916 MiB です。最大の blob は `graphify-out/graph.json` で、1 版が 30MB、24 版が履歴にあります。単純に足すと 720MB で、pack の大半です[^bigblobs]。

[第Ⅵ部-4](graphify) で見たとおり、この 30MB は「clone 直後から構造を引ける」ために追跡されています。不採用時の評価は「21.6MB は git commit 不可」でしたが、採用時にその判断は覆りました。git は差分を圧縮しますが、JSON の全面的な再生成は差分になりにくく、24 版がそのまま積まれています。

生成物の置き場の判断で、これは最も高くついた 1 件です。`screenshots` branch の 5,175 ファイルは orphan で main を汚しませんが、graph.json は main にあり、すべての clone が 916 MiB を引きます。

## 存在しないサブモジュール

CLAUDE.md の Further Context は「@personal/data/family.yml（サブモジュール）」を挙げています。最初の入力にも「家庭情報は personal リポジトリを参考とし、必要に応じてサブモジュールとして追加してください」とありました。しかし `.gitmodules` は履歴のどこにも存在せず、`personal/` はリポジトリにありません[^rootclaude]。

家族の情報は、公開リポジトリに入らなかった。`personal` はオーナーの個人情報のリポジトリで、含めるべきではなかった。これは [第Ⅰ部-6](legal-by-design) の「収集しないデータ」の、開発側の実践です。CLAUDE.md の行は、オーナーの手元にだけある文脈への参照として残っています。AI がそのファイルを Read しようとすれば失敗しますが、それは正しい失敗です。

## 今ならこうする

モノレポは、変えません。一人と AI の開発で、リポジトリを分ける利益はありませんでした。

生成物の行き先は、初日に決めるべきでした。5 つの行き先は、事故のたびに 1 つずつ増えました。screenshots branch は SS 偽装の事故のあと、tmp/ の規律は research の氾濫のあと、filter-repo はディレクトリが肥大したあと。「AI は生成物を大量に作る」は、始める前から分かっていたことです。

30MB の再生成物を main に置くことは、二度としません。orphan の branch か、Release の asset か、外部のストレージです。screenshots branch で一度正しい形を作っていたのに、グラフには適用しませんでした。

[^codebasemap]: codebase-map §1 トップレベルディレクトリ。出典: [docs/codebase-map.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/codebase-map.md)

[^gitignore]: .gitignore（160 行）。tmp/、docs/tickets/、docs/pr-screenshots/、`/pr-*/` と `actions/` の un-ignore、filter-repo で抹消済みの注記、graphify-out の sidecar。出典: [.gitignore](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.gitignore)

[^ssbranch]: screenshots branch（2026-04-27 init、5,175 ファイル）。出典: [screenshots branch](https://github.com/Takenori-Kusaka/ganbari-quest/tree/screenshots)

[^docsclaude]: docs/CLAUDE.md §docs SSOT 原則の research 配置規律。出典: [docs/CLAUDE.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/CLAUDE.md)

[^issue1443]: Issue #1443「docs/design/logo-candidates/ を git 履歴ごと完全削除（git filter-repo）」と Issue #379「不要ファイル・ディレクトリの削除 + git 履歴からの除去」。出典: [Issue #1443](https://github.com/Takenori-Kusaka/ganbari-quest/issues/1443)、[Issue #379](https://github.com/Takenori-Kusaka/ganbari-quest/issues/379)

[^adr26]: ADR-0026「致命修正コミットの force push による消失防止」。PR #1717 の経緯、3 層の決定、`--force-with-lease` の必須化。出典: [docs/decisions/0026-force-push-protection.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0026-force-push-protection.md)

[^bigblobs]: pack サイズは `git count-objects -vH`、blob の大きさは `git rev-list --objects --all | git cat-file --batch-check` で数えた（2026-09-16）。出典: [graphify-out/](https://github.com/Takenori-Kusaka/ganbari-quest/tree/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/graphify-out)

[^rootclaude]: ルートの CLAUDE.md の Further Context。出典: [CLAUDE.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/CLAUDE.md)
