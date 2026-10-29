---
title: "第22章　3つの道筋 ―― 自動化・人手回帰・規制主導、分岐条件と早期警戒指標"
---

### 序論：本章が扱う範囲

著者は、2026年10月時点の観測に最も近いのは、自動の採点が道具として広がりながら、合否の最終判定が人に残る状態だと考えます。道筋A(自動化)の道具と、道筋B(人手回帰)の判定の構造が混ざった状態です。道筋C(規制主導)は日付の確定した予定として進んでいますが、評価の中身を決める段階にはまだ来ていません。これは著者の意見です。本章の表と指標は、読者がこの見立てを確かめ、必要なら覆すための材料です。

本章は、[言説の分類の章](21-discourse-taxonomy)で分けた3つの方向を、2027年・2029年・2031年の像として描きます。続けて、道筋が分かれる条件と、どの道筋へ進んでいるかを知らせる早期警戒指標を一覧にします。最後に、各道筋に対応する「後悔しない手」「選択権を買う手」「賭ける手」を示します。3種類の手の型は、本編『AIトランスフォーメーションの設計図』の道筋別の戦略と同じです。

本章は確率を割り当てません。年限つきの像は、規則の適用日のように日付の確定した事実を骨組みにし、そこから著者が推論したものです。評価を主語にした数値の予測は、本書の調査ではGartnerのものしか一次資料がありません。それ以外の数値は作りません。

### 1. 出発点：2026年10月の事実

3つの道筋は、同じ出発点から分かれます。

