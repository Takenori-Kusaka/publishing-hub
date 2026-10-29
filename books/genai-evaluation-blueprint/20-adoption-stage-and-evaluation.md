---
title: "第20章　導入フェーズと評価 ―― S1〜S6で要る評価、提供事業者と費用"
---

### 序論：本章が扱う範囲

本章は、本書の枠組みを本編『AIトランスフォーメーションの設計図』に接続します。本編は、企業が生成AIを取り込む深さをS1からS6の6段階で定義しました。各段階の名前は、第1節の表の1列目に示します。定義は本編の[生成AIの導入段階の章](https://zenn.dev/takenori_kusaka/books/ai-transformation-blueprint/viewer/30-genai-adoption-stages)にあります。

本編の[各段階で必要なものの章](https://zenn.dev/takenori_kusaka/books/ai-transformation-blueprint/viewer/34-requirements-and-providers)は、評価の要素を「個人の確認」「手順での確認、利用率」「自動の評価、監視、誤り率」「製品の品質指標、顧客の成果指標」と段階ごとに置きました。本章はこの評価の行を、本書の10項目と成熟度V0からV4で細かくします。

本章の対応づけは、すべて著者による整理です。提供事業者の名前は、本書の調査で一次資料により提供を確認できたものに限ります。費用は、一次資料に数値があるものだけを書きます。

### 1. 段階と評価の対応表

自社の用途がどの段階かを決めるため、各段階の本編での定義を要約します。全文は本編の[生成AIの導入段階の章](https://zenn.dev/takenori_kusaka/books/ai-transformation-blueprint/viewer/30-genai-adoption-stages)にあります。

| 導入の段階 | 本編の定義 |
| --- | --- |
| S1触れる | 個人が試用する。業務の成果物には使わない |
| S2仕事に適用する | 個人が自分の業務で使う。成果物は人が確認して出す |
| S3仕事に組み込む | 部門の手順に組み込む。プロンプトや社内文書検索を共有する |
| S4システムに組み込む | APIで自社システムと業務の流れに統合する。評価・監視・費用を管理する |
| S5商品に組み込む | 自社の製品やサービスの機能として顧客に提供する |
| S6顧客へ届ける | 顧客接点でAIが自律的に価値を届ける。事業モデルが変わる |

各段階で要る評価は、次のとおりです。

| 導入の段階 | 要る評価の成熟度 | 重点の項目 | 提供事業者・道具の例 |
| --- | --- | --- | --- |
| S1触れる | V0 | G3、I5 | なし(個人の確認) |
| S2仕事に適用する | V0〜V1 | G3、G1、I5 | 表計算、チャット型サービス |
| S3仕事に組み込む | V1 | I2、I3、I4、I5、G2 | promptfoo、Ragas |
| S4システムに組み込む | V2〜V3 | 10項目すべて | LangSmith、Langfuse、Phoenix、Braintrust、クラウドの評価機能 |
| S5商品に組み込む | V3〜V4 | G4、G5 | 観測基盤、ガードレール、外部の認証 |
| S6顧客へ届ける | V4 | G5、G4 | 評価の台帳、適合性評価 |

段階が上がるほど、要る成熟度も上がります。理由は、本編が段階を分けた軸と同じです。本編は軸を「誰の、どの判断を、どこまでAIに任せるか」とし、上位の段階ほどAIの誤りの及ぶ範囲は広いと述べました。誤りの範囲が広がるほど、誤りを見つける仕組みを先に用意する必要があります。

### 2. S1〜S2：個人の確認を手順にする

S1とS2では、AIの出力を使うかどうかを個人が毎回決めます。要る評価はV0の目視で、重点の項目はG3(事実)です。出力の事実を確かめるのは、使う人の責任です。

この責任は、裁判所が明文化しています。Mata v. Aviancaの決定は、信頼できるAIの道具を使うこと自体は不適切でないが、提出物の正確性を担保する門番の役割は弁護士にあると述べました [ [ 289 ] ](https://national.clla.org/wp-content/uploads/2025/05/Mata-v-Avianca-Inc.pdf) 。英国の司法府は2023年12月に、裁判官向けのAIの手引きを公表しています [ [ 458 ] ](https://www.judiciary.uk/wp-content/uploads/2023/12/AI-Judicial-Guidance.pdf) 。

S1とS2では、I5(出所)の判断も個人に任されます。何を入力してよいかは、利用規程で決める事項です。著者は、S2の評価を「確認の手順を書いた利用規程」と「よく使う業務の数件の確認例」で足りるとみます。V1のゴールデンセットは、S3へ進む準備として作り始めます。

### 3. S3：社内文書の検索を測る

S3では、部門の手順にAIを組み込み、社内文書を参照する検索が加わります。ここで初めて入力の層の項目が主役になります。

S3の評価で最初に要るのはI5の権限です。MicrosoftはCopilotの導入手引きで、過剰に共有されたサイトや所有者のいないサイトを見つけて直すこと、陳腐化した文書を取り除いて回答の品質を上げることを求めています [ [ 214 ] ](https://learn.microsoft.com/en-us/microsoft-365/copilot/configure-secure-governed-data-foundation-microsoft-365-copilot) 。前者はI5、後者はI4の評価に当たります。

S3の成熟度はV1です。部門の典型的な質問と、正しい答えと、根拠の文書を組にしたゴールデンセットを作ります。規模は、Anthropicがエージェントの評価で勧める20〜50の課題が目安の1つです [ [ 406 ] ](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) 。採点者は、その部門の業務を知る人です。道具は表計算から始められます。オープンソースのpromptfooは2023年に公開され、評価とレッドチーミングのためのコマンドラインの道具と説明しています [ [ 361 ] ](https://www.promptfoo.dev/docs/intro/) 。OpenAIは2026年3月9日に、promptfooの買収を発表しました [ [ 1655 ] ](https://openai.com/index/openai-to-acquire-promptfoo/) 。Ragasを使えば、文脈の再現率と適合率を数値にできます [ [ 167 ] ](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/context_precision/) 。

### 4. S4：自動評価と本番評価を回す

S4では、自社のシステムからAPIを呼び、業務の流れの中でAIが処理を担います。要る成熟度はV2からV3で、最終的には10項目すべてが評価の対象になります。ただし、最初から10項目すべては測りません。[評価を始める章](23-launching-evaluation)の手順で、用途の失敗に効く3〜4項目から始めます。

V2の自動評価は、プロンプトやモデルを変えるたびの回帰検査です。主要なクラウドは、評価機能を標準で備えました。

| クラウド | 評価機能の到達点 |
| --- | --- |
| AWS | Bedrockのモデル評価を2024年4月に一般提供し [ [ 393 ] ](https://aws.amazon.com/blogs/aws/amazon-bedrock-model-evaluation-is-now-generally-available/) 、RAGの評価を2025年3月に一般提供した [ [ 241 ] ](https://aws.amazon.com/about-aws/whats-new/2025/03/amazon-bedrock-rag-evaluation-generally-available) |
| Google Cloud | Vertex AIの評価サービスを2024年8月に一般提供した [ [ 389 ] ](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes) |
| Microsoft | Foundryで本番の抽出トラフィックの継続評価と、CIの品質ゲートを提供する [ [ 133 ] ](https://learn.microsoft.com/en-us/azure/ai-foundry/concepts/evaluation-approach-gen-ai) |

クラウドに依存しない観測と評価の基盤もあります。LangSmithは2023年7月に発表され [ [ 374 ] ](https://www.langchain.com/blog/announcing-langsmith) 、オープンソースのLangfuseは、2026年10月29日の時点で、本書の調査の範囲で最も多いGitHubのスター数を持つ評価・観測の道具でした [ [ 366 ] ](https://github.com/langfuse/langfuse) 。DatadogやNew Relicのような既存の監視の事業者も、大規模言語モデルの観測機能を一般提供しています [ [ 384 ] ](https://investors.datadoghq.com/news-releases/news-release-details/datadog-llm-observability-now-generally-available-help) [ [ 385 ] ](https://docs.newrelic.com/whats-new/2024/03/whats-new-03-28-aimonitoringga/) 。

S4でAIエージェントを使う場合は、G5の課題達成を、1回の成功でなく繰り返しの安定性で測ります。τ-benchは、同じ課題を決めた回数だけ続けて成功させる率(pass^k)を提案しました [ [ 115 ] ](https://arxiv.org/abs/2406.12045) 。途中の手順は、軌跡で測れます。Vertex AIはエージェントの軌跡の評価を2025年1月にプレビュー公開し、呼んだツールの順序が参照と一致するかなどの指標を提供しています [ [ 390 ] ](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/evaluation-agents) 。

S4のつまずきは、評価なしに本番へ出すことです。Gartnerは2024年7月、生成AIの案件の少なくとも30%が2025年末までにPoCの後で放棄されると予測し、理由にデータ品質の低さと不十分なリスク管理などを挙げました [ [ 419 ] ](https://www.gartner.com/en/newsroom/press-releases/2024-07-29-gartner-predicts-30-percent-of-generative-ai-projects-will-be-abandoned-after-proof-of-concept-by-end-of-2025) 。

### 5. S5〜S6：顧客に対する品質を約束する

S5とS6では、AIの出力が顧客に届きます。重点はG4(安全)とG5(期待)で、要る成熟度はV3からV4です。

顧客向けの出力の誤りは、企業の責任になります。カナダのブリティッシュコロンビア州の民事紛争解決の審判所は2024年、航空会社のチャットボットが忌引運賃を事後に申請できると誤って案内した件で、同社に支払いを命じました。同社の「チャットボットは別個の法的主体」という主張は退けられました [ [ 459 ] ](https://decisions.civilresolutionbc.ca/crt/crtd/en/525448/1/document.do) 。

V4に向けて、規制と規格が評価の内容を書き始めています。EU AI Actの第72条は、高リスクのAIの提供者に市販後の監視を求めます [ [ 552 ] ](https://artificialintelligenceact.eu/article/72/) 。ISO/IEC 42001は2023年12月に発行されたAIマネジメントシステムの規格です [ [ 518 ] ](https://www.iso.org/standard/42001) 。AWSとAnthropicは、この規格の認定認証の取得を公表しています [ [ 608 ] ](https://aws.amazon.com/blogs/machine-learning/aws-achieves-iso-iec-420012023-artificial-intelligence-management-system-accredited-certification) [ [ 609 ] ](https://www.anthropic.com/news/anthropic-achieves-iso-42001-certification-for-responsible-ai) 。日本では、デジタル庁の生成AIの調達・利活用のガイドラインが、利活用の前に出力の精度とリスクの程度を理解することを求めています [ [ 583 ] ](https://www.digital.go.jp/assets/contents/node/basic_page/field_ref_resources/e2a06143-ed29-4f1d-9c31-0f06fca67afc/80419aea/20250527_resources_standard_guidelines_guideline_01.pdf) 。

S5へ進む前に用意するV3は、最小の形でかまいません。著者は、顧客へ広く出す前に、限られた顧客か社内の利用者へ公開し、次の4つを動かしておくことを勧めます。本番の記録を採取する仕組み、採点する記録の抽出率、品質がしきい値を下回ったときの警報、人が記録を確かめる注釈の作業列です。いずれも[評価の成熟度の章](19-evaluation-maturity)のV3の要素です。この期間の抜き取りで合否の基準を満たしてから、公開の範囲を広げます。

### 6. 費用の根拠のある目安

評価の総費用の目安を示す一次資料は、本書の調査では見つかりませんでした。単価として公開されている値を、段階に当てて示します。

| 費用の項目 | 公開値 | 主に関わる段階 |
| --- | --- | --- |
| 人手評価の手数料(Bedrock) | 自前の作業者を持ち込む人手評価で、完了したタスク1件あたり0.21ドル。作業者の人件費は含まない [ [ 395 ] ](https://aws.amazon.com/bedrock/pricing/) | S3〜S4 |
| 一般の参加者(Prolific) | 最低時給8.00ドル、企業の手数料42.8% [ [ 407 ] ](https://www.prolific.com/pricing) | S3〜S4 |
| 自動の採点(Bedrock) | アルゴリズムの採点は追加料金なし、審判モデルはトークンの料金 [ [ 395 ] ](https://aws.amazon.com/bedrock/pricing/) | S4 |
| 事実検証の自動化(SAFE) | 人手の20分の1以下 [ [ 40 ] ](https://arxiv.org/abs/2403.18802) | S4 |
| 分類器型のガードレール | 推論の費用が23.7%増、本番の拒否率が0.38ポイント増 [ [ 314 ] ](https://arxiv.org/abs/2501.18837) | S5〜S6 |

この表の人手評価の値は、道具の手数料です。人手の採点の主な費用は採点する人の時間で、表には現れません。著者は、人件費を「評価者の時間 × 社内の時間単価」の式で見積もり、自動の採点の費用(審判モデルのトークン)と並べて比べることを勧めます。著者は、費用の制約は単価より、採点する専門家の時間にあると考えます。

### 7. 提供事業者にデファクトは無い

評価の道具の市場には、まだ標準の1つがありません。道具の撤退も起きています。OpenAIは2026年6月にEvalsのプラットフォームの廃止を告知し、2026年11月30日に停止する予定です [ [ 127 ] ](https://developers.openai.com/api/docs/guides/evals) 。評価と観測の基盤を提供していたHumanloopの共同創業者らは、2025年8月にAnthropicへ移りました [ [ 380 ] ](https://techcrunch.com/2025/08/13/anthropic-nabs-humanloop-team-as-competition-for-enterprise-ai-talent-heats-up/) 。

したがって、道具の選定より先に、評価のデータと基準を自社の資産として持つことが要ります。ゴールデンセット、採点の基準、過去の評価の結果を、道具から取り出せる形で保管しておけば、道具を替えても評価は続けられます。

### 🗺️ 図：導入の段階が上がるほど、評価の成熟度を先に上げる

![左の列に導入の段階S1〜S6を上から下へ並べ、右に各段階で要る評価の成熟度を帯で示す。S1はV0、S2はV0〜V1、S3はV1、S4はV2〜V3、S5はV3〜V4、S6はV4](/images/genai-evaluation-blueprint/20-adoption-stage-and-evaluation.png)

#### 図の読み方

この図は、左の列に本編の導入の段階を上から下へ並べ、右に各段階で要る評価の成熟度を帯で置いています。上から、S1はV0、S2はV0からV1、S3はV1、S4はV2からV3、S5はV3からV4、S6はV4です。第1節の表と同じ対応です。

読み順は上から下です。帯は下の段ほど右へずれ、段階が上がるほど成熟度も上がることを表します。下の段ほど、AIの誤りが及ぶ範囲は広くなります。帯の色は、その段階で要る成熟度のうち高い方の色で、人が判定するV0とV1を丹、機械の評価が加わるV2とV3を藍、到達点のV4を千歳緑にしています。図の表題「導入の段階を上げる前に、評価の成熟度を上げる」が本章の主張です。各段階の重点の項目と道具は第1節の表にあります。

### 経営層への含意

本章の段階と成熟度の対応、重点の項目の選び方は、著者による整理です。道具と費用は、本書の調査で確認できた2026年10月の時点の公開値です。

経営層が本章から持ち帰るべき点は3つです。

第一に、評価の成熟度は導入の段階に先行させます。S4へ進む前にV2の回帰検査を、S5へ進む前にV3の本番評価を用意します。V3は、限られた利用者への公開の間に、最小の形で動かし始めます。評価が追いつかないまま段階を上げると、誤りの範囲だけが広がります。

第二に、S3の評価の起点は権限です。社内文書を参照する検索では、回答の精度より先に、読んではならない文書が回答に出ないかを確かめます。

第三に、評価の道具は買えますが、評価の基準とゴールデンセットは買えません。道具は撤退することがあるため、基準と記録を自社の資産として持つことが、評価への投資を守る手段になります。
