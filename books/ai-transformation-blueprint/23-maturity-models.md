---
title: "第23章　現在地を測る道具 ―― 成熟度モデルの系譜と使い方"
---

### 序論：本章が扱う範囲

経営層が「自社はいまどこにいるか」を特定するための資料には、いくつかの名前があります。成熟度モデル、成熟度評価、準備度評価、As-Is/To-Beのギャップ分析、Wardley Map、Three Horizonsなどです。本章は、これらの名称と起源を整理し、それぞれが何を測り何を測らないかを示します。

[組織の内部化の章](22-organizational-internalization)で、成熟度という語がソフトウェア開発の評価枠組みに由来することを述べました。本章はその系譜を広げ、2020年代のAI成熟度モデルの研究と、Gartner、IDC、MIT、BCG、経済産業省などが公表する実務の枠組みを比較します。各枠組みが示す企業の分布も併記します。

最後に、本書が[3つの現在地の章](32-three-positions)で定義する3つの軸(事業フェーズ、導入フェーズS1〜S6、文化フェーズC1〜C5)が、この系譜のどこに置かれるかを示します。道具の選択と整理は著者の判断です。

### 1. 名称の整理 ―― 何を測る道具か

経営判断にとっての意味は、「現在地を測る」と一口に言っても、道具によって測る対象が違い、目的に合わない道具は誤った一手を導く、ということです。

