---
title: "第34章　各段階で必要なもの ―― 人材・データ・統治・評価・費用と提供事業者"
---

### 序論：本章が扱う範囲

本章は、[生成AIの導入段階の章](30-genai-adoption-stages)で定義したS1からS6の各段階について、「何が要るか」と「誰がそれを売っているか」を対応づけます。要るものは5つに分けます。人材、データ、統治、評価、費用です。売っている側は、[市場の地図の章](18-market-map)で示した9つの層で整理します。

本章の目的は、経営層が「自社の次の段階に進むには、何を社内で用意し、何を外から買うか」を一覧できるようにすることです。事業者の名前は、2026年10月の時点で一次資料により提供を確認できたものに限ります。事業者の列挙は網羅ではなく、各層に実在する選択肢があることを示す例です。将来現れそうな層については、推定であることを明記します。

本章が扱わないのは、誰が運営するかという問いです。それは[運営モデルの進化の章](33-operating-model-evolution)で扱いました。

### 1. 要るものは段階とともに変わる

5つの要素が、段階ごとにどう変わるかを先に示します。この表は著者による整理です。

| 要素 | S1〜S2 | S3 | S4 | S5〜S6 |
| --- | --- | --- | --- | --- |
| 人材 | 使える人 | 業務を設計し直せる人、推進者 | APIを扱う技術者、評価を設計する人 | 製品責任者、顧客対応の設計者 |
| データ | 不要 | 社内文書の整理と参照の許可 | 業務データの構造化、権限の整理 | 顧客データの扱いの規約 |
| 統治 | 利用規程、情報セキュリティ審査、既存の共有権限の棚卸し | 業務ごとの責任者、誤りの扱い | 権限、監査記録、費用管理 | 顧客への説明責任、法令対応(個人情報保護法、消費者契約法、景品表示法、特定商取引法、電気通信事業法の外部送信規律) |
| 評価 | 個人の確認 | 手順での確認、利用率 | 自動の評価、監視、誤り率 | 製品の品質指標、顧客の成果指標 |
| 費用 | 席課金 | 席課金と基盤の固定費 | 従量課金(トークン)と運用費 | 製品の原価、成果課金 |

