---
title: "付録A：用語集 ―― 評価の用語と本書の定義"
---

本付録は、本書に出てくる評価の用語を、定義・初出・本書の主な章とともにまとめます。定義は、その用語を提案した論文や規格、公式文書の記述に基づき、出典へのリンクを添えます。「初出」は、その語や手法が公表された時点と発表者です。起源をたどれなかった語は「起源は未特定」と書き、本書が引く最初の例か、定義に使った資料だけを示します。

本書は、似た語を次のように使い分けます。指標と人の採点の相関を論じるときは「人の評価」、人が出力を採点する作業は「人手評価」、合否を決める行為は「人の判定」と書きます。RAGの評価手法と論文は「RAGAS」、その実装のライブラリは「Ragas」と書きます。

本書の枠組みに属する語(入力側5項目のI1〜I5、生成側5項目のG1〜G5、評価の成熟度V0〜V4、道筋A〜C)は、著者の整理です。導入フェーズS1〜S6は、本編『AIトランスフォーメーションの設計図』の定義です。業界の標準ではありません。これらには出典を付けず、初出の欄に「本書の定義」と記します。

用語は分野ごとに8つの表に分けました。各表の中は、アルファベットで始まる語をアルファベット順に並べ、続いて日本語の語を五十音順に並べます。最後の表だけは、枠組みの記号の順に並べます。

### 1. 評価の基本の語