**成熟度モデル(maturity model)**。組織の能力やプロセスを、段階的に上がる水準として表した枠組みです。語の起源は、Paulkらが1993年に定義した能力成熟度モデル(CMM)であり、その前身は1987年のHumphreyの成熟度の枠組みです [ [ 273 ] ](https://www.sei.cmu.edu/library/capability-maturity-model-for-software-version-11/) 。測るのは、組織のプロセスがどれだけ規律を持って運用されているかです。

**成熟度評価、能力評価(maturity assessment、capability assessment)**。成熟度モデルに沿って自社を採点する行為と、その結果です。GartnerのAI成熟度の調査は、7つの領域をそれぞれ水準1(計画・着手)から水準5(リーダーシップ)で採点します [ [ 186 ] ](https://www.gartner.com/en/newsroom/press-releases/2025-06-30-gartner-survey-finds-forty-five-percent-of-organizations-with-high-artificial-intelligence-maturity-keep-artificial-intelligence-projects-operational-for-at-least-three-years) 。経済産業省のDX推進指標は、企業の自己診断をIPAが集計する仕組みで、水準0(未着手)から水準5(グローバル市場におけるデジタル企業)の6段階です [ [ 225 ] ](https://www.ipa.go.jp/pressrelease/2025/press20250507.html) 。

**準備度評価(readiness assessment)**。導入の前に、導入に必要な条件が揃っているかを評価する枠組みです。Jöhnkらは2021年に、戦略の整合、資源、知識、文化、データの5つの領域にわたる18のAI準備度の因子を示しました [ [ 215 ] ](https://aisel.aisnet.org/bise/vol63/iss1/2) 。Alsheibaniらは2018年に、技術、組織、環境の枠組みに基づく企業レベルのAI準備度を提案しました [ [ 216 ] ](https://research.monash.edu/en/publications/artificial-intelligence-adoption-ai-readiness-at-firm-level) 。成熟度が「どこまで来たか」を測るのに対し、準備度は「始められるか」を測ります。

**段階モデル(stage model)**。導入が一定の順序で段階を踏むという仮説に基づく枠組みです。情報技術の分野の原点は、[組織の内部化の章](22-organizational-internalization)で述べたNolanの1973年の段階仮説です [ [ 272 ] ](https://doi.org/10.1145/362280.362284) 。成熟度モデルが「水準」を測るのに対し、段階モデルは「順序」を主張します。両者は混同されやすく、各社のAI成熟度モデルの多くは両方の性格を持ちます。

**As-Is/To-Beのギャップ分析**。現状と目標の状態を記述し、差を埋める施策を導く一般的な業務分析の手法です。固有の一次資料は特定していません。成熟度モデルは、As-IsとTo-Beを同じ尺度で記述するための共通の物差しとして使われます。

**Wardley Map**。Simon Wardleyが2005年に考案した手法で、事業を構成する要素を、利用者からの可視性(縦軸)と進化の段階(横軸)の2軸で地図にします。横軸は、創生、個別構築、製品、汎用品の4段階です [ [ 279 ] ](https://learnwardleymapping.com/book/) 。測るのは自社の成熟度ではなく、自社が使う部品と市場の成熟度です。

**Three Horizons**。Baghai、Coley、Whiteが1999年の『The Alchemy of Growth』で示した成長戦略の枠組みで、現在の中核事業の防衛(地平1)、立ち上がりつつある新事業の育成(地平2)、将来の選択肢の種まき(地平3)を同時に管理すべきだとします [ [ 278 ] ](https://archive.org/details/alchemyofgrowth00mehr) 。各地平は成果指標、人材、管理の方法が異なり、地平1の指標で地平3を評価すると芽を摘みます。測るのは導入の深さではなく、事業の成熟度と投資の配分です。

**運営モデル(operating model)**。AIを担う組織の形態で、中央集権、ハブ&スポーク、分散の3つの型がMcKinseyの資料で整理されています [ [ 191 ] ](https://www.mckinsey.com/capabilities/tech-and-ai/our-insights/a-data-leaders-operating-guide-to-scaling-gen-ai) 。段階ではなく、段階ごとに適した形態です。[運営モデルの進化の章](33-operating-model-evolution)で扱います。

### 2. AI成熟度モデルの研究 ―― 5段階と7次元

経営判断にとっての意味は、各社のAI成熟度モデルが示す「5段階」は研究上も主流の型であり、違いは段階の数ではなくどの次元を測るかにあるということです。

Sadiqらは2021年に、AI成熟度モデルに関する研究を系統的にレビューしました [ [ 213 ] ](https://pmc.ncbi.nlm.nih.gov/articles/PMC8409328) 。レビューが確認したのは、「5水準の連続的な表現」が成熟度モデルの開発で主流であることと、重要な次元としてデータ、分析、技術と道具、知的な自動化、ガバナンス、人、組織の7つが繰り返し現れることです。

Lichtenthalerは2020年に、AIの管理の成熟度を自動運転の5水準になぞらえた5段階で示しました。孤立した無知、初期の意図、独立した取り組み、相互作用する実装、相互依存する革新、統合された知能という名称です [ [ 214 ] ](https://journalsojs3.fe.up.pt/index.php/jim/article/view/2183-0606_008.001_0005) 。アメリカのMITREは2023年に、初期、関与、定義済み、管理された、最適化の5水準と、倫理的で公正な利用、戦略、組織、技術、データ、性能の6つの柱からなるAI成熟度モデルと組織評価の道具を公開しました [ [ 202 ] ](https://www.mitre.org/sites/default/files/2023-11/PR-22-1879-MITRE-AI-Maturity-Model-and-Organizational-Assessment-Tool-Guide.pdf) 。カーネギーメロン大学のソフトウェア工学研究所は、100以上の既存のAI成熟度モデルの系統的レビューを基に、独自のモデルを構築中です [ [ 203 ] ](https://www.sei.cmu.edu/library/aimaturitymodel-overview) 。

生成AIの事実に当てはめると、7つの次元のうち、データ、ガバナンス、人、組織の4つが、[投資対効果と失敗率の章](15-roi-and-failure)で示した成功と失敗を分ける要因と重なります。技術と道具の次元は、[市場の地図の章](18-market-map)で示したとおり外部から調達でき、企業の間の差を生みにくくなっています。

当てはまらない点は、これらのモデルが生成AI以前のAI(予測モデルの開発と運用)を主な対象にしていることです。生成AIの導入では、モデルの開発ではなく、外部のモデルの利用と出力の評価が中心になります。次元の重みは、過去のAI成熟度モデルから引き継げません。

### 3. 実務の成熟度モデル ―― 各社の段階と企業の分布

経営判断にとっての意味は、どの枠組みで測っても上位の層は5〜18%で下位の層は35〜60%という分布が繰り返し現れ、自社が「中間」にいる確率が最も高いということです。

実務で使われる枠組みを、段階の数と公表された分布とともに並べます。数値は各社の調査の定義に依存し、相互に比較できません。

| 枠組み | 段階 | 公表された分布 | 出典 |
| --- | --- | --- | --- |
| Gartner AI成熟度 | 水準1〜5、7領域 | 高成熟組織の平均4.2〜4.5、低成熟組織1.6〜2.2 | [ [ 186 ] ](https://www.gartner.com/en/newsroom/press-releases/2025-06-30-gartner-survey-finds-forty-five-percent-of-organizations-with-high-artificial-intelligence-maturity-keep-artificial-intelligence-projects-operational-for-at-least-three-years) |
| IDC MaturityScape | 散発的、機会的、反復可能、管理された、最適化 | 2026年の調査で、全社戦略の有無と実行の間に乖離 | [ [ 199 ] ](https://www.idc.com/resource-center/blog/ai-strategy-is-easier-to-define-than-to-deliver-idcs-benchmark-shows-the-gap) |
| MIT CISR企業AI成熟度 | 4段階(探索と準備、パイロットと能力構築、AIの働き方の開発、AI時代への準備完了) | 2025年の更新で4段階に分布を公表 | [ [ 201 ] ](https://cisr.mit.edu/publication/2025_0801_EnterpriseAIMaturityUpdate_WoernerSebastianWeillKaganer) |
| BCG | future-built、スケール中、その他 | 5%、35%、60% | [ [ 180 ] ](https://www.bcg.com/publications/2025/are-you-generating-value-from-ai-the-widening-gap) |
| Accenture(2022年) | 実験者、構築者、革新者、達成者 | 63%、12%、13%、12% | [ [ 195 ] ](https://newsroom.accenture.com/news/2022/more-than-60-percent-of-companies-are-only-experimenting-with-ai-creating-significant-opportunities-for-value-on-their-journey-to-ai-maturity-accenture-research-finds) |
| ServiceNow企業AI成熟度指数 | 0〜100の指数、上位層をPacesettersと呼ぶ | 上位層18.2%。平均は44から35へ低下 | [ [ 200 ] ](https://www.servicenow.com/workflow/ai/enterprise-ai-maturity-index-2025.html) |
| 経済産業省DX推進指標 | 水準0〜5 | IPAが2024年版の自己診断を集計 | [ [ 225 ] ](https://www.ipa.go.jp/pressrelease/2025/press20250507.html) |

Gartnerの2025年の調査には、成熟度と結果の関係を示す数値があります。AIのプロジェクトを3年以上本番で維持する割合は、高成熟組織の45%に対し低成熟組織では20%です([運営モデルの進化の章](33-operating-model-evolution))。高成熟組織の91%が専任のAIリーダーを任命し、約60%がAIの戦略、ガバナンス、データ、基盤を中央に集約しています [ [ 186 ] ](https://www.gartner.com/en/newsroom/press-releases/2025-06-30-gartner-survey-finds-forty-five-percent-of-organizations-with-high-artificial-intelligence-maturity-keep-artificial-intelligence-projects-operational-for-at-least-three-years) 。

ServiceNowの指数が示す「平均スコアの低下」は、成熟度の測り方に固有の現象です。2025年の調査では、平均が44から35へ9ポイント下がり、上位層も54から44へ下がりました [ [ 200 ] ](https://www.servicenow.com/workflow/ai/enterprise-ai-maturity-index-2025.html) 。技術の要求水準が上がると、同じ組織でも成熟度は下がって測られます。成熟度は絶対的な到達点ではなく、その時点の要求水準に対する相対的な位置です。

### 4. 自己評価の限界 ―― 測る側の認識のずれ

経営判断にとっての意味は、経営層の自己評価は現場の実態と系統的にずれており、ずれの方向は決まっている、ということです。

McKinseyの2025年の調査では、従業員の13%が日常業務の30%以上で生成AIを使っており、経営層の推定の4%の3倍超でした [ [ 189 ] ](https://www.mckinsey.com/~/media/mckinsey/business%20functions/quantumblack/our%20insights/superagency%20in%20the%20workplace%20empowering%20people%20to%20unlock%20ais%20full%20potential%20at%20work/superagency-in-the-workplace-empowering-people-to-unlock-ais-full-potential-v4.pdf) 。経営層は、現場の利用を過小に見積もります。

逆の方向のずれもあります。[投資対効果と失敗率の章](15-roi-and-failure)で示したとおり、PwCの2026年の調査では、AIがコストと収益の両方で成果を出したと答えたCEOは12%で、どちらかで成果があったのは33%でした [ [ 184 ] ](https://www.pwc.com/gx/en/news-room/press-releases/2026/pwc-2026-global-ceo-survey.html) 。IBMの2025年の調査では、過去数年のAI施策のうち期待した投資対効果を達成したのは25%でしたが、85%のCEOは2027年までに効率化の投資が正の収益を生むと期待していました [ [ 178 ] ](https://newsroom.ibm.com/2025-05-06-ibm-study-ceos-double-down-on-ai-while-navigating-enterprise-hurdles) 。経営層は、将来の成果を過大に見積もります。

Microsoftの2026年の調査は、個人のAI能力と組織の準備度の2軸で回答者を5つに分けました。両方とも高い層は19%、両方とも形成中の層は50%、両方とも低い層は16%です [ [ 205 ] ](https://assets-c4akfrf5b4d3f4b7.z01.azurefd.net/assets/2026/05/2026_Work_Trend_Index_Annual_Report_050526-7_69fc5b1c4e265.pdf) 。個人と組織の2軸を分けると、「個人は進んでいるのに組織は追いついていない」層と、その逆の層が別に見えます。

これらの事実から導かれる使い方は、自己評価を1つの軸で行わないことです。現場の利用、組織の整備、事業の成果は別の軸で、別の人が答えなければ、ずれは打ち消されません。

### 5. 本書の3つの現在地を系譜に置く

本書は[3つの現在地の章](32-three-positions)で、事業フェーズ、導入フェーズS1〜S6、文化フェーズC1〜C5の3つの軸を定義します。この3軸は、本章で整理した道具の系譜に、次のように対応します。対応づけは著者の判断です。

**導入フェーズS1〜S6は、段階モデルの系譜です。** Nolanの段階仮説と、Agrawal、Gans、Goldfarbの点、応用、システムの3水準を細分化したものです。測るのは、生成AIが組織のどこまで入り込んでいるかという「順序」であり、プロセスの規律という「水準」ではありません。各社の枠組みとの対応は[生成AIの導入段階の章](30-genai-adoption-stages)に表として置きます。

**文化フェーズC1〜C5は、準備度評価と文化の次元の系譜です。** Sadiqらのレビューが挙げた7次元のうち人と組織、Jöhnkらの準備度の因子のうち文化と知識、そして[文化の形成の章](36-culture-formation)で扱うWestrumの組織文化の類型に基づきます。測るのは、組織が生成AIを使って学ぶ構えがあるかです。

**事業フェーズは、Three Horizonsと両利きの経営の系譜です。** 測るのは、生成AIを既存事業の効率化に使うのか、新しい事業の創出に使うのかという投資の配分であり、導入の深さとは独立です。同じS4にいる2社でも、地平1の効率化としてS4にいる会社と、地平3の探索としてS4にいる会社では、次の一手が異なります。

**Wardley Mapは、3軸の外側の地図です。** 自社の現在地ではなく、自社が使う部品の進化段階を示します。基盤モデルは製品から汎用品へ、エージェント基盤は個別構築から製品へ進化しつつあります。[各段階で必要なものの章](34-requirements-and-providers)で、各段階で買うべき部品と作るべき部品を分けるとき、この地図を使います。

### 6. 道具の使い方 ―― 序列ではなく次の一手

成熟度モデルには、使い方を誤ると害になる性質があります。

第一に、最上位の水準を目標にしてしまうことです。CMMの最適化の水準は、プロセスの定量的な管理と継続的な改善が行われている状態を指し、事業の成果を保証しません。[組織の内部化の章](22-organizational-internalization)で述べたとおり、規律の高い組織が価値を出しているとは限りません。本書のS6(顧客へ届ける)も、すべての企業の目標ではありません。[道筋別の戦略の章](35-strategy-by-path)で示すとおり、事業フェーズと目指す道筋によって、適切な到達点は異なります。

第二に、1つの軸で測ってしまうことです。前節で示したとおり、個人の利用、組織の整備、事業の成果は別の軸であり、経営層の自己評価は系統的にずれます。本書が3軸を分けるのは、このずれを可視化するためです。

第三に、測った結果を序列として扱ってしまうことです。成熟度の測定の目的は、自社が他社より上か下かを知ることではなく、次の一手を決めることです。本書は、現在地の特定を[AXプロジェクトの立ち上げの章](37-launching-ax-project)の手順の最初の工程に置き、各現在地からの次の一手を[各段階で必要なものの章](34-requirements-and-providers)で対応づけます。

### 🗺️ 図：3つの現在地は、3つの系譜の道具で測る

![導入フェーズは段階モデル、文化フェーズは準備度と文化の次元、事業フェーズはThree Horizonsと両利きの系譜に対応する](/images/ai-transformation-blueprint/23-maturity-models.png)

#### 図の読み方

この図は、3つの列からなります。各列の上段が本書の軸、下段がその軸の由来となった道具の系譜です。

左の列は導入フェーズS1〜S6で、Nolanの段階仮説(1973年)とAgrawal、Gans、Goldfarbの3水準(2022年)に由来します。中央の列は文化フェーズC1〜C5で、Jöhnkらの準備度の因子(2021年)とWestrumの組織文化の類型(2004年)に由来します。右の列は事業フェーズで、BaghaiらのThree Horizons(1999年)とO'ReillyとTushmanの両利きの経営(2004年)に由来します。

3つの列が並列に置かれているのが、この図の主張です。3つの軸は序列ではなく、別の人が別の問いに答えて測ります。各道具の原典は本文の第1節と第5節に記しています。

### 本章の位置づけ

本章で取り上げた道具の整理と、本書の3軸との対応づけは、著者の判断です。

成熟度モデルの系譜が本書の推論に与える結論は、次の3つです。第一に、「現在地を測る資料」には成熟度、準備度、段階、地平という別の系譜があり、それぞれ測る対象が違います。第二に、どの枠組みで測っても上位の層は少数(財務成果による定義なら5%、自己申告の成熟度なら12〜18%)にとどまり、下位の層は35〜60%を占めます。経営層の自己評価は現場の利用を過小に、将来の成果を過大に見積もります。第三に、測定の目的は序列ではなく次の一手であり、そのためには軸を分ける必要があります。

本章の整理は、[3つの現在地の章](32-three-positions)の定義と、[AXプロジェクトの立ち上げの章](37-launching-ax-project)の診断の手順の根拠になります。次の章は、第Ⅳ部で未来を推論するための方法を扱います。
