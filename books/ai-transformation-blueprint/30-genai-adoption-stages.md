---
title: "第30章　生成AIはどう導入されてきたか ―― 6つの段階と各社の枠組み"
---

### 序論：本章が扱う範囲

本章から第Ⅴ部に入ります。[第Ⅱ部](11-individual-adoption)までで整理した事実と、[第Ⅲ部](20-diffusion-theory)の理論を土台に、企業が生成AIをどう取り込んできたかを「導入の深さ」という1本の物差しで整理します。

物差しは6段階です。「触れる」「仕事に適用する」「仕事に組み込む」「システムに組み込む」「商品に組み込む」「顧客へ届ける」の順に並びます。本書はこれをS1からS6と呼びます。この6段階は著者による整理です。コンサルティング会社や技術ベンダーは、それぞれ3段階から5段階の枠組みを公表しています。本章の後半で、それらの枠組みを6段階に対応づけます。対応づけも著者の判断であり、各発行元が相互の対応を主張しているわけではありません。

本章が扱わないことも先に示します。AIエージェントに固有の導入の問題は[AIエージェントの導入の章](31-agent-adoption-stages)で、自社の現在地を測る方法は[3つの現在地の章](32-three-positions)で、各段階に必要な人材・データ・費用は[各段階で必要なものの章](34-requirements-and-providers)で扱います。

### 1. 6つの段階の定義

| 段階 | 名前 | 定義 | 典型の形 |
| --- | --- | --- | --- |
| S1 | 触れる | 個人が試用する。業務の成果物には使わない | 無料のチャット、個人契約 |
| S2 | 仕事に適用する | 個人が自分の業務で使う。成果物は人が確認して出す | 会社契約のチャット型サービス |
| S3 | 仕事に組み込む | 部門の手順に組み込む。プロンプトや社内文書検索を共有する | 社内チャット基盤、利用規程、推進組織 |
| S4 | システムに組み込む | APIで自社システムと業務の流れに統合する。評価・監視・費用を管理する | 基盤モデルのAPI、エージェント基盤、観測 |
| S5 | 商品に組み込む | 自社の製品やサービスの機能として顧客に提供する | 製品内のAI機能、価格への反映 |
| S6 | 顧客へ届ける | 顧客接点でAIが自律的に価値を届ける。事業モデルが変わる | AIエージェントが顧客対応や取引を完結する |

段階を分ける軸は「誰の、どの判断を、どこまでAIに任せるか」です。S1とS2では、AIの出力を使うかどうかを個人が毎回決めます。S3とS4では、組織が手順として決めます。S5とS6では、顧客との関係の中で決まります。段階が上がるほど、AIの誤りが及ぶ範囲は個人から組織へ、組織から顧客へと広がります。したがって、段階が上がるほど評価と統治の仕組みが先に要ります。