- **自動の採点は普及の途中にある**。LangChainの2025年11〜12月の調査(1,340回答。評価の道具を提供する事業者による調査)では、審判モデルを使う組織が53.3%、人によるレビューが59.8%でした [ [ 423 ] ](https://www.langchain.com/state-of-agent-engineering) 。どちらも過半をわずかに超える程度です。
- **審判モデルへの評価は下がった**。Thoughtworksは2025年11月に、審判モデルを技術の採用段階のTrialからAssessへ下げました [ [ 358 ] ](https://www.thoughtworks.com/radar/techniques/llm-as-a-judge) 。
- **評価の基盤は動いている**。OpenAIは自社のEvalsプラットフォームを2026年11月30日に停止する予定です [ [ 128 ] ](https://developers.openai.com/api/docs/deprecations) 。観測の共通規格であるOpenTelemetryのGenAI規約は、2026年10月時点でも未安定の段階です [ [ 401 ] ](https://github.com/open-telemetry/semantic-conventions-genai) 。
- **規制の日付は決まっている**。EU AI Actの汎用AI(GPAI)モデルの義務は2025年8月2日から適用されています [ [ 546 ] ](https://artificialintelligenceact.eu/article/113/) 。2026年7月の改正(デジタル・オムニバス)は、附属書IIIの高リスク規定を2027年12月2日に、附属書Iを2028年8月2日に延期しました [ [ 559 ] ](https://eur-lex.europa.eu/eli/reg/2026/1744/oj) [ [ 546 ] ](https://artificialintelligenceact.eu/article/113/) 。
- **日本は観点を示し、計画を毎年改める**。AI推進法には出力の評価方法を直接定める条文がありません [ [ 580 ] ](https://www.shugiin.go.jp/internet/itdb_housei.nsf/html/housei/21720250604053.htm) 。人工知能基本計画は当面毎年改定とされ、第Ⅱ期は2026年7月14日に閣議決定されました [ [ 581 ] ](https://www.cao.go.jp/press/new_wave/20260206.html) 。

### 2. 3つの道筋の像

次の表は、3つの道筋の2027年・2029年・2031年の像です。各欄は著者の推論で、根拠は表の後に示します。

| 時期 | 道筋A：自動化 | 道筋B：人手回帰 | 道筋C：規制主導 |
| --- | --- | --- | --- |
| 2027年前後 | 審判モデルによる採点が、開発中の回帰検査の既定になる。人は審判の較正だけを担う | 審判の失敗の公表が重なり、合否の最終判定を人に戻す組織が増える | 既存のGPAIモデルの遵守期限と、附属書IIIの高リスク規定の適用が来る。評価の記録の書式が規則で決まり始める |
| 2029年前後 | 本番の記録を審判が全件採点し、人は審判が判定に迷った出力だけを見る | ドメイン専門家による評価が職能になり、評価者の採用と単価の市場ができる | 整合規格に沿った評価と市販後の監視が、調達の条件になる |
| 2031年前後 | 較正の記録つきの自動評価を、規制当局が適合の証拠として受け入れる | 自動評価は候補の絞り込みに限られ、高リスクの用途では専門家の署名が評価の条件になる | 適合性評価と認証が、何をどの頻度で測るかを規定する |
| 支える言説の担い手 | クラウド事業者、評価の提供事業者、モデルの提供者の製品文書 | 審判モデルを検証した研究者、実装を担う実務家 | 規制当局、第三者評価の組織と運営者 |

**道筋Aの根拠**。AWSは2024年12月に審判モデルとRAG評価をクラウドの機能として公開し、人手評価の数分の1の費用で人並みの品質と説明しました [ [ 394 ] ](https://aws.amazon.com/blogs/aws/new-rag-evaluation-and-llm-as-a-judge-capabilities-in-amazon-bedrock) 。人の評価で知られる運営者Arenaも、2026年7月に報酬モデルによる即時の採点を加えました [ [ 627 ] ](https://arena.ai/blog/autoeval-scores) 。2031年の像の時期は、GartnerがAI TRiSMの主流化を5年以内と予測した範囲 [ [ 657 ] ](https://www.gartner.com/en/newsroom/press-releases/2025-08-05-gartner-hype-cycle-identifies-top-ai-innovations-in-2025) です。

**道筋Bの根拠**。審判モデルは最大級のものでも人間同士の一致に届かず [ [ 628 ] ](https://arxiv.org/abs/2406.12624) 、評価対象の問題を継承します [ [ 346 ] ](https://arxiv.org/abs/2404.12272) 。評価の空白を当事者が明文にした例もあります。OpenAIは2025年5月に、迎合に傾いた更新が小規模のA/Bテストでは見つからなかったと述べました [ [ 303 ] ](https://openai.com/index/expanding-on-sycophancy/) 。Anthropicは2025年9月に、品質の劣化の検出が遅れた理由の1つに、ノイズの多い評価への依存を挙げています [ [ 494 ] ](https://www.anthropic.com/engineering/a-postmortem-of-three-recent-issues) 。

**道筋Cの根拠**。EU AI Actは、2025年8月2日より前の上市のGPAIモデルについて、2027年8月2日までの遵守を求めます [ [ 545 ] ](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng) 。高リスクAIの市販後の監視計画の雛形は、2027年9月2日までに欧州委員会が示します [ [ 552 ] ](https://artificialintelligenceact.eu/article/72/) 。整合規格は2026年第4四半期までの利用可能化が目標です [ [ 557 ] ](https://www.cencenelec.eu/news-events/news/2025/brief-news/2025-10-23/) 。認証の側では、ISO/IEC 42001の認証機関への要求事項が2025年7月に発行され、認証の手続きが始まりました [ [ 612 ] ](https://www.pwc.com/jp/ja/press-room/2025/iso42001.html) 。

### 3. 分岐条件

分岐は軸ごとに判定します。審判モデルの利用が広がりながら最終判定が人に残る、という組み合わせは両立します。各道筋へ進む条件は次のとおりです。

**道筋Aへ**。第一に、審判のバイアスの研究が収束し、位置・長さ・自己ひいきの補正法が定まること。第二に、主要な事業者の評価APIが普及し、停止しないこと。第三に、規制当局が自動評価を適合の証拠として認めること。3つ目が最も強い条件です。

**道筋Bへ**。第一に、審判モデルの失敗事例が公表され、累積すること。第二に、専門職による評価の市場が形成されること。第三に、人手評価の費用が下がること。2026年10月時点では、AWSの人手評価は1件0.21ドル [ [ 395 ] ](https://aws.amazon.com/bedrock/pricing/) 、Prolificの参加者への最低報酬は時給8ドルで企業の手数料は42.8%です [ [ 407 ] ](https://www.prolific.com/pricing) 。Amazon Mechanical Turkは2026年9月30日に閉鎖されました [ [ 408 ] ](https://www.mturk.com/pricing) 。

**道筋Cへ**。第一に、EU AI ActのGPAIの義務が執行されること。第二に、ISO/IEC 42001の認証が調達の条件として普及すること。第三に、日本の基本計画と政府調達の要件に評価が書き込まれること。デジタル庁の2025年5月のガイドラインは、利用の前に出力の精度とリスクの程度を理解するよう求めています [ [ 583 ] ](https://www.digital.go.jp/assets/contents/node/basic_page/field_ref_resources/e2a06143-ed29-4f1d-9c31-0f06fca67afc/80419aea/20250527_resources_standard_guidelines_guideline_01.pdf) 。

### 4. 早期警戒指標

経営会議で見るのは、上位の3つだけです。1つ目は、審判モデルと人によるレビューの利用率の差です。2つ目は、EUの整合規格の発行と高リスク規定の適用日です。3つ目は、主要な事業者が審判モデルをどう位置づけているかです。選び方は著者の判断です。次の表は、本書が追跡を勧める指標の全体です。

| 指標 | 現在値(時点) | 出典 | 動いたときに示す方向 | 確認の頻度 |
| --- | --- | --- | --- | --- |
| 審判モデルと人によるレビューの利用率 | 53.3%と59.8%(2025年11〜12月) | LangChain [ [ 423 ] ](https://www.langchain.com/state-of-agent-engineering) | 審判が人を上回り差が開けばA。人が維持か上昇ならB | 年次 |
| オフライン評価とオンライン評価の実施率 | 39.8%と32.5%(2024年)から52.4%と37.3%(2025年) | LangChain [ [ 422 ] ](https://www.langchain.com/stateofaiagents) [ [ 423 ] ](https://www.langchain.com/state-of-agent-engineering) | どの道筋でも上がる。伸びが止まればBの像に近い | 年次 |
| 技術助言の格付けでの審判モデルの位置 | Assess(2025年11月) | Thoughtworks [ [ 358 ] ](https://www.thoughtworks.com/radar/techniques/llm-as-a-judge) | TrialかAdoptへ戻ればA。Holdへ下がればB | 半年 |
| 人の評価の運営者による自動採点 | AutoEvalを導入(2026年7月) | Arena [ [ 627 ] ](https://arena.ai/blog/autoeval-scores) | 人の投票なしの順位が主になればA | 半年 |
| 人手評価の単価 | 1件0.21ドル。最低時給8ドル、手数料42.8% | AWS [ [ 395 ] ](https://aws.amazon.com/bedrock/pricing/) 、Prolific [ [ 407 ] ](https://www.prolific.com/pricing) | 下がればB | 年次 |
| 評価の空白を明記した事後報告 | 迎合(2025年5月)、品質劣化(2025年9月)、評価認識(2026年3月) | OpenAI [ [ 303 ] ](https://openai.com/index/expanding-on-sycophancy/) 、Anthropic [ [ 494 ] ](https://www.anthropic.com/engineering/a-postmortem-of-three-recent-issues) [ [ 619 ] ](https://www.anthropic.com/engineering/eval-awareness-browsecomp) | 累積すればB。当局が報告を求めればC | 随時 |
| EUの整合規格と適用日 | 規格は2026年第4四半期が目標。附属書IIIは2027年12月2日 | CEN/CENELEC [ [ 557 ] ](https://www.cencenelec.eu/news-events/news/2025/brief-news/2025-10-23/) 、EU [ [ 559 ] ](https://eur-lex.europa.eu/eli/reg/2026/1744/oj) | 規格が発行され延期が止まればC | 半年 |
| ISO/IEC 42001の認証 | AWS(2024年)、Anthropic(2025年)、NTTデータ(2025年12月)。件数の一次統計は未確認 | [ [ 608 ] ](https://aws.amazon.com/blogs/machine-learning/aws-achieves-iso-iec-420012023-artificial-intelligence-management-system-accredited-certification) [ [ 609 ] ](https://www.anthropic.com/news/anthropic-achieves-iso-42001-certification-for-responsible-ai) [ [ 611 ] ](https://www.tuv.com/press/en/press-releases/nttdatagroup-iso42001-certification.html) | 調達の条件に入ればC | 年次 |
| 日本の計画と指針 | 基本計画の第Ⅱ期(2026年7月)。AISIの評価観点ガイド第1.20版(2026年7月) | 内閣府 [ [ 581 ] ](https://www.cao.go.jp/press/new_wave/20260206.html) 、AISI [ [ 571 ] ](https://aisi.go.jp/output/output_framework/guide_to_evaluation_perspective_on_ai_safety/) | 調達の要件に評価観点が入ればC | 年次 |
| エージェント型AIの案件の中止 | 2027年末までに40%超が中止(2025年6月の予測) | Gartner [ [ 656 ] ](https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027) | 予測を上回る中止に評価の不足が挙げられればBかC | 年次 |

指標の読み方を2点補足します。第一に、1つの指標で道筋を判定しません。審判モデルの利用率が上がっても、人によるレビューの率が下がらなければ、それは道筋Aではありません。第二に、調査の母集団に注意が要ります。LangChainの調査は評価の道具を提供する事業者によるもので、回答者が評価に関心の高い組織に偏る可能性があります。同じ調査を年をまたいで追うことが原則です。

### 5. 後悔しない手、選択権を買う手、賭ける手

次の表は、3種類の手を道筋に対応させたものです。分類と表の各欄は著者の整理です。

| 手の種類 | 内容 | 根拠 |
| --- | --- | --- |
| 後悔しない手 | 本番か想定の失敗から20〜50件のゴールデンセットを作り、更新し続ける | Anthropic [ [ 406 ] ](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) |
| 後悔しない手 | 何を・いつ・誰が・どの基準で測ったかを記録する。EUの技術文書が求める評価基準・指標・限界の記述と同じ骨格にする | EU AI Act附属書XI [ [ 550 ] ](https://artificialintelligenceact.eu/annex/11/) |
| 後悔しない手 | 審判モデルを使うなら、人のラベルで較正し、一致の度合いを記録する | Husain・Shankar [ [ 351 ] ](https://hamel.dev/blog/posts/evals-faq/) |
| 後悔しない手 | 評価のデータと記録を、特定の事業者の基盤の外へ持ち出せる形で持つ | OpenAIの停止予定 [ [ 128 ] ](https://developers.openai.com/api/docs/deprecations) |
| 選択権を買う手 | 本番の記録を採取し、抜き取りで人が見る仕組みを用意する(第Ⅲ部のV3の準備) | Langfuse [ [ 403 ] ](https://langfuse.com/docs/evaluation/overview) |
| 選択権を買う手 | 判定の最終責任を持つドメイン専門家を1人決める | Husain・Shankar [ [ 351 ] ](https://hamel.dev/blog/posts/evals-faq/) |
| 選択権を買う手 | ISO/IEC 42001の要求事項と自社の差を調べておく | PwC Japan [ [ 612 ] ](https://www.pwc.com/jp/ja/press-room/2025/iso42001.html) |
| 賭ける手(道筋A) | 審判モデルを本番の合否の関門に置き、継続的インテグレーション(CI)で自動で止める | DeepEval [ [ 415 ] ](https://deepeval.com/docs/evaluation-unit-testing-in-ci-cd) |
| 賭ける手(道筋B) | 評価者を社内の職能として採用・育成し、評価の部門を作る | 著者の推論 |
| 賭ける手(道筋C) | 認証を取得し、適合性評価と市販後監視の体制を先に作る | AWS [ [ 608 ] ](https://aws.amazon.com/blogs/machine-learning/aws-achieves-iso-iec-420012023-artificial-intelligence-management-system-accredited-certification) |

後悔しない手は、3つの道筋のどれでも使えます。ゴールデンセットは、道筋Aでは審判の較正に、道筋Bでは専門家の採点の基準に、道筋Cでは適合の証拠に使えます。賭ける手は、後悔しない手の上に乗ります。ゴールデンセットと記録のない組織が審判モデルで合否を自動化すれば、外れたときの損失を測れません。

### 🗺️ 図：3つの道筋は「誰が最後に判定するか」で分かれる ―― 下の段はどの道筋でも要る

![上段は3つの道筋の箱、下段は3つすべてをまたぐ後悔しない手の帯の図。道筋Aは審判モデル、道筋Bは専門家、道筋Cは規制と認証が最後に判定する](/images/genai-evaluation-blueprint/22-three-paths.png)

#### 図の読み方

図は上下の2段です。上段の3つの箱が道筋で、左から道筋A(藍)、道筋B(丹の縁取り)、道筋C(黄土色)です。各箱の下の行に、2031年に最後の判定をする者を書きました。道筋Aは審判モデル、道筋Bはドメイン専門家、道筋Cは規制と認証です。丹は人が判定する場所にだけ使っています。

下段の千歳緑の帯は、3つの道筋すべてにまたがる後悔しない手です。ゴールデンセット、評価の記録、審判の較正の3つを書きました。本文の第5節の表で、後悔しない手の上の3行に対応します。図の下の添え書きのとおり、道筋に賭けるのは上段だけです。

### 本道筋が外れる条件

3つの道筋の枠組みそのものが外れる条件を、著者の推論として3つ挙げます。

第一に、評価がモデルの訓練の中に吸収される場合です。検証できる報酬で訓練されたモデルが、自分の出力の検査まで内部で担えるようになれば、外部の評価の主語を問う3つの道筋は意味を失います。ただし、OpenAIは思考の過程を直接罰すると意図を隠すようになると報告しており [ [ 616 ] ](https://openai.com/index/chain-of-thought-monitoring/) 、内部の検査を外から確かめる問題は残ります。

第二に、評価の中身が規制ではなく、保険や賠償の側から決まる場合です。本書の調査はこの経路を扱っていません。これは本書の弱い環です。

第三に、3つの道筋が同時に進む場合です。社内の文書検索は道筋A、医療や法務の判断は道筋B、EUの高リスク用途は道筋C、という用途ごとの分かれ方は十分ありえます。この場合、道筋の判定は組織全体ではなく用途ごとに行います。

各道筋が個別に外れる条件もあります。道筋Aは、審判モデルの失敗が規制当局の執行の対象になれば外れます。道筋Bは、評価の専門職の単価が下がらず、評価が一部の大企業の特権にとどまれば外れます。道筋Cは、EUの延期が続き、整合規格が予定どおりに出なければ外れます。

### 経営層への含意

本章の像と表は著者の推論であり、各社の判断を代替しません。経営層が持ち帰るべき点を3つ述べます。

第一に、道筋が決まる前に打てる手があります。ゴールデンセット、評価の記録、審判の較正は、どの道筋でも無駄になりません。多くの組織は、まだこの3つを持っていません。

第二に、評価の資産は事業者の外に置きます。評価の基盤を提供する事業者は、2年で撤退することがあります。データと記録を持ち出せる形で持つことは、費用の小さな保険です。

第三に、見る指標は四半期に1回で足ります。審判モデルと人によるレビューの利用率、EUの規格と適用日、主要な事業者の審判モデルの位置づけの3つを、担当を決めて追います。最初の90日で何をするかは、次の[評価体制の立ち上げの章](23-launching-evaluation)で扱います。
