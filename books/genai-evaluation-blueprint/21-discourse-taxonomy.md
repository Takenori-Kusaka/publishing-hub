---
title: "第21章　言説の分類 ―― 誰が、どの利害で、評価の未来を語るか"
---

### 序論：本章が扱う範囲

第Ⅳ部は推論の領域です。本章から3つの章で、生成AIの出力の評価がこれからどう変わるかを扱います。本章はその出発点として、評価の現在と未来について公表された言説を整理します。

対象は、2023年3月から2026年10月までに公表された、出力の評価をめぐる言説100件余りです。発言者は、モデルの提供者、クラウド事業者、評価の提供事業者、研究者、実務家、投資家と調査会社、批判者、日本の発信者に分かれます。能力ベンチマークの順位そのものは扱わず、出力をどう測るかを語った部分だけを拾いました。

本章は言説の当否を判定しません。誰が、いつ、どの利害のもとで、何を述べたかを並べます。そのうえで、言説を人物ではなく「主張 × 軸」で分類します。同じ発言者が、審判モデル(LLM-as-a-judge)の効率を説きながら、その限界も認めている例が多いためです。

この分類は、次の[3つの道筋の章](22-three-paths)の材料になります。章末では、評価そのものを主語にした年限つきの予測を一覧にします。

### 1. 分類の方法：人物ではなく、主張と軸で分ける