この軸は、利用のデータでも裏づけられます。Anthropicが自社の利用記録を分析した2025年9月の報告によれば、対話型の利用では人がAIと協働する「増強」の型と作業を任せる「自動化」の型がほぼ半々で、この報告で初めて自動化が増強を上回りました。APIを通じた利用では、自動化の型が77%を占めました [ [ 116 ] ](https://www.anthropic.com/research/anthropic-economic-index-september-2025-report) 。対話型の利用はS2に、APIの利用はS4に対応します。同じモデルでも、組み込みの深さによって人の関わり方が変わります。

### 2. 各段階の典型の形と、つまずき

**S1：触れる**。従業員が個人の判断で無料のサービスを試す段階です。組織の判断は要りません。ここでのつまずきは、組織が知らないうちに業務情報が外部へ出ることです。Microsoftが2024年に31か国の31,000人を調べた報告では、職場でAIを使う人の78%が会社の提供でない自前のAIツールを持ち込んでいました [ [ 296 ] ](https://www.microsoft.com/en-us/worklab/work-trend-index/ai-at-work-is-here-now-comes-the-hard-part) 。S1は、組織が決める前に始まっています。

**S2：仕事に適用する**。会社が契約したチャット型のサービスを従業員に配る段階です。意思決定は「誰に配るか」「何を禁じるか」です。つまずきは、配っても使われないことと、個人の時間短縮が組織の成果に結びつかないことです。McKinseyの2026年の調査では、9割近くの組織が少なくとも1つの業務機能でAIを常用している一方、EBITの5%超をAIに帰属させる「高成果企業」は6%にとどまりました [ [ 136 ] ](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai) 。情報処理推進機構の2026年の調査でも、AI導入の効果として「業務が効率化・迅速化した」は91.6%の企業が挙げる一方、「売上が向上した」は3.9%でした [ [ 123 ] ](https://www.ipa.go.jp/pressrelease/2026/rcu1hd0000016yh4-att/press20260716.pdf) 。個人の効率と組織の収益の間に、段差があります。

**S3：仕事に組み込む**。部門の業務手順にAIの利用を書き込む段階です。プロンプトの雛形、社内文書を参照する検索、利用規程、推進担当者がそろいます。意思決定は「どの業務から」「誰が責任者か」です。つまずきは、手順を変えずにツールだけを足すことです。BCGは2025年の調査で、ツールを配る「Deploy」から業務の流れを再設計する「Reshape」へ進みつつある企業が半数だと報告しました [ [ 193 ] ](https://www.bcg.com/publications/2025/ai-at-work-momentum-builds-but-gaps-remain) 。これは移行の途中にある企業の割合で、到達した企業の割合ではありません。2026年の調査では、ReshapeかInventに到達した組織は42%で、前年の22%からほぼ倍増しています [ [ 194 ] ](https://www.bcg.com/publications/2026/ai-at-work-why-strategy-matters-more-than-tools) 。

**S4：システムに組み込む**。自社のシステムから基盤モデルのAPIを呼び、業務の流れの中でAIが処理を担う段階です。意思決定は「どのモデルを」「どう評価し、どう監視し、費用をどう管理するか」です。つまずきは、評価の仕組みなしに本番へ出すことです。OpenAIは企業向けの手引きで、7つの教訓の第一に「評価から始める」を置いています [ [ 209 ] ](https://cdn.openai.com/business-guides-and-resources/ai-in-the-enterprise.pdf) 。Gartnerは2025年6月、費用の増加と不明確な事業価値とリスク管理の不足により、エージェント型AIの案件の40%超が2027年末までに中止されると予測しました [ [ 181 ] ](https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027) 。

**S5：商品に組み込む**。自社の製品やサービスにAIの機能を載せ、顧客に提供する段階です。意思決定は「価格に乗せるか」「責任をどう分けるか」です。つまずきは、社内で検証していない機能を顧客に出すことです。日本のIT企業は、自社で先に使ってから顧客へ提供する順序を「クライアントゼロ」と呼びます。この順序は第5節で確認します。

**S6：顧客へ届ける**。AIが顧客接点で自律的に価値を届け、事業のモデルそのものが変わる段階です。2026年10月の時点で、この段階に到達したと一次資料で確認できる企業は少数です。BCGは、AIから規模のある価値を得ている「future-built」企業を全体の5%と推計しています [ [ 180 ] ](https://www.bcg.com/publications/2025/are-you-generating-value-from-ai-the-widening-gap) 。

### 3. 各社の枠組みとの対応

公表されている段階論の多くは3段階です。本書の6段階は、それらを細分したものに当たります。次の表は著者による対応づけです。段階名は発行元の表記のまま書きます。

| 枠組み | S1 触れる | S2 適用 | S3 組み込む | S4 システム | S5 商品 | S6 顧客 |
| --- | --- | --- | --- | --- | --- | --- |
| BCG Deploy / Reshape / Invent [ [ 193 ] ](https://www.bcg.com/publications/2025/ai-at-work-momentum-builds-but-gaps-remain) | Deploy | Deploy | Reshape | Reshape | Invent | Invent |
| Microsoft Frontier Firm の3相 [ [ 204 ] ](https://www.microsoft.com/en-us/worklab/work-trend-index/2025-the-year-the-frontier-firm-is-born) | Human with assistant | Human with assistant | Human-agent teams | Human-led, agent-operated | ― | ― |
| OpenAI assistance → delegation [ [ 211 ] ](https://openai.com/signals/enterprise-data) | assistance | assistance | delegation | delegation | ― | ― |
| Anthropic augmentation / automation [ [ 116 ] ](https://www.anthropic.com/research/anthropic-economic-index-september-2025-report) | augmentation | augmentation | automation | automation | ― | ― |
| MIT CISR の4段階 [ [ 201 ] ](https://cisr.mit.edu/publication/2025_0801_EnterpriseAIMaturityUpdate_WoernerSebastianWeillKaganer) | Stage 1 Experiment and Prepare | Stage 2 Build Pilots and Capabilities | Stage 3 Develop AI Ways of Working | Stage 3 | Stage 4 Become AI Future Ready | Stage 4 |
| IDC MaturityScape [ [ 199 ] ](https://www.idc.com/resource-center/blog/ai-strategy-is-easier-to-define-than-to-deliver-idcs-benchmark-shows-the-gap) | Ad hoc | Opportunistic | Repeatable | Managed | Managed | Optimized |
| Gartner AI Maturity [ [ 186 ] ](https://www.gartner.com/en/newsroom/press-releases/2025-06-30-gartner-survey-finds-forty-five-percent-of-organizations-with-high-artificial-intelligence-maturity-keep-artificial-intelligence-projects-operational-for-at-least-three-years) | Level 1 planning/beginning | Level 2 | Level 3 | Level 4 | Level 5 leadership | Level 5 |
| Deloitte 2026 の3群 [ [ 139 ] ](https://www.deloitte.com/us/en/what-we-do/capabilities/applied-artificial-intelligence/content/state-of-ai-in-the-enterprise.html) | surface level | surface level | redesigning key processes | redesigning key processes | deeply transform | deeply transform |
| Agrawal, Gans & Goldfarb [ [ 281 ] ](https://store.hbr.org/product/power-and-prediction-the-disruptive-economics-of-artificial-intelligence/10580) | point solution | point solution | application solution | system solution | system solution | ― |
| Nolan の6段階 [ [ 219 ] ](https://hbr.org/1979/03/managing-the-crises-in-data-processing) | Initiation | Contagion | Control | Integration | Data administration | Maturity |
| 経済産業省 DX推進指標 [ [ 225 ] ](https://www.ipa.go.jp/pressrelease/2025/press20250507.html) | レベル1 一部での散発的実施 | レベル2 一部での戦略的実施 | レベル3 部門横断的推進 | レベル4 持続的実施 | レベル5 | レベル5 |
| IPA DX動向2025 の設問 [ [ 227 ] ](https://www.ipa.go.jp/digital/chousa/dx-trend/tbl5kb0000001mn2-att/dx-trend-2025.pdf) | 個人や部署で試験利用 | 個人で業務利用 | 部署の業務プロセスに組み込まれている | 業務全般・全社的な活用 | ― | ― |
| 経団連 AI活用戦略Ⅱ [ [ 229 ] ](https://www.keidanren.or.jp/policy/2023/067_honbun.html) | AI-Ready | AI-Ready | AI-Powered | AI-Powered | AI-Powered | AI-Powered |

表から3つのことが読み取れます。

第一に、海外の枠組みはS1とS2、S3とS4、S5とS6をそれぞれ1つにまとめる傾向があります。本書がS3とS4を分ける根拠は、前節で示した利用データの差です。対話型の利用とAPIの利用では、人の関わり方が逆転します。

第二に、ベンダーの枠組みはS4で終わります。Microsoft、OpenAI、Anthropicの3社は、いずれも「人が支援を受ける」から「エージェントに委任する」への移行を描いていますが、顧客向けの商品化は扱いません。利用者である企業が、自社の商品にどう載せるかはベンダーの範囲外だからです。

第三に、日本の公的な設問はS1からS4までを細かく分けています。IPAの設問は「個人や部署で試験利用」「個人で業務利用」「部署の業務プロセスに組み込まれている」「業務全般・全社的な活用」の4区分です [ [ 227 ] ](https://www.ipa.go.jp/digital/chousa/dx-trend/tbl5kb0000001mn2-att/dx-trend-2025.pdf) 。本書のS1からS4は、この設問の区分とほぼ重なります。

古典との対応も付記します。Nolanが1979年に示した6段階は、計算機の導入が「散発的な伝染」の後に「統制」の段階を迎えると述べました [ [ 219 ] ](https://hbr.org/1979/03/managing-the-crises-in-data-processing) 。生成AIにおいて、従業員が勝手に使い始めた後に利用規程が作られる順序は、この型と同じです。Agrawal、Gans、Goldfarbは2022年の著書で、AIの導入が既存の判断を置き換える「点の解決」にとどまり、判断の相互依存を組み直す「システムの解決」に至っていないと論じました [ [ 281 ] ](https://store.hbr.org/product/power-and-prediction-the-disruptive-economics-of-artificial-intelligence/10580) 。本書のS2が点の解決、S4以降がシステムの解決に当たります。Zuboffは1988年に、情報技術が仕事を「自動化する」作用と、活動を情報に変えて「可視化する」作用の両方を持つと述べました [ [ 221 ] ](https://shoshanazuboff.com/book/books/in-the-age-of-the-smart-machine) 。Anthropicの「自動化」と「増強」の区分は、この二重性の現代版と読めます。

### 4. 段階の分布

各段階に企業がどれだけいるかは、調査によって母集団と定義が異なります。数値を並べるときは、何を数えたかを添える必要があります。

| 調査 | 上位層 | 中間層 | 下位層 | 母集団と時点 |
| --- | --- | --- | --- | --- |
| McKinsey [ [ 136 ] ](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai) | high performers 6% | 全社でスケール中 44% | ― | 97か国1,719人、2026年5〜6月 |
| BCG [ [ 180 ] ](https://www.bcg.com/publications/2025/are-you-generating-value-from-ai-the-widening-gap) | future-built 5% | scaling 約35% | laggards 60% | 1,250社超、2025年 |
| MIT CISR [ [ 201 ] ](https://cisr.mit.edu/publication/2025_0801_EnterpriseAIMaturityUpdate_WoernerSebastianWeillKaganer) | Stage 4 18% | Stage 3 46% | Stage 1〜2 36% | 2025年(2022年はStage 4が7%) |
| IDC [ [ 199 ] ](https://www.idc.com/resource-center/blog/ai-strategy-is-easier-to-define-than-to-deliver-idcs-benchmark-shows-the-gap) | Optimized 3.1% | Repeatable + Managed 35.6% | Ad hoc + Opportunistic 61.3% | 20市場1,900組織、2026年 |
| Deloitte [ [ 139 ] ](https://www.deloitte.com/us/en/what-we-do/capabilities/applied-artificial-intelligence/content/state-of-ai-in-the-enterprise.html) | deeply transform 34% | redesigning key processes 30% | surface level 37% | 24か国3,235人、2025年8〜9月 |
| Accenture [ [ 195 ] ](https://newsroom.accenture.com/news/2022/more-than-60-percent-of-companies-are-only-experimenting-with-ai-creating-significant-opportunities-for-value-on-their-journey-to-ai-maturity-accenture-research-finds) | Achievers 12% | Builders 12%、Innovators 13% | Experimenters 63% | 1,200社、2022年 |

財務成果で上位層を定義する調査では、上位層は5%から6%です。自己申告で段階を答える調査では、上位層が18%から34%になります。IDCは、自らを上位層と答えた組織の84.9%が実際の採点ではRepeatable以下だったと報告しています [ [ 199 ] ](https://www.idc.com/resource-center/blog/ai-strategy-is-easier-to-define-than-to-deliver-idcs-benchmark-shows-the-gap) 。自己申告は、実際の段階より高く出ます。この性質は、[3つの現在地の章](32-three-positions)の自己診断を使うときの前提になります。

日本の分布は、公的統計で追えます。IPAの2026年の報告では、生成AIを「導入している」企業は2024年度の22.6%から2025年度の44.0%へ増え、「試験利用中」の15.6%を合わせると59.6%でした [ [ 124 ] ](https://www.ipa.go.jp/digital/chousa/dx-trend/rcu1hd0000017uk8-att/dx-trend-2026.pdf) 。総務省の2025年度の調査では、生成AIによる業務変革について「組織的な取組はない」と答えた日本企業が約3割弱で、他の3か国より高い割合でした [ [ 107 ] ](https://www.soumu.go.jp/main_content/001082851.pdf) 。経済産業省は2024年6月の時点で、社内での利活用は進んだ一方、日常業務への組み込みと新サービスの創出と経営層の関与が停滞していると総括しています [ [ 226 ] ](https://www.meti.go.jp/press/2024/06/20240628006/20240628006.html) 。S2までは広がり、S3から先が細い、というのが日本の分布の形です。

### 5. 日本企業の事例を段階に当てる

一次資料で経過が追える企業を、段階に当てはめます。段階の判定は著者によるものです。

**パナソニック コネクト**は、2023年2月に全社員約12,400人へ汎用のAIアシスタントを配り、2023年9月に自社の公開情報で特化型を試験し、2024年4月に社外秘の品質管理文書を参照する特化型を本番にしました。2025年度には業務プロセスにAIエージェントの活用を始めると公表しています [ [ 232 ] ](https://news.panasonic.com/jp/press/jn240625-1) 。2025年度の実績は、利用回数361万回、総労働時間の削減効果78.8万時間で、年間の総労働時間の3.4%に相当します [ [ 537 ] ](https://news.panasonic.com/jp/press/jn260729-1) 。S2からS3を経てS4へ、1年に1段ずつ進んだ経過を年次で公表している例です。

**LINEヤフー**は、2025年7月に全従業員約11,000人へ生成AIの活用を義務づけました。必須のeラーニングの合格を利用の条件にし、調査・資料作成・会議という共通の業務について「まずはAIに聞く」などの規則を定め、全部署に推進者を置きました [ [ 238 ] ](https://www.lycorp.co.jp/ja/news/release/018121) 。S1を飛ばしてS2とS3を同時に始めた例です。

**三菱UFJ銀行**は、2023年11月に行員約4万人へChatGPTの利用を開放し、110の業務への適用で月22万時間以上の削減に相当するという試算をまとめたと報じられました [ [ 236 ] ](https://www.nikkei.com/article/DGXZQOUB270LP0X21C23A1000000) 。この数値は報道であり、試算値です。その後、2025年11月にMUFGと三菱UFJ銀行はOpenAIと戦略的な契約を結び、2026年1月以降に全行員約35,000人へChatGPT Enterpriseを順次展開すると公表しました [ [ 538 ] ](https://www.bk.mufg.jp/news/news2025/pdf/news1112.pdf) 。S2の全行展開からS3へ進む途上にあります。

**ソフトバンク**は、2025年6月から全社員に1人100個のAIエージェントを作る取り組みを始め、2か月半で250万個を超えました。同社はこの狙いを、AIを使うことを日常の行動に変える文化づくりだと説明しています [ [ 241 ] ](https://www.softbank.jp/sbnews/entry/20251204_01) 。2026年の年頭所感では、子会社のGen-AXがコンタクトセンター向けのサービス提供を始めたことに触れています [ [ 539 ] ](https://www.softbank.jp/corp/news/press/sbkk/2026/20260101_01) 。S1とS2を量で押し上げ、S5へ進もうとする例です。

**日立製作所**は、2023年5月に推進組織「Generative AIセンター」を設け、グループ32万人の業務で利用してノウハウを蓄積し、顧客にも安全な利用環境を提供する価値創出の循環を掲げました [ [ 233 ] ](https://www.hitachi.com/ja-jp/press/articles/2023/05/0515) 。**NEC**は、約4万人の社員が社内サービスを約1年使った対話履歴を分析し、2024年4月に自社の大規模言語モデルを発表しました [ [ 542 ] ](https://jpn.nec.com/press/202404/20240424_01.html) 。**NTTデータグループ**は、2025年10月の時点で生成AI関連の受注が2,000件を超え、実践的な人材7万人を2027年度までに全社員約20万人へ広げると公表しています [ [ 243 ] ](https://www.nttdata.com/global/ja/news/release/2025/102900) 。IT企業は、自社をS2からS4で先に使い、その知見をS5とS6として顧客へ提供する循環を明示的に設計しています。

**サイバーエージェント**は、2023年5月に独自の日本語モデルを広告の製品に組み込み、2023年10月に全社員向けの推進組織を新設して、2026年までにオペレーション業務の6割削減を掲げました [ [ 239 ] ](https://www.cyberagent.co.jp/news/detail/id=29442) 。S5がS3より先に来た例です。**メルカリ**は、社員の95%がAIを使い、コード生成の約70%をAIが担うと公表しながら、現在の状態を「AI-Native」とは捉えていないと自己評価しています [ [ 240 ] ](https://engineering.mercari.com/blog/entry/20251225-mercari-ai-native-company) 。利用率が高くても、仕事の設計を変えるS3は別の仕事だという認識です。

### 6. 段階は直線ではない

6段階は順番に進むとは限りません。Microsoftは、Frontier Firmへの道は直線ではなく、多くの組織が3つの相に同時にいると述べています [ [ 204 ] ](https://www.microsoft.com/en-us/worklab/work-trend-index/2025-the-year-the-frontier-firm-is-born) 。前節の事例でも、S1を飛ばした企業、S5が先行した企業、S2を量で押し上げてからS3を目指す企業がありました。

段階の後退もあります。KPMGの米国企業への四半期調査では、AIエージェントを配備した組織の割合が2025年第3四半期の42%から第4四半期には26%へ下がりました [ [ 197 ] ](https://kpmg.com/us/en/media/news/q3-ai-pulse.html) 。ServiceNowの成熟度指数は、2年目に平均が44から35へ9ポイント下がり、到達目標が上がったためだと説明されています [ [ 200 ] ](https://www.servicenow.com/workflow/ai/enterprise-ai-maturity-index-2025.html) 。段階は、技術の進歩とともに定義そのものが動きます。

したがって6段階は、順に登る階段ではなく、自社の業務ごとに現在地を置く目盛りとして使うのが適切です。ある業務はS4にあり、別の業務はS1にある、という状態が普通です。

### 🗺️ 図：導入の深さ6段階 ―― 判断を任せる相手が広がる

![導入の深さの6段階。S1 触れる。S2 仕事に適用する。S3 仕事に組み込む。S4 システムに組み込む。S5 商品に組み込む。S6 顧客へ届ける。判断の主体は個人から組織へ、組織から顧客へ広がる](/images/ai-transformation-blueprint/30-genai-adoption-stages.png)

#### 図の読み方

この図は、下から上へ6つの段を積んだ階段です。各段に段階の番号と名前を置き、右側に「誰が判断するか」を添えています。下の2段は個人が判断し、中の2段は組織が手順として判断し、上の2段は顧客との関係の中で判断が決まります。

段の色は、下の2段が薄い藍、中の2段が藍、上の2段が濃い藍です。色の濃さは、AIの誤りが及ぶ範囲の広さを表します。図の下に添えた一文「判断を任せる相手が、個人から組織へ、組織から顧客へ広がる」が、本章の主張です。

図は段階の順序を示しますが、第6節で述べたとおり、企業は必ずしもこの順に進みません。図を読むときは、自社の業務を1つずつ段に置いてみてください。

### 経営層への含意

本章の6段階と各社の枠組みとの対応は、著者による整理です。各発行元の枠組みは、それぞれの調査の目的に合わせて作られており、相互に互換性があるわけではありません。本書の6段階を使う利点は、ベンダーの枠組みが扱わないS5とS6まで含めて、1本の物差しで自社の業務を並べられることにあります。

経営層が本章から持ち帰るべき点は3つです。

第一に、S2までの普及とS3以降の組み込みは別の仕事です。配ることは契約で済みますが、組み込むことは業務の設計を変える仕事です。日本の公的統計は、S2までが広がりS3から先が細い分布を示しています。自社がどちら側にいるかを、個人の利用率ではなく、手順に書き込まれた業務の数で測る必要があります。

第二に、段階が上がるほど、評価と統治の仕組みが先に要ります。S4以降でつまずく主因は、モデルの性能ではなく、評価の不在と費用管理の不在です。Gartnerの中止予測もOpenAIの手引きも、同じ点を指しています。

第三に、自己申告は実際より高く出ます。IDCの採点では、自称上位層の大半が中位以下でした。自社の現在地は、利用者の感想ではなく、[3つの現在地の章](32-three-positions)に示す観察可能な事実から判定するのが安全です。
