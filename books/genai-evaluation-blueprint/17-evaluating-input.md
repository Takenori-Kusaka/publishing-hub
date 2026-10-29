---
title: "第17章　入力側の評価 ―― 必要・十分・精度・鮮度・出所をどう測るか"
---

### 序論：本章が扱う範囲

本章は、[期待値への距離の章](16-distance-to-expectation)で定義した入力5層(I1必要、I2十分、I3精度、I4鮮度、I5出所)の測り方を、層ごとに示します。各層の代表的な手法の定義と数値は一次資料から引きます。どの手法をどの層に置くかは著者の分類です。

入力側の評価には、2つの系譜があります。1つは1960年代から続く情報検索の評価で、もう1つは2023年に始まったRAGの評価です。系譜そのものは[RAG評価の成立の章](06-rag-evaluation)で述べたので、本章では現在の実務で使える測り方に絞ります。

本章が扱わないのは、生成側の忠実性と事実性です。それらは[生成側の評価の章](18-evaluating-generation)で扱います。

### 1. 入力側の評価の骨格

情報検索の評価は、文書集合・問い・適合性判定からなるテストコレクションで測る方式が基本です。英国のCranfieldの実験は1966年の報告書で1,400文書と279の質問を使いました [ [ 143 ] ](https://ntrl.ntis.gov/NTRL/dashboard/searchResults/titleDetail/PB169574.xhtml) 。1992年に始まったTRECは、参加システムの結果をプールして判定する方式を確立しました [ [ 3 ] ](https://trec.nist.gov/overview.html) 。

RAGの評価は、この骨格を生成と組み合わせました。RAGASは2023年に、参照回答なしでRAGを評価する枠組みとして登場しました [ [ 41 ] ](https://arxiv.org/abs/2309.15217) 。TruLensは文脈の関連性・根拠性・回答の関連性の3つを「RAG Triad」と呼びます [ [ 168 ] ](https://www.trulens.org/getting_started/core_concepts/rag_triad/) 。Amazon Bedrockの評価も、検索のみの評価(文脈の関連性、網羅性)と検索と生成の評価を分けています [ [ 241 ] ](https://aws.amazon.com/about-aws/whats-new/2025/03/amazon-bedrock-rag-evaluation-generally-available) 。どの道具も、検索の側を独立に測る形を取っています。

### 2. I1必要：入力だけで何が足りないか

I1は、ユーザーの入力から集めるべきものを正しく把握したかを問います。5層のうち、標準の指標が最も未成熟な層です。

入力が曖昧なことは、標準データでも珍しくありません。AmbigQAは、質問応答の標準データであるNQ-openの質問の半数超が曖昧だと報告しました [ [ 1301 ] ](https://arxiv.org/abs/2004.10645) 。曖昧さを解く手段の1つは、聞き返すことです。Aliannejadiらは、良い明確化の質問を1つするだけで、上位1件の適合率が170%超改善するとオラクル実験で示しました [ [ 1302 ] ](https://arxiv.org/abs/1907.06554) 。

検索するかどうかの判断も、I1に含まれます。Self-RAGは「いつ検索するか」を学習させ、その判断自体を評価の対象にしました [ [ 162 ] ](https://arxiv.org/abs/2310.11511) 。誤った前提を含む質問も、I1の失敗の源です。FreshQAは、規模を問わずすべてのモデルが急変する知識と誤前提の質問に弱いと報告しました [ [ 219 ] ](https://arxiv.org/abs/2310.03214) 。MicrosoftのAzure AI Searchの文書は、RAGの課題の第一に「クエリ理解」を挙げています [ [ 210 ] ](https://learn.microsoft.com/en-us/azure/search/retrieval-augmented-generation-overview) 。

著者は、I1の測り方を次の3つの率で設計することを勧めます。曖昧な入力を曖昧と検出した率、聞き返しが必要な場面で聞き返した率、誤前提を指摘した率です。いずれも、曖昧・誤前提の入力を意図して混ぜたゴールデンセットがあれば数えられます。

### 3. I2十分：必要な情報が集まったか

I2は、答えに必要な情報が文脈にそろったかを問います。

RAGASのContext Recallは、参照回答に含まれる主張のうち、取得した文脈で支持される数を、参照の主張の総数で割った値です。参照文脈が分かっている場合は、取得できた参照文脈の数を参照文脈の総数で割る版もあります [ [ 167 ] ](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/context_precision/) 。どちらも、何が必要だったかを示す参照が要ります。

参照なしで十分性を測る方法もあります。Googleの研究者は、文脈が質問に確定的な答えを出すのに必要な情報をすべて含むかを分類する自動判定器を作り、人手ラベルとの一致が93%以上だったと報告しました [ [ 172 ] ](https://arxiv.org/abs/2411.06037) 。不十分な文脈を与えると、Gemmaの誤答率は文脈なしの10.2%から66.1%に上がりました [ [ 173 ] ](https://research.google/blog/deeper-insights-into-retrieval-augmented-generation-the-role-of-sufficient-context/) 。

集める量を増やせば十分性は上がりますが、別の問題が出ます。Databricksの実測では、取得する文書を増やすと平均の再現率が2kトークンで0.468、128kトークンで0.95に上がった一方、64kトークン超で精度を保てたのは最新の少数のモデルだけでした [ [ 194 ] ](https://www.databricks.com/blog/long-context-rag-performance-llms) 。

目標値の例として、OpenAIの評価の手引きは「文脈の再現率0.85以上、文脈の適合率0.7超」を挙げています [ [ 119 ] ](https://developers.openai.com/api/docs/guides/evaluation-best-practices) 。これは1つの例示で、業務ごとに決め直す値です。

### 4. I3精度：雑音は少ないか

I3は、集めた情報が関係のあるものか、関係のない雑音がどれだけ混じったかを問います。

RAGASのContext Precisionは、関係のある断片を上位に並べられたかを測ります。上位K件の各位置の適合率と、その位置の断片が関係あるかを掛け、関係ある件数で割って平均します [ [ 167 ] ](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/context_precision/) 。段階的な適合度を扱うnDCGは、2002年にJärvelinとKekäläinenが提案した指標です [ [ 147 ] ](https://researchportal.tuni.fi/en/publications/cumulated-gain-based-evaluation-of-ir-techniques) 。

雑音の害は実測されています。Chromaの2025年の報告は、妨害文が1つあるだけで性能が落ちること、焦点を絞った約300トークンの入力が約113kトークンの全文より一貫して高いことを示しました [ [ 195 ] ](https://www.trychroma.com/research/context-rot) 。

検索の構成は、評価して選ぶものです。次の数値は、いずれも提供事業者が自社の手法について公表したものです。

| 公表者 | 比較 | 結果 |
| --- | --- | --- |
| Microsoft(2023年) | キーワード、ベクトル、ハイブリッド、ハイブリッドと意味的ランカー | 顧客データのNDCG@3で40.6、43.8、48.4、60.1 [ [ 201 ] ](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/azure-ai-search-outperforming-vector-search-with-hybrid-retrieval-and-reranking/3929167) |
| Anthropic(2024年) | 文脈つき埋め込み、BM25の併用、再ランキングの併用 | 上位20件の取得失敗率が5.7%から3.7%、2.9%、1.9%へ [ [ 197 ] ](https://www.anthropic.com/news/contextual-retrieval) |
| Chroma(2024年) | チャンク分割の戦略 | 戦略により再現率が最大9%違う [ [ 199 ] ](https://www.trychroma.com/research/evaluating-chunking) |

### 5. I4鮮度：情報は古くないか

I4は、集めた情報が質問の時点で正しいかを問います。時間で変わる事実への対応は、2021年から測られています。TimeQAでは、最良のモデルの正答率が46%で、人間の87%に遠く及びませんでした [ [ 216 ] ](https://arxiv.org/abs/2108.06314) 。

鮮度の評価には、評価データ自体を更新し続ける設計が要ります。RealTime QAは毎週新しい質問を出す動的な評価で、GPT-3が取得文書に十分な情報がないと古い答えを返す傾向を示しました [ [ 218 ] ](https://arxiv.org/abs/2207.13332) 。FreshQAのリポジトリは、データセットを週次か要望に応じて更新すると述べています [ [ 219 ] ](https://arxiv.org/abs/2310.03214) 。

企業の文書では、古い版が検索結果に混じることがI4の主な失敗です。MicrosoftはCopilotの導入手引きで、活動のない文書や陳腐化した文書を保持・削除の方針で取り除き、回答の品質を上げるよう求めています [ [ 214 ] ](https://learn.microsoft.com/en-us/microsoft-365/copilot/configure-secure-governed-data-foundation-microsoft-365-copilot) 。企業文書の陳腐化率を示す一次統計は、本書の調査では見つかりませんでした。著者は、取得した文書の更新日の分布と、正本でない版が上位に入った率を記録することを、I4の最小の測り方として勧めます。

### 6. I5出所：信頼でき、使ってよいか

I5は、情報が信頼できる出所から来たか、利用者がそれを読む権限を持つかを問います。

権限は、評価の対象として明記されています。Azure AI Searchの文書は「利用者とエージェントは許可された内容だけを取得しなければならない」と述べます [ [ 210 ] ](https://learn.microsoft.com/en-us/azure/search/retrieval-augmented-generation-overview) 。MicrosoftのCopilotの手引きは、過剰に共有されたサイトや所有者のいないサイトを事前に見つけて直すよう求めます [ [ 214 ] ](https://learn.microsoft.com/en-us/microsoft-365/copilot/configure-secure-governed-data-foundation-microsoft-365-copilot) 。

引用の正確さは、「引用があること」と「引用が主張を支持すること」を分けて測ります。ALCEは引用の再現率と適合率を自動で評価する基準です。最良のモデルでも、半分の場面で引用の裏づけが不完全でした [ [ 224 ] ](https://arxiv.org/abs/2305.14627) 。Bedrockは2025年に、引用の適合率と引用の網羅性を指標に加えました [ [ 241 ] ](https://aws.amazon.com/about-aws/whats-new/2025/03/amazon-bedrock-rag-evaluation-generally-available) 。

第三者の実測は、出所が最大の弱点であることを繰り返し示しています。

| 実測 | 結果 |
| --- | --- |
| Stanfordの研究者(2023年、生成型の検索4製品) | 生成文の51.5%しか引用で完全に支持されなかった [ [ 226 ] ](https://arxiv.org/abs/2304.09848) |
| Tow Center(2025年3月、8製品) | 全体で60%超の質問に誤答した [ [ 229 ] ](https://www.cjr.org/tow_center/we-compared-eight-ai-search-engines-theyre-all-bad-at-citing-news.php) |
| EBUとBBC(2025年10月、4アシスタント) | 回答の45%に重大な問題があり、出所の問題が31%で最大だった [ [ 232 ] ](https://www.ebu.ch/files/live/sites/ebu/files/Publications/MIS/open/EBU-MIS-BBC_News_Integrity_in_AI_Assistants_Report_2025.pdf) |

### 7. 入力側の評価の組み方

5層の測り方を、参照データの要否で整理します。この表は著者による整理です。

| 層 | 主な指標 | 参照データ | 道具の例 |
| --- | --- | --- | --- |
| I1必要 | 曖昧の検出率、聞き返しの率 | 曖昧な入力を混ぜたセット | 自前の採点 |
| I2十分 | 文脈の再現率、十分性 | 参照回答か、十分性の判定器 | RAGAS、Bedrock |
| I3精度 | 文脈の適合率、nDCG | 適合性のラベル | RAGAS、Foundry |
| I4鮮度 | 古い版の混入率、時点つき正答率 | 更新日つきの文書 | 自前の記録 |
| I5出所 | 権限違反の件数、引用の適合率 | 権限の表、出典の照合 | Bedrock、Vertex |

参照データが要らない指標から始めると、運用を早く回せます。MicrosoftのFoundryは、根拠ラベルがあれば検索品質の複合指標を、なければ審判モデルによる1から5の採点を使い分けます [ [ 242 ] ](https://learn.microsoft.com/en-us/azure/ai-foundry/concepts/evaluation-evaluators/rag-evaluators) 。著者は、まずI2とI3を参照なしの方法で回し、ゴールデンセットが育つにつれて参照ありの指標に移る順序を勧めます。

### 🗺️ 図：集めた情報を5つの問いで検める

![入力側の5層を上から下へ並べる。I1必要は足りないものを知る。I2十分は必要な情報がそろう。I3精度は雑音が少ない。I4鮮度は古くない。I5出所は信頼でき読んでよい。5つを通った情報だけが生成へ渡る](/images/genai-evaluation-blueprint/17-evaluating-input.png)

#### 図の読み方

この図は、上から下へ5つの関門を並べたものです。各段に層の記号と、その層の問いを書いています。上から順に、足りないものを知る段、必要な情報をそろえる段、雑音を除く段、古い情報を除く段、出所と権限を確かめる段です。

読み順は上から下です。最下段の矢印が生成側へ向かいます。図の下の一文「5つを通った情報だけが生成へ渡る」が本章の主張です。各段の代表的な指標は第7節の表にあります。

### 本章の位置づけ

本章の5層への分類と、I1とI4の測り方の提案は、著者によるものです。I2とI3には、RAGASや各クラウドの評価機能という確立した指標があります。I1、I4、I5の権限の部分には、広く使われる標準の指標がまだありません。

著者は、入力側の評価で最初に投資すべきはI5の権限だと考えます。I2とI3の失敗は回答の質を下げますが、I5の失敗は読んではならない情報を回答に出します。被害の性質が違うため、権限の評価は精度の評価と別に、件数で管理するのが安全です。