| 用語 | 定義 | 初出 | 本書の主な章 |
| --- | --- | --- | --- |
| A/Bテスト | 利用者を無作為に分け、変更前と変更後の版を比べる対照実験。事前に総合評価基準(OEC)を定めることが勧められる。生成AIでは、ユーザー指標による評価がこの系譜に連なる | 2020年3月にKohaviらの教科書が体系化した [ [ 118 ] ](https://doi.org/10.1017/9781108653985) | [評価の成熟度の章](19-evaluation-maturity)、[評価体制の立ち上げの章](23-launching-evaluation) |
| Bradley-Terryモデル | ペア比較の勝敗から、各対象の潜在的な「強さ」を推定する統計モデル。2023年12月以降のChatbot Arenaの順位はこのモデルに基づく [ [ 75 ] ](https://lmsys.org/blog/2023-12-07-leaderboard/) | 1952年12月、BradleyとTerryがBiometrikaで発表した [ [ 5 ] ](https://academic.oup.com/biomet/article-abstract/39/3-4/324/320283) | [審判としてのLLMの章](05-llm-as-judge) |
| Eloレーティング | 対戦の勝敗から点数を逐次更新する、チェス由来の順位付けの方式。LLMの順位付けでは変動の大きさが問題になった [ [ 75 ] ](https://lmsys.org/blog/2023-12-07-leaderboard/) | チェスの格付けの方式で、本書は原著を確かめていない。LLMの評価での最初の使用は、2023年5月にLMSYSがChatbot Arenaの順位付けに採用したもの [ [ 67 ] ](https://lmsys.org/blog/2023-05-03-arena/) | [審判としてのLLMの章](05-llm-as-judge) |
| Goodhartの法則 | 指標を目標にすると、指標が目標の代わりとして働かなくなるという経験則。報酬モデルを最適化しすぎると真の性能が下がる現象として測られた [ [ 65 ] ](https://arxiv.org/abs/2210.10760) | 1975年、Charles GoodhartがReserve Bank of Australiaの論文集で述べた。2018年3月のManheimとGarrabrantの論文はこの原典を引き、変種を分類した [ [ 629 ] ](https://arxiv.org/abs/1803.04585) | [嗜好の学習の章](04-preference-learning)、[3つの道筋の章](22-three-paths) |
| vibes(目視の評価) | 作った人が数件の出力を見て、良し悪しを感覚で判断すること。実務家は、この確認をコードとアサーションで運用に落とすよう勧めている [ [ 640 ] ](https://applied-llms.org/) | 起源は未特定。2025年3月にKarpathyは、目視の確認は誤解を招くかもしれないと述べた [ [ 646 ] ](https://x.com/karpathy/status/1896266683301659068) | [評価の成熟度の章](19-evaluation-maturity) |
| 汚染(データ汚染) | 評価に使う問題や正解が、モデルの学習データに含まれてしまうこと。点数が実力より高く出る。記憶と利用を分けて量る方法が示されている | 起源は未特定。本書が引く定量化の方法は、2022年3月のMagarとSchwartzのもの [ [ 120 ] ](https://arxiv.org/abs/2203.08242) | [能力ベンチマークとの距離の章](10-capability-benchmarks-distance) |
| オフライン評価 | 配備する前に、用意したデータセットで出力を評価すること。プロンプトやモデルを変えたときの回帰テストに使う [ [ 375 ] ](https://docs.langchain.com/langsmith/evaluation-concepts) | 起源は未特定 | [道具の氾濫の章](09-tool-proliferation)、[評価の成熟度の章](19-evaluation-maturity) |
| 回帰検査 | プロンプトやモデルを変えたときに、固定したデータセットで出力を採点し、前より悪くなっていないかを確かめること。オフライン評価の主な用途 [ [ 375 ] ](https://docs.langchain.com/langsmith/evaluation-concepts) | 起源は未特定 | [評価の成熟度の章](19-evaluation-maturity)、[評価体制の立ち上げの章](23-launching-evaluation) |
| オンライン評価 | 本番のトレースに評価器を当てて、稼働中の品質を監視すること。費用を抑えるため、対象のトレースを一定の割合で抜き出して採点する [ [ 402 ] ](https://docs.langchain.com/langsmith/online-evaluations) | 起源は未特定 | [道具の氾濫の章](09-tool-proliferation)、[評価の成熟度の章](19-evaluation-maturity) |
| 観測基盤 | 本番の実行を記録し、評価・監視・人手のレビューにつなぐ道具の総称。自動採点、人手の注釈、データセットと実験をまとめて扱う製品が多い [ [ 403 ] ](https://langfuse.com/docs/evaluation/overview) | 起源は未特定。2025年5月にMicrosoftが評価・トレース・監視の統合を掲げた例がある [ [ 623 ] ](https://devblogs.microsoft.com/foundry/achieve-end-to-end-observability-in-azure-ai-foundry/) | [道具の氾濫の章](09-tool-proliferation)、[評価の成熟度の章](19-evaluation-maturity) |
| 継続的インテグレーション(CI) | 変更のたびに検査を自動で回す開発の仕組み。評価の道具は、指標がしきい値を下回ると変更の取り込み(ビルド)を失敗させる [ [ 415 ] ](https://deepeval.com/docs/evaluation-unit-testing-in-ci-cd) | 起源は未特定 | [評価の成熟度の章](19-evaluation-maturity)、[評価体制の立ち上げの章](23-launching-evaluation) |
| 較正(審判の較正) | 審判モデルの採点の基準やプロンプトを、人のラベルに合わせて調整すること。実務家は、審判が人の判断にどれだけ一致するかを測るよう勧める [ [ 351 ] ](https://hamel.dev/blog/posts/evals-faq/) | 起源は未特定 | [評価体制の立ち上げの章](23-launching-evaluation) |
| ゴールデンセット | 評価のために固定した、入力と参照出力(または採点基準)の組の集まり。企業は外部のベンチマークよりも、社内のベンチマークやゴールデンデータセットを重く見ている [ [ 409 ] ](https://a16z.com/ai-enterprise-2025/) | 起源は未特定。データセットを入力と参照出力の例と定義する文書がある [ [ 375 ] ](https://docs.langchain.com/langsmith/evaluation-concepts) | [評価の成熟度の章](19-evaluation-maturity)、[評価体制の立ち上げの章](23-launching-evaluation) |
| しきい値 | 合否を分ける値。評価の道具では指標ごとにしきい値を決め、下回ると変更の取り込みを止める [ [ 415 ] ](https://deepeval.com/docs/evaluation-unit-testing-in-ci-cd) | 起源は未特定 | [評価の成熟度の章](19-evaluation-maturity)、[評価体制の立ち上げの章](23-launching-evaluation) |
| テストコレクション | 文書の集合、問い、問いごとの適合性の判定の3つをそろえた評価用の資源。検索の評価の基本形 | 1960年代のCranfield実験。1966年の報告は1,400文書と279問を使った [ [ 143 ] ](https://ntrl.ntis.gov/NTRL/dashboard/searchResults/titleDetail/PB169574.xhtml) | [人が測っていた時代の章](01-human-judgement-era) |
| トレース | 1回の実行を、モデルの呼び出しやエージェントの処理などの区間(span)に分けて記録したもの。OpenTelemetryのGenAI意味規約は、2026年10月時点でも開発中の状態にある [ [ 401 ] ](https://github.com/open-telemetry/semantic-conventions-genai) | 2024年5月、OpenTelemetryの意味規約v1.26.0にGenAIの規約が初めて入った [ [ 399 ] ](https://github.com/open-telemetry/semantic-conventions/releases/tag/v1.26.0) | [道具の氾濫の章](09-tool-proliferation) |
| 人手評価と評価者間一致 | 人が出力を採点すること。採点の信頼性は、評価者どうしの一致の度合いを係数で表して確かめる。Cohenのκ、Krippendorffのα、Fleissのκが代表。κは、偶然による一致を除いて一致の度合いを測る指標で、0.6以上を実質的な一致とみなす実務家の説明がある [ [ 439 ] ](https://note.com/wayne_chang/n/n3dcff96258b1) | 1960年のCohen、1970年のKrippendorff、1971年のFleiss [ [ 4 ] ](https://doi.org/10.1177/001316446002000104) | [人が測っていた時代の章](01-human-judgement-era)、[3つの道筋の章](22-three-paths) |
| 飽和 | ベンチマークの点数が上限に近づき、モデル間の差を見分けられなくなること。数年もつはずの評価が数か月で飽和するようになったと報告されている [ [ 630 ] ](https://hai.stanford.edu/ai-index/2026-ai-index-report/technical-performance) | 2019年5月、SuperGLUEがGLUEの飽和を理由に作られた [ [ 44 ] ](https://arxiv.org/abs/1905.00537) | [能力ベンチマークとの距離の章](10-capability-benchmarks-distance) |
| 評価(evals) | 開発と本番を通じて、モデルやエージェントの出力の品質・安全性・信頼性を測ること [ [ 133 ] ](https://learn.microsoft.com/en-us/azure/ai-foundry/concepts/evaluation-approach-gen-ai) 。本書はevalsを「評価」と訳す | 起源は未特定。本書が引く最初の例は、2023年3月にOpenAIが公開した評価の枠組みOpenAI Evals [ [ 342 ] ](https://openai.com/index/gpt-4-research/) | [道具の氾濫の章](09-tool-proliferation) |
| 評価キャンペーン | 共通のデータで参加者が各自のシステムを走らせ、共通の方法で採点して結果を比べる催し | 起源は未特定。本書が引く最初の例は、1992年にNISTなどが始めたTREC [ [ 3 ] ](https://trec.nist.gov/overview.html) | [人が測っていた時代の章](01-human-judgement-era) |
| 評価駆動開発(EDD) | 開発の出発点に評価を置き、課題に固有の評価を回しながら改善する開発の進め方 | 2023年7月、Eugene Yanが命名した [ [ 343 ] ](https://eugeneyan.com/writing/llm-patterns/) 。2024年10月にVercelも提唱した [ [ 347 ] ](https://vercel.com/blog/eval-driven-development-build-better-ai-faster) | [評価の成熟度の章](19-evaluation-maturity)、[評価体制の立ち上げの章](23-launching-evaluation) |
| ペア比較 | 2つの出力を並べ、どちらが良いかを判定させる評価の形式 | 起源は未特定。本書が引く統計の土台は、1952年のBradley-Terryモデル [ [ 5 ] ](https://academic.oup.com/biomet/article-abstract/39/3-4/324/320283) | [審判としてのLLMの章](05-llm-as-judge)、[生成側の評価の章](18-evaluating-generation) |
| メタ評価 | 評価の指標や審判そのものが、人の判断とどれほど合うかを評価すること。メタ評価の結論自体が外れ値に左右されることも示された | 起源は未特定。本書が引く例は、2014年のWMTの指標の共通課題の報告 [ [ 24 ] ](https://aclanthology.org/W14-3336/) と、指標のメタ評価の危うさを示した2020年6月の研究 [ [ 27 ] ](https://arxiv.org/abs/2006.06264) | [参照との一致の章](02-reference-metrics)、[審判としてのLLMの章](05-llm-as-judge) |
| ルーブリック評価 | 採点の観点と基準を事前に文章で定め、それに沿って人や審判モデルが採点する方式。医療では医師が書いた48,562の基準で採点した例がある [ [ 299 ] ](https://openai.com/index/healthbench/) | 起源は未特定 | [生成側の評価の章](18-evaluating-generation) |

### 2. 参照と意味の一致を測る指標

| 用語 | 定義 | 初出 | 本書の主な章 |
| --- | --- | --- | --- |
| BERTScore | 候補と参照を、完全一致ではなく文脈埋め込みのトークン類似度で照合する指標 | 2019年4月、Zhangらが提案した [ [ 31 ] ](https://arxiv.org/abs/1904.09675) | [意味の一致の章](03-learned-metrics) |
| BLEU | 機械翻訳の出力と参照訳のn-gramの一致から計算する自動指標。1〜4-gramの修正適合率(参照に現れる回数で頭打ちにした適合率)を幾何平均し、短すぎる訳に罰則を掛ける [ [ 17 ] ](https://aclanthology.org/P02-1040/) 。人手評価の「代役」として提案された。翻訳以外や個別の文の評価には支持されないと総括された [ [ 26 ] ](https://aclanthology.org/J18-3002/) | 2002年7月、IBMのPapineniらが提案した [ [ 17 ] ](https://aclanthology.org/P02-1040/) | [参照との一致の章](02-reference-metrics) |
| BLEURT | 数千件の人手評価で微調整した、学習済みの評価指標 | 2020年4月、Googleが提案した [ [ 33 ] ](https://arxiv.org/abs/2004.04696) | [意味の一致の章](03-learned-metrics) |
| chrF | 文字単位のn-gramのF値で翻訳を評価する指標。語の区切りに依存しないため、多くの言語で使われる | 2015年9月、Popovićが提案した [ [ 23 ] ](https://aclanthology.org/W15-3049/) | [参照との一致の章](02-reference-metrics) |
| COMET | 原文と参照訳の両方を入力にとる、ニューラル網の翻訳評価の枠組み。3種の人手評価で訓練した | 2020年9月、Unbabelが公開した [ [ 34 ] ](https://arxiv.org/abs/2009.09025) | [意味の一致の章](03-learned-metrics) |
| METEOR | 語幹や同義語も一致とみなすユニグラムの照合に、語順の乱れの罰則を加えた翻訳の指標 | 2005年6月、BanerjeeとLavieが提案した [ [ 19 ] ](https://aclanthology.org/W05-0909/) | [参照との一致の章](02-reference-metrics) |
| QAGS | 要約と原文に同じ質問をし、答えが一致するかで事実の整合を測る、参照を使わない手法 | 2020年4月、Wangらが提案した [ [ 35 ] ](https://arxiv.org/abs/2004.04228) | [意味の一致の章](03-learned-metrics) |
| ROUGE | 要約と参照要約の語の重なりを測る指標群(ROUGE-N、ROUGE-Lなど)。約20年にわたり要約評価の標準だった [ [ 30 ] ](https://arxiv.org/abs/2010.07100) | 2004年7月、Linが公開した [ [ 18 ] ](https://aclanthology.org/W04-1013/) | [参照との一致の章](02-reference-metrics) |
| SummaC | 自然言語推論(NLI)のモデルを文単位に分けて当て、要約の不整合を検出する手法 | 2021年11月、Labanらが提案した [ [ 37 ] ](https://arxiv.org/abs/2111.09525) | [意味の一致の章](03-learned-metrics) |
| 参照(参照解) | 人が書いた模範の出力。参照との一致で測る指標は、本当に気にかけている品質の粗い代理にすぎないと指摘された [ [ 62 ] ](https://arxiv.org/abs/2009.01325) | 2002年のBLEUが参照訳との照合を標準にした [ [ 17 ] ](https://aclanthology.org/P02-1040/) | [参照との一致の章](02-reference-metrics) |

### 3. 審判と嗜好の語

| 用語 | 定義 | 初出 | 本書の主な章 |
| --- | --- | --- | --- |
| Chatbot Arena | 利用者が匿名の2モデルの回答を比べて投票し、その結果で順位を付ける公開の場。2026年7月には、票が集まるまで報酬モデルが即時に採点する仕組みも入った [ [ 627 ] ](https://arena.ai/blog/autoeval-scores) | 2023年5月、LMSYSが公開した [ [ 67 ] ](https://lmsys.org/blog/2023-05-03-arena/) | [審判としてのLLMの章](05-llm-as-judge) |
| Constitutional AI / RLAIF | 人による有害性のラベルの代わりに、原則のリストに基づくAIの自己批評とAIの選好で学習する方式。AIのフィードバックによる強化学習をRLAIFと呼ぶ | 2022年12月、Anthropicが提示した [ [ 66 ] ](https://arxiv.org/abs/2212.08073) | [嗜好の学習の章](04-preference-learning) |
| DPO | 報酬モデルを明示的に学習せず、選好のデータから方策を直接最適化する方法 | 2023年5月、Rafailovらが提案した [ [ 69 ] ](https://arxiv.org/abs/2305.18290) | [嗜好の学習の章](04-preference-learning) |
| G-Eval | GPT-4に思考の連鎖と記入式の採点をさせる評価法。LLMの評価器がLLMの生成文を好む偏りも早くに指摘した | 2023年3月、Microsoftの研究者が提案した [ [ 86 ] ](https://arxiv.org/abs/2303.16634) | [審判としてのLLMの章](05-llm-as-judge) |
| MT-Bench | 多ターンの質問に対する回答を、審判モデルに採点させるベンチマーク。GPT-4の審判と人の一致は、同点の票を除いた比較で85%で、人どうしの一致(81%)を上回った [ [ 89 ] ](https://arxiv.org/abs/2306.05685) | 2023年6月、Zhengらが公開した [ [ 89 ] ](https://arxiv.org/abs/2306.05685) | [審判としてのLLMの章](05-llm-as-judge)、[日本の評価の実践の章](14-japan-practice) |
| RLHF | 人の選好から報酬モデルを学習し、強化学習でモデルを人の意図に合わせる方式。InstructGPTは、1.3Bのモデルの出力が175BのGPT-3より好まれると示した [ [ 63 ] ](https://arxiv.org/abs/2203.02155) | 2017年6月、Christianoらが選好からの学習を示した [ [ 61 ] ](https://arxiv.org/abs/1706.03741) | [嗜好の学習の章](04-preference-learning) |
| RLVR | 正解を機械で検証できる課題で、その検証結果を報酬にする強化学習。報酬が本当に能力を測っているかの検証が要ると指摘された [ [ 108 ] ](https://arxiv.org/abs/2506.10947) | 2024年11月、AI2のTülu 3が命名した [ [ 106 ] ](https://arxiv.org/abs/2411.15124) | [嗜好の学習の章](04-preference-learning)、[3つの道筋の章](22-three-paths) |
| 位置バイアス | 審判モデルが、回答の中身ではなく提示の順番で判定を変える偏り。順番を入れ替えるだけで勝敗を操作できた | 2023年5月、Wangらが報告した [ [ 88 ] ](https://arxiv.org/abs/2305.17926) | [審判としてのLLMの章](05-llm-as-judge) |
| 自己選好 | 審判モデルが自分の生成した出力を見分け、高く評価する偏り。自己認識の能力と偏りの強さに相関がある | 2024年4月、Panicksseryらが定義した [ [ 98 ] ](https://arxiv.org/abs/2404.13076) | [審判としてのLLMの章](05-llm-as-judge) |
| 冗長性バイアス | 審判モデルが、内容の質と関係なく長い回答を好む偏り | 2023年6月にZhengらが挙げ [ [ 89 ] ](https://arxiv.org/abs/2306.05685) 、同年10月に日本の研究者が検証した [ [ 94 ] ](https://arxiv.org/abs/2310.10076) | [審判としてのLLMの章](05-llm-as-judge) |
| 審判モデル(LLM-as-a-judge) | 大規模言語モデル(LLM)に、別のモデルの出力を採点させる評価の方式。位置・冗長性・自己強化の偏りと、推論能力の限界がある | 2023年6月、Zhengらが命名して検証した [ [ 89 ] ](https://arxiv.org/abs/2306.05685) | [審判としてのLLMの章](05-llm-as-judge)、[3つの道筋の章](22-three-paths) |
| 選好漏洩 | 学習用の合成データを作ったモデルと審判モデルが同じか近い系統のとき、審判が「教え子」を贔屓する汚染。従来の偏りより検出が難しい | 2025年2月、Liらが定義した [ [ 107 ] ](https://arxiv.org/abs/2502.01534) | [審判としてのLLMの章](05-llm-as-judge) |
| 報酬モデル | 人の比較のデータから学習し、出力の良さを点数で返すモデル。評価器がそのまま訓練の信号になる。報酬モデル自体を評価するベンチマークもある [ [ 77 ] ](https://arxiv.org/abs/2403.13787) | 2017年6月、Christianoらが人の比較から報酬を学習する方法を示した [ [ 61 ] ](https://arxiv.org/abs/1706.03741) 。2019年9月にはZieglerらがこの報酬学習を言語の課題に適用した [ [ 1605 ] ](https://arxiv.org/abs/1909.08593) 。2020年9月にはOpenAIが要約で人の比較から報酬モデルを学習した [ [ 62 ] ](https://arxiv.org/abs/2009.01325) | [嗜好の学習の章](04-preference-learning) |
| 迎合(sycophancy) | モデルが正しさより、ユーザーの見解に合う応答を返す傾向。人の選好のデータが迎合的な応答を好むことが一因とされる [ [ 73 ] ](https://arxiv.org/abs/2310.13548) | 2022年12月、Anthropicのモデル生成評価が測った [ [ 300 ] ](https://arxiv.org/abs/2212.09251) 。2025年4月にOpenAIは迎合を理由に更新を戻した [ [ 302 ] ](https://openai.com/index/sycophancy-in-gpt-4o/) | [嗜好の学習の章](04-preference-learning)、[失敗の記録の章](11-failure-records) |

### 4. 収集(入力側)の語

| 用語 | 定義 | 初出 | 本書の主な章 |
| --- | --- | --- | --- |
| ARES | 合成データで軽量の判定器を微調整し、少数の人手ラベルで予測を補正して、RAGを3つの観点で評価する枠組み | 2023年11月、Saad-Falconらが提案した [ [ 42 ] ](https://arxiv.org/abs/2311.09476) | [RAG評価の成立の章](06-rag-evaluation) |
| context precision | 検索器が、適合するチャンクを適合しないものより上位に並べられたかを測るRAGASの指標 [ [ 167 ] ](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/context_precision/) | RAGASの論文(2023年9月)の指標ではなく、後にライブラリRagasの公式文書に加わった指標。加わった時期は本書では確かめていない [ [ 167 ] ](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/context_precision/) | [RAG評価の成立の章](06-rag-evaluation)、[入力側の評価の章](17-evaluating-input) |
| context recall | 参照回答に含まれる主張のうち、取得した文脈で支持されるものの割合。LLMを使わない版は、取得できた参照文脈の割合で測る [ [ 167 ] ](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/context_precision/) 。計算には常に比べる相手の参照が要る [ [ 1808 ] ](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/context_recall/) | RAGASの論文(2023年9月)の指標ではなく、後にライブラリRagasの公式文書に加わった指標。加わった時期は本書では確かめていない [ [ 1808 ] ](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/context_recall/) | [RAG評価の成立の章](06-rag-evaluation)、[入力側の評価の章](17-evaluating-input) |
| Lost in the Middle | 関連する情報が長い入力の中央にあると性能が大きく落ち、先頭や末尾にあると高い現象 | 2023年7月、Stanfordなどの研究者が報告した [ [ 185 ] ](https://arxiv.org/abs/2307.03172) | [入力側の評価の章](17-evaluating-input) |
| MRR(平均逆順位) | 最初の正答が何位に出たかの逆数を問いごとにとり、平均した値 | 1999年のTREC-8の質問応答トラックで使われた [ [ 146 ] ](https://aclanthology.org/L00-1018) | [人が測っていた時代の章](01-human-judgement-era)、[入力側の評価の章](17-evaluating-input) |
| Needle in a Haystack | 長い文章の中に1文(針)を埋め込み、文脈の長さと埋め込む深さを変えて探させるテスト | 2023年11月、Greg Kamradtが公開した [ [ 186 ] ](https://github.com/gkamradt/LLMTest_NeedleInAHaystack) | [入力側の評価の章](17-evaluating-input) |
| nDCG | 段階的な適合度を、順位が下がるほど割り引いて累積し、理想の並びで正規化した検索の指標 | 2002年、JärvelinとKekäläinenがACM TOISで提案した [ [ 147 ] ](https://researchportal.tuni.fi/en/publications/cumulated-gain-based-evaluation-of-ir-techniques) | [入力側の評価の章](17-evaluating-input) |
| RAG(検索拡張生成) | 検索で集めた情報を根拠にして、モデルに出力を生成させる構成。生成器と密ベクトルの索引を組み合わせた論文が名前を与えた | 2020年5月、Facebook AI ResearchのLewisらが命名した [ [ 158 ] ](https://arxiv.org/abs/2005.11401) | [RAG評価の成立の章](06-rag-evaluation) |
| RAG Triad | 文脈の関連性、根拠性、回答の関連性の3つでRAGを評価する考え方 | 2023年、TruLensのプロジェクトが導入した [ [ 168 ] ](https://www.trulens.org/getting_started/core_concepts/rag_triad/) | [RAG評価の成立の章](06-rag-evaluation) |
| RAGAS | RAGを、忠実性・回答の関連性・文脈の関連性の3つの観点で、人手の正解なしに評価する指標群 [ [ 41 ] ](https://arxiv.org/abs/2309.15217) 。本書は論文と手法をRAGAS、実装のライブラリをRagasと書き分ける | 2023年9月、Esらが公開した [ [ 41 ] ](https://arxiv.org/abs/2309.15217) | [RAG評価の成立の章](06-rag-evaluation)、[道具の氾濫の章](09-tool-proliferation) |
| RAGの7つの失敗点 | 3つの事例から整理された、RAGが失敗する7つの箇所。RAGの検証は運用中にしかできないと結論した | 2024年1月、Deakin大学のBarnettらが整理した [ [ 198 ] ](https://arxiv.org/abs/2401.05856) | [RAG評価の成立の章](06-rag-evaluation)、[失敗から逆算する評価の章](12-evaluation-from-failures) |
| 再現率 | 集めるべき適合の文書や情報のうち、実際に集められたものの割合。プール方式の判定では、見つかっていない適合文書のため過大に見積もられやすい [ [ 144 ] ](https://findanexpert.unimelb.edu.au/scholarlywork/1056492-how-reliable-are-the-results-of-large-scale-information-retrieval-experiments%3F) | 1960年代のCranfield実験に始まる検索評価の基本指標 [ [ 143 ] ](https://ntrl.ntis.gov/NTRL/dashboard/searchResults/titleDetail/PB169574.xhtml) | [人が測っていた時代の章](01-human-judgement-era)、[入力側の評価の章](17-evaluating-input) |
| 時点つきQA | 時間とともに答えが変わる問いで、知識の鮮度を測る評価。FreshQAは、規模を問わず全モデルが急に変わる知識と誤った前提に弱いと示した [ [ 219 ] ](https://arxiv.org/abs/2310.03214) | 2021年から時間つきの事実の診断データが作られた。本書が引く例は2021年8月のTimeQA [ [ 216 ] ](https://arxiv.org/abs/2108.06314) | [入力側の評価の章](17-evaluating-input) |
| 出所(provenance) | データや物の生成に関わった実体・活動・人の情報。品質や信頼性の評価に使える [ [ 220 ] ](https://www.w3.org/TR/prov-dm/) | 2013年4月、W3CがPROV-DMで標準の語彙を定めた [ [ 220 ] ](https://www.w3.org/TR/prov-dm/) 。2020年9月のKILTは出所を示せるかを評価軸に入れた [ [ 164 ] ](https://arxiv.org/abs/2009.02252) | [入力側の評価の章](17-evaluating-input) |
| 適合率 | 集めた文書や情報のうち、問いに適合するものの割合。雑音の少なさを表す | 1960年代のCranfield実験に始まる検索評価の基本指標 [ [ 143 ] ](https://ntrl.ntis.gov/NTRL/dashboard/searchResults/titleDetail/PB169574.xhtml) | [人が測っていた時代の章](01-human-judgement-era)、[入力側の評価の章](17-evaluating-input) |
| ナゲット評価 | 正解に含まれるべき情報の単位(ナゲット)を決め、出力がそれをどれだけ含むかで採点する方法 | 2003年のTREC QAトラックで生まれ、2024年にLLMで自動化された [ [ 181 ] ](https://arxiv.org/abs/2411.09607) | [RAG評価の成立の章](06-rag-evaluation) |
| 文脈の十分性(sufficient context) | 与えた文脈だけで質問に答えられるかどうか。不十分な文脈を足すと、モデルは棄権せず誤答しやすくなる [ [ 173 ] ](https://research.google/blog/deeper-insights-into-retrieval-augmented-generation-the-role-of-sufficient-context/) | 2024年11月、Googleの研究者が自動判定器とともに提案した [ [ 172 ] ](https://arxiv.org/abs/2411.06037) | [RAG評価の成立の章](06-rag-evaluation)、[入力側の評価の章](17-evaluating-input) |

### 5. 生成側の語

| 用語 | 定義 | 初出 | 本書の主な章 |
| --- | --- | --- | --- |
| confabulation | 誤りで、かつ乱数の種のような無関係な条件で答えが変わる幻覚の一部を指す語 [ [ 260 ] ](https://www.nature.com/articles/s41586-024-07421-0) 。NIST AI 600-1は生成AIに固有のリスクの名前にこの語を使い、「幻覚」を俗称とした [ [ 259 ] ](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) | 2024年6月、OxfordのFarquharらがNatureで定義した [ [ 260 ] ](https://www.nature.com/articles/s41586-024-07421-0) | [幻覚の計測の章](07-hallucination-measurement) |
| FActScore | 長い生成文を原子的な事実に分け、信頼できる知識源で支持される割合を測る指標。人手で測ると6,500件の生成で2.6万ドルかかった | 2023年5月、Minらが提案した [ [ 39 ] ](https://arxiv.org/abs/2305.14251) | [幻覚の計測の章](07-hallucination-measurement)、[生成側の評価の章](18-evaluating-generation) |
| FACTS Grounding | 最大32Kトークンの文書に基づく長文の応答が、文書に根拠づいているかを3つの審判モデルで2段階に採点するベンチマーク | 2024年12月、Google DeepMindが公開した [ [ 281 ] ](https://deepmind.google/discover/blog/facts-grounding-a-new-benchmark-for-evaluating-the-factuality-of-large-language-models/) | [幻覚の計測の章](07-hallucination-measurement) |
| IFEval | 「400語以上で書く」のように機械で検証できる25種の指示で、指示への追従を測るベンチマーク | 2023年11月、Zhouらが提案した [ [ 57 ] ](https://arxiv.org/abs/2311.07911) | [生成側の評価の章](18-evaluating-generation) |
| pass@k | コード生成で候補を複数つくり、そのうち1つでもテストに通る確率 | 2019年6月にKulalらがSPoCで使い [ [ 1802 ] ](https://arxiv.org/abs/1906.04908) 、2021年7月にOpenAIのCodexの論文が偏りの無い推定量を示した [ [ 292 ] ](https://arxiv.org/abs/2107.03374) | [生成側の評価の章](18-evaluating-generation) |
| pass^k | 同じ課題を繰り返し試して、すべて成功する確率。エージェントの信頼性を測る | 2024年6月、Sierraの研究者がτ-benchで提案した [ [ 115 ] ](https://arxiv.org/abs/2406.12045) | [生成側の評価の章](18-evaluating-generation)、[3つの道筋の章](22-three-paths) |
| SimpleQA | 正解が1つに決まる短答の事実問題で、回答を「正解・不正解・未回答」に採点するベンチマーク。知っていることを知っているかを測る [ [ 125 ] ](https://arxiv.org/abs/2411.04368) | 2024年11月7日、OpenAIが論文を公開した [ [ 125 ] ](https://arxiv.org/abs/2411.04368) | [幻覚の計測の章](07-hallucination-measurement) |
| 引用の正確さ | 出力に付けた出典が、実際にその内容を支えているかの度合い。ある調査では、200件の引用のうち153件で出所の特定が部分的か全面的に誤っていた [ [ 228 ] ](https://www.cjr.org/tow_center/how-chatgpt-misrepresents-publisher-content.php) | 2021年12月、GoogleのAISが、出力を特定の出所に帰属できるかを人手で測る枠組みを示した [ [ 252 ] ](https://arxiv.org/abs/2112.12870) 。2022年12月にはGoogleが生成文に出所を付けるタスクを定義した [ [ 223 ] ](https://arxiv.org/abs/2212.08037) | [失敗の記録の章](11-failure-records)、[生成側の評価の章](18-evaluating-generation) |
| 課題達成率 | 出力や行動の結果、利用者の課題が達成されたかの割合。エージェントでは、機能的な正しさで課題の達成を測る [ [ 113 ] ](https://arxiv.org/abs/2307.13854) | 1997年、PARADISEが対話の評価を課題の達成と対話の費用に分けた [ [ 7 ] ](https://aclanthology.org/P97-1035/) | [人が測っていた時代の章](01-human-judgement-era)、[生成側の評価の章](18-evaluating-generation) |
| 幻覚(ハルシネーション) | もっともらしいが事実に基づかない内容を生成すること [ [ 254 ] ](https://arxiv.org/abs/2311.05232) 。用語は画像の分野が先で、誤りの意味は2018年の画像キャプションから広まった [ [ 246 ] ](https://arxiv.org/abs/2202.03629) | 2022年2月、Jiらの総説が用語の歴史を整理した [ [ 246 ] ](https://arxiv.org/abs/2202.03629) | [幻覚の計測の章](07-hallucination-measurement) |
| 幻覚率と棄権 | 幻覚率は、回答のうち誤った回答の割合。正答率だけで採点すると当て推量が得になるため、答えない(棄権)を別に数える採点が提案された [ [ 262 ] ](https://openai.com/index/why-language-models-hallucinate/) | 起源は未特定。本書が引く最初の例は、回答を正解・不正解・未回答に分けて採点した2024年11月のSimpleQA [ [ 125 ] ](https://arxiv.org/abs/2411.04368) 。2024年12月にはOpenAIのo1のシステムカードが正答率と幻覚率を並べた [ [ 332 ] ](https://cdn.openai.com/o1-system-card-20241205.pdf) | [幻覚の計測の章](07-hallucination-measurement)、[生成側の評価の章](18-evaluating-generation) |
| 根拠性(groundedness) | 応答が、利用者の与えた資料に根拠づいているかどうか。根拠のない箇所を検出して直す機能も製品化された [ [ 312 ] ](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/whats-new) | 起源は未特定 | [ガードレールの系譜の章](08-guardrails-lineage)、[生成側の評価の章](18-evaluating-generation) |
| 事実性(factuality) | 出力が、世界の事実と一致していること。与えた根拠との一致(忠実性)とは区別される | 2020年5月、Maynezらが論文の題で忠実性と分けた [ [ 249 ] ](https://arxiv.org/abs/2005.00661) | [幻覚の計測の章](07-hallucination-measurement)、[生成側の評価の章](18-evaluating-generation) |
| 忠実性(faithfulness) | 出力が、与えた根拠や入力の文書と一致していること。RAGASは、応答の主張のうち取得文脈で支持される割合として測る [ [ 166 ] ](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/faithfulness/) | 2017年11月、Caoらが要約の約30%が偽の事実を含むと報告した [ [ 247 ] ](https://arxiv.org/abs/1711.04434) | [意味の一致の章](03-learned-metrics)、[生成側の評価の章](18-evaluating-generation) |
| 閉じた領域・開いた領域の幻覚 | 閉じた領域の幻覚は、与えた文脈にない情報を作ること。開いた領域の幻覚は、文脈なしに世界について誤情報を自信をもって述べること | 2023年3月、OpenAIのGPT-4のシステムカードが分けた [ [ 253 ] ](https://cdn.openai.com/papers/gpt-4-system-card.pdf) | [幻覚の計測の章](07-hallucination-measurement) |
| 内在的幻覚・外在的幻覚 | 原典では、内在的幻覚は入力の文書の情報を使いながら文書と食い違う内容を作るもの、外在的幻覚は入力の文書に無い内容を加えるもの [ [ 249 ] ](https://arxiv.org/abs/2005.00661) 。2025年4月のMetaのHalluLensは、外在的の比較の相手を学習データに置き換えて再定義した [ [ 256 ] ](https://arxiv.org/abs/2504.17550) | 2020年5月、Maynezらが要約の分野で区別した [ [ 249 ] ](https://arxiv.org/abs/2005.00661) | [幻覚の計測の章](07-hallucination-measurement) |

### 6. 安全とガードレールの語

| 用語 | 定義 | 初出 | 本書の主な章 |
| --- | --- | --- | --- |
| Llama Guard | 入力と出力を安全リスクの分類体系で判定する、LLMを使った安全分類器 | 2023年12月、MetaがPurple Llamaの一部として公開した [ [ 311 ] ](https://ai.meta.com/blog/purple-llama-open-trust-safety-generative-ai/) | [ガードレールの系譜の章](08-guardrails-lineage) |
| ガードレール | LLMの出力を制御する特定の方法。学習でモデルに埋め込む整合とは別に、実行時に入力や出力などを制御する [ [ 310 ] ](https://arxiv.org/abs/2310.10501) | 2023年4月、NVIDIAがNeMo Guardrailsを公開した [ [ 309 ] ](https://blogs.nvidia.com/blog/ai-chatbot-guardrails-nemo) | [ガードレールの系譜の章](08-guardrails-lineage)、[生成側の評価の章](18-evaluating-generation) |
| 過剰拒否 | 安全な問いなのに、危険な問いと似た語を含むために拒否すること。有用性と無害性の緊張を表す [ [ 316 ] ](https://arxiv.org/abs/2308.01263) | 2023年8月、XSTestが定式化した [ [ 316 ] ](https://arxiv.org/abs/2308.01263) 。2024年3月にはAnthropicが製品の改善点として挙げた [ [ 323 ] ](https://www.anthropic.com/news/claude-3-family) | [ガードレールの系譜の章](08-guardrails-lineage)、[生成側の評価の章](18-evaluating-generation) |
| 間接プロンプトインジェクション | 検索や閲覧で読み込まれるデータに指示を仕込み、モデルにそれを実行させる攻撃。データと指示の境界が曖昧になる | 2023年2月、Greshakeらが実在のシステムで実証した [ [ 1102 ] ](https://arxiv.org/abs/2302.12173) | [ガードレールの系譜の章](08-guardrails-lineage)、[失敗の記録の章](11-failure-records) |
| システムカード | 事業者がモデルの公開に合わせて、安全性や幻覚などの評価の結果を文書で公開するもの | 2023年3月、OpenAIがGPT-4と合わせて公開した [ [ 607 ] ](https://arxiv.org/abs/2303.08774) | [幻覚の計測の章](07-hallucination-measurement)、[評価の現在地の章](15-state-of-2026) |
| 脱獄(jailbreak) | 細工した入力で、モデルの安全上の制限を回避させること。既存の評価は脱獄の効果を過大に見積もっていたと報告された [ [ 317 ] ](https://arxiv.org/abs/2402.04249) | 起源は未特定。2024年2月以降、HarmBenchなどで評価の標準化が進んだ [ [ 317 ] ](https://arxiv.org/abs/2402.04249) | [ガードレールの系譜の章](08-guardrails-lineage) |
| プロンプトインジェクション | 入力の中の、信頼できない指示に誤って従うこと [ [ 328 ] ](https://openai.com/index/operator-system-card/) 。指示の乗っ取りと、プロンプトの漏えいの2つの攻撃が定式化された | 2022年11月、PerezとRibeiroが定式化した [ [ 306 ] ](https://arxiv.org/abs/2211.09527) | [ガードレールの系譜の章](08-guardrails-lineage)、[失敗の記録の章](11-failure-records) |
| モデルカード | モデルを評価した条件と性能を文書にまとめる慣行 | 2019年1月、MitchellらがFAT* 2019で発表した [ [ 597 ] ](https://arxiv.org/abs/1810.03993) | [規格と規制の章](13-standards-and-regulation) |
| レッドチーミング | 攻撃者の視点からシステムの弱点や対策の不備を探る評価。アメリカの大統領令14110は法令の上で定義した [ [ 534 ] ](https://www.federalregister.gov/documents/2023/11/01/2023-24283/safe-secure-and-trustworthy-development-and-use-of-artificial-intelligence) | 2022年2月にDeepMindが [ [ 320 ] ](https://arxiv.org/abs/2202.03286) 、同年8月にAnthropicが体系化した [ [ 1803 ] ](https://arxiv.org/abs/2209.07858) | [ガードレールの系譜の章](08-guardrails-lineage)、[規格と規制の章](13-standards-and-regulation) |

### 7. 規格と規制の語

| 用語 | 定義 | 初出 | 本書の主な章 |
| --- | --- | --- | --- |
| AI事業者ガイドライン | 総務省と経済産業省がAIの開発者・提供者・利用者に向けて示す指針。第1.1版は、出力の品質が活用の開始後に大きく変わりうるとして、作業記録の保存を求めた [ [ 578 ] ](https://www.soumu.go.jp/main_content/001002576.pdf) | 2024年4月、第1.0版が取りまとめられた [ [ 577 ] ](https://www.meti.go.jp/press/2024/04/20240419004/20240419004.html) | [規格と規制の章](13-standards-and-regulation)、[日本の評価の実践の章](14-japan-practice) |
| AI推進法 | 日本の令和7年法律第53号(人工知能関連技術の研究開発及び活用の推進に関する法律)。指針の整備、権利利益の侵害事案の分析、人工知能基本計画の策定を定める。出力の評価方法を直接定める条文はない | 2025年6月4日に公布された [ [ 580 ] ](https://www.shugiin.go.jp/internet/itdb_housei.nsf/html/housei/21720250604053.htm) | [規格と規制の章](13-standards-and-regulation)、[3つの道筋の章](22-three-paths) |
| AISI(日本) | AIの安全性評価の調査や基準の検討を担う日本の機関。IPAの中に置かれた | 2024年2月に発足した [ [ 570 ] ](https://aisi.go.jp/about/) | [規格と規制の章](13-standards-and-regulation)、[日本の評価の実践の章](14-japan-practice) |
| EU AI Act | EUのAI規則。禁止行為、汎用目的AI(GPAI)モデルの義務、高リスクAIの要求を段階的に適用する。GPAIの義務は2025年8月2日から適用された [ [ 546 ] ](https://artificialintelligenceact.eu/article/113/) 。高リスクの分類と要求事項(第III章第1〜3節)の適用は、2026年7月の改正で附属書IIIが2027年12月2日、附属書Iが2028年8月2日に延期された [ [ 1701 ] ](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32026R1744) | 2025年2月2日に一部の適用が始まった [ [ 546 ] ](https://artificialintelligenceact.eu/article/113/) | [規格と規制の章](13-standards-and-regulation)、[3つの道筋の章](22-three-paths) |
| GPAIの技術文書 | 汎用目的AIモデルの提供者が作る文書。訓練とテストの過程と評価の結果を含む [ [ 549 ] ](https://artificialintelligenceact.eu/article/53/) 。システミックリスクを持つモデルでは、評価の基準・指標・限界の特定方法を含む評価戦略を追加で記す(附属書XI第2節) [ [ 550 ] ](https://artificialintelligenceact.eu/annex/11/) | AI Act第53条(1)(a)。自由でオープンソースのライセンスで重みなどを公開したモデルの提供者は、システミックリスクを持つ場合を除き、この義務の対象外(第53条2項) [ [ 549 ] ](https://artificialintelligenceact.eu/article/53/) | [規格と規制の章](13-standards-and-regulation) |
| GPAI実践規範 | AI Actの汎用目的AIの義務を守るための任意の手段。透明性・著作権・安全性とセキュリティの3章から成る | 2025年7月10日に欧州委員会が公表した [ [ 554 ] ](https://digital-strategy.ec.europa.eu/en/policies/contents-code-gpai) | [規格と規制の章](13-standards-and-regulation) |
| ISO/IEC 42001 | AIマネジメントシステムの国際規格。出力の精度の指標そのものは定めず、リスク評価・監視・内部監査など評価の仕組みを求める [ [ 519 ] ](https://webdesk.jsa.or.jp/preview/pre_jis_q_42001_000_000_2025_j_ed10_ch.pdf) | 2023年12月18日に発行された [ [ 518 ] ](https://www.iso.org/standard/42001) | [規格と規制の章](13-standards-and-regulation)、[3つの道筋の章](22-three-paths) |
| ISO/IEC 42006 | AIマネジメントシステムを審査し認証する機関への要求事項。42001の認定認証の枠組みを整えた | 2025年7月7日に発行された [ [ 526 ] ](https://www.iso.org/standard/44546.html) | [規格と規制の章](13-standards-and-regulation) |
| NIST AI RMF | NISTのAIリスクマネジメントの枠組み。Govern・Map・Measure・Manageの4機能から成り、任意で使う [ [ 531 ] ](https://www.nist.gov/itl/ai-risk-management-framework) | 2023年1月26日に公開された [ [ 531 ] ](https://www.nist.gov/itl/ai-risk-management-framework) | [規格と規制の章](13-standards-and-regulation) |
| TEVV | テスト・評価・検証・妥当性確認の略。AI RMFのMeasure機能は、客観的で再現でき規模を拡げられるTEVVの手順と指標を到達点に置く | 2023年1月のAI RMF 1.0 [ [ 532 ] ](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf) | [規格と規制の章](13-standards-and-regulation) |
| 重大インシデント報告 | AIによる重大なインシデントを当局に報告する義務。AI Actには2つの義務がある。システミックリスクを持つGPAIモデルの提供者は、第55条(1)(c)により追跡・文書化と遅滞のない報告を課される [ [ 551 ] ](https://artificialintelligenceact.eu/article/55/) 。高リスクAIの提供者の報告は第73条が定める [ [ 553 ] ](https://artificialintelligenceact.eu/article/73/) | GPAIの義務(第V章)は2025年8月2日から適用された [ [ 546 ] ](https://artificialintelligenceact.eu/article/113/) 。高リスクAIの分類と要求事項(第III章第1〜3節)の適用は、2026年7月の改正で2027年12月2日(附属書III)と2028年8月2日(附属書I)に延期された [ [ 1701 ] ](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32026R1744) | [規格と規制の章](13-standards-and-regulation)、[3つの道筋の章](22-three-paths) |
| 適合性評価 | 製品やシステムが規格や法令の要求を満たすことを確かめる手続き。AI Actは高リスクAIの提供者に、市場に出す前の実施を求める。実質的な変更のたびにやり直す | AI Act第43条 [ [ 1501 ] ](https://artificialintelligenceact.eu/article/43/) 。適合性評価で確かめる高リスクの要求事項(第III章第2節)の適用は、2026年7月の改正で、附属書IIIの高リスクが2027年12月2日、附属書Iの高リスクが2028年8月2日からとされた [ [ 1701 ] ](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32026R1744) | [規格と規制の章](13-standards-and-regulation)、[3つの道筋の章](22-three-paths) |
| 評価観点ガイド | 日本のAISIがまとめた、AIの安全性を評価する10の観点の文書。偽誤情報については、出力の前に事実を確認する仕組みがある状態を目指す姿とする [ [ 572 ] ](https://aisi.go.jp/assets/pdf/ai_safety_eval_summary_v1.10_ja.pdf) | 2024年9月18日に第1.00版が公表された [ [ 572 ] ](https://aisi.go.jp/assets/pdf/ai_safety_eval_summary_v1.10_ja.pdf) | [規格と規制の章](13-standards-and-regulation)、[日本の評価の実践の章](14-japan-practice) |

### 8. 本書の枠組みの語

| 用語 | 定義 | 初出 | 本書の主な章 |
| --- | --- | --- | --- |
| 2層10項目 | 評価の対象を、入力側(収集の評価)と生成側(生成の評価)の2層に分け、各層を5項目に分ける本書の整理 | 本書の定義(第16章) | [期待値への距離の章](16-distance-to-expectation) |
| 期待値への距離 | ユーザーの入力に対する期待値に、出力がどこまで近づいたか。10項目の組み合わせで読み、1つの点数にまとめない。測れていない項目が、失敗の起きた項目と対応する | 本書の定義(第16章) | [期待値への距離の章](16-distance-to-expectation)、[失敗から逆算する評価の章](12-evaluation-from-failures) |
| I1必要 | 入力だけで足りないものは何か、という情報要求の把握。クエリの理解、質問の明確化率、曖昧さの検出で測る | 本書の定義(第16章) | [入力側の評価の章](17-evaluating-input) |
| I2十分 | 必要な情報が集まったか。再現率、context recall、文脈の十分性で測る | 本書の定義(第16章) | [入力側の評価の章](17-evaluating-input) |
| I3精度 | 集めた情報は関係があり、雑音は少ないか。適合率、context precision、nDCG、再ランキングで測る | 本書の定義(第16章) | [入力側の評価の章](17-evaluating-input) |
| I4鮮度 | 情報は古くないか。時点つきQA、更新日、陳腐化率で測る | 本書の定義(第16章) | [入力側の評価の章](17-evaluating-input) |
| I5出所 | 集めた資料は信頼でき、使ってよいか。出所と権限で測る(回答の文が根拠を正しく指すかはG2忠実) | 本書の定義(第16章) | [入力側の評価の章](17-evaluating-input) |
| G1整形 | 期待した形になっているか。指示追従(IFEval)、構造化出力、ツール呼び出しの形式と引数、長さと体裁で測る | 本書の定義(第16章) | [生成側の評価の章](18-evaluating-generation) |
| G2忠実 | 与えた根拠と一致しているか。忠実性、引用の裏づけ、FACTS Grounding、要約の整合で測る | 本書の定義(第16章) | [生成側の評価の章](18-evaluating-generation) |
| G3事実 | 世界の事実と一致しているか。事実性、SimpleQA、FActScore、幻覚率で測る | 本書の定義(第16章) | [生成側の評価の章](18-evaluating-generation) |
| G4安全 | 有害・漏えい・権限の逸脱・注入が無いか。ガードレール、拒否率と過剰拒否、注入の成功率で測る | 本書の定義(第16章) | [生成側の評価の章](18-evaluating-generation) |
| G5期待 | 有用で、課題を達成し、満足されたか。回答の関連性と完全さ、ペア比較、ルーブリック、課題達成率、ユーザー指標で測る | 本書の定義(第16章) | [生成側の評価の章](18-evaluating-generation) |
| 評価の成熟度(V0〜V4) | 評価の体制を、目視から評価駆動までの5段階で表す本書の尺度。各段階に人材・道具・費用・よくある失敗を対応させる。導入フェーズS1〜S6との対応の正本は第20章の表 | 本書の定義(第19章) | [評価の成熟度の章](19-evaluation-maturity)、[導入フェーズと評価の章](20-adoption-stage-and-evaluation) |
| V0目視 | 作った人が数件を見て判断する段階。道具はチャット画面。本編の導入フェーズS1〜S2に当たる | 本書の定義(第19章) | [評価の成熟度の章](19-evaluation-maturity) |
| V1固定セット | ゴールデンセットと人手の採点で評価する段階。第19章は規模の目安の1つに20〜50の課題を引く。本編の導入フェーズS2〜S3に当たる | 本書の定義(第19章) | [評価の成熟度の章](19-evaluation-maturity)、[評価体制の立ち上げの章](23-launching-evaluation) |
| V2自動評価 | 指標と審判モデルで、変更のたびに回帰を検査する段階。本編の導入フェーズS4に当たる | 本書の定義(第19章) | [評価の成熟度の章](19-evaluation-maturity)、[評価体制の立ち上げの章](23-launching-evaluation) |
| V3本番評価 | 本番のログの採取、抜き取り、人手のレビュー、A/Bテストと監視で評価する段階。本編の導入フェーズS4〜S5に当たる | 本書の定義(第19章) | [評価の成熟度の章](19-evaluation-maturity) |
| V4評価駆動 | 評価が仕様と改善を駆動し、規制の適合と監査に耐える段階。本編の導入フェーズS5〜S6に当たる | 本書の定義(第19章) | [評価の成熟度の章](19-evaluation-maturity) |
| S1触れる | 個人が試用する。業務の成果物には使わない。要る評価の成熟度はV0 | 本編の定義([本編の生成AIの導入段階の章](https://zenn.dev/takenori_kusaka/books/ai-transformation-blueprint/viewer/30-genai-adoption-stages)) | [導入フェーズと評価の章](20-adoption-stage-and-evaluation) |
| S2仕事に適用する | 個人が自分の業務で使い、成果物は人が確認して出す。要る成熟度はV0〜V1 | 本編の定義 | [導入フェーズと評価の章](20-adoption-stage-and-evaluation) |
| S3仕事に組み込む | 部門の手順に組み込み、プロンプトや社内文書検索を共有する。要る成熟度はV1 | 本編の定義 | [導入フェーズと評価の章](20-adoption-stage-and-evaluation) |
| S4システムに組み込む | APIで自社システムと業務の流れに統合し、評価・監視・費用を管理する。要る成熟度はV2〜V3 | 本編の定義 | [導入フェーズと評価の章](20-adoption-stage-and-evaluation) |
| S5商品に組み込む | 自社の製品やサービスの機能として顧客に提供する。要る成熟度はV3〜V4 | 本編の定義 | [導入フェーズと評価の章](20-adoption-stage-and-evaluation) |
| S6顧客へ届ける | 顧客接点でAIが自律的に価値を届け、事業モデルが変わる。要る成熟度はV4 | 本編の定義 | [導入フェーズと評価の章](20-adoption-stage-and-evaluation) |
| 道筋A 自動化 | 審判モデルと検証可能な報酬が標準になり、AIがAIを評価する比率が上がる未来 | 本書の定義(第22章) | [3つの道筋の章](22-three-paths) |
| 道筋B 人手回帰 | ドメイン専門家による評価が職能として確立し、自動評価が補助に回る未来 | 本書の定義(第22章) | [3つの道筋の章](22-three-paths) |
| 道筋C 規制主導 | 適合性評価・監査・インシデント報告が、評価の内容を規定する未来 | 本書の定義(第22章) | [3つの道筋の章](22-three-paths) |
| 後悔しない手・選択権を買う手・賭ける手 | 3つの道筋に対応させる打ち手の3分類。どの道筋でも有効な手、将来の選択肢を残す手、1つの道筋に賭ける手を指す。本編の第35章と同じ型 | 本書の定義(第22章) | [3つの道筋の章](22-three-paths)、[評価体制の立ち上げの章](23-launching-evaluation) |
| 早期警戒指標 | どの道筋に進んでいるかを早めに知るために観測する指標。道筋ごとの分岐条件と対にする | 本書の定義(第22章) | [3つの道筋の章](22-three-paths) |
