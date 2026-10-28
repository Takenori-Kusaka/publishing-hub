---
title: "第5章　エージェントの年 ―― 計算機操作、MCP、A2A、コーディングエージェント(2025)"
---

### 序論：本章が扱う範囲

本章は、2024年10月から2025年12月までの約14か月に起きた出来事を、時系列で整理します。この期間に、大規模言語モデル(LLM)は「質問に答える道具」から「道具を使って仕事を進める主体」へと、提供される形を変えました。業界ではこの期間を「エージェントの年」と呼ぶ言い方が広まりました。

本章が扱うのは出来事です。製品の公開、プロトコルの公開、企業の発表、そして発表の中で各社が示した数値を、発表者の言葉のまま記録します。エージェントが実際にどれだけの仕事をこなせるのかという能力の実測は、[AIエージェントの現在地の章](16-agents-today)に譲ります。エージェントがどう導入されるかの枠組みは、[AIエージェントの導入の章](31-agent-adoption-stages)で扱います。

[推論モデルと価格の章](04-reasoning-and-cost-2024)が扱った推論モデルの登場と、本章が扱うエージェントの登場とは、時期が重なります。推論モデルが「考える時間」を手に入れたことで、複数の手順を要する仕事を任せられるようになった、という関係にあります。本章の本文は事実の記述に限り、評価は章末に分離します。

### 1. 前史：道具を使うモデル(2022〜2024年前半)

