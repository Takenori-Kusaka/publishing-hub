---
title: "第9章　道具の氾濫 ―― Evalsから観測基盤まで、デファクト不在の地図(2023〜2026)"
---

### 序論：本章が扱う範囲

本章は、生成AIの評価を日々の開発と運用で回すための道具の歴史を記述します。対象の期間は2023年から2026年で、道具がどう生まれて広がり、一部がどう撤退したかを扱います。ここでいう道具は、評価の実行を支えるオープンソースのライブラリ、商用の評価・観測の基盤、クラウドの標準機能の3種類です。

本章が示したい事実は、2026年10月の時点で、どの道具と手法も事実上の標準(デファクト)になっていないことです。それを示すため、道具ごとに初出日と提供元、測る対象、GitHubのスター数を並べた地図を作ります。スター数は利用の規模そのものではなく、開発者の関心の目安にすぎません。本章のスター数は、すべて2026年10月29日の取得です。

個々の指標の中身は、RAGについては[RAG評価の成立の章](06-rag-evaluation)、審判モデル(LLM-as-a-judge)については[審判としてのLLMの章](05-llm-as-judge)で扱いました。道具の選び方と導入の手順は、[評価の成熟度の章](19-evaluation-maturity)で扱います。

### 1. 評価の工学化を唱える言説(2023〜2026)

道具の氾濫に先立って、評価を工学の手順として回すべきだという言説が現れました。

