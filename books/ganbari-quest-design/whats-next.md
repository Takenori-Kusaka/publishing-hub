---
title: "第Ⅷ部-4　未解決と今後 ― Pre-PMF の現在地、オーナー代行からの脱却条件、試す・読む・支援する"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

最後の章は、終わっていないことの一覧です。製品は Pre-PMF の段階にあり、ロードマップの「正式ローンチ」には到達していません。この本が見つけた不整合も、まだ直っていません。ここでは、現在地、脱却の条件、この本が残した宿題、そして読者が次にできることを書きます。

## 現在地

SaaS展開ロードマップは、Phase 0（品質安定化）、Phase 1（調査と prototype）、Phase 2（要件定義と開発）、Phase 3（GTM）を経て、Phase 4「リリース・運用開始」を「未到達」としています。Phase 4 の判定基準は定量で、Activation Rate 30% 以上、サインアップ月 20 以上、月次解約率 10% 未満、critical バグ 0 件、本番 E2E 成功率 99% 以上です[^roadmap]。

このロードマップは 2026-04-11 に書かれたもので、Phase 3.5 から 4 への移行条件にはライセンスキーの critical bug の解消や DynamoDB の記事が並んでいます。[第Ⅱ部-12](billing) で見たとおりライセンスキーは全廃され、[第Ⅱ部-6](aurora-dsql) で見たとおり DynamoDB は撤去されました。ロードマップは、この本で何度も見た「書いた日の正解」の 1 つです。

現在の判断の軸は、ロードマップではなく 2026-07-30 に置かれた「3 か月後の成功の定義」です。有料課金が人手介入ゼロで一巡する。獲得した家族が critical で離脱しない。サインアップ月 20 名の導線が生きている。データを失わない。1 人と AI の開発ループが 1 日で回る。この 5 つに向けて EPIC が 5 本立てられ、4 本が close、データを失わない E3 だけが open です。open の Issue は 31 件です[^epics]。

顧客数と売上は、この本に書きません。それは判断の材料で、公開の材料ではないと決めています。

## オーナー代行からの脱却

この本の PO は、Claude Code のロールセッションです。しかし 7 か月の間、Dev・QM・PO の会話は、オーナーが手で中継していました。その状態を縮小する条件は 3 つと決められています[^epics]。

1. 不可逆の 4 操作（削除、本番 deploy、課金の書き込み、スキーマ変更）を機械で止める。「削除」には gate や test の削除を含める
2. バックアップが本番の実機で 1 周検証されている
3. 1 PR が 1 日で回る

3 つ揃った時点で、PO と QM の相互指摘をやめ、PO は「不可逆 4 操作」と「顧客価値の優先順」だけ、QM は「BLOCK 3 類型」だけを見る。原則は「gate が直ったら任せる」ではなく「間違えても安く戻せる状態になったら任せる」です。

2026-09-16 現在、1 は `state:needs-owner` の label と labeler の paths 規則が担う設計です。3 は [第Ⅶ部-4](actions-portfolio) の 8 本削除と [第Ⅶ部-2](branch-strategy-evolution) の二層により、直近 1,000 件の PR の中央値が 1.9 時間になりました。2 は E3 が open のままです。[第Ⅱ部-14](backup-export) で見た restore drill は runbook にあり、実機の 1 周は Issue の手番です。

リリースの cadence も、9 月に変わりました。cut に PO の決裁を挟まず、週 1 固定と「main..develop が 50 commit」の非常口の早い方で cut する。[第Ⅶ部-3](stacked-pr-integration) で見た 181 本の統合は、「50 commit 超で PO に提案」という規則が PO 待ちで詰まった結果でした。規則ではなく経路の欠陥だった、と記録されています[^epics]。

## この本が残した宿題

この本を書くために原典を読み直し、リポジトリの側の不整合を見つけました。すべて、各部の PR で「要確認」としてオーナーに渡してあります。主なものを並べます。

| 章 | 不整合 |
| --- | --- |
| [第Ⅱ部-16](ops-console) | `/ops/costs` が Cost Explorer を直接呼ぶ。CLAUDE.md と cost-review skill はそれを禁じている |
| [第Ⅱ部-16](ops-console) | 週報が撤去済みの DynamoDB テーブルを毎週 scan している |
| [第Ⅱ部-1](stack-selection) | 3 つの設計書の技術スタック表が SQLite / DynamoDB / Zod のまま |
| [第Ⅱ部-1](stack-selection) | OSSライセンスコンプライアンスの文書が AGPL の依存を禁じ、製品自身は AGPL-3.0 |
| [第Ⅵ部-1](claude-md-hierarchy) | AGENTS.md と GEMINI.md が初版のまま。docs/sessions の import が壊れている可能性 |
| [第Ⅵ部-5](codebase-map) | 並行実装マップの解消計画と codebase-map の件数が古い |
| [第Ⅵ部-6](skills-as-sop) | cost-review skill が DynamoDB 前提の数字を持つ |
| [第Ⅶ部-1](monorepo-and-artifacts) | 30MB の graph.json が 24 版、pack の大半を占める |
| [第Ⅶ部-3](stacked-pr-integration) | 統合 PR の回数の番号が揺れ、手番が止まった日を検出する仕組みが無い |
| この章 | ロードマップの移行条件が 2026-04 のまま |