S5〜S6の法令対応に挙げた法令のうち、本書が条文を引いているのは個人情報保護法です [ [ 1904 ] ](https://laws.e-gov.go.jp/law/415AC0000000057) 。消費者契約法、景品表示法、特定商取引法、電気通信事業法の外部送信規律は、顧客向けの表示、取引、利用者情報の送信に関わる規律として名前だけを挙げます。適用の有無と詳細は、弁護士などの専門家に確認してください。

段階が上がるほど、要るものは「買う」から「作る」へ移ります。S2までは、要るものの大半を席として買えます。ただし、席を配る前に2つの仕事があります。第一に、情報セキュリティ審査と契約の確認です。データの保存場所、学習への不使用、ログの扱いを確かめる審査は、提供事業者を新しく契約するたびに入ります。これは著者の整理で、審査の項目と期間は企業ごとに異なります。海外の提供事業者でも、データを国内に置く選択肢はあります。Azure OpenAIのモデルは東日本リージョンの標準デプロイで提供され [ [ 1809 ] ](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability) 、標準デプロイでは入力と出力は顧客が指定した地理の中で処理され、基盤モデルの学習には使われません [ [ 1810 ] ](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/openai/data-privacy) 。Amazon Bedrockは東京リージョンにエンドポイントを持ちます [ [ 1808 ] ](https://docs.aws.amazon.com/general/latest/gr/bedrock.html) 。第二に、既存の共有権限の棚卸しです。業務アプリに内蔵されたAI(L4)は、利用者がすでに読める文書を根拠に答えるため、過剰に共有された文書があればそのまま答えに現れます。MicrosoftはCopilotの導入手引きで、安全な土台の3本柱の第一に過剰共有の是正を置き、危険の高いサイトと文書の特定と、アクセスの修正を配布前の手順にしています [ [ 1902 ] ](https://learn.microsoft.com/en-us/microsoft-365/copilot/secure-govern-copilot-foundational-deployment-guidance) 。S3では社内文書の整理が加わります。整理の作業は外部に頼めますが、どの文書を正本とし誰が読めるかを決める判断と責任は代わってもらえません。S4では評価と監視という、運用し続ける仕事が加わります。S5以降では、顧客への責任が加わります。

BCGは2024年の調査で、AIで先行する企業は技術とアルゴリズムよりも人と業務プロセスに力を注いでいると報告しています [ [ 179 ] ](https://www.bcg.com/publications/2024/wheres-value-in-ai) 。この傾向は、要るものの大半が買えない側にあることを示しています。

### 2. 人材：どの段階で誰が要るか

S2で要るのは、使える人です。パナソニック コネクトは全社員約12,400人に汎用のアシスタントを配ることから始めました [ [ 232 ] ](https://news.panasonic.com/jp/press/jn240625-1) 。LINEヤフーは必須のeラーニングの合格を利用の条件にしました [ [ 238 ] ](https://www.lycorp.co.jp/ja/news/release/018121) 。全社員に配る例が多い一方で、PCや個人のメールアドレスを持たない現場の作業者は、端末も業務の性質も異なります。著者の整理では、配る対象をまず間接部門(PCを持つ人)とし、現場の作業者は別の計画として扱います。

推進組織の規模について、本書は目安の人数を示しません。本書に既出の一次資料で公表されている例を挙げます。富士通は全社員10万人にClaudeを展開しつつ、1,000人規模の技術者チームを置くと発表しました [ [ 470 ] ](https://global.fujitsu/ja-JP/pr/news/2026/05/27-01) 。メルカリは全社を33の領域に分け、各領域にエンジニア1〜2名とプロジェクト管理者1〜2名と領域責任者を置いています [ [ 240 ] ](https://engineering.mercari.com/blog/entry/20251225-mercari-ai-native-company) 。LINEヤフーは全部署に推進者を置きました [ [ 238 ] ](https://www.lycorp.co.jp/ja/news/release/018121) 。日立製作所は2023年5月に推進組織「Generative AIセンター」を設け、グループ32万人の業務での利用を推進しています [ [ 233 ] ](https://www.hitachi.com/ja-jp/press/articles/2023/05/0515) 。人数は会社の規模と運営モデルで決まるため、これらの例を参照し各社で決めます。

S3で要るのは、業務を設計し直せる人です。経済産業省は2024年に、DX推進人材に「問いを立てる力」「仮説を立て検証する力」に加えて「評価する・選択する力」を求めました [ [ 226 ] ](https://www.meti.go.jp/press/2024/06/20240628006/20240628006.html) 。情報処理推進機構の2026年の調査では、DX推進人材の量が不足していると答えた企業が85.5%でした [ [ 124 ] ](https://www.ipa.go.jp/digital/chousa/dx-trend/rcu1hd0000017uk8-att/dx-trend-2026.pdf) 。

S4で要るのは、APIを扱う技術者と評価を設計する人です。日本ではIT人材の73.6%がIT企業側にいるため [ [ 520 ] ](https://www.ipa.go.jp/archive/press/2022/press20230316-2.html) 、この段階の人材は多くの企業で社内にいません。供給側はこれに応じて人材を増やしています。NTTデータグループは実践的な人材を2027年度までに全社員約20万人へ広げると公表しています [ [ 243 ] ](https://www.nttdata.com/global/ja/news/release/2025/102900) 。Accentureは2026会計年度の新規受注が845.4億ドルで、AIとデータの人材を約11万人と公表しています [ [ 468 ] ](https://www.sec.gov/Archives/edgar/data/0001467373/000146737326000037/q4fy26earnings8-kexhibit.htm) 。IBMの生成AI関連の受注残は2025年第4四半期の時点で125億ドルを超え、約8割がコンサルティングです [ [ 469 ] ](https://newsroom.ibm.com/2026-01-28-IBM-RELEASES-FOURTH-QUARTER-RESULTS) 。

外部の人材を使う場合の判断基準は、知見が社内に残るかどうかです。[運営モデルの進化の章](33-operating-model-evolution)で述べたとおり、組み込みの設計を外部に任せる構造では、組み込みの段階で足踏みが起きます。

### 3. データ：S3の壁

S3で初めて、社内のデータが要ります。社内文書を参照する検索を作るには、文書がどこにあり、誰が読んでよいかが整理されている必要があります。

総務省の2025年度の調査では、生成AIによる業務変革について、社内データを学習させたり参照できるデータベースを構築したという回答の割合が、日本では他の3か国より顕著に低いという結果でした [ [ 107 ] ](https://www.soumu.go.jp/main_content/001082851.pdf) 。S2からS3へ進めない企業の多くは、この壁で止まっています。

パナソニック コネクトは、2023年9月に自社の公開情報で特化型を試し、2024年4月に社外秘の品質管理文書11,743ページを参照する特化型を本番にしました [ [ 232 ] ](https://news.panasonic.com/jp/press/jn240625-1) 。公開情報から始めて社外秘へ進む順序は、データの整理と権限の設計に時間がかかることを示しています。

第1節の表でS3の費用を「席課金と基盤の固定費」としたのは、社内文書を参照する検索の基盤が席とは別にかかるからです。著者の整理では、基盤は3つの要素から成ります。文書の整理(正本の指定、重複と古い版の除去)、権限の連携(誰がどの文書を読めるかを検索に反映する仕組み)、検索サービス(文書を索引し、問いに応じて該当の箇所を返す仕組み)です。費用の形は、検索サービスの利用量に応じた従量と、構築と運用の固定費の組み合わせになります。金額の桁は構成と文書の量で大きく異なるため、本書は示しません。

S4では、業務のデータを構造化し、システムから渡せる形にする必要があります。Databricksは2026年に年換算の売上が70億ドルを超え、前年比80%で成長しました [ [ 456 ] ](https://www.databricks.com/company/newsroom/press-releases/databricks-grows-80-yoy-surpasses-7b-revenue-run-rate-scales) 。データ基盤の層が伸びている背景には、S4へ進む企業がデータの構造化を外部の基盤で行っていることがあります。

### 4. 統治と評価：S4で「買える層」が現れた

統治と評価は、S2では利用規程と個人の確認で足ります。S4では、権限、監査の記録、自動の評価、監視、費用管理が要ります。2024年から2026年にかけて、これらを売る層が現れました。

**評価と監視**。AWSは2025年10月にエージェントの実行基盤を一般提供し、2026年3月に13種の組み込み評価器を持つ評価機能を一般提供しました [ [ 452 ] ](https://aws.amazon.com/about-aws/whats-new/2025/10/amazon-bedrock-agentcore-available/) [ [ 460 ] ](https://aws.amazon.com/about-aws/whats-new/2026/03/agentcore-evaluations-generally-available/) 。Datadogは2024年6月に大規模言語モデルの観測機能を一般提供しています [ [ 459 ] ](https://www.datadoghq.com/about/latest-news/press-releases/datadog-llm-observability-is-now-generally-available-to-help-businesses-monitor-improve-and-secure-generative-ai-applications/) 。日本では、Citadel AIが2026年に東京海上ホールディングスや三井住友銀行へ評価・監視の製品を提供し、10月に複数の基盤を横断してエージェントのリスクを可視化する製品を発表しました [ [ 466 ] ](https://www.citadel-ai.com/ja/news/) 。

**権限と身元**。人とは別にエージェントの身元を発行し、失効させる製品が2026年に出そろいました。MicrosoftのEntra Agent IDは2026年に一般提供され、Copilot StudioとFoundryで作ったエージェントに自動で身元を付与します [ [ 461 ] ](https://learn.microsoft.com/en-us/entra/agent-id/whats-new-agent-id) 。Oktaは2026年4月にエージェント向けの身元管理を一般提供しました [ [ 462 ] ](https://www.okta.com/blog/ai/okta-ai-agents-early-access-announcement/) 。これらの製品が要るのは、[AIエージェントの導入の章](31-agent-adoption-stages)の区分でエージェントをA3(定めた範囲の中で自律的に実行し、事後に人が監査する)へ進める時点です。A2までは、承認者の指定と実行の記録を既存のSaaSと承認の運用で行えます。既存のRPAの統制(ロボットのIDの発行、実行の記録、停止の手順)を持つ企業は、著者の判断では、それをA2からA3の統治の土台として再利用できます。

**防御**。プロンプトへの注入や外部文書を通じた攻撃を防ぐ製品は、2025年にセキュリティ大手が買収して自社の製品群に組み込みました。Palo Alto Networksは2025年7月にProtect AIの買収を完了し [ [ 464 ] ](https://www.paloaltonetworks.com/company/press/2025/palo-alto-networks-completes-acquisition-of-protect-ai) 、Check Pointは2025年9月にLakeraの買収で合意しました [ [ 465 ] ](https://www.checkpoint.com/press-releases/check-point-acquires-lakera-to-deliver-end-to-end-ai-security-for-enterprises) 。

**規格**。AIマネジメントシステムの国際規格ISO/IEC 42001の認証取得が、2026年にはベンダー側の売り文句として定着しています [ [ 467 ] ](https://finance.yahoo.com/news/maven-agi-achieves-iso-iec-130000204.html) 。認証の件数に関する公式統計は、本書の調査では見つかっていません。

買える層が現れたことは、S4の統治と評価を自前で作らなくてよくなったことを意味します。ただし、これらの製品の多くは海外のSaaSであり、既存のID基盤やセキュリティの監視基盤(SIEM)との統合と、情報セキュリティ審査の工数が別途かかります。また、何を評価するか、どこまでの権限を与えるかという判断は買えません。OpenAIが企業向けの手引きの第一に「評価から始める」を置いたのは、評価の設計が利用者側の仕事だからです [ [ 209 ] ](https://cdn.openai.com/business-guides-and-resources/ai-in-the-enterprise.pdf) 。

### 5. 費用：席課金、従量課金、成果課金

費用の形は段階で変わります。S2は席課金、S4は従量課金、S6は成果課金が主になります。

**席課金**。Microsoft 365 Copilotは1ユーザー月30ドルで、2023年の発表以来据え置かれています。中小企業向けには通常21ドルの追加版があり、2026年7月から12月は初年度18ドルの販促価格です [ [ 439 ] ](https://www.microsoft.com/en-us/microsoft-365-copilot/pricing/enterprise) 。Googleは2025年1月にGeminiをWorkspaceの標準機能として同梱し、追加版で月32ドルだった顧客の価格を14ドルにしました [ [ 440 ] ](https://workspace.google.com/blog/product-announcements/empowering-businesses-with-AI) 。日本では、サイボウズが2026年6月からkintoneのAI機能を正式版とし、追加料金なしで毎月のクレジットを付与し、追加のクレジットは有償にしています [ [ 447 ] ](https://topics.cybozu.co.jp/news/2026/04/22-19405.html) 。席課金は、同梱とクレジット制へ移りつつあります。

**従量課金**。基盤モデルのAPIは100万トークン単位の従量課金です。Anthropicの価格表では、Claude Opus 5.5が入力4ドルと出力20ドル、Haiku 5.5が入力0.10ドルと出力0.50ドルです。Opus 4.1の入力15ドルと出力75ドルから、5.5では入力と出力がともに73%下がりました [ [ 423 ] ](https://platform.claude.com/docs/en/about-claude/pricing) 。OpenAIのGPT-5.5は入力5ドルと出力30ドルです [ [ 424 ] ](https://developers.openai.com/api/docs/models/gpt-5.5) 。Epoch AIの推計では、同じ性能水準に到達するための推論価格は、性能の水準により年9倍から900倍のペースで下がっています [ [ 425 ] ](https://epoch.ai/data-insights/llm-inference-price-trends) 。

**必要な性能の決め方**。[推論モデルと価格の章](04-reasoning-and-cost-2024)で述べた見極めの手順を、費用の面から補います。業務ごとに、最も安価な級で試し、評価(自動の評価か人の確認)の結果が足りなければ1つ上の級へ上げます。級の価格差は[会議資料と90日計画の章](38-meeting-pack)の試算のとおり40倍に達するため、全社で最上位の級を既定にせず、業務ごとに級を決めます。決めた級は評価の結果とともに記録し、モデルの更新のたびに測り直します。

価格の低下は、S4の費用の見積もりに影響します。1年前の価格で計算した投資判断は、1年後には過大になっています。逆に、利用量は価格の低下とともに増えるため、総額が下がるとは限りません。費用管理の仕組みがS4で要る理由はここにあります。

**成果課金**。顧客対応のエージェントを提供するSierraは、成果に基づく課金を採用していると報じられています [ [ 472 ] ](https://siliconangle.com/2026/05/04/ai-agent-startup-sierra-valued-15b-new-950m-funding-round) 。SalesforceのAgentforceは、2027会計年度第2四半期に年間経常収益が15億ドルを超えました [ [ 442 ] ](https://www.salesforce.com/news/press-releases/2026/08/26/fy27-q2-earnings/) 。S6に近づくほど、費用は席やトークンではなく、顧客との取引や成果に連動します。

### 6. 提供事業者の層と段階の対応

[市場の地図の章](18-market-map)の9つの層を、段階に対応づけます。この表は著者による整理です。事業者名は一次資料で確認できた例です。

| 層 | 主に関わる段階 | 世界の例 | 日本の例 |
| --- | --- | --- | --- |
| L1計算資源 | S4以降(自前で動かす場合) | NVIDIA、AMD | ソフトバンク、KDDI、さくらインターネット |
| L2クラウドAI基盤 | S4 | Microsoft、AWS、Google Cloud、Oracle | ソフトバンク [ [ 415 ] ](https://www.softbank.jp/corp/news/press/sbkk/2026/20260416_02/) 、KDDI [ [ 416 ] ](https://newsroom.kddi.com/news/detail/kddi_nr-1211_4785.html) |
| L3基盤モデル | S4以降 | OpenAI、Anthropic、Google DeepMind、Meta、DeepSeek | SB Intuitions [ [ 432 ] ](https://www.sbintuitions.co.jp/news/press/20261013_01/) 、NTT [ [ 433 ] ](https://group.ntt/jp/newsrelease/2025/10/20/251020a.html) 、PFN [ [ 434 ] ](https://www.preferred.jp/ja/news/pr20260622) 、Sakana AI [ [ 435 ] ](https://sakana.ai/series-b/) 、ELYZA [ [ 436 ] ](https://elyza.ai/news/2026/03/10/kddi%E3%81%A8elyza%E3%83%87%E3%82%B8%E3%82%BF%E3%83%AB%E5%BA%81%E3%81%AE%E3%82%AC%E3%83%90%E3%83%A1%E3%83%B3%E3%83%88ai%E3%81%A7%E8%A9%A6%E7%94%A8%E3%81%99%E3%82%8B-%E5%9B%BD) |
| L4業務アプリ内蔵 | S2〜S3 | Microsoft 365 Copilot、Google Workspace、Salesforce、ServiceNow | LayerX [ [ 445 ] ](https://layerx.co.jp/news/20260318/) 、Exa Enterprise AI [ [ 446 ] ](https://exawizards.com/archives/32373/) 、サイボウズ、PKSHA [ [ 448 ] ](https://www.pkshatech.com/ir/summary/) |
| L5開発者ツール・エージェント基盤 | S4 | GitHub Copilot、Claude Code、OpenAI Codex、AWS AgentCore、Copilot Studio | (海外製の利用が主) |
| L6データ基盤・評価・観測 | S3〜S4 | Databricks、Snowflake、Datadog | (国内の再販が主) |
| L7統治・安全・身元 | S4以降(エージェントをA3へ進める時点) | Microsoft Entra、Okta、Palo Alto Networks、Check Point | Citadel AI |
| L8 SI・コンサル | S3〜S5 | Accenture、IBM | NTTデータ、富士通 [ [ 470 ] ](https://global.fujitsu/ja-JP/pr/news/2026/05/27-01) 、エクサウィザーズ |
| L9業界特化 | S5〜S6 | Sierra、Harvey | LegalOn [ [ 474 ] ](https://prtimes.jp/main/html/rd/p/000000799.000036601.html) |

ChatGPTやClaudeのような、L3の事業者が直接提供する対話型サービスは、[市場の地図の章](18-market-map)の区分に従いL3に含め、この表のL4には置いていません。

表から読める構造を3つ挙げます。

第一に、S2とS3は買えます。L4の層に、世界と日本の両方で選択肢があります。Exa Enterprise AIの対話型サービスは2026年7月の時点で導入社数1,700社 [ [ 446 ] ](https://exawizards.com/archives/32373/) 、LayerXは2026年1月末に全社の年間経常収益が100億円に達しています [ [ 445 ] ](https://layerx.co.jp/news/20260318/) 。

第二に、S4の基盤は海外製が主です。L5の層で国内の事業者は少なく、企業向けの大規模言語モデルのAPI支出の88%をAnthropic、OpenAI、Googleの3社が占めています [ [ 417 ] ](https://menlovc.com/perspective/2025-the-state-of-generative-ai-in-the-enterprise) 。この調査はAnthropicの投資家であるMenlo Venturesによるもので、アメリカ企業の意思決定者495名が対象です。国内の基盤モデルは、データを国内に置く要件や日本語の精度を理由に選ばれますが、API支出の規模では海外製に及びません。

第三に、S5とS6は業界ごとに事業者が分かれます。法務のLegalOnは2026年7月末の時点で有償の導入社数が世界で9,000社を超えました [ [ 474 ] ](https://prtimes.jp/main/html/rd/p/000000799.000036601.html) 。自社の業界にすでにL9の事業者がいる場合、S5で自社が作るか、L9から買うかの判断が要ります。

L8に文書の整理や構築を委ね、個人データを渡す場合には、個人情報保護法の第25条が委託先の監督を求めています [ [ 1904 ] ](https://laws.e-gov.go.jp/law/415AC0000000057) 。個人情報保護委員会のガイドラインは、その内容を委託先の選定、委託契約の締結、委託先における取扱状況の把握の3つとしています [ [ 1903 ] ](https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/) 。提供事業者が入力を学習に使わないかの確認だけでは、この監督を満たしません。

### 7. これから現れそうな層

2024年から2026年にかけて、エージェントの実行基盤、エージェントの身元、評価と観測、防御の統合、という4つの層が製品として出そろいました。この先に現れそうな層は、著者の推定です。推定の根拠を添えます。

第一に、エージェント同士の取引と決済の層です。AWSの実行基盤は2026年に決済の機能を一般提供しました [ [ 452 ] ](https://aws.amazon.com/about-aws/whats-new/2025/10/amazon-bedrock-agentcore-available/) 。矢野経済研究所は、AIエージェントを経由する消費者向けの電子商取引が2030年度で3兆円規模へ達すると推計していますが、同年度でも電子商取引の全体の8.9%にとどまる見通しです [ [ 486 ] ](https://www.yano.co.jp/press-release/show/press_id/4148) 。

第二に、成果の検証と保険の層です。成果課金が広がれば、成果を第三者が検証する仕組みと、誤りの損失を引き受ける仕組みが要ります。2026年10月の時点で、これを専業とする事業者は本書の調査では確認できていません。

第三に、国内の推論環境の層です。KDDIは2026年に、海外のモデルを国内のデータセンターで動かし、データを国内に置いたまま使う環境を商用化しました [ [ 416 ] ](https://newsroom.kddi.com/news/detail/kddi_nr-1211_4785.html) 。富士キメラ総研は2026年の調査で、MCPへの対応を支援するサービスを市場として新たに区分しています [ [ 483 ] ](https://www.fkg-report.jp/market-trends/2026/3016.html) 。

市場の規模は、これらの層が広がる余地を示します。Gartnerは2025年の世界の生成AI支出を6,440億ドルと予測し [ [ 477 ] ](https://www.gartner.com/en/newsroom/press-releases/2025-03-31-gartner-forecasts-worldwide-genai-spending-to-reach-644-billion-in-2025) 、IDCはAI支出が2029年に1.3兆ドルで世界のIT支出の26%を超えると予測しています [ [ 478 ] ](https://my.idc.com/getdoc.jsp?containerId=prUS53765225) 。IDC Japanは国内のAI市場が2025年の2兆3,725億円から2029年に6兆8,897億円へ2.9倍になると予測しています [ [ 481 ] ](https://www.idc.com/resource-center/blog/%E5%9B%BD%E5%86%85ai%E5%B8%82%E5%A0%B4%E3%81%AF%E4%BB%8A%E5%BE%8C4%E5%B9%B4%E3%81%A7%E7%B4%843%E5%80%8D%E3%81%AB%E6%88%90%E9%95%B7%EF%BC%9A-2029%E5%B9%B4%E3%81%AE%E5%9B%BD%E5%86%85ai%E5%B8%82%E5%A0%B4) 。予測は予測であり、[道筋Cの章](28-path-c-correction)が扱う投資の収縮が起きれば下方に修正されます。

### 🗺️ 図：段階が上がるほど「買えるもの」から「作るもの」へ

![段階S1〜S6を横軸に、人材・データ・統治・評価・費用の5つの要素がどの段階で加わるかを示す。席を買う段階から、社内文書の整理、評価と監視の運用、顧客への責任へと、作る仕事が積み上がる](/images/ai-transformation-blueprint/34-requirements-and-providers.png)

#### 図の読み方

この図は、左から右へS1からS6の段階を並べ、各段階で新たに要るものを上に積んでいます。最下段の薄い藍は「買えるもの」で、席の契約と業務アプリです。その上の藍は「整えるもの」で、社内文書と権限です。さらに上の濃い藍は「運用し続けるもの」で、評価と監視と費用管理です。最上段の千歳緑は「顧客に負うもの」で、製品の品質と説明責任です。

図の下に添えた一文「買えるものは下に、作るものは上に積み上がる」が本章の主張です。図の各段の具体的な中身は第1節の表に、売っている事業者は第6節の表にあります。

### 経営層への含意

要るものの5分類と、層と段階の対応は、著者による整理です。事業者の例は一次資料で確認できた範囲であり、網羅ではありません。価格と市場規模は2026年10月の時点の値で、価格は年単位で大きく下がります。

経営層が本章から持ち帰るべき点は3つです。

第一に、S2とS3は買えますが、S3では買えないものが1つあります。社内文書の整理の作業は買えますが、どの文書を正本とし誰が読めるかを決める判断と責任は買えません。日本企業がS3の手前で止まる主因は、データベースの構築が他国より少ないという統計に現れています。次の段階に進む投資の大半は、BCGの調査が示すとおり、技術ではなく人と業務プロセスに向かいます。S2でも、席を配る前に情報セキュリティ審査と共有権限の棚卸しが要ります。

第二に、S4の統治と評価は2026年には買える層になりました。評価器、身元、防御、観測は製品として存在します。買えないのは、何を評価し、どこまでの権限を与えるかという判断です。この判断を外部に任せると、[運営モデルの進化の章](33-operating-model-evolution)で述べた知見の流出が起きます。

第三に、費用の形は段階とともに席から従量へ、従量から成果へ移ります。従量課金の価格は年単位で桁が変わるため、投資判断は価格の低下を前提に組み、利用量の増加を費用管理で追う必要があります。