- **2023年3月14日、OpenAI**: GPT-4の発表に併せ、評価の枠組みOpenAI Evalsをオープンソース化しました。自社の開発で欠点の発見と回帰の防止に使っていると述べ、GPT-4を採点者にするテンプレートを同梱しました [ [ 342 ] ](https://openai.com/index/gpt-4-research/) 。
- **2023年7月30日、Eugene Yan**: 評価の構築をLLMを使う製品の出発点に置くべきだとし、この実践を「Eval Driven Development」と呼びました [ [ 343 ] ](https://eugeneyan.com/writing/llm-patterns/) 。
- **2024年3月29日、Hamel Husain**: 評価を、アサーションによる単体テスト・人とモデルによる評価・A/Bテストの3つの段階(level)に分けました [ [ 345 ] ](https://hamel.dev/blog/posts/evals/) 。
- **2024年4月18日、Shankarら**: 評価の基準は出力を見てから定まるという「criteria drift」を報告しました [ [ 346 ] ](https://arxiv.org/abs/2404.12272) 。

提供事業者の公式文書も同じ方向を示しました。Anthropicのドキュメントは、評価の設計の原則として、課題に固有であること・可能な限り自動化すること・質より量を優先することを掲げます。採点にはコード、人手、LLMの3種類を挙げ、生成とは別のモデルで採点することを勧めています [ [ 352 ] ](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests) 。

### 2. オープンソースの評価道具の地図

主なオープンソースの道具を、公開の早い順に並べます。初出日は、発表の日・最初の版の日・リポジトリの作成日のいずれかで、種類を括弧で示します。

| 名称 | 提供元 | 初出日 | 何を測るか | スター数 |
| --- | --- | --- | --- | --- |
| lm-evaluation-harness | EleutherAI | 2021-09-02(初版) | 学術ベンチマーク60超 [ [ 51 ] ](https://github.com/EleutherAI/lm-evaluation-harness) | 14,343 |
| HELM | Stanford CRFM | 2022-11-17(初版) | 16のシナリオ×7指標 [ [ 360 ] ](https://crfm.stanford.edu/2022/11/17/helm.html) | 2,960 |
| OpenAI Evals | OpenAI | 2023-03-14(発表) | LLMとその応用の評価 [ [ 54 ] ](https://github.com/openai/evals) | 19,672 |
| Phoenix | Arize | 2023-04-26(発表) | 出力の評価と観測 [ [ 367 ] ](https://arize.com/?p=12087) | 12,048 |
| promptfoo | promptfoo(2026年にOpenAIが買収を発表) | 2023-05-03(初版) | 応用の評価とレッドチーミング [ [ 361 ] ](https://www.promptfoo.dev/docs/intro/) | 26,566 |
| Ragas | Vibrant Labs | 2023-05-14(初版) | RAGの参照なし評価 [ [ 1653 ] ](https://pypi.org/pypi/ragas/json) | 16,174 |
| TruLens | TruEra(現Snowflake) | 2023-05-23(初版) | RAGの3指標 [ [ 363 ] ](https://www.trulens.org/) | 3,618 |
| Langfuse | Langfuse(2026年にClickHouseが買収) | 2023-07-12(初版) | エージェントの評価と観測 [ [ 366 ] ](https://github.com/langfuse/langfuse) | 36,669 |
| DeepEval | Confident AI | 2023-08-15(初版) | LLMの評価の枠組み [ [ 362 ] ](https://github.com/confident-ai/deepeval) | 19,173 |
| OpenLLMetry | Traceloop | 2023-09-02(作成) | OpenTelemetryに基づく観測 [ [ 370 ] ](https://github.com/traceloop/openllmetry) | 7,512 |
| MLflow(LLM評価) | MLflowプロジェクト(機械学習全般の基盤) | 2023-10-29(v2.8.0) | 既定のLLM評価指標 [ [ 369 ] ](https://github.com/mlflow/mlflow/releases/tag/v2.8.0) | 28,579 |
| simple-evals | OpenAI | 2024-04-11(作成) | 自社公表値の透明性 [ [ 364 ] ](https://github.com/openai/simple-evals) | 4,683 |
| Inspect | 英国AI Safety Institute | 2024-05-10(発表) | 最先端モデルの評価 [ [ 329 ] ](https://www.gov.uk/government/news/ai-safety-institute-releases-new-ai-safety-evaluations-platform) | 3,126 |
| Opik | Comet | 2024-09-17(発表) | 追跡、自動評価、ダッシュボード [ [ 1654 ] ](https://www.comet.com/site/about-us/news/press-releases/comet-launches-opik/) | 23,002 |

最もスター数が多いのは、評価と観測を一体にしたLangfuseの36,669です。2位のMLflowは機械学習全般の基盤で、そのスター数はLLMの評価への関心だけを表すものではありません。Opikのリポジトリは2023年5月10日に作成されています [ [ 368 ] ](https://github.com/comet-ml/opik) 。製品としての発表は2024年9月17日です [ [ 1654 ] ](https://www.comet.com/site/about-us/news/press-releases/comet-launches-opik/) 。道具の置き場所も数年で変わります。Ragasのリポジトリは2026年10月時点でvibrantlabsai/ragasにあります [ [ 1652 ] ](https://github.com/vibrantlabsai/ragas) 。Giskardのリポジトリはgiskard-ossに移っています [ [ 365 ] ](https://github.com/Giskard-AI/giskard-oss) 。

### 3. 商用の基盤とクラウドの標準機能

商用の評価・観測の基盤も、2023年から2024年に揃いました。LangChainは2023年7月18日、LLMを使う応用のデバッグ・テスト・評価・監視の統合の基盤としてLangSmithを発表しました。発表文は、およそ30%の割合で動くものならデモには十分だと書き、試作と本番の隔たりを埋めるとしています [ [ 374 ] ](https://www.langchain.com/blog/announcing-langsmith) 。既存の監視の事業者も参入し、New Relicは2024年3月26日にAI monitoringを [ [ 385 ] ](https://docs.newrelic.com/whats-new/2024/03/whats-new-03-28-aimonitoringga/) 、Datadogは2024年6月26日にLLM Observabilityを一般提供としました [ [ 384 ] ](https://investors.datadoghq.com/news-releases/news-release-details/datadog-llm-observability-now-generally-available-help) 。投資家のa16zは2024年10月8日、評価と記録を備えたBraintrustへの出資を公表しています [ [ 376 ] ](https://a16z.com/announcement/investing-in-braintrust/) 。

主要クラウドは、評価を標準の機能に組み込みました。

| 時期 | クラウド | 出来事 |
| --- | --- | --- |
| 2023年11月15日 | Microsoft | Azure AI Studioのプレビューに、モデルの応答の評価を含めた [ [ 386 ] ](https://news.microsoft.com/ignite-2023-book-of-news/) |
| 2023年11月29日 | AWS | BedrockのModel Evaluationをプレビュー公開。自動評価と人手評価 [ [ 392 ] ](https://aws.amazon.com/about-aws/whats-new/2023/11/evaluate-compare-select-fms-use-case-amazon-bedrock) |
| 2024年8月30日 | Google Cloud | Vertex AIのGen AI Evaluation Serviceを一般提供 [ [ 389 ] ](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes) |
| 2025年3月20日 | AWS | BedrockのRAG評価と審判モデルの評価を一般提供 [ [ 394 ] ](https://aws.amazon.com/blogs/aws/new-rag-evaluation-and-llm-as-a-judge-capabilities-in-amazon-bedrock) |

費用の公開値もあります。AWSのBedrockの料金表では、自前の作業者を持ち込む人手評価に、評価中のモデルの推論の料金と、完了した人手のタスク1件あたり0.21ドルの手数料がかかります。採点する作業者は利用者が用意するので、その人件費はこの手数料に含まれません。審判モデルの評価は、審判が使うトークンの料金で課金されます [ [ 395 ] ](https://aws.amazon.com/bedrock/pricing/) 。

### 4. 撤退と移籍

道具の側の入れ替わりも記録されています。最も大きいのはOpenAIです。同社は2024年10月1日にダッシュボードの評価機能を公開し [ [ 396 ] ](https://developers.openai.com/api/docs/changelog) 、2025年4月8日にSDKへEvals APIを加えました [ [ 397 ] ](https://github.com/openai/openai-python/releases/tag/v1.72.0) 。その後2026年6月3日に評価の基盤の廃止を告知し、既存の利用者には2026年10月31日に読み取り専用とし、11月30日に停止する予定です [ [ 127 ] ](https://developers.openai.com/api/docs/guides/evals) 。自社の公表値の根拠として公開したsimple-evalsも、2025年7月以降は新しいモデルで更新されていません [ [ 364 ] ](https://github.com/openai/simple-evals) 。

ほかにも次の変化がありました。

- **2025年8月13日**: プロンプトの管理と評価の基盤を提供していたHumanloopの共同創業者らが、Anthropicに移籍したと報じられました。Anthropicは資産や知的財産を取得していないとしています [ [ 380 ] ](https://techcrunch.com/2025/08/13/anthropic-nabs-humanloop-team-as-competition-for-enterprise-ai-talent-heats-up/) 。
- **2026年1月16日**: Langfuseは、ClickHouseがLangfuseを買収したと公表しました。Langfuseはオープンソースのまま、自分で運用できる形を保つとしています [ [ 1656 ] ](https://langfuse.com/blog/joining-clickhouse) 。
- **2026年3月9日**: OpenAIは、promptfooを買収すると発表しました。買収の完了後に、promptfooの技術を自社の基盤OpenAI Frontierに組み込むとしています。完了は通常の条件の充足を要するとしています [ [ 1655 ] ](https://openai.com/index/openai-to-acquire-promptfoo/) 。
- **2026年9月30日**: 人手の作業を安く集める場だったAmazon Mechanical Turkが、恒久的に閉鎖されました [ [ 408 ] ](https://www.mturk.com/pricing) 。

### 5. 標準の未成熟

観測の規格は、まだ安定版に達していません。OpenTelemetryは2024年5月21日のv1.26.0で、生成AIのクライアント向けの意味規約を初めて導入しました [ [ 399 ] ](https://github.com/open-telemetry/semantic-conventions/releases/tag/v1.26.0) 。2026年10月29日の時点でも、その規約の状態は「Development」です [ [ 401 ] ](https://github.com/open-telemetry/semantic-conventions-genai) 。

評価の方法についても、専門家の評価は揺れています。lm-evaluation-harnessの開発者らは2024年5月23日、言語モデルの信頼できる評価は「未解決の課題」だと述べ、評価の設定への感度と再現性の欠如を挙げました [ [ 357 ] ](https://arxiv.org/abs/2405.14782) 。コンサルティング企業のThoughtworksは、審判モデルの手法を2024年10月に「Trial」に置きましたが、2025年11月に「Assess」へ下げ、かつて信じられたほど成熟していないと評しました [ [ 358 ] ](https://www.thoughtworks.com/radar/techniques/llm-as-a-judge) 。

### 6. 調査が示す手法の分散

評価の手法の採用率を示す調査は、評価の道具を売る事業者によるものが中心です。LangChainの2024年12月の調査(1,300名超)では、オフライン評価をする回答は39.8%、オンライン評価は32.5%でした [ [ 422 ] ](https://www.langchain.com/stateofaiagents) 。同社の2025年11月から12月の調査(1,340回答)の結果は次のとおりです [ [ 423 ] ](https://www.langchain.com/state-of-agent-engineering) 。

| 手法 | 採用の割合 |
| --- | --- |
| 何らかの観測 | 89% |
| 人手によるレビュー | 59.8% |
| 審判モデル | 53.3% |
| テスト集合でのオフライン評価 | 52.4% |
| 本番でのオンライン評価 | 37.3% |

観測は9割近くに広がった一方、評価の手法はどれも6割に届いていません。投資家のa16zが2025年6月10日に公表したCIO 100名の調査も、モデルの性能の評価では社内のベンチマーク、ゴールデンセット、開発者の意見が依然として重要だと報告しています [ [ 409 ] ](https://a16z.com/ai-enterprise-2025/) 。Stanford AI Index 2024は、LLMの責任に関する頑健で標準化された評価が著しく欠けていると述べました [ [ 420 ] ](https://hai.stanford.edu/ai-index/2024-ai-index-report) 。

日本の実務の記録も、道具より手順を共有しています。PharmaXは2024年5月7日、プロンプトを変えたときの事前評価と、稼働後の事後評価を分ける構成を公開しました [ [ 427 ] ](https://zenn.dev/pharmax/articles/ec8c65c20d9835) 。2026年9月19日の記事は、プルリクエストごとにはゴールデンセットの代表的な30〜50件で主要な指標だけを確かめ、リリース前にだけ全件を評価する段階的な運用を勧めています [ [ 438 ] ](https://zenn.dev/libercraft/articles/20260919-ragas-component-evaluation) 。

### 🗺️ 図：観測は9割に広がったが、評価の手法はどれも6割に届かない

![LangChainの2025年の調査による評価の手法ごとの採用の割合を横棒で示した図](/images/genai-evaluation-blueprint/09-tool-proliferation.png)

#### 図の読み方

この図は、LangChainが2025年11月から12月に行った調査の5つの割合を、上から大きい順に横棒で並べたものです。上から、何らかの観測89%・人手によるレビュー59.8%・審判モデル53.3%・テスト集合でのオフライン評価52.4%・本番でのオンライン評価37.3%です。図では、3番目の手法を「オフライン評価」と略しています。数値は第6節の表と同じです。棒の色は第15章の図と同じ規則です。観測の棒は評価の手法ではないので墨、人手によるレビューは人が判定する手法なので丹、ほかの3つは機械が採点する手法なので藍で塗っています。

読み順は上から下です。一番上の観測の棒と、2番目以下の評価の手法の棒の間に、30ポイント近い差があります。図の下の添え書きにあるとおり、この調査は評価の道具を提供する事業者によるもので、回答者はその利用者に偏る可能性があります。

---

### 本章の要点と解釈

本節は、著者による解釈です。前節までの事実記述とは区別して読んでください。

要点は3つです。第一に、評価の道具は2023年の約1年間で一斉に生まれ、2026年10月時点で十を超える道具が並んでいます。スター数の最多は、評価と観測を一体にしたLangfuseです。2026年には、スター数の多いpromptfooとLangfuseの提供元が、買収で変わりつつあります。第二に、モデル提供者のOpenAIが、自社の評価の基盤を約2年で廃止します。観測の規格も安定版に達しておらず、提供の形そのものが固まっていません。第三に、調査では観測が9割近くまで広がりました。一方で評価の手法はどれも6割未満で、単一の手法が支配する状態にありません。

著者は、この状態を「道具が足りない」のではなく「何を測るかが組織ごとに違うので、道具が1つに収斂しない」状態だと考えます。複数の実務家と提供事業者が、汎用の指標より課題に固有の評価を勧めている事実は、この読み方と整合します。実務家への含意は、道具を選ぶ前に、評価のデータセットと採点の基準を道具から独立した形で持つことです。OpenAIの廃止の例が示すように、道具は2年で入れ替わりえます。経営層にとっての含意は、特定の道具の導入を評価体制の完成とみなさず、評価の資産を移せる形で蓄えることを求める点にあります。
