---
title: "エンタープライズハーネスとは何か ―― Thoughtworks Technology Radar Vol. 35 を一次資料で読む"
emoji: "🏎️"
type: "tech"
topics: ["ai", "thoughtworks", "platformengineering", "llm", "claudecode"]
published: true
---

:::message
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。
:::

Thoughtworksは、2026年11月に技術動向の報告書『Technology Radar Vol. 35』を公開しました [ [ 1 ] ](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/11/tr_technology_radar_vol_35_en.pdf) 。この号は、4つのテーマの1つ目に「Harness engineering at scale(ハーネスエンジニアリングを組織の規模へ)」を掲げ、技法の27番に「Enterprise harness(エンタープライズハーネス)」を載せています。

この記事は、エンタープライズハーネスについてRadarが何を書いたかを、本文に沿って整理します。Radarが書いたことと、筆者の読みは節を分けて書きます。訳はすべて筆者によるものです。

## 1. 先に押さえる3点

- **対象はコーディングエージェントです。** Radarはエンタープライズハーネスを「コーディングエージェントが使うもの」の組織全体の層と定義しています [ [ 2 ] ](https://www.thoughtworks.com/radar/techniques/enterprise-harness) 。限られるのはエージェントの種類で、使う人の職種ではありません。Radarは、コーディングエージェントを使い始めたコードを書かない人にも、エンタープライズハーネスを用意するよう勧めています [ [ 8 ] ](https://www.thoughtworks.com/radar/techniques/ai-accelerated-shadow-it) 。
- **評価は「Assess(評価段階)」です。** Radarの4つの段階(Adopt、Trial、Assess、Caution)のうちAssessは、自社への影響を理解するために調べる価値がある、という段階です [ [ 1 ] ](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/11/tr_technology_radar_vol_35_en.pdf) 。導入を勧める段階ではありません。
- **やり方はまだ定まっていません。** Radarは、うまく作る方法についての合意はまだ無いと書いています [ [ 2 ] ](https://www.thoughtworks.com/radar/techniques/enterprise-harness) 。

## 2. ハーネスとは

Radarは、ハーネスエンジニアリングを、AIエージェントの周りに環境を組み立てるためのすべての作業と説明しています。記憶や文脈から、フィードバックの仕組み、ガードレールまでを含みます [ [ 1 ] ](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/11/tr_technology_radar_vol_35_en.pdf) 。モデルそのものではなく、モデルを仕事で使えるようにする周りの仕組みです。

同じテーマの節で、Radarはさらに2つのことを述べています。1つは、ハーネスが継続して持ち主と保守を要する「生きた資産」になってきたことです。もう1つは、より大きな課題がハーネスを企業の要件に合う規模へ広げることだという点です。そのうえで、数年前にプラットフォームとプラットフォームエンジニアリングに起きたことと同じように、エンタープライズハーネスが1つの製品として現れるかもしれない、と見通しています [ [ 1 ] ](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/11/tr_technology_radar_vol_35_en.pdf) 。

## 3. Radarが書いたエンタープライズハーネス

技法の27番の本文は、次の内容です [ [ 2 ] ](https://www.thoughtworks.com/radar/techniques/enterprise-harness) 。

| 観点 | Radarの記述(筆者の要約) |
| --- | --- |
| 定義 | コーディングエージェントが使うものを、組織全体でまとめて管理する層 |
| 含むもの | スキル、ツール、社内の文脈へのコネクタ、承認済みの技術、アーキテクチャの決定記録、本番までの道筋の手引き(原文は path-to-production guidance)、フック、セキュリティのポリシー |
| 生まれる理由 | 複数のチームがコーディングエージェントを使い始めると、各チームが整えた共有の指示を補う、共通の文脈が要る |
| たとえ | 開発者体験(developer experience)のプラットフォームに似ているが、対象はエージェント体験(agent experience) |
| 推奨 | 独自のコーディングエージェントを作り込むより、オープンな標準で資産を共有し、エージェントのプラグインのマーケットプレイスで配る |
| 注意 | うまく作る方法の合意はまだ無い。薄く、連邦的に(原文は thin and federated)保ち、試す余地を残し、うまくいったものを取り入れる |

Radarは「エージェント体験」を定義していません。筆者は、エージェントが仕事を始めるときに、必要な文脈と道具と制約がそろっている度合いと読んでいます。「連邦的」も定義はありませんが、中央が持つ共通部分を薄くし、各チームの資産は各チームが持ち続ける形を指すと読めます。どちらも筆者の解釈です。

Radarは、オープンソースのコーディングエージェントであるOpenCode [ [ 14 ] ](https://github.com/anomalyco/opencode) の上に、独自のコーディングエージェントを作った組織も見たと書いたうえで、それを勧めていません。中央で作り込むのではなく、共有と配布の仕組みを整える方向を勧めています。

## 4. 周りの項目

エンタープライズハーネスは単独の項目ではなく、同じ号の複数の項目とつながっています。関係の深いものを段階とともに並べます。

| 番号と名前 | 段階 | Radarの記述の要点 |
| --- | --- | --- |
| 1 Agent sandboxing | Adopt | エージェントの隔離した実行を、すべてのエージェントの妥当な既定とする。脅威モデリングに基づき、リスクに応じて隔離する [ [ 3 ] ](https://www.thoughtworks.com/radar/techniques/agent-sandboxing) |
| 7 Agent plugin marketplace | Trial | スキル、指示、MCPサーバ、サブエージェントの定義などを組織に配る手段。エンタープライズハーネスを組織全体で使えるようにする実用的な方法と位置づける [ [ 4 ] ](https://www.thoughtworks.com/radar/techniques/agent-plugin-marketplace) |
| 11 Feedback flywheel | Trial | セッションの終わりに共有の資産を変えるべきかを問い、チームの振り返りで何を更新するかを決める。エージェントが変更を提案し、人が選ぶ [ [ 5 ] ](https://www.thoughtworks.com/radar/techniques/feedback-flywheel) |
| 18 Self-improving harness | Trial | 実行の記録と評価の結果をエージェントが分析し、ハーネスの改善を提案または実装する [ [ 6 ] ](https://www.thoughtworks.com/radar/techniques/self-improving-harness) |
| 29 Harness quality evaluation | Assess | ハーネスが実際に効いているかを評価する。決定的な(モデルの判断を介さない)ガードレールには、それぞれが効くことを確かめる試験の一式を用意し、評価は夜間やCIと一緒に定期的に回す [ [ 7 ] ](https://www.thoughtworks.com/radar/techniques/harness-quality-evaluation) |
| 38 AI-accelerated shadow IT | Caution | コーディングエージェントで作られた、正規の開発の外のソフトウェアには、第一にセキュリティのリスクがあり、第二に試験、配備の仕組み、観測が欠けがちである [ [ 8 ] ](https://www.thoughtworks.com/radar/techniques/ai-accelerated-shadow-it) |
| 58 Agent Plugins | Assess | スキルとMCPサーバを持ち運べる形に包む、オープンな標準 [ [ 9 ] ](https://www.thoughtworks.com/radar/platforms/agent-plugins) |
| 72 Agent Package Manager | Trial | エージェントの設定の依存を管理するオープンソースの道具。版を付けたスキルを中央のリポジトリから配る [ [ 10 ] ](https://www.thoughtworks.com/radar/tools/agent-package-manager) |

Radarのテーマの節は、Agent Plugins、マーケットプレイス、Agent Package Managerをプラグインの生態系の例として、ハーネスの品質の評価、自己改善するハーネス、フィードバックのはずみ車を、ハーネスが保守を要する資産であることの例として挙げています [ [ 1 ] ](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/11/tr_technology_radar_vol_35_en.pdf) 。筆者の整理では、前者が配布の部品、後者が品質の部品、エージェントの隔離が安全の部品です。シャドーITの項目は、それが無いと何が起きるかの側にあたります。

## 5. 配布の具体例：Agent Package Manager

Radarは72番で、Agent Package Managerを「エージェントの設定の依存を管理するオープンソースの道具」と説明しています。プラグイン、スキル、指示、MCPサーバを宣言するマニフェストで動き、ロックファイルに内容のハッシュと出所を記録し、ポリシーのファイルで取り込み元と範囲を制限できる、と書いています。一方で、まだ1.0より前で、コミュニティ主導の段階であるため、AdoptではなくTrialに置いたとも書いています [ [ 10 ] ](https://www.thoughtworks.com/radar/tools/agent-package-manager) 。

GitHubで公開されているAgent Package Manager(microsoft/apm、MITライセンス)のREADMEには、次のマニフェストの例があります [ [ 11 ] ](https://github.com/microsoft/apm) 。

```yaml
# apm.yml — ships with your project
name: your-project
version: 1.0.0
targets:
  - copilot # choose the harness(es) this project supports
dependencies:
  apm:
    # Skills from any repository
    - anthropics/skills/skills/frontend-design
    # Plugins
    - github/awesome-copilot/plugins/context-engineering
    # ...
```

READMEは、対応するエージェントとしてGitHub Copilot、Claude Code、Cursor、Codexなどを挙げています。上の例の `targets` が copilot だけなのは、例がそう書いているためです。各チームがスキルや指示のファイルをリポジトリ間で写す代わりに、依存として宣言して取り込む形です。Radarは7番で、写すやり方では公開、発見、更新の簡単な方法が無いことを、マーケットプレイスが要る理由に挙げています [ [ 4 ] ](https://www.thoughtworks.com/radar/techniques/agent-plugin-marketplace) 。

## 6. なぜ組織の問題になるのか：シャドーAIとシャドーIT

全社展開を進める側から見ると、エンタープライズハーネスは、管理されていない利用を減らす手段でもあります。日本の公的な資料にも、同じ方向の指摘があります。IPA(情報処理推進機構)の『情報セキュリティ10大脅威 2026[組織編]』の解説書は、3位に「AIの利用をめぐるサイバーリスク」を置いています。そのなかで、職場でAIサービスを利用できない場合などに従業員が個人で使っているAIサービスを業務に使うことを「シャドーAI」と呼び、情報漏えいにつながるリスクとして挙げています [ [ 12 ] ](https://www.ipa.go.jp/security/10threats/omgdg50000008fi8-att/kaisetsu_2026_soshiki.pdf) 。同じ節は米国のAI企業の調査を引き、生成AIにデータを貼り付けて入力している利用者が77%で、そのうち82%が組織に管理されていないアカウントによるものだったと紹介しています。IPAが経営者層の対策に挙げるのは、AIサービスの利用の検討と、未許可のAIサービスの利用の禁止、利用規定の整備です。

Radarの38番は、作る側から同じ問題を見ています。コーディングエージェントによって、コードを書かない人も自分の道具を作れるようになりました。Radarはそれを歓迎しつつ、第一のリスクにセキュリティを挙げます。第二に、正規の開発の外で生まれたソフトウェアは試験、配備の仕組み、観測を欠きがちだと指摘します。そのうえで、意欲を消すより、安全に試せる環境とエンタープライズハーネスを用意するほうがよい、というのがThoughtworksの経験だと書いています。セキュリティについては妥協しないことも求めています [ [ 8 ] ](https://www.thoughtworks.com/radar/techniques/ai-accelerated-shadow-it) 。

IPAが扱うのは、利用者として使うAIサービスの管理です。Radarが扱うのは、コーディングエージェントで作られるソフトウェアの管理です。両者の対象は異なります。共通するのは、組織が把握していない利用が増えることを、リスクとして見ている点です。

## 7. 筆者の読み

ここからは、Radarの本文ではなく筆者の解釈です。

**エンタープライズハーネスは、規則の集合というより配布の仕組みです。** Radarが含むものとして挙げた項目(スキル、承認済みの技術、本番までの手引き、セキュリティのポリシー)は、エージェントのために新しく作るものとは限りません。開発の標準や決定記録として、すでに文書にしている組織もあるでしょう。その場合に足りないのは、それをエージェントが読める形で、版を付けて、全チームに同じものを届ける経路です。Radarが独自のエージェントの作り込みより、オープンな標準での共有とマーケットプレイスでの配布を勧めているのも、この読みと合います。

**品質の項目が対になります。** 配った規則が効いているかを確かめなければ、組織全体に同じ誤りを配ることになります。ハーネスの品質の評価と、フィードバックのはずみ車・自己改善するハーネスという改善の仕組みは、配布と一緒に考えるべきものだと考えます。フィードバックのはずみ車が、変更の提案はエージェントに任せ、どれを採るかは人が決める形をとっていることは、承認を人に残す設計の1つの例です。

**モデルを替えても残るのはハーネスです。** Radarの2つ目のテーマ「Beyond frontier models」は、独占的な最先端モデルを自動的に選ぶことは、もはや自明の選択ではないと書いています [ [ 1 ] ](https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/11/tr_technology_radar_vol_35_en.pdf) 。使うモデルを用途や費用で選び分けるなら、組織の文脈と安全の基準を持つ層は、モデルの外に置くほうが替えやすいはずです。ただし、これは筆者の推論で、Radarがそう結論しているわけではありません。

品質の評価の1つの試みとして、筆者は [pit-crew](https://github.com/Takenori-Kusaka/pit-crew) で、ロールを分けたAIエージェント用のハーネスと、同じ課題をハーネスあり・なしで走らせて比べる評価基盤を作っています。まだ作っている途中で、評価も途中です [ [ 13 ] ](https://github.com/Takenori-Kusaka/pit-crew) 。

## 8. 最初の一歩(筆者の提案)

Radarの推奨(薄く保つ・オープンな標準による共有・マーケットプレイスからの配布・ハーネスの定期的な評価)から、全社展開の担当者が最初に手を付けられることを3つ挙げます。Radarの手順ではなく、筆者の提案です。

1. **写されている資産を数える。** 各チームのリポジトリで、スキル、指示のファイル(AGENTS.md など)、MCPサーバの設定がどれだけ重複しているかを調べます。重複の多いものから共有を始めます。
2. **Gitのリポジトリ1つから配る。** Radarは、文書を付けたGitのリポジトリでマーケットプレイスを作った経験を書いています [ [ 4 ] ](https://www.thoughtworks.com/radar/techniques/agent-plugin-marketplace) 。中央に置くものは、セキュリティのポリシーのように全社で同じであるべきものに絞ります。
3. **配ったものに試験を付ける。** フックや検査のような決定的なガードレールには、効くことを確かめる試験を書き、夜間かCIで回します [ [ 7 ] ](https://www.thoughtworks.com/radar/techniques/harness-quality-evaluation) 。

## 9. まだ分からないこと

- **うまく作る方法。** Radar自身が合意は無いと書いています。薄く、連邦的に、という推奨は方向であって、設計の型ではありません [ [ 2 ] ](https://www.thoughtworks.com/radar/techniques/enterprise-harness) 。
- **道具の成熟。** Agent Package Managerは1.0より前で、Radarは競合する解決策が続くと見ています [ [ 10 ] ](https://www.thoughtworks.com/radar/tools/agent-package-manager) 。Agent Pluginsの仕様も意図的に最小限です [ [ 9 ] ](https://www.thoughtworks.com/radar/platforms/agent-plugins) 。
- **コーディング以外への広がり。** Radarのエンタープライズハーネスはコーディングエージェントの層です。業務部門のエージェントに同じ形が当てはまるかは、Radarは述べていません。1番の隔離については、エージェントが業務システムでも動くようになったことを理由に、すべてのエージェントの既定としています [ [ 3 ] ](https://www.thoughtworks.com/radar/techniques/agent-sandboxing) 。

## 参考文献

1. Thoughtworks『Technology Radar Vol. 35』2026年11月 https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/11/tr_technology_radar_vol_35_en.pdf
2. Thoughtworks「Enterprise harness」Technology Radar https://www.thoughtworks.com/radar/techniques/enterprise-harness
3. Thoughtworks「Agent sandboxing」Technology Radar https://www.thoughtworks.com/radar/techniques/agent-sandboxing
4. Thoughtworks「Agent plugin marketplace」Technology Radar https://www.thoughtworks.com/radar/techniques/agent-plugin-marketplace
5. Thoughtworks「Feedback flywheel」Technology Radar https://www.thoughtworks.com/radar/techniques/feedback-flywheel
6. Thoughtworks「Self-improving harness」Technology Radar https://www.thoughtworks.com/radar/techniques/self-improving-harness
7. Thoughtworks「Harness quality evaluation」Technology Radar https://www.thoughtworks.com/radar/techniques/harness-quality-evaluation
8. Thoughtworks「AI-accelerated shadow IT」Technology Radar https://www.thoughtworks.com/radar/techniques/ai-accelerated-shadow-it
9. Thoughtworks「Agent Plugins」Technology Radar https://www.thoughtworks.com/radar/platforms/agent-plugins
10. Thoughtworks「Agent Package Manager」Technology Radar https://www.thoughtworks.com/radar/tools/agent-package-manager
11. microsoft/apm(Agent Package Manager)GitHub https://github.com/microsoft/apm
12. IPA『情報セキュリティ10大脅威 2026[組織編]』解説書 https://www.ipa.go.jp/security/10threats/omgdg50000008fi8-att/kaisetsu_2026_soshiki.pdf
13. Takenori-Kusaka/pit-crew GitHub https://github.com/Takenori-Kusaka/pit-crew
14. anomalyco/opencode GitHub https://github.com/anomalyco/opencode