エージェントという言葉そのものは、2024年に生まれたものではありません。2022年10月に公開されたReActは、LLMに推論の痕跡と行動とを交互に生成させる手法を提案しました [ [ 574 ] ](https://arxiv.org/abs/2210.03629) 。2023年2月のToolformerは、どのAPIをいつどの引数で呼ぶかを、モデル自身に学習させる方法を示しました [ [ 575 ] ](https://arxiv.org/abs/2302.04761) 。

2023年3月には、目標を与えると自律的に手順を組み立てて実行するAutoGPTのリポジトリが作られ、2026年10月時点で18万7,785のスターを集めています [ [ 576 ] ](https://github.com/Significant-Gravitas/AutoGPT) 。2024年3月、Cognitionは「最初のAIソフトウェアエンジニア」としてDevinを発表し、SWE-benchの一部で13.86%の課題を解決したと公表しました。それまでの最高は1.96%でした [ [ 577 ] ](https://cognition.com/blog/introducing-devin) 。同年5月には、エージェント専用の操作画面を設計したSWE-agentが12.5%を達成しています [ [ 578 ] ](https://arxiv.org/abs/2405.15793) 。

この時点でのエージェントは、研究と実験の対象でした。企業向けの製品として各社が並べ始めるのは、2024年秋からです。

### 2. 2024年秋：計算機を操作し、接続の標準ができる

2024年9月12日、Salesforceは自律型AIエージェント群Agentforceを発表しました。顧客対応と営業向けの一般提供は同年10月25日です [ [ 586 ] ](https://www.salesforce.com/news/press-releases/2024/09/12/agentforce-announcement/) 。同年9月10日にはServiceNowが、IT運用と顧客対応向けのAIエージェントを同年11月から提供すると発表しています [ [ 587 ] ](https://newsroom.servicenow.com/press-releases/details/2024/ServiceNow-to-unlock-247-productivity-at-massive-scale-with-AI-agents-for-IT-Customer-Service-Procurement-HR-Software-Development-and-more-09-10-2024-traffic/default.aspx) 。

2024年10月21日、Gartnerは2025年の戦略的テクノロジー・トレンドの筆頭に「agentic AI」を置き、利用者が定めた目標に向けて自律的に計画し行動するシステムと定義しました。あわせて、2028年までに日常業務の意思決定の少なくとも15%がエージェントによって自律的に下される、という予測を示しました。2024年時点では0%です [ [ 569 ] ](https://www.gartner.com/en/newsroom/press-releases/2024-10-21-gartner-identifies-the-top-10-strategic-technology-trends-for-2025) 。同じ日、MicrosoftはCopilot Studioで自律エージェントを構築する機能を発表しています [ [ 584 ] ](https://www.microsoft.com/en-us/microsoft-copilot/blog/copilot-studio/unlocking-autonomous-agent-capabilities-with-microsoft-copilot-studio/) 。

2024年10月22日、Anthropicは「computer use」を公開ベータとして発表しました。モデルが画面を見て、カーソルを動かし、文字を打ち、クリックして計算機を操作する機能です。同時に公開された新しいClaude 3.5 Sonnetは、計算機操作のベンチマークOSWorldのスクリーンショットのみの部門で14.9%を記録しました。次点は7.8%でした [ [ 21 ] ](https://www.anthropic.com/news/3-5-models-and-computer-use) 。

2024年11月25日、Anthropicは接続の標準としてModel Context Protocol(MCP)をオープンソースで公開しました。モデルと外部のデータや道具とを、双方向につなぐための共通の約束事です [ [ 22 ] ](https://www.anthropic.com/news/model-context-protocol) 。公開時点での初期採用はBlockとApolloで、開発ツール各社が対応を進めている段階でした [ [ 22 ] ](https://www.anthropic.com/news/model-context-protocol) 。

2024年12月14日、GoogleはGoogle Agentspaceを発表しました [ [ 585 ] ](https://cloud.google.com/blog/products/ai-machine-learning/bringing-ai-agents-to-enterprises-with-google-agentspace) 。同年12月19日、Anthropicは技術記事「Building effective agents」で、LLMを使う構成全体を「agentic systems」と呼びました。そのうえで、コードで経路を固定する「workflow」と、LLMが自ら工程と道具の使用を決める「agent」とを区別しました [ [ 566 ] ](https://www.anthropic.com/engineering/building-effective-agents) 。この区別は、以後の議論の共通語になります。

### 3. 2025年前半：操作する、調べる、書く

2025年1月23日、OpenAIは自前のブラウザでウェブを操作するOperatorを、アメリカのProユーザー向けに研究プレビューとして公開しました [ [ 28 ] ](https://openai.com/index/introducing-operator/) 。同年2月2日には、複数の段階に分けてウェブを調査し、数十分で報告書を作るdeep researchを公開しています [ [ 580 ] ](https://openai.com/index/introducing-deep-research/) 。

2025年2月24日、AnthropicはClaude 3.7 Sonnetとともに、端末上で動く「agentic codingのためのコマンドラインツール」としてClaude Codeを限定研究プレビューで公開しました [ [ 29 ] ](https://www.anthropic.com/news/claude-3-7-sonnet) 。同年5月22日のClaude 4の発表で一般提供となり、同じ発表の中で、楽天がオープンソースの改修作業を7時間にわたって自律実行させた事例が示されています [ [ 33 ] ](https://www.anthropic.com/news/claude-4) 。

2025年3月11日、OpenAIはResponses APIとAgents SDKを公開し、エージェントを「利用者に代わって自律的にタスクを遂行するシステム」と定義しました [ [ 583 ] ](https://openai.com/index/new-tools-for-building-agents/) 。同年3月26日、OpenAIはAgents SDKでMCPへの対応を公開しました。Anthropicが公開した標準を、競合であるOpenAIが採用した時点です [ [ 1704 ] ](https://github.com/openai/openai-agents-python/releases/tag/v0.0.7) 。同年5月21日には、Responses APIからリモートのMCPサーバへ接続できるよう広げています [ [ 579 ] ](https://openai.com/index/new-tools-and-features-in-the-responses-api/) 。

2025年4月9日、Googleはエージェント同士が連携するためのオープンなプロトコルAgent2Agent(A2A)を、50社超のパートナーとともに公開しました [ [ 32 ] ](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/) 。MCPが「モデルと道具」をつなぐ約束事であるのに対し、A2Aは「エージェントとエージェント」をつなぐ約束事です。A2Aは同年6月23日に、Linux Foundationのもとで運営されるプロジェクトになりました。この時点で100社超が支持を表明しています [ [ 1705 ] ](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents) 。

2025年5月16日、OpenAIはクラウド上の隔離環境で複数の作業を並列に進めるソフトウェア開発エージェントCodexを研究プレビューで公開しました [ [ 581 ] ](https://openai.com/index/introducing-codex/) 。同年5月20日にはGoogleが非同期のコーディングエージェントJulesを公開ベータにし、8月6日に全員へ提供を広げています。ベータ期間中に14万件超のコード改善が公開されました [ [ 582 ] ](https://blog.google/technology/google-labs/jules/) 。

この半年で、3社はそれぞれ「ブラウザを操作する」「調べて報告書を書く」「コードを書いて直す」という3つの仕事をエージェントに任せる製品を出しました。

### 4. 2025年6月：警告と実測が並ぶ

製品の発表が続く一方で、同じ2025年6月には、評価と警告が公表されています。

2025年6月25日、Gartnerは、agentic AIプロジェクトの40%超が2027年末までに中止されると予測しました。理由として挙げたのは、費用の増大、不明確な事業価値、不十分なリスク管理の3つです。同じ発表で、2028年までに企業ソフトウェアの33%にagentic AIが組み込まれる(2024年は1%未満)という予測も示しました [ [ 181 ] ](https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027) 。同じ発表の中でGartnerは、既存製品を「エージェント」と言い換える「agent washing」を批判し、数千社のベンダーのうち実体があるのは約130社と推定しています [ [ 181 ] ](https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027) 。

2025年6月27日、Anthropicは、Claudeに社内の小型店舗を約1か月運営させた実験Project Vendの結果を公表しました。利益は出ず、金属製の立方体を大量に仕入れて純資産が急落し、自分を人間だと思い込む事象も起きました [ [ 607 ] ](https://www.anthropic.com/research/project-vend-1) 。同社は同年6月20日に、模擬環境で16のモデルを試験し、目標の衝突と置き換えの脅威がある条件で高い率の恐喝行動が観察されたことも報告しています。実運用での発生は確認していない、との注記つきです [ [ 637 ] ](https://www.anthropic.com/research/agentic-misalignment) 。

発表と警告が同じ月に並んだことは、この年の性格を示しています。

### 5. 2025年後半：基盤になる

2025年7月16日、AWSはエージェントを本番で動かすための一連の部品、Amazon Bedrock AgentCoreをプレビューで発表し、同年10月13日に一般提供を始めました。実行環境、記憶、ID、ゲートウェイ、ブラウザ、コード実行、観測の7つの部品で構成されます [ [ 588 ] ](https://aws.amazon.com/blogs/aws/introducing-amazon-bedrock-agentcore-securely-deploy-and-operate-ai-agents-at-any-scale/) 。

2025年8月7日、OpenAIはGPT-5を公開し、コーディングのベンチマークSWE-bench Verifiedで74.9%と報告しました [ [ 34 ] ](https://openai.com/index/introducing-gpt-5/) 。同年9月29日のClaude Sonnet 4.5の発表では、同じベンチマークで77.2%、OSWorld-Verifiedで61.4%という数値のほか、複数の手順からなる課題で30時間超にわたって集中を保ったとの観察が示されています [ [ 35 ] ](https://www.anthropic.com/news/claude-sonnet-4-5) 。2024年10月の14.9%はOSWorld初版のスクリーンショットのみの部門、61.4%は不具合を修正したOSWorld-Verifiedでの値であり、条件が異なるため同一の尺度ではありません。それでも、計算機操作の数値が11か月で大きく上がったことを示しています。

2025年10月6日、OpenAIはエージェントを組み立てる道具一式AgentKitを発表しました [ [ 451 ] ](https://openai.com/index/introducing-agentkit) 。同年10月10日、GoogleはGemini Enterpriseを「職場のAIの新しい玄関口」として発表しました [ [ 1706 ] ](https://cloud.google.com/blog/products/ai-machine-learning/introducing-gemini-enterprise) 。Agentspaceの案内ページは、同製品がGemini Enterpriseへ引き継がれたと注記しています [ [ 585 ] ](https://cloud.google.com/blog/products/ai-machine-learning/bringing-ai-agents-to-enterprises-with-google-agentspace) 。11月18日、MicrosoftはAgent 365を「AIエージェントのコントロールプレーン」として発表し、登録、アクセス制御、可視化、相互運用、セキュリティの5つの機能を挙げました [ [ 584 ] ](https://www.microsoft.com/en-us/microsoft-copilot/blog/copilot-studio/unlocking-autonomous-agent-capabilities-with-microsoft-copilot-studio/) 。同じ11月18日に公開されたGemini 3は、SWE-bench Verifiedで76.2%を報告しています [ [ 36 ] ](https://blog.google/products-and-platforms/products/gemini/gemini-3) 。

企業向けの数値も公表されました。Salesforceは2025年12月3日の決算で、Agentforceの契約が累計1万8,500件超、うち有料が9,500件超、年間経常収益が5億ドル超(前年比330%増)と公表しました [ [ 616 ] ](https://www.salesforce.com/in/news/press-releases/2025/12/03/fy26-q3-earnings/) 。McKinseyが2025年11月に公表した調査では、回答者の23%が少なくとも1つの業務機能でエージェントをスケール中、39%が実験を始めた段階でした [ [ 609 ] ](https://www.mckinsey.com/~/media/mckinsey/business%20functions/quantumblack/our%20insights/the%20state%20of%20ai/the-state-of-ai-in-2025-vf.pdf) 。

2025年12月9日、AnthropicはMCPをLinux Foundation傘下のAgentic AI Foundationへ寄贈しました。財団はAnthropic、Block、OpenAIが共同で設立し、Google、Microsoft、AWSなどが支援しています。寄贈時点で公開されているMCPサーバは1万を超え、SDKの月間ダウンロードは9,700万回を超えていました [ [ 39 ] ](https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation) 。

### 6. 「エージェントの年」と呼ばれた根拠

この期間を「エージェントの年」と呼ぶ言い方の根拠は、次の3点に整理できます。

第一に、主要な事業者がそろってエージェントを主力製品に据えました。Salesforce、ServiceNow、Microsoft、Google、OpenAI、Anthropic、AWSが、2024年9月から2025年11月のあいだに、それぞれの名前でエージェントの製品か基盤を発表しています。

第二に、標準ができました。MCPが「モデルと道具」を、A2Aが「エージェント同士」をつなぐ約束事として公開され、競合同士がそれを採用しました。A2Aは2025年6月にLinux Foundationへ、MCPは2025年12月にLinux Foundation傘下の財団へ移管されています。

第三に、数値が動きました。計算機操作のベンチマークはOSWorld初版(スクリーンショットのみ)の14.9%からOSWorld-Verifiedの61.4%へ上がりました。コーディングのベンチマークはSWE-bench全体の1.96%(2023年10月)からSWE-bench Verifiedの77.2%(2025年9月)へ上がりました [ [ 58 ] ](https://arxiv.org/abs/2310.06770) 。いずれも前後で問題集や条件が異なるため、同一の尺度での上昇ではありません。

一方で、同じ期間にGartnerの中止予測とAnthropicの実験の失敗が公表されたことも、記録として残ります。

### 🗺️ 図：14か月で「答える道具」から「仕事を進める主体」へ

![2024年10月から2025年12月までのエージェントの節目を、操作・接続・開発・基盤の4段で示したスライド](/images/ai-transformation-blueprint/05-year-of-agents-2025.png)

#### 図の読み方

この図は、上から下へ4段の縦の流れで構成されています。各段は、エージェントが獲得した能力の種類を表し、右側にその段を代表する出来事と月を添えています。

最上段「操作する」は、2024年10月のcomputer useと2025年1月のOperatorです。画面を見て計算機を操作する能力が、製品として提供され始めた段です。

2段目「つながる」は、2024年11月のMCPと2025年4月のA2Aです。モデルと道具、エージェント同士をつなぐ標準ができ、競合がそれを採用し、2025年6月と12月に財団へ移管されました。

3段目「作る」は、2025年2月のClaude Code、5月のCodexとJulesです。コードを書いて直す仕事が、エージェントに任される最初の領域になりました。

最下段「基盤になる」は、2025年7月のAgentCore、10月のAgentKitとGemini Enterprise、11月のAgent 365です。エージェントを本番で動かし、管理するための部品が、クラウド各社から出そろいました。

最下段の灰色の枠は、同じ期間に公表された警告です。Gartnerの「40%超が中止」の予測と、Project Vendの失敗を置いています。補助ラベルの数値の出典は、本文の第4節にあります。

### 本章の要点と解釈

本節は、著者による解釈です。前節までの事実記述とは区別して読んでください。

第一に、2025年に起きたのは「エージェントが仕事をこなせるようになった」ことではなく、「エージェントを売り、つなぎ、管理するための部品がそろった」ことです。能力の実測は[AIエージェントの現在地の章](16-agents-today)で扱いますが、製品の発表と能力の到達とは、別々に読む必要があります。

第二に、標準が1年でできたことの意味は大きいと、著者は考えます。MCPが競合に採用され財団へ移管されたことで、企業は特定の事業者に閉じない形でエージェントをつなぐ前提を持てるようになりました。これは、[各段階で必要なものの章](34-requirements-and-providers)で扱う「どの層をどの事業者から買うか」の判断に直接効きます。

第三に、発表と警告が同じ月に並んだことは、この技術の現在地をよく表しています。Gartnerの中止予測は、エージェントが無価値だという意味ではなく、費用と価値と統治の3つを決めずに始めた試行が続かない、という意味です。

### 経営層への含意

2025年に出そろった部品は、2026年10月の時点で、どの企業も同じ条件で買えるものです。差がつくのは部品の有無ではなく、自社のどの仕事に、どの範囲の権限で任せるかという判断です。その判断の枠組みは、[AIエージェントの導入の章](31-agent-adoption-stages)で示します。
