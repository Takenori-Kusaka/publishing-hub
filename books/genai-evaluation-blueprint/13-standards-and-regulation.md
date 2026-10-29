---
title: "第13章　規格と規制が求める評価 ―― ISO 42001、NIST、EU AI Act、日本のガイド"
---

### 序論：本章が扱う範囲

本章は、国際規格・各国の公的な枠組み・法令が、生成AIの出力の評価について何を求めているかを、条文と発行日で記録します。対象は、ISO/IECの規格、アメリカのNISTと行政の文書、EUのAI法(AI Act)と実践規範、英国と国際合意、日本の公的な指針です。

それぞれの文書について、評価の指標そのものを定めているか、評価の仕組みや記録を求めているか、拘束力はどこまでかを見ます。業界団体の枠組みと事業者の自己規律、認証の取得の状況は、最後の節で短く扱います。

[失敗から逆算する評価の章](12-evaluation-from-failures)は、規制当局が「評価をしていないこと」を問い始めた事例を記録しました。本章は、その問いの根拠となる文書の側を扱います。日本の企業と自治体の実践は、次の[日本の評価の実践の章](14-japan-practice)で扱います。

### 1. 国際規格：評価の仕組みを求める

AIマネジメントシステムの国際規格ISO/IEC 42001:2023は、2023年12月18日に発行されました [ [ 518 ] ](https://www.iso.org/standard/42001) 。要求事項は、箇条8「運用」にAIリスクアセスメントとAIシステムインパクトアセスメントを置きます。箇条9「パフォーマンス評価」には、監視・測定・分析・評価、内部監査、マネジメントレビューを置きます。出力の精度の指標そのものは定めていません [ [ 519 ] ](https://webdesk.jsa.or.jp/preview/pre_jis_q_42001_000_000_2025_j_ed10_ch.pdf) 。日本では一致規格のJIS Q 42001:2025が2025年8月20日に制定されました [ [ 519 ] ](https://webdesk.jsa.or.jp/preview/pre_jis_q_42001_000_000_2025_j_ed10_ch.pdf) 。

評価に関わる周辺の規格は、次のとおりです。

- **ISO/IEC TR 29119-11:2020。** AIを使うシステムのテストの手引きです。AIシステムは仕様が曖昧で非決定的になり得るため、受入基準を決めにくいと明記しています [ [ 523 ] ](https://www.iso.org/standard/79016.html) 。
- **ISO/IEC 25059:2023とTS 25058:2024。** AIシステムの品質モデルと、それを使った品質評価の手引きです [ [ 521 ] ](https://www.iso.org/standard/80655.html)  [ [ 522 ] ](https://www.iso.org/standard/82570.html) 。
- **ISO/IEC 42005:2025。** AIシステムのインパクトアセスメントの規格で、2025年5月28日に発行されました。ISOは、設計から市販後の監視までの全期間でアセスメントを行うことを推奨すると説明しています [ [ 525 ] ](https://www.iso.org/standard/44545.html) 。
- **ISO/IEC 42006:2025。** 42001の審査と認証を担う機関への要求事項で、2025年7月7日に発行されました [ [ 526 ] ](https://www.iso.org/standard/44546.html) 。

### 2. アメリカ：MEASUREと生成AIプロファイル

NISTのAIリスクマネジメントフレームワーク(AI RMF 1.0)は、2023年1月26日に公開された任意利用の枠組みです [ [ 531 ] ](https://www.nist.gov/itl/ai-risk-management-framework) 。4つの機能のうちMEASUREは、客観的で再現可能なテスト・評価・検証・妥当性確認(TEVV)の手順と指標が整い、文書化されることを到達点とします。展開環境に近い条件での性能の測定、本番での監視、一般化の限界の文書化も求めます。検証を担う者は、テストを行う者と別であることが理想だとしています [ [ 532 ] ](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf) 。

2024年7月26日の生成AIプロファイル(NIST AI 600-1)は、幻覚を「作話(confabulation)」と呼び、誤った内容を自信を持って示す現象と定義しました。入力からの逸脱と、同じ文脈での自己矛盾も含めています。推奨アクションには、RAGで強化するモデルを選ぶときに基準の性能を考慮することがあります。狭く非体系的で逸話的な評価から性能を外挿しないことも求めています [ [ 259 ] ](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) 。

行政の文書は政権交代で変わりました。2023年10月の大統領令14110は、AIのレッドチーミングを定義し、評価と監査のための指針とベンチマークの作成をNISTに命じました [ [ 534 ] ](https://www.federalregister.gov/documents/2023/11/01/2023-24283/safe-secure-and-trustworthy-development-and-use-of-artificial-intelligence) 。2025年1月20日の大統領令14148が、これを撤回しています [ [ 535 ] ](https://www.whitehouse.gov/presidential-actions/2025/01/initial-rescissions-of-harmful-executive-orders-and-actions/) 。2025年4月の連邦機関向けのOMBのメモM-25-21は、それまでのM-24-10を置き換えるもので、高影響のAIに展開前のテストとインパクトアセスメントを義務づけました。モデルやデータに触れられない場合は、サービスに問い合わせて出力を観察するなどの代替の手法を使うよう求めています [ [ 537 ] ](https://www.whitehouse.gov/wp-content/uploads/2025/02/M-25-21-Accelerating-Federal-Use-of-AI-through-Innovation-Governance-and-Public-Trust.pdf) 。

2025年6月3日、商務長官はAI Safety Instituteを、Center for AI Standards and Innovation(CAISI、AIの標準と革新のためのセンター)に改組すると発表しました。評価は、サイバー・バイオ・化学兵器など実証可能なリスクに集中するとしています [ [ 540 ] ](https://content.govdelivery.com/accounts/USDOC/bulletins/3e381fb) 。改組の前の2024年12月、アメリカと英国の機関はOpenAI o1の展開前評価を共同で行いました。手法は、別のモデルで自動採点して人が確認する質問応答、仮想環境でのエージェント課題、専門家による定性的な観察の3種です [ [ 542 ] ](https://www.nist.gov/news-events/news/2024/12/pre-deployment-evaluation-openais-o1-model) 。

### 3. EU：AI法と実践規範

EUのAI法(Regulation (EU) 2024/1689)は、2024年7月12日付の官報に掲載されました [ [ 545 ] ](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng) 。第113条は、汎用目的AI(GPAI)モデルの義務を2025年8月2日から、全体を2026年8月2日から適用すると定めます [ [ 546 ] ](https://artificialintelligenceact.eu/article/113/) 。2026年7月8日に採択され、同月24日の官報に掲載されたデジタル・オムニバス(Regulation (EU) 2026/1744)は、同法を改正しました [ [ 559 ] ](https://eur-lex.europa.eu/eli/reg/2026/1744/oj) 。改正は第113条を改め、高リスクAIの分類・要求事項・義務を定める第III章第1〜3節の適用を延期しています。延期後の日付は、附属書IIIに当たる高リスクAIが2027年12月2日、製品に組み込む附属書Iに当たる高リスクAIが2028年8月2日です [ [ 1701 ] ](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32026R1744) 。

評価に関わる条文は、次のとおりです。

- **第9条(8)。** 高リスクAIのテストを、遅くとも上市の前までに、事前に定義した指標と確率的なしきい値で行うことを求めます [ [ 547 ] ](https://artificialintelligenceact.eu/article/9/) 。
- **第15条。** 正確性の水準と指標を、使用説明書に明記することを求めます [ [ 548 ] ](https://artificialintelligenceact.eu/article/15/) 。
- **第53条と附属書XI。** 第53条(1)(a)は、GPAIモデルの提供者に、訓練とテストの過程と評価結果を含む技術文書を求めます。第53条(2)は、自由でオープンソースのライセンスで公開し、重みなどを公開したモデルの提供者をこの義務から外します。ただし、システミックリスクを持つモデルにはこの例外を適用しません [ [ 1702 ] ](https://artificialintelligenceact.eu/article/53/) 。システミックリスクを持つモデルの提供者には、附属書XIの第2節が、評価基準・指標・限界を特定する方法を含む評価戦略の記述を追加で求めます [ [ 1703 ] ](https://artificialintelligenceact.eu/annex/11/) 。
- **第55条。** システミックリスクを持つGPAIモデルの提供者に、最新の技術を反映した標準化された手順とツールによる評価と、敵対的テストを求めます。重大インシデントの報告も義務です [ [ 551 ] ](https://artificialintelligenceact.eu/article/55/) 。
- **第72条。** 高リスクAIの提供者に、市販後の監視を義務づけ、性能のデータを能動的に集めて分析するよう求めます [ [ 552 ] ](https://artificialintelligenceact.eu/article/72/) 。

GPAIの実践規範は2025年7月10日に公表された任意の遵守手段で、透明性・著作権・安全性とセキュリティの3章から成ります [ [ 554 ] ](https://digital-strategy.ec.europa.eu/en/policies/contents-code-gpai) 。整合規格を作るCEN/CENELECは、2025年10月に開発を早める例外措置を決めました。2026年第4四半期までの利用開始を目標にしています [ [ 557 ] ](https://www.cencenelec.eu/news-events/news/2025/brief-news/2025-10-23/) 。

### 4. 英国と国際合意

英国のAI Safety Instituteは2023年11月2日に発足し、2025年2月14日にAI Security Instituteへ改称しました [ [ 560 ] ](https://www.gov.uk/government/news/prime-minister-launches-new-ai-safety-institute)  [ [ 561 ] ](https://www.gov.uk/government/news/tackling-ai-security-risks-to-unleash-growth-and-deliver-plan-for-change) 。同機関は2024年5月10日に、大規模言語モデル(LLM)の評価の枠組みInspectをオープンソースで公開しています。政府系の機関が主導した安全性テストの基盤の一般公開は初めてとされます [ [ 329 ] ](https://www.gov.uk/government/news/ai-safety-institute-releases-new-ai-safety-evaluations-platform) 。

国際合意では、2023年10月の広島AIプロセスの国際行動規範が、レッドチーミングを含む内部と外部のテストを組み合わせた評価を求めました [ [ 566 ] ](https://www.mofa.go.jp/files/100573473.pdf) 。2024年5月のAIソウル・サミットでは、署名企業が、深刻なリスクを許容できなくなるしきい値を定め、その超過を評価すると約束しています [ [ 568 ] ](https://www.gov.uk/government/publications/frontier-ai-safety-commitments-ai-seoul-summit-2024/frontier-ai-safety-commitments-ai-seoul-summit-2024) 。

### 5. 日本：評価観点と品質の指針

日本のAIセーフティ・インスティテュート(AISI)は、2024年2月14日に発足しました [ [ 570 ] ](https://aisi.go.jp/about/) 。同機関の「AIセーフティに関する評価観点ガイド」は、2024年9月の第1.00版から改訂を重ねました。2025年3月の第1.10版はマルチモーダル基盤モデルの評価観点を加え、2026年7月7日の第1.20版はAIエージェントに対応して評価項目の例を拡充しています [ [ 571 ] ](https://aisi.go.jp/output/output_framework/guide_to_evaluation_perspective_on_ai_safety/) 。評価観点は10個です(第1.10版の概要版で確認)。偽誤情報の項目で目指す姿は、出力の前に事実を確かめる仕組みが整った状態です。観点は網羅的なものでなく、更新を前提とすると明記しています [ [ 572 ] ](https://aisi.go.jp/assets/pdf/ai_safety_eval_summary_v1.10_ja.pdf) 。

政府の指針と法令は、次のとおりです。

- **AI事業者ガイドライン。** 総務省と経済産業省が2024年4月に第1.0版を取りまとめました [ [ 577 ] ](https://www.meti.go.jp/press/2024/04/20240419004/20240419004.html) 。2025年3月の第1.1版は、出力の品質が活用の開始後に大きく変わり得ることを踏まえ、事後の検証のための作業記録の保存を求めます [ [ 578 ] ](https://www.soumu.go.jp/main_content/001002576.pdf) 。
- **AI推進法。** 2025年6月4日に公布された「人工知能関連技術の研究開発及び活用の推進に関する法律」は、指針の整備と権利侵害の事案の分析を国に求めます。出力の評価の方法を直接定める条文はありません [ [ 580 ] ](https://www.shugiin.go.jp/internet/itdb_housei.nsf/html/housei/21720250604053.htm) 。
- **デジタル庁のガイドライン。** 2025年5月27日に決定された行政向けの調達・利活用のガイドラインの第1版は、利活用の前に出力の精度とリスクの程度を理解することを求めます。幻覚で利用者や第三者に不利益を与えた場合などを「リスクケース」とし、AI統括責任者が対応の手順を整えると定めます [ [ 583 ] ](https://www.digital.go.jp/assets/contents/node/basic_page/field_ref_resources/e2a06143-ed29-4f1d-9c31-0f06fca67afc/80419aea/20250527_resources_standard_guidelines_guideline_01.pdf) 。2026年6月12日に決定された第2.0版でも、利活用の前に出力の精度とリスクの程度を理解する求めは残り、正確性や根拠をリスクに応じて確かめることも求めています [ [ 1807 ] ](https://www.digital.go.jp/assets/contents/node/information/field_ref_resources/decb64eb-f26e-41cb-8d37-f3dd173108b8/59054b35/20260612_resources_standard_guidelines_guideline_01.pdf) 。
- **産総研の生成AI品質マネジメントガイドライン。** 2025年5月26日に第1版が公開されました。RAGは取り込んだデータの内容が妥当かには触れないため、外部データの有用性と知識の衝突を別に評価する必要があると述べています [ [ 755 ] ](https://qai.pj.aist.go.jp/downloads/generative-ai-quality-management-guideline-v1.pdf) 。

### 6. 業界の枠組み・事業者の自己規律・認証

業界の枠組みでは、OWASPのLLMアプリケーション向けの上位10リスクの2025年版が、9番目を「誤情報」とし、8番目に「ベクトルと埋め込みの弱点」を新設しました [ [ 591 ] ](https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/) 。MLCommonsのAILuminateは、12の有害カテゴリについて言語ごとに24,000件超のプロンプトで評価し、5段階で格付けします。対象は単一ターンの対話だけです [ [ 595 ] ](https://mlcommons.org/benchmarks/ailuminate/) 。

事業者の自己規律では、Anthropicが責任あるスケーリング方針の2024年10月15日の第2.0版で、評価の間隔について、直近の評価が3か月の間隔より3日遅れたと公表しました。同じ第2.0版で、間隔を6か月に延ばしています [ [ 604 ] ](https://www.anthropic.com/rsp-updates) 。こうした枠組みは事業者が自ら定めたもので、規制当局が求めた評価ではありません。

ISO/IEC 42001の認証は、事業者による取得の発表が続いています。AWSは、主要なクラウド事業者として初めて取得したと発表しました [ [ 608 ] ](https://aws.amazon.com/blogs/machine-learning/aws-achieves-iso-iec-420012023-artificial-intelligence-management-system-accredited-certification) 。Anthropicも認証の取得を発表しています [ [ 609 ] ](https://www.anthropic.com/news/anthropic-achieves-iso-42001-certification-for-responsible-ai) 。日本では、TÜV Rheinland Japanが2025年12月に、NTTデータグループとNTTデータに、生成AIソリューション「LITRON Generative Assistant」の開発と提供を範囲とする認証を発行しました [ [ 611 ] ](https://www.tuv.com/press/en/press-releases/nttdatagroup-iso42001-certification.html) 。

### 7. 文書ごとの比較

| 文書 | 拘束力 | 出力の指標を定めるか | 求める評価と記録 |
| --- | --- | --- | --- |
| ISO/IEC 42001 | 任意(認証) | 定めない | 監視・測定・内部監査・マネジメントレビュー |
| NIST AI RMFとAI 600-1 | 任意 | 定めない | 展開環境に近い条件での測定、本番の監視、限界の文書化 |
| EU AI法 第9条・第15条 | 法的義務(高リスク。附属書IIIは2027年12月2日、附属書Iは2028年8月2日から適用) | 提供者が事前に定める | しきい値に対するテスト、正確性の指標の明記 |
| EU AI法 第53条・第55条 | 法的義務(GPAI) | 定めない | 評価結果を含む技術文書(オープンソースの一部は除外)。システミックリスクのモデルには評価戦略と敵対的テスト |
| AISI 評価観点ガイド | 任意 | 観点を示す | 10の観点での評価 |
| AI事業者ガイドライン | 任意 | 定めない | 事後の検証のための作業記録 |
| デジタル庁のガイドライン | 行政の内部規範 | 定めない | 精度とリスクの理解、リスクケースの手順と報告 |

### 🗺️ 図：規格と規制が求めるのは、測る仕組みと記録

![任意の枠組み・認証の規格・法的義務の3つが、それぞれ評価の仕組みと記録を求め、出力の指標は組織に委ねることを示す図](/images/genai-evaluation-blueprint/13-standards-and-regulation.png)

#### 図の読み方

図は、左から右へ拘束力の強さの順に3つの柱を並べています。左が任意の枠組み、中央が認証の規格、右が法的義務です。

左の柱はNIST AI RMFと日本の指針で、展開環境に近い条件での測定と作業記録の保存を求めます(第2節・第5節)。中央の柱はISO/IEC 42001で、監視・測定と内部監査を求めます(第1節)。右の柱はEUのAI法で、高リスクAIには事前に定めたしきい値に対するテストを、GPAIモデルには評価結果の文書化を求めます(第3節)。高リスクAIの義務の適用は、2027年12月以降に延期されています。

3つの柱の下を横切る帯は、どの文書も出力の指標そのものは組織や提供者に委ねていることを示します。第7節の表の「出力の指標を定めるか」の列に対応します。拘束力の強さは、柱の上の「弱い」から「強い」への矢印のラベルで表しました。3つの柱は同じ墨の枠で塗り分けず、色の濃さに意味を持たせていません。

### 本章の要点と解釈

本節は、著者による解釈です。前節までの事実記述とは区別して読んでください。

- **規格は「どう測るか」を定めず、「測る仕組みを持て」と求めます。** ISO/IEC 42001とNIST AI RMFは、どちらも出力の指標の内容を組織に委ねています。EUのAI法も、指標としきい値を提供者が事前に定めることを求めています。著者は、出力の評価にデファクトの指標が無いことは、規格の欠陥というより設計だと考えます。
- **最も具体的なのは記録の要求です。** 附属書XI第2節の評価戦略、OMBの展開前テスト、AI事業者ガイドラインの作業記録は、何を測ったかを後から確かめられる状態を求めています。著者は、規制への対応で最初に要るのは、評価の結果より評価の記録だと考えます。
- **規制が評価の中身を決める日は、まだ来ていません。** EUの高リスクの義務は2027年12月以降に延期され、整合規格は2026年第4四半期が目標です。アメリカは2025年に行政の看板を「安全」から「標準と革新」へ替えました。

経営層と実務家への含意は、認証や規制への適合と、出力の質を分けて考えることです。ISO/IEC 42001の認証は評価の仕組みを第三者が確かめたものであり、出力が正しいことを保証するものではありません。著者は、規制が求める記録を残す仕組みと、利用者の期待に近いかを測る仕組みを、同じ評価の台帳に載せることを勧めます。規制がこの先どう評価の内容を左右し得るかは、[3つの道筋の章](22-three-paths)の道筋Cで扱います。