同じ発言者が、文脈によって別の方向を向いている例から始めます。OpenAIは2023年3月にOpenAI Evalsを公開し、GPT-4が自分の出力を驚くほどよく検査できると述べました [ [ 342 ] ](https://openai.com/index/gpt-4-research/) 。同じOpenAIが2024年6月には、極端に複雑な課題では、モデルの助けを得た専門家でも正しく評価できない場合があると書いています [ [ 614 ] ](https://openai.com/index/finding-gpt4s-mistakes-with-gpt-4/) 。自動化の推進と、人の判定の限界の指摘が、同じ事業者から出ています。

このため本書は、言説を「楽観派」「懐疑派」に分けません。次の4つの軸を立て、軸ごとに主張を分類します。

| 軸 | 問い | 3つの方向 |
| --- | --- | --- |
| 1. 誰が採点するか | 出力の良否を最後に判定するのは誰か | 審判モデルと自動の指標 / ドメイン専門家 / 規制と第三者の手順 |
| 2. 物差しは信頼できるか | 公開のベンチマークと順位表で、出力の質が分かるか | 検証できる基準と私的な評価へ移る / 人の確認に戻る / 標準化された手順で縛る |
| 3. 幻覚は直るか | 幻覚(ハルシネーション)はなくなるか | ゼロにできる / 減らせる / 棄権で逃がす |
| 4. 評価の基盤をどこに置くか | 評価の仕組みを誰が持つか | 事業者とクラウドの標準機能 / 利用者自身のゴールデンセット / 中立の第三者 |

軸1、軸2、軸4の3つの方向は、本書の3つの道筋に対応します。自動化(A)、人手回帰(B)、規制主導(C)です。軸3は道筋と対応せず、幻覚の扱い方の違いとして別に並べます。

もう1つの列が、発言者の利害です。クラウド事業者は自社の基盤での評価を、評価の提供事業者は評価を基盤の中核とする見方を語ります。評価の運営者は中立の第三者の必要を語ります。利害があることは発言が誤りであることを意味しません。しかし利害を書かずに並べれば、本書は広告になります。

### 2. 軸1：誰が採点するか

| 方向 | 主張 | 発言者と利害 | 公表 |
| --- | --- | --- | --- |
| 自動化 | 人手評価の数分の1の費用と時間で、人並みの品質で他のモデルを評価できる | AWS(クラウド事業者) | 2024年12月 [ [ 394 ] ](https://aws.amazon.com/blogs/aws/new-rag-evaluation-and-llm-as-a-judge-capabilities-in-amazon-bedrock) |
| 自動化 | 可能な限り自動で採点し、質より量を優先する | Anthropic(モデルの提供者) | 2026年10月取得 [ [ 352 ] ](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests) |
| 自動化 | 審判モデルは人手より桁違いに速く安く、ときにより信頼できる | Eugene Yan(大手企業の応用科学者) | 2024年8月 [ [ 641 ] ](https://eugeneyan.com/writing/llm-evaluators/) |
| 自動化 | 人間の投票が集まるまで、人の選好で学習した報酬モデルが即時に採点する | Arena(評価の運営者) | 2026年7月 [ [ 627 ] ](https://arena.ai/blog/autoeval-scores) |
| 人手回帰 | 審判モデルは評価対象の問題を継承するので、人の検証がさらに要る | Shankarら(UC Berkeleyの研究者) | 2024年4月 [ [ 346 ] ](https://arxiv.org/abs/2404.12272) |
| 人手回帰 | 最大級のモデルでも、人間同士の一致には遠く及ばない | Thakurら(研究者) | 2024年6月 [ [ 628 ] ](https://arxiv.org/abs/2406.12624) |
| 人手回帰 | 大事なのは審判が人の判断にどれだけ一致するかで、エラー分析が最も重要な活動 | Hamel HusainとShreya Shankar(評価講座を提供する実務家) | 2026年9月表示 [ [ 351 ] ](https://hamel.dev/blog/posts/evals-faq/) |
| 人手回帰 | 審判モデルは「かつて信じられていたほど成熟していない」。TrialからAssessへ下げる | Thoughtworks(コンサルティング会社) | 2025年11月 [ [ 358 ] ](https://www.thoughtworks.com/radar/techniques/llm-as-a-judge) |
| 規制主導 | フロンティアAIには有効な第三者テストが要り、政府が評価機関を支えるべきだ | Anthropic(モデルの提供者) | 2024年3月 [ [ 617 ] ](https://www.anthropic.com/news/third-party-testing) |
| 規制主導 | 実際の人の手に渡ったAIの安全と整合を測る、中立の第三者が要る | Arena(評価の運営者) | 2026年10月 [ [ 667 ] ](https://arena.ai/blog/series-b) |

この軸の特徴は、自動化を語る側も人の確認を捨てていないことです。審判モデルの出発点になった2023年6月の論文は、GPT-4の審判が人間と80%超で一致し、人間同士と同じ水準だと報告しました [ [ 89 ] ](https://arxiv.org/abs/2306.05685) 。2024年には、自分の出力を見分ける審判の能力と、自分の出力をひいきする強さに、線形の相関があると示されました [ [ 98 ] ](https://arxiv.org/abs/2404.13076) 。2025年8月の立場論文は、審判モデルの採用が、妥当性と信頼性の検証を追い越していると主張しています [ [ 359 ] ](https://arxiv.org/abs/2508.18076) 。

### 3. 軸2：物差しは信頼できるか

公開のベンチマークへの不信には、LLM以前からの源流があります。Rajiらは2021年に、少数の影響力あるベンチマークを汎用能力の代理として称揚する傾向を批判しました [ [ 50 ] ](https://arxiv.org/abs/2111.15366) 。LLMの時代に入ると、この批判は汚染、飽和、ゲーミングの3つの形で再燃しました。

- **汚染**。評価データに関連するデータが訓練に混入する「ベンチマーク漏洩」が一般化していると、2023年11月に警告されました [ [ 121 ] ](https://arxiv.org/abs/2311.01964) 。
- **飽和**。Stanford HAIのAI Index 2026は、数年もつはずの評価が数か月で飽和すると述べました [ [ 630 ] ](https://hai.stanford.edu/ai-index/2026-ai-index-report/technical-performance) 。
- **ゲーミング**。2025年4月の論文「The Leaderboard Illusion」は、Chatbot Arenaで非公開の事前テストが許され、MetaがLlama-4の公開前に27の非公開の変種を試したと指摘しました [ [ 82 ] ](https://arxiv.org/abs/2504.20879) 。主著者は競合のモデル提供者Cohereの研究者です。運営者は反論を公表し、どの提供者も望むだけ変種を提出できると述べています [ [ 83 ] ](https://arena.ai/blog/our-response) 。

同じ人物の発言を時点順に追うと、信頼が崩れていく過程が見えます。Andrej Karpathy(元OpenAI。独立の研究者)は、2024年7月に、難問を解きながら簡単な問題で失敗する現象を「Jagged Intelligence」と名づけました [ [ 644 ] ](https://x.com/karpathy/status/1816531576228053133) 。2025年3月には「評価の危機がある」と投稿し、私的な評価の組み合わせが有望な道かもしれないと述べました [ [ 646 ] ](https://x.com/karpathy/status/1896266683301659068) 。2025年12月の年次総括では、ベンチマークへの信頼を失ったと書いています [ [ 647 ] ](https://karpathy.bearblog.dev/year-in-review-2025) 。

評価を科学にしようとする提案も並びます。第三者評価の組織Apollo Researchは2024年1月に、現在の評価は科学というより芸術だと述べました [ [ 638 ] ](https://www.apolloresearch.ai/blog/we-need-a-science-of-evals) 。AnthropicのEvan Millerは2024年11月に、評価は実験であるとして、標準誤差と信頼区間を評価に持ち込むよう提案しました [ [ 618 ] ](https://arxiv.org/abs/2411.00640) 。Anthropicは2026年3月に、自社のモデルが評価中にテストを疑い、解答鍵を復号した事例を公表し、評価の完全性を継続的な敵対的問題として扱うよう述べています [ [ 619 ] ](https://www.anthropic.com/engineering/eval-awareness-browsecomp) 。

### 4. 軸3：幻覚は直るか

幻覚をめぐる言説は、二項対立ではなく3つの立場に分かれます。

| 立場 | 主張 | 発言者と利害 | 公表 |
| --- | --- | --- | --- |
| ゼロにできる | 全ての回答で答えを調べる規則を足せば対処できる(「解決可能」は記事の要約) | Jensen Huang(NVIDIA CEO。AI需要を支える利害)。報道 | 2024年3月 [ [ 672 ] ](https://techcrunch.com/2024/03/19/agi-and-hallucinations/) |
| 減らせる | 修正モデルを組み合わせ、自社の順位表で幻覚率0.9%に下げた | Vectara(幻覚検出の提供事業者) | 2025年4月 [ [ 626 ] ](https://www.vectara.com/blog/introducing-mockingbird-2-vectaras-crosslingual-grounded-generation-model) |
| 棄権で逃がす | 幻覚は不可避ではない。不確かなら棄権できる。ただし精度は100%に届かない | OpenAI(モデルの提供者) | 2025年9月 [ [ 262 ] ](https://openai.com/index/why-language-models-hallucinate/) |
| 直らない | 幻覚はLLMの働きの核心そのものだ | Gary Marcus(認知科学者。著名な懐疑派) | 2024年4月 [ [ 670 ] ](https://garymarcus.substack.com/p/facing-facts) |

この軸で評価に直接かかわるのは、OpenAIの主張です。同社は、正答率だけで採点する評価が推測を報いるために幻覚が生まれるとし、自信のある誤りを強く罰し、不確かさの表明に部分点を与えるよう主要な評価の採点を変えるべきだと述べました [ [ 262 ] ](https://openai.com/index/why-language-models-hallucinate/) 。幻覚の原因の一部を、評価の設計そのものに帰した主張です。

### 5. 軸4：評価の基盤をどこに置くか

**事業者とクラウドの標準機能**。Google Cloudは2024年9月に、順位表は自社の要件での振る舞いを明らかにしないとして、利用者が自分の評価基準を定める評価サービスを一般提供にしました [ [ 622 ] ](https://cloud.google.com/blog/products/ai-machine-learning/experimentation-to-production-with-gemini-and-vertex-ai) 。Microsoftは2025年5月に、統治・評価・追跡・監視を1つにまとめた最初の製品だと称する観測機能を公開しています [ [ 623 ] ](https://devblogs.microsoft.com/foundry/achieve-end-to-end-observability-in-azure-ai-foundry/) 。一方でOpenAIは2026年6月に、自社のEvalsプラットフォームの廃止を通知し、2026年11月30日に停止する予定と公表しました [ [ 128 ] ](https://developers.openai.com/api/docs/deprecations) 。

**評価の提供事業者への投資**。評価を独立した事業とみる資金の流れは、会社の発表で確かめられます。

| 会社 | 発表 | 金額(会社の発表) |
| --- | --- | --- |
| Patronus AI | 2024年5月、シリーズA | 1,700万ドル [ [ 663 ] ](https://www.patronus.ai/blog/announcing-our-17-million-series-a) |
| Braintrust | 2024年10月、シリーズA | 3,600万ドル [ [ 664 ] ](https://www.braintrust.dev/blog/announcing-series-a) |
| Arena | 2026年1月、シリーズA | 1.5億ドル [ [ 666 ] ](https://arena.ai/blog/series-a) |
| Braintrust | 2026年2月、シリーズB | 8,000万ドル [ [ 665 ] ](https://www.braintrust.dev/blog/announcing-series-b) |
| Arena | 2026年10月、シリーズB | 2億ドル(評価額31億ドル) [ [ 667 ] ](https://arena.ai/blog/series-b) |

**利用者自身の評価**。a16z(ベンチャー投資家)は2024年3月に、企業の責任者が公開ベンチマークではなく自社内部のベンチマークでモデルを比べていると報告しました [ [ 418 ] ](https://a16z.com/generative-ai-enterprise-2024/) 。2025年6月の同社の調査でも、社内のベンチマーク、ゴールデンセット、開発者の反応が評価の中心でした [ [ 409 ] ](https://a16z.com/ai-enterprise-2025/) 。

### 6. 日本の言説の位置

日本の言説は、公的機関が評価の観点を供給し、企業の技術者が手順を発信するという分業になっています。

公的な側では、AIセーフティ・インスティテュート(AISI)が2024年9月に評価観点ガイドを公開し、2026年7月の第1.20版でAIエージェントに対応しました [ [ 571 ] ](https://aisi.go.jp/output/output_framework/guide_to_evaluation_perspective_on_ai_safety/) 。AISIの所長は2025年3月の取材で、今のAIが英語圏、特にアメリカの文化に強く依存していることへの懸念を述べています [ [ 673 ] ](http://scienceportal.jst.go.jp/stories/20250321_e01/index.html) 。研究の側では、国立情報学研究所の研究者が2024年9月の講演資料で「まだ評価は不十分」と記しました [ [ 676 ] ](https://llmc.nii.ac.jp/wp-content/uploads/2024/10/20240925_t3_miyao.pdf) 。

企業の技術ブログは、海外で2024年に出た審判モデルへの反証を、2025年から2026年に受け取り直しています。LayerXは2025年9月に、完全一致で比べられる部分だけが自動化され、文章の自然さの評価は人が行っていると書きました [ [ 681 ] ](https://tech.layerx.co.jp/entry/stable-ai-agent-dev-with-langfuse) 。受託開発企業の代表は2026年3月に、同じモデルの審判は「評価」より「承認」に近づきやすいと述べています [ [ 683 ] ](https://zenn.dev/peintangos/articles/525b8067c852e8) 。海外の実務知は翻訳でも入りました。2024年6月には、実務家6名の共同執筆の教訓が、著者の許可を得て日本語に訳されています [ [ 685 ] ](https://zenn.dev/seya/articles/12c67b5d80670a) 。

### 7. 年限つきの予測の一覧

評価そのものを主語にした、年限つきの数値の予測は少数です。本書の調査で一次資料を確かめられたものは、Gartner(調査会社。予測と助言を売る利害)のAIの信頼・リスク・セキュリティ管理(AI TRiSM)に関するものに限られます。

| 公表 | 予測 | 出典 |
| --- | --- | --- |
| 2023年10月 | AI TRiSMは2〜5年で主流になる。2026年までに、透明性と信頼とセキュリティを運用した組織は採用などで50%改善する | [ [ 653 ] ](https://www.gartner.com/en/newsroom/press-releases/2023-10-11-gartner-says-more-than-80-percent-of-enterprises-will-have-used-generative-ai-apis-or-deployed-generative-ai-enabled-applications-by-2026) |
| 2023年10月 | 2026年までに、AI TRiSMの統制を使う企業は誤った情報の最大80%を排除する | [ [ 654 ] ](https://www.gartner.com/en/newsroom/press-releases/2023-10-16-gartner-identifies-the-top-10-strategic-technology-trends-for-2024) |
| 2024年7月 | 2025年末までに、生成AIの案件の30%以上が概念実証の後に放棄される。理由の1つは不十分なリスク統制 | [ [ 419 ] ](https://www.gartner.com/en/newsroom/press-releases/2024-07-29-gartner-predicts-30-percent-of-generative-ai-projects-will-be-abandoned-after-proof-of-concept-by-end-of-2025) |
| 2025年6月 | 2027年末までに、エージェント型AIの案件の40%超が中止される | [ [ 656 ] ](https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027) |
| 2025年8月 | AI TRiSMは過度な期待のピークにあり、5年以内に主流になる | [ [ 657 ] ](https://www.gartner.com/en/newsroom/press-releases/2025-08-05-gartner-hype-cycle-identifies-top-ai-innovations-in-2025) |

自動評価の比率、人手評価の回帰、審判モデルの標準化を数値で予測した一次資料は、本書の調査では見つかりませんでした。他の言説は、予測ではなく提案か兆候です。OpenAIの採点の改革 [ [ 262 ] ](https://openai.com/index/why-language-models-hallucinate/) とApolloの科学化の呼びかけ [ [ 638 ] ](https://www.apolloresearch.ai/blog/we-need-a-science-of-evals) は提案です。ArenaのAI採点の導入 [ [ 627 ] ](https://arena.ai/blog/autoeval-scores) とAnthropicの評価認識の事例 [ [ 619 ] ](https://www.anthropic.com/engineering/eval-awareness-browsecomp) は兆候です。2026年を期限とするGartnerの予測の当否を、2026年10月時点で判定できる一次資料も、本書の調査では見つかりませんでした。

### 🗺️ 図：評価の言説は「誰が採点するか」で3方向に分かれる

![評価の言説を3つの方向に分けた図。左から自動化、人手回帰、規制主導の3つの列があり、各列に主な担い手と代表的な主張を置く。下に、年限つきの数値予測はGartnerだけという添え書きがある](/images/genai-evaluation-blueprint/21-discourse-taxonomy.png)

#### 図の読み方

図は、3つの列を左から右へ読みます。左の藍の列が自動化で、担い手はクラウド事業者と評価の提供事業者です。中央の列が人手回帰で、担い手は審判モデルを検証した研究者と実務家です。この列だけを丹(朱色)で縁取ったのは、人が判定する場所を表すためです。右の黄土色の列が規制主導で、担い手は規制当局と第三者評価の組織です。

列の中の短い主張は、本文の第2節の表から1つずつ選んだものです。同じ発言者が複数の列に現れることは、第1節で挙げたOpenAIの例のとおりです。図の下の添え書きは、第7節の結論を1行で示しています。

### 本章の位置づけ

本章は言説を分類しただけで、どの方向が正しいかを述べていません。分類から読み取れることを、著者の整理として3点記します。

第一に、発言者の利害は方向と強く対応しています。自動化を語るのは、クラウド事業者、評価の提供事業者、モデルの提供者の製品文書に集中しています。人手回帰を語るのは、審判モデルを検証した研究者と、実装を担う実務家です。規制主導を語るのは、規制当局のほか、第三者評価の制度化で役割を得る事業者と運営者です。この対応は方向の当否を決めませんが、言説を読むときの基準率になります。

第二に、軸を分けると矛盾の多くが消えます。「審判モデルで量を測る」と「人の判断との一致を確かめる」は両立します。実務家の推奨は、どの軸でも両方を組み合わせる形に収束しています。3つの道筋は排他ではなく、軸ごとの方向の組み合わせとして定義する必要があります。

第三に、評価を主語にした数値の予測はほとんどありません。著者は、評価の未来を語る言説の多くが予測ではなく自社の製品や役割の提案であることを、この分野の特徴と考えます。次の[3つの道筋の章](22-three-paths)では、年限つきの像を描く際に、Gartner以外の数値を作らず、規則の適用日のように日付の確定した事実を骨組みに使います。