どれも「動いている」ので落ちません。[第Ⅴ部-4](fitness-functions) の「記録を反証可能にする」を、これらにも掛けるかどうかは、[第Ⅳ部-8](platform-session) の「装置を増やさない」との間で、オーナーが決めることです。私は増やさない方に賭けます。表の 10 件のうち、機械で守る価値があるのは Cost Explorer の呼び出しだけで、残りは月 1 の棚卸で人が読み直せば足ります。

## 試す

登録なしで触れるデモがあります。本番と同じルートを、[第Ⅲ部-6](multi-lambda-demo) で見た env 駆動の別 Lambda で動かしたものです。子供の画面を 5 つの年齢帯で切り替え、活動を記録し、ごほうびと交換できます。記録はサーバに書かれません。demo 用の Repository は書き込みをすべて no-op の Stub にしてあり、記録はブラウザのタブごとの sessionStorage に持ち、タブを閉じると消えます。

- デモ: https://demo.ganbari-quest.com/
- 製品の紹介と価格: https://www.ganbari-quest.com/

有料プランは月額 500 円からで、[第Ⅰ部-5](pre-pmf-scope) で見た「作らない」判断の下で、機能は絞られています。自宅の小型 PC で動かす選択肢もあり、[第Ⅲ部-7](nuc-selfhost) で見た PGlite の構成で、課金なしで全機能が使えます。

## 読む

この本の脚注は、すべて 2026-09-16 の main（`3af6c2e`）に固定した GitHub の URL です。リポジトリは AGPL-3.0 で公開されています。設計書 46 本、ADR 37 本、runbook 23 本、skill 26 本、workflow 33 本、test 1,102 ファイルは、すべて読めます。

- リポジトリ: https://github.com/Takenori-Kusaka/ganbari-quest

読むなら、この本の順ではなく、[要点](summary) の表から自分の問いに近い章へ飛んでください。そして、章が引用した原典を開いてください。この本は、原典への索引として書きました。

生成AIに実装を任せる開発プロセスの一般論は、前著『AIが実装する時代の開発プロセス ― ピットイン方式』に書きました。この本は、その一般論を 1 つの製品で 7 か月実行した記録です。両方を読むと、原則がどこで理想論になり、どこで機構になったかが分かります[^pitin]。

## 支援する

このリポジトリは、GitHub Sponsors を受け付けています。支援は、[第Ⅲ部-1](serverless-cost) で見たとおり AWS の月額 1〜3 ドルではなく、[第Ⅷ部-1](by-the-numbers) で見た Claude Max の定額と、オーナーの時間に向かいます。

- GitHub Sponsors: https://github.com/sponsors/Takenori-Kusaka

支援より役に立つのは、デモを触って壊れた画面を Issue にすることです。[第Ⅵ部-6](skills-as-sop) の ui-defect-hunt が「機械が既に見ている軸は手で歩かない」と書いたとおり、機械が見ていない軸を歩くのは人だけです。

## 最後に

この本は、生成AIに実装を任せて商用サービスを作った記録ですが、AI が作った製品の宣伝ではありません。7 か月の間に、AI は 2,985 の commit を書き、人は 444 の commit と、数えられない数の判断を書きました。判断の多くは、この本の各章の「今ならこうする」に、間違いも含めて残しました。

製品が成功するかどうかは、まだ分かりません。Pre-PMF とは、そういう段階です。分かっているのは、AI に実装を任せる開発が「60 点のデモ」で止まる理由と、100 点に寄せる機構の形です。それを持ち帰ってもらえれば、この本の目的は果たせます。

[^roadmap]: SaaS展開ロードマップ（2026-04-11）。§6 Phase 3.5 → 4 移行条件、§7 Phase 4（未到達）、§7.3 リリース判定基準。出典: [docs/design/10-SaaS展開ロードマップ.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/10-SaaS%E5%B1%95%E9%96%8B%E3%83%AD%E3%83%BC%E3%83%89%E3%83%9E%E3%83%83%E3%83%97.md)

[^epics]: EPIC 5 本（E1 課金 #4117、E2 契約状態 #4118、E3 データ #4119、E4 JST 日付 #4120、E5 検証装置 #4121）と、cut cadence の決定（第 22 回統合 PR #4887 のコメント）。出典: [EPIC E3 #4119](https://github.com/Takenori-Kusaka/ganbari-quest/issues/4119)、[PR #4887](https://github.com/Takenori-Kusaka/ganbari-quest/pull/4887)

[^pitin]: 前著。出典: [AIが実装する時代の開発プロセス — ピットイン方式](https://zenn.dev/takenori_kusaka/books/pit-in-process)
