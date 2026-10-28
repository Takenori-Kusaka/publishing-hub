---
title: "第18章　市場の地図 ―― 9 つの層と提供事業者(世界と日本)"
---

### 序論：本章が扱う範囲

本章は、生成AIとAIエージェントを企業に提供する事業者を、9つの層に分けて整理します。各層について、世界と日本の主な事業者と、公表された数値(売上、席数、顧客数、価格)を記録します。数値の時点は2026年10月までです。

この地図は著者の整理であり、網羅ではありません。事業者名の順序は優劣を示しません。公表数値は、決算資料やプレスリリースなど一次発表を優先し、報道にしか根拠がない数値は「報道」と明記します。

どの層の事業者を、どの導入段階で選ぶべきかは、[各段階で必要なものの章](34-requirements-and-providers)で扱います。本章の本文は、事業者と数値の記述に限ります。

### 1. 9つの層の定義

本書は、提供事業者を下から上へ次の9層に分けます。

| 層 | 名前 | 提供するもの |
| --- | --- | --- |
| L1 | 計算資源 | 半導体、データセンター、電力 |
| L2 | クラウドAI基盤 | モデルをホストし、APIで提供する環境 |
| L3 | 基盤モデル | 大規模言語モデルそのもの(世界・日本) |
| L4 | 業務アプリ内蔵 | 既存の業務ソフトに組み込まれたAI機能 |
| L5 | 開発者ツール・エージェント基盤 | コーディング支援、エージェントの実行基盤 |
| L6 | データ基盤・評価・観測 | データの整備、品質評価、稼働監視 |
| L7 | 統治・安全・ID | エージェントの権限管理、防御、規格認証 |
| L8 | SI・コンサル | 導入支援、人材、受託開発 |
| L9 | 業界特化 | 法務、医療、顧客対応などの専用製品 |

下の層ほど資本集約的で事業者は少なく、上の層ほど事業者は多く入れ替わりも速い、という構造です。

### 2. L1 計算資源

NVIDIAの2027会計年度第2四半期(2026年5月から7月)の売上は962億ドルで前年比106%増、うちデータセンター部門は890億ドルで117%増でした。第3四半期の見通しは1,080億ドルで、中国向けのデータセンター計算の売上は見込んでいません [ [ 402 ] ](https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-second-quarter-fiscal-2027) 。AMDの2026年第2四半期の売上は115億ドル、データセンター部門は67億ドルで前年比107%増です。同社はOpenAIと最大6ギガワットの供給契約を結んでいます [ [ 403 ] ](https://ir.amd.com/news-events/press-releases/detail/1295/amd-reports-second-quarter-2026-financial-results) 。

クラウド事業者は自社の半導体を持ち始めています。Googleは2025年11月に第7世代TPUのIronwoodの一般提供を予告し、Anthropicが最大100万TPUの利用を計画していると述べました [ [ 404 ] ](https://cloud.google.com/blog/products/compute/ironwood-tpus-and-new-axion-based-vms-for-your-ai-workloads) 。Amazonは2026年第2四半期の時点で、自社の半導体事業の年間売上の換算値が250億ドルを超え、前年比で3桁%の成長だと発表しました [ [ 406 ] ](https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Second-Quarter-Results) 。同社はAnthropic向けにTrainium2を50万基以上接続したクラスタを構築しています [ [ 405 ] ](https://www.aboutamazon.com/news/aws/trainium-3-ultraserver-faster-ai-training-lower-cost) 。

日本では、通信事業者がデータセンターを建設しています。ソフトバンクの北海道苫小牧のデータセンターは、将来的に受電容量300メガワット超まで拡大する見込みです [ [ 407 ] ](https://www.softbank.jp/business/service/platform/datacenter/tomakomai) 。KDDIの大阪堺データセンターは2026年1月22日に稼働を始め、GPUクラウドの申し込み受付を4月1日に開始しました [ [ 408 ] ](https://newsroom.kddi.com/news/detail/kddi_nr-891_4287.html) 。半導体製造では、Rapidusが2026年2月に政府と民間から総額約2,676億円を調達し、2027年の2ナノメートル世代の量産を目標にしています [ [ 410 ] ](https://www.rapidus.inc/news_topics/news-info/rapidus-secures-267-6-billion-yen-in-funding-from-japan-government-and-private-sector-companies) 。経済産業省のGENIACは第4期(2026年度)で基盤モデル開発16件に計算資源の提供支援を行っています [ [ 411 ] ](https://www.meti.go.jp/press/2026/06/20260604003/20260604003.html) 。

### 3. L2 クラウドAI基盤

Microsoftの2026会計年度(2025年7月から2026年6月)では、Azureの売上が初めて1,000億ドルを超えて41%増でした。モデル提供基盤Foundryの顧客は10万社で、売上は前年比2倍超です [ [ 413 ] ](https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q4) 。Amazonの2026年第2四半期では、AWSの売上が37%増で、AI事業の年間売上の換算値は250億ドル超でした。Bedrockには数十万社の利用があります [ [ 406 ] ](https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Second-Quarter-Results) 。Google Cloudの2026年第2四半期の売上は82%増の248億ドルで、受注残は5,140億ドルでした。モデルAPIは毎分約220億トークンを処理しています [ [ 91 ] ](https://blog.google/company-news/inside-google/message-ceo/alphabet-earnings-q2-2026) 。Oracleの2027会計年度第1四半期(2026年6月から8月)では、残存履行義務が6,640億ドルに達し、四半期中に300億ドル超のAIクラウド契約を追加しました [ [ 414 ] ](https://investor.oracle.com/investor-news/news-details/2026/Oracle-Announces-Q1-Results-Driven-by-Triple-Digit-Growth-in-Cloud-Infrastructure-Revenues/default.aspx) 。

日本では「データを国内に置いたまま海外モデルを動かす」層が商用化されました。KDDIは大阪堺データセンターで、Geminiに加えてオープンウェイトモデルや顧客独自モデルに対応する国内推論環境を提供すると発表しています [ [ 416 ] ](https://newsroom.kddi.com/news/detail/kddi_nr-1211_4785.html) 。ソフトバンクはOracle Alloyを採用した国内クラウドで、国産モデルSarashinaを使った生成AIサービスを2026年6月から順次提供すると発表しました [ [ 415 ] ](https://www.softbank.jp/corp/news/press/sbkk/2026/20260416_02/) 。

### 4. L3 基盤モデル(世界と日本)

企業向けの利用シェアは、ベンチャーキャピタルMenlo Venturesの調査が参照されます。2025年11月の調査(アメリカの企業のAI意思決定者495名)では、企業のLLM API支出のシェアはAnthropic 40%、OpenAI 27%、Google 21%で、3社で88%でした。コーディング用途ではAnthropicが54%です。Menlo VenturesはAnthropicの投資家です [ [ 417 ] ](https://menlovc.com/perspective/2025-the-state-of-generative-ai-in-the-enterprise) 。a16zの2025年のCIO調査(15業種100名)では、5つ以上のモデルを使う企業が37%で、前年の29%から増えました [ [ 418 ] ](https://a16z.com/ai-enterprise-2025) 。

事業者の規模を示す2026年の数値は、急速に動いています。Anthropicは2026年2月のシリーズGで300億ドルを調達し、評価額は3,800億ドルでした。年間売上の換算値は140億ドル、Claude Codeの同換算値は25億ドル超です [ [ 420 ] ](https://www.anthropic.com/news/anthropic-raises-30-billion-series-g-funding-380-billion-post-money-valuation) 。同社の2026年4月の発表によれば、年間売上の換算値は300億ドルを超え、2025年末の約90億ドルから増えました [ [ 421 ] ](https://www.anthropic.com/news/google-broadcom-partnership-compute) 。同社が2026年10月26日に提出した上場申請書類について、Fortuneは次のように報じています。2026年上半期の売上は163億ドルで、純損失807億ドルのうち724億ドルは転換社債の評価替えでした。売上の約半分はクラウドの販売経路を経由します [ [ 422 ] ](https://fortune.com/2026/10/26/anthropics-s-1) 。

OpenAIは2026年3月31日、1,220億ドルの調達を完了し、企業向けが売上の40%超を占めると発表しました [ [ 86 ] ](https://openai.com/index/accelerating-the-next-phase-ai) 。年間売上の換算値については報道に食い違いがあります。Axiosは2026年10月8日、OpenAIの年換算売上が500億ドルで、9月に広く報じられた700億ドルはAnthropicと比較可能にするための調整後の数字だったと報じました [ [ 419 ] ](https://www.axios.com/2026/10/08/openai-50-billion-arr-anthropic-revenue-accounting) 。両社の数値は集計の定義が異なるため、単純には比較できません。

オープンウェイトのモデルも普及しています。MetaのLlamaは2025年3月に累計ダウンロード10億回を超えました [ [ 426 ] ](https://about.fb.com/news/2025/03/celebrating-1-billion-downloads-llama/) 。AlibabaのQwenは2026年8月時点で派生モデル30万超、累計ダウンロード30億超です [ [ 427 ] ](https://www.alibabacloud.com/blog/alibaba-unveils-qwen3-8-27b-and-releases-weights-of-qwen3-8-flagship-model_603463) 。ヨーロッパのMistral AIは、Samsung主導のシリーズDで30億ユーロを調達し、評価額は210億ユーロ超です [ [ 429 ] ](https://mistral.ai/news/mistral-makes-sovereign-open-weight-ai-to-frontier) 。xAIは2026年1月にシリーズEで200億ドルを調達しました [ [ 430 ] ](https://x.ai/news/series-e) 。

日本の基盤モデルは、通信事業者と研究機関が担っています。主な動きを表にまとめます。

| 事業者 | モデル | 2025年から2026年の動き |
| --- | --- | --- |
| SB Intuitions | Sarashina | 2026年10月13日、6モデルをAPIで使える無償ベータを開始 [ [ 432 ] ](https://www.sbintuitions.co.jp/news/press/20261013_01/) |
| NTT | tsuzumi 2 | 2025年10月20日提供開始。1GPUで推論可能 [ [ 433 ] ](https://group.ntt/jp/newsrelease/2025/10/20/251020a.html) |
| Preferred Networks | PLaMo 3.0 Prime | 2026年6月22日正式リリース。APIまたはオンプレミス [ [ 434 ] ](https://www.preferred.jp/ja/news/pr20260622) |
| Sakana AI | - | 2025年11月のシリーズBで約320億円、評価額約4,320億円 [ [ 435 ] ](https://sakana.ai/series-b/) |
| 国立情報学研究所(NII) | LLM-jp-4 | 2026年4月3日、約12兆トークンで学習したモデルを公開 [ [ 437 ] ](https://www.nii.ac.jp/news/release/2026/0403.html) |

富士通はCohereと共同開発したTakaneを2024年9月から提供し [ [ 543 ] ](https://info.archives.global.fujitsu/jp/news/2024/09/30.html) 、2026年5月にはAnthropicと戦略的提携を結んで全社員10万人にClaudeを展開すると発表しました [ [ 470 ] ](https://global.fujitsu/ja-JP/pr/news/2026/05/27-01) 。国産モデルと海外モデルを併用する構成です。

### 5. L4 業務アプリ内蔵

既存の業務ソフトにAIが組み込まれる層は、席数で規模が測られます。

Microsoft 365 Copilotの有償席数は2026年7月29日時点で3,000万超です [ [ 413 ] ](https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q4) 。最大の契約はAccentureの74万席超で、5万席超の顧客数は前年比4倍でした [ [ 438 ] ](https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q3) 。価格は企業向けで1ユーザー月30ドルで、2023年の発表以来据え置かれています。中小向けには21ドルの追加版と従量課金が併設されました [ [ 439 ] ](https://www.microsoft.com/en-us/microsoft-365-copilot/pricing/enterprise) 。

Googleは2025年1月、Geminiの機能をWorkspaceの有償プランに標準で同梱しました。追加版を買っていた顧客は月32ドルから14ドルになりました [ [ 440 ] ](https://workspace.google.com/blog/product-announcements/empowering-businesses-with-AI) 。企業向けのGemini Enterpriseは、2025年10月の提供開始から4か月で有償席数800万超です [ [ 90 ] ](https://abc.xyz/investor/events/event-details/2026/2025-Q4-Earnings-Call-2026-Dr_C033hS6/default.aspx) 。

業務システムの事業者も、AIの売上を分離して開示し始めました。Salesforceの2027会計年度第2四半期では、Agentforceの年間経常収益が15億ドル超で、前年比240%超の増加でした [ [ 442 ] ](https://www.salesforce.com/news/press-releases/2026/08/26/fy27-q2-earnings/) 。ServiceNowのAI製品の年間契約額は2026年第2四半期に10億ドルを超えました [ [ 443 ] ](https://newsroom.servicenow.com/press-releases/details/2026/ServiceNow-Reports-Second-Quarter-2026-Financial-Results/default.aspx) 。SAPの2026年第3四半期のクラウド受注残は241億ユーロで28%増ですが、AIアシスタントJouleの導入社数は非公表です [ [ 444 ] ](https://news.sap.com/2026/10/sap-announces-q3-2026-results/) 。

日本の事業者の数値も記録します。LayerXは2026年1月末に全社の年間経常収益100億円を達成し、AIエージェント事業が成長を牽引したと発表しました [ [ 445 ] ](https://layerx.co.jp/news/20260318/) 。エクサウィザーズ傘下のexaBase AIは2026年7月に導入社数1,700社を超えました [ [ 446 ] ](https://exawizards.com/archives/32373/) 。サイボウズはkintone AIを2026年6月から正式提供し、契約者に追加料金なしで毎月AIクレジットを付与しています [ [ 447 ] ](https://topics.cybozu.co.jp/news/2026/04/22-19405.html) 。

### 6. L5 開発者ツール・エージェント基盤

コーディング支援は、最も普及が速い層です。GitHub Copilotの利用者は2026年7月時点で5,000万人です [ [ 413 ] ](https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q4) 。Claude Codeは2026年2月時点で年間売上の換算値が25億ドル超で、法人契約は2026年初から4倍になりました [ [ 420 ] ](https://www.anthropic.com/news/anthropic-raises-30-billion-series-g-funding-380-billion-post-money-valuation) 。OpenAIのCodexは、同社内でほぼ全エンジニアが使い、週あたりのマージされた変更が70%増えたと同社は述べています [ [ 450 ] ](https://openai.com/index/codex-now-generally-available) 。Cursorは2025年11月に23億ドルを調達し、年換算売上10億ドル超と報じられています [ [ 449 ] ](https://www.cnbc.com/2025/11/13/cursor-ai-startup-funding-round-valuation.html) 。

エージェントを実行する基盤は、2025年から2026年に製品として出そろいました。AWSのBedrock AgentCoreは2025年10月13日に一般提供され、実行環境、記憶、ゲートウェイ、ID、観測の機能を従量課金で提供します [ [ 452 ] ](https://aws.amazon.com/about-aws/whats-new/2025/10/amazon-bedrock-agentcore-available/) 。Microsoftは、Fortune 500の約90%がローコードツールで稼働中のエージェントを持つと述べ [ [ 438 ] ](https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q3) 、Agent 365は提供2か月で約4,000万のエージェントが登録されました [ [ 413 ] ](https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q4) 。OpenAIは2025年10月に発表したAgentKitのうち、画面で組み立てる製品を2026年11月30日で終了し、コードによる開発キットへ集約すると告知しています [ [ 451 ] ](https://openai.com/index/introducing-agentkit) 。製品の統廃合がこの層では速いことを示す例です。

ワークフロー基盤のn8nは、2026年5月にSAPの戦略出資を受けて評価額52億ドルとなり、SAPの製品に組み込まれました [ [ 453 ] ](https://blog.n8n.io/n8n-sap) 。日本の事業者は、この層では主に海外製の基盤を利用しています。

### 7. L6・L7 データ、評価、観測、統治、ID

データ基盤では、Databricksが2026年第2四半期に年間売上の換算値70億ドルを超え、評価額1,900億ドルで50億ドルを調達しました [ [ 456 ] ](https://www.databricks.com/company/newsroom/press-releases/databricks-grows-80-yoy-surpasses-7b-revenue-run-rate-scales) 。観測では、DatadogのLLM観測機能が2024年6月に一般提供されました [ [ 459 ] ](https://www.datadoghq.com/about/latest-news/press-releases/datadog-llm-observability-is-now-generally-available-to-help-businesses-monitor-improve-and-secure-generative-ai-applications/) 。エージェント単位の評価は2026年の製品で、AWSのAgentCore Evaluationsは2026年3月に13種の組み込み評価器とともに一般提供されました [ [ 460 ] ](https://aws.amazon.com/about-aws/whats-new/2026/03/agentcore-evaluations-generally-available/) 。

ID管理では、人のIDとは別にエージェントのIDを発行し失効させる製品群が現れました。Microsoft Entra Agent IDは2026年に一般提供され、他社の基盤で作ったエージェントとの連携や条件付きアクセスを提供します [ [ 461 ] ](https://learn.microsoft.com/en-us/entra/agent-id/whats-new-agent-id) 。Okta for AI Agentsは2026年4月30日に一般提供されました [ [ 462 ] ](https://www.okta.com/blog/ai/okta-ai-agents-early-access-announcement/) 。1Passwordは、各エージェントに短命の検証可能な資格情報を発行するキットを提供しています [ [ 463 ] ](https://1password.com/solutions/ai-agent-identity) 。

防御の層では、2025年に買収が集中しました。Palo Alto NetworksはProtect AIの買収を2025年7月22日に完了し [ [ 464 ] ](https://www.paloaltonetworks.com/company/press/2025/palo-alto-networks-completes-acquisition-of-protect-ai) 、Check Pointは2025年9月16日にLakeraの買収で合意しました [ [ 465 ] ](https://www.checkpoint.com/press-releases/check-point-acquires-lakera-to-deliver-end-to-end-ai-security-for-enterprises) 。日本ではCitadel AIが、2026年3月に東京海上ホールディングスへ本格導入し、10月に複数のAI基盤を横断してエージェントのリスクを可視化する製品を発表しました [ [ 466 ] ](https://www.citadel-ai.com/ja/news/) 。

### 8. L8・L9 導入支援と業界特化

導入支援の層では、受注額が公表され始めています。Accentureの2026会計年度の新規受注は845.4億ドルで、2025会計年度の生成AI受注は通期59億ドルでした [ [ 468 ] ](https://www.sec.gov/Archives/edgar/data/0001467373/000146737326000037/q4fy26earnings8-kexhibit.htm) 。IBMの生成AI関連の受注残高は2025年第4四半期時点で125億ドル超あり、約8割をコンサルティングが占めます [ [ 469 ] ](https://newsroom.ibm.com/2026-01-28-IBM-RELEASES-FOURTH-QUARTER-RESULTS) 。日本では、NTTデータが2025年10月時点で生成AI関連の受注2,000件超、実践的な生成AI人財7万人と発表しました [ [ 243 ] ](https://www.nttdata.com/global/ja/news/release/2025/102900) 。AI専業のエクサウィザーズは2026年3月期の売上高が119.96億円で22.3%増です [ [ 471 ] ](https://www2.jpx.co.jp/disc/42590/140120260512525045.pdf) 。

業界特化の層では、成果に応じた課金が現れました。顧客対応のSierraは2026年5月に9.5億ドルを調達し、評価額150億ドル超、成果ベースの課金を採用していると報じられています [ [ 472 ] ](https://siliconangle.com/2026/05/04/ai-agent-startup-sierra-valued-15b-new-950m-funding-round) 。法務のHarveyは2026年5月時点で年間経常収益3億ドルと推計されていますが、一次発表は確認できていません [ [ 473 ] ](https://sacra.com/c/harvey/) 。日本では、LegalOn Technologiesの有償導入社数が2026年7月末にグローバルで9,000社を超えました [ [ 474 ] ](https://prtimes.jp/main/html/rd/p/000000799.000036601.html) 。矢野経済研究所(矢野経研)によれば、コールセンター事業者のAIサービス市場は2024年度に90億円で、2029年度に313億円と予測されています [ [ 475 ] ](https://www.yano.co.jp/press-release/show/press_id/4096) 。

### 9. 市場規模と価格の推移

世界の規模は、定義によって桁が変わります。ガートナーは2025年の世界の生成AI支出をハードウェア・ソフトウェア・サービスを含めて6,440億ドルと予測しました [ [ 477 ] ](https://www.gartner.com/en/newsroom/press-releases/2025-03-31-gartner-forecasts-worldwide-genai-spending-to-reach-644-billion-in-2025) 。企業のソフトウェア支出に絞ったMenlo Venturesの推計では、2025年は370億ドルです [ [ 417 ] ](https://menlovc.com/perspective/2025-the-state-of-generative-ai-in-the-enterprise) 。IDCは、AI支出が2029年に1.3兆ドルに達し、世界のIT支出の26%超を占めると予測しています [ [ 478 ] ](https://my.idc.com/getdoc.jsp?containerId=prUS53765225) 。

日本の規模も、調査会社によって幅があります。IDC Japanは国内AI市場の支出額が2025年の2兆3,725億円から2029年に6兆8,897億円へ2.9倍になると予測しました [ [ 481 ] ](https://www.idc.com/resource-center/blog/%E5%9B%BD%E5%86%85ai%E5%B8%82%E5%A0%B4%E3%81%AF%E4%BB%8A%E5%BE%8C4%E5%B9%B4%E3%81%A7%E7%B4%843%E5%80%8D%E3%81%AB%E6%88%90%E9%95%B7%EF%BC%9A-2029%E5%B9%B4%E3%81%AE%E5%9B%BD%E5%86%85ai%E5%B8%82%E5%A0%B4) 。富士キメラ総研は、2025年度の国内AI関連市場を1兆8,301億円(生成AI関連が36.4%)、2029年度を3兆1,779億円と推計しています。同調査は「MCP対応支援」をサービス市場として新設しました [ [ 483 ] ](https://www.fkg-report.jp/market-trends/2026/3016.html) 。

価格は下がり続けています。AnthropicのAPI価格は、100万トークンあたり入力と出力でOpus 4.1の15ドルと75ドルから、Opus 5.5の4ドルと20ドルへ約73%低下しました。Haiku 5.5は0.10ドルと0.50ドルです [ [ 423 ] ](https://platform.claude.com/docs/en/about-claude/pricing) 。OpenAIのGPT-5.5は入力5ドル、出力30ドルです [ [ 424 ] ](https://developers.openai.com/api/docs/models/gpt-5.5) 。Epoch AIの分析では、同じ性能水準に到達するための推論価格は、性能の水準によって年9倍から900倍のペースで低下しています [ [ 425 ] ](https://epoch.ai/data-insights/llm-inference-price-trends) 。

### 10. 2024年から2026年に新しく現れた層

2024年時点では独立した製品カテゴリとして明確でなく、2025年から2026年に専用製品と価格表が出そろったものを、著者の整理として列挙します。

第一に、エージェント実行基盤です。AgentCore、Agent 365、AgentKitのように、クラウド各社が「エージェントをホストして課金する層」を作りました。第二に、エージェントIDです。Entra Agent ID、Okta for AI Agents、1Passwordの資格情報キットが該当します。第三に、AIの実行時防御の大手への統合です。Protect AIとLakeraの買収がその例です。第四に、エージェント単位の評価と観測です。第五に、MCP対応支援の市場で、富士キメラ総研が2026年版調査で新設しました。第六に、国内の推論環境です。KDDIとソフトバンクが2026年に商用化しました。第七に、成果や会話の単位で課金する業界特化エージェントです。Sierraの成果課金、Agentforceの会話単位課金、kintone AIのクレジット制が該当します。

これらの層は、[AIエージェントはどう導入されるかの章](31-agent-adoption-stages)で扱う「権限・ID・評価・監査」の要件に、製品が追いついてきた過程を示しています。

### 🗺️ 図：9つの層

![計算資源から業界特化まで、下から上へ9つの層を縦に積んだ図。下の層ほど資本集約的で事業者は少なく、上の層ほど事業者は多く入れ替わりも速い](/images/ai-transformation-blueprint/18-market-map.png)

#### 図の読み方

図は、下から上へ9つの層を積んだ縦の構造です。最下段がL1の計算資源、最上段がL9の業界特化です。各段には層の名前だけを置き、事業者名は本文の表と各節に書いています。

下の3段(L1からL3)を濃い藍で塗り、資本集約的で事業者が少ない層であることを示しています。中の4段(L4からL7)は薄い藍で、企業が導入の段階に応じて選ぶ層です。上の2段(L8とL9)は紙の色のままで、事業者が多く入れ替わりの速い層です。右側の添え書きは、2025年から2026年に新しく現れた層(L5の実行基盤、L7のID)の位置を示します。

### 本章の要点と解釈

本セクションは、著者による解釈です。前節までの事実記述とは区別して読んでください。

第一に、市場は2年で層が増えました。2024年には「モデルを選ぶ」ことが導入の主な判断でしたが、2026年には実行基盤、ID、評価、防御のそれぞれが製品になっています。層の増加は、企業が選ぶべき部品の増加を意味します。[各段階で必要なものの章](34-requirements-and-providers)で、導入段階ごとにどの層が必要になるかを整理します。

第二に、下の層ほど集中が進み、上の層ほど分散しています。基盤モデルは3社で企業向け支出の88%を占める一方、業務アプリと業界特化の層には多数の事業者がいます。筆者は、企業が長期の依存先を決めるのは下の層であり、入れ替えを前提に選ぶのが上の層だと考えます。

第三に、数値の定義に注意が要ります。年間売上の換算値は、事業者によって販売経路の売上を含むかどうかが異なり、同じ月に500億ドルと700億ドルという報道が並びました。席数は有償か無償かで意味が変わります。本章は定義が確認できた数値だけを記録しましたが、それでも比較には限界があります。

経営層への含意は次のとおりです。提供事業者の選択は「どの会社が勝つか」の予想ではなく、「どの層をどれだけ自社で持つか」の判断です。計算資源と基盤モデルは買い、業務アプリは席数で契約し、実行基盤とIDは自社システムに組み込み、評価と統治は自社で持つ。この配分が、[運営モデルの進化の章](33-operating-model-evolution)で扱う運営モデルの選択と対応します。日本の事業者は基盤モデルと推論環境の層に現れており、データを国内に置く要件がある企業には選択肢が増えています。
