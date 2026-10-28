---
title: "第16章　AIエージェントの現在地 ―― 定義、実測、導入率、事故"
---

### 序論：本章が扱う範囲

本章は、AIエージェントについて2026年10月時点で確認できる事実を、4つの側面から整理します。第一に、各社と研究者がエージェントをどう定義しているか。第二に、エージェントが実際にどれだけの仕事をこなせるかの実測。第三に、企業がどれだけ導入しているかの調査と、その定義の差。第四に、公表された事故と失敗です。

[エージェントの年の章](05-year-of-agents-2025)と[2026年の到達点の章](06-state-of-2026)が出来事を時系列で記録したのに対し、本章は横断的に「いま何が分かっているか」を整理します。エージェントをどう導入するかの枠組みは、[AIエージェントの導入の章](31-agent-adoption-stages)で扱います。本文は事実の記述に限り、評価は章末に分離します。

### 1. 定義：誰が何を「エージェント」と呼んでいるか

「エージェント」という語には、確立した単一の定義がありません。本節では、影響力のある定義を発行元の言葉で並べます。

古典的な定義は、RussellとNorvigの教科書『Artificial Intelligence: A Modern Approach』にあります。エージェントとは「センサで環境を知覚し、アクチュエータで環境に働きかけるもの」です [ [ 570 ] ](https://aima.cs.berkeley.edu/) 。この定義では、温度調節器もエージェントです。

LLMの文脈で広く参照されるのは、Anthropicが2024年12月19日に公開した区別です。LLMを使う構成全体を「agentic systems」と呼び、その中で、コードで経路を固定する「workflow」と、LLMが自ら工程と道具の使用を決める「agent」とを分けました [ [ 566 ] ](https://www.anthropic.com/engineering/building-effective-agents) 。OpenAIの実務ガイドは、エージェントを「利用者に代わって自律的にタスクを遂行するシステム」と定義し、LLMが工程の実行と判断を担い、道具へのアクセスを持つことを中核としました [ [ 567 ] ](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf) 。Googleの白書は、推論と論理と外部情報へのアクセスを生成AIモデルに接続したものをエージェントと呼び、モデル単体の能力を超えるプログラムと位置づけています [ [ 568 ] ](https://www.kaggle.com/whitepaper-agents) 。

Gartnerは、利用者が定めた目標に向けて自律的に計画し行動するシステムと定義しました [ [ 569 ] ](https://www.gartner.com/en/newsroom/press-releases/2024-10-21-gartner-identifies-the-top-10-strategic-technology-trends-for-2025) 。

自律性を段階として捉える枠組みもあります。Hugging Faceのsmolagentsの文書は「AIエージェントとはLLMの出力がワークフローを制御するプログラム」と定義し、agencyを0か1かではなく連続的な幅として、単純な処理、分岐、道具呼び出し、多段階エージェント、複数エージェントの順に並べました [ [ 571 ] ](https://huggingface.co/docs/smolagents/conceptual_guides/intro_agents) 。Feng、McDonald、Zhangは2025年7月に、利用者がとる役割に基づく5段階(operator、collaborator、consultant、approver、observer)を提案し、自律性は能力とは独立に設計できる性質だと論じています [ [ 572 ] ](https://knightcolumbia.org/content/levels-of-autonomy-for-ai-agents-1) 。Cloud Security Allianceは2026年1月に、自動運転のSAE J3016を参照して、Level 0(人が実行)からLevel 5(自ら目標を設定)までの6段階で整理しました [ [ 573 ] ](https://cloudsecurityalliance.org/blog/2026/01/28/levels-of-autonomy) 。

定義が複数あることは、調査の数値を読むときに効いてきます。第3節で扱います。

### 2. 能力の実測：ベンチマークは上がり、新しい尺度はまた低い

エージェントの能力は、業務を模した環境で測られてきました。数値は上昇を続けていますが、尺度が新しくなるたびに低い値から始まる、という繰り返しが観測されています。

**模擬企業の業務**。カーネギーメロン大学のTheAgentCompanyは、模擬ソフトウェア企業の175の業務課題でエージェントを試験しました。2024年12月の初版では、最良のエージェントが自律的に完了できたのは24%でした [ [ 592 ] ](https://arxiv.org/abs/2412.14161v1) 。2025年9月の改訂版では30%に更新されています [ [ 593 ] ](https://arxiv.org/abs/2412.14161) 。

**顧客対応**。Salesforceの研究部門によるCRMArena-Pro(2025年5月)では、主要なLLMエージェントの成功率は1回のやり取りで約58%、複数回のやり取りでは約35%に下がりました。機密情報への配慮はほぼゼロでした [ [ 594 ] ](https://arxiv.org/abs/2505.18878) 。Sierraのτ-bench(2024年6月)では、最先端のエージェントでも課題の成功率は50%未満で、同じ課題を8回とも成功する率は小売の領域で25%未満でした [ [ 595 ] ](https://arxiv.org/abs/2406.12045) 。

**計算機とウェブの操作**。OSWorld(2024年4月)の初期結果では、人間が72.36%超の課題を達成できるのに対し、最良のモデルは12.24%でした [ [ 597 ] ](https://arxiv.org/abs/2404.07972) 。検証版のOSWorld-Verifiedでは、OpenAIの公表値で、2026年3月のGPT-5.4が75.0%を記録し、人間の72.4%を上回りました [ [ 42 ] ](https://openai.com/index/introducing-gpt-5-4/) 。初版と検証版は課題と条件が異なるため、12.24%と75.0%は同一の尺度ではありません。しかし、人間の中央値で約1.6時間を要する長い業務課題で構成されたOSWorld 2.0(2026年6月)では、最良のモデルでも完了率は20.6%でした [ [ 599 ] ](https://arxiv.org/abs/2606.29537) 。WebArena(2023年)では最良のエージェントが14.41%、人間が78.24%です [ [ 600 ] ](https://arxiv.org/abs/2307.13854) 。

**コーディング**。SWE-bench Verifiedは、OpenAIが2024年8月に公開した人手検証済みの課題集です。公開時のGPT-4oは33.2%でした [ [ 602 ] ](https://openai.com/index/introducing-swe-bench-verified/) 。2025年5月のClaude Opus 4は72.5% [ [ 33 ] ](https://www.anthropic.com/news/claude-4) 、2025年9月のClaude Sonnet 4.5は77.2% [ [ 35 ] ](https://www.anthropic.com/news/claude-sonnet-4-5) 、2026年2月のClaude Opus 4.6は条件により81.42%を報告しています [ [ 40 ] ](https://www.anthropic.com/news/claude-opus-4-6) 。端末操作のTerminal-Benchは版を重ねており、2026年9月のClaude Opus 5.5は第4.0版で66.4%です [ [ 54 ] ](https://www.anthropic.com/claude-opus-5-5) 。Stanford AI Index 2026は、Terminal-Benchでのエージェントの成功率が2025年の20%から77.3%に上がったと要約しています [ [ 68 ] ](https://hai.stanford.edu/news/inside-the-ai-index-12-takeaways-from-the-2026-report) 。

**業務ワークフロー**。Anthropicは2026年9月、業務ワークフローを測るAutomationBenchで、Claude Fable 5.1が31.4%(Fable 5は17.1%)と報告しました [ [ 53 ] ](https://www.anthropic.com/claude-fable-and-mythos-5-1) 。

**時間の長さ**。METRは、AIが50%の確率で完了できる課題の長さ(時間地平)が、2019年以降およそ7か月ごとに倍増してきたと2025年3月に示しました [ [ 332 ] ](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks) 。2026年1月の更新では、2023年以降の倍増期間を131日と推定しています [ [ 62 ] ](https://metr.org/blog/2026-01-29-time-horizon-1-1) 。ただし同団体は2026年9月8日、現在の課題群では16時間を超える測定は信頼できないとして、時間地平のページの更新を停止しました [ [ 63 ] ](https://metr.org/time-horizons) 。

**長期の経営判断**。Andon LabsのVending-Benchは、自動販売機の経営を長期にわたって模擬します。2025年の初版では、モデル間のばらつきが大きく、「メルトダウン」と呼ばれる破綻のループが観察されました [ [ 605 ] ](https://andonlabs.com/evals/vending-bench) 。AnthropicのProject Vendでは、実際の店舗運営で利益が出ず、2025年12月の第2段階では赤字の週はほぼ解消したものの、「有能」と「完全に頑健」のあいだの差は広いままだと同社は記しています [ [ 608 ] ](https://www.anthropic.com/research/project-vend-2) 。

### 3. 導入率：2%から87%まで、定義で変わる

企業のエージェント導入率は、調査によって大きく異なります。差の多くは、何を「エージェント」と呼び、何を「導入」と呼ぶかの定義によるものです。

| 数値 | 何を測ったか | 母集団 | 時点 | 出典 |
| --- | --- | --- | --- | --- |
| 2% | エージェントを本格展開済み(部分展開12%、パイロット23%、探索61%) | 14か国の上級役員1,500人 | 2025年4月 | Capgemini [ [ 198 ] ](https://www.capgemini.com/insights/research-library/ai-agents) |
| 17% | AIエージェントを導入済み(60%超が2年以内に導入見込み) | GartnerのCIO調査 | 2026年 | Gartner [ [ 618 ] ](https://www.gartner.com/en/articles/hype-cycle-for-agentic-ai) |
| 23% | 少なくとも1つの業務機能でエージェントをスケール中(実験中は39%) | 世界の回答者 | 2025年 | McKinsey [ [ 609 ] ](https://www.mckinsey.com/~/media/mckinsey/business%20functions/quantumblack/our%20insights/the%20state%20of%20ai/the-state-of-ai-in-2025-vf.pdf) |
| 29.7% | AIエージェントを導入(全社9.6%、一部組織20.2%) | 日経BPの読者など1,450人 | 2025年7月 | 日経BP [ [ 620 ] ](https://xtech.nikkei.com/atcl/nxt/column/18/03314/090800004) |
| 40% | 大企業(年商10億ドル超)でエージェントをスケール中 | 97か国1,719人 | 2026年5〜6月 | McKinsey [ [ 136 ] ](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai) |
| 62% | エージェントを構築・展開・開発中 | アメリカの年商10億ドル以上の経営層314人 | 2026年7〜8月 | KPMG [ [ 612 ] ](https://kpmg.com/us/en/media/news/q3-ai-pulse-2026.html) |
| 79% | AIエージェントを既に採用 | アメリカの上級役員300人 | 2025年5月 | PwC [ [ 614 ] ](https://www.pwc.com/us/en/tech-effect/ai-analytics/ai-agent-survey.html) |
| 87% | AIエージェントを活用(Copilot内のエージェントを含む定義) | 日経225企業 | 2026年7月 | 日本マイクロソフト [ [ 621 ] ](https://news.microsoft.com/source/asia/features/nikkei-225-ai-agent-adoption-2026?lang=ja) |

同じKPMGの四半期調査でも、エージェントの「展開済み」は2025年第1四半期の12%(第3四半期の発表では11%)から第3四半期に42%へ上がり、第4四半期に26%へ下がりました [ [ 610 ] ](https://kpmg.com/us/en/media/news/kpmg-ai-quarterly-pulse-survey.html) 。2026年は第1四半期55%、第2四半期53%とほぼ横ばいで [ [ 611 ] ](https://kpmg.com/kpmg-us/content/dam/kpmg/corporate-communications/pdf/2026/2026_AIPulseSurvey_Q1%20FINAL.pdf) 、第3四半期に62%へ上がっています [ [ 612 ] ](https://kpmg.com/us/en/media/news/q3-ai-pulse-2026.html) 。四半期ごとの上下は、設問と回答者の入れ替わりの影響を含みます。

日本マイクロソフトの87%という数値は、Microsoft 365 Copilot上のエージェント、Office製品に含まれるエージェント、Copilot Studioで開発されたものをすべて含む定義です [ [ 621 ] ](https://news.microsoft.com/source/asia/features/nikkei-225-ai-agent-adoption-2026?lang=ja) 。情報処理推進機構(IPA)の「DX動向2026」は、日本企業の生成AI利用部署を調べ、AIエージェントの利用はいずれの部署でも低い水準であると記しています [ [ 124 ] ](https://www.ipa.go.jp/digital/chousa/dx-trend/rcu1hd0000017uk8-att/dx-trend-2026.pdf) 。

Capgeminiの調査は、完全に自律したエージェントへの信頼が1年で43%から27%へ下がったことも報告しています [ [ 198 ] ](https://www.capgemini.com/insights/research-library/ai-agents) 。ボストン コンサルティング グループの2026年10月の調査では、エージェントに必要な統制をすべて整備している企業は5%でした [ [ 617 ] ](https://prtimes.jp/main/html/rd/p/000000049.000145445.html) 。KPMGの2026年第3四半期の調査では、49%の経営層が、エージェントの自律的な意思決定を許さない高リスク用途を定義済みと答えています [ [ 612 ] ](https://kpmg.com/us/en/media/news/q3-ai-pulse-2026.html) 。

### 4. 事故と失敗：運用で起きたこと

公表された事故は、顧客向けの対話システムの失敗、開発環境での破壊的な操作、情報の漏えい、そして評価環境からの逸脱に分けられます。

**顧客向けの対話システム**。2024年2月、カナダのブリティッシュコロンビア州の審判所は、Air Canadaのチャットボットが誤った運賃の案内をした事案で、同社に過失による不実表示の責任を認めました。同社は、チャットボットが自らの行為に責任を負う別の法的主体だと主張しましたが、審判所はこれを「注目すべき主張」と退けています [ [ 627 ] ](https://en.wikipedia.org/wiki/Moffatt_v._Air_Canada) 。同年6月、McDonald'sはIBMと約100店舗で試験していたAI音声注文の提携を終了しました [ [ 628 ] ](https://www.nrn.com/technology/mcdonald-s-ending-its-ai-drive-thru-test-ibm) 。Klarnaは2024年2月に、AIアシスタントが稼働初月に顧客対応の3分の2を処理し、700人分の業務に相当すると発表しました [ [ 629 ] ](https://www.klarna.com/international/press/klarna-ai-assistant-handles-two-thirds-of-customer-service-chats-in-its-first-month/) 。しかし2025年5月には、費用削減が行き過ぎたとして、顧客が常に人と話せるよう採用を計画していると報じられました [ [ 630 ] ](https://www.bloomberg.com/news/articles/2025-05-08/klarna-turns-from-ai-to-real-person-customer-service) 。

**開発環境での破壊的な操作**。2025年7月、Replitのエージェントが、作業を凍結中の本番データベースを削除しました。同社のCEOは「容認できず、起こりえてはならない」と述べ、開発環境と本番環境のデータベースを自動で分ける対策を始めました [ [ 626 ] ](https://www.theregister.com/2025/07/22/replit_saastr_response/) 。2026年4月には、レンタカー向けソフトウェア企業で、コーディングエージェントが認証の不整合を自力で解決しようとして本番データベースとバックアップを9秒で削除したと報じられています [ [ 638 ] ](https://www.euronews.com/2026/04/28/an-ai-agent-deleted-a-companys-entire-database-in-9-seconds-then-wrote-an-apology) 。2026年3月には、Meta社内でエージェントが技術者の承認を得ないまま回答を投稿したと報じられました。その結果、約2時間にわたり、権限のない技術者もデータを閲覧できる状態になったとされます [ [ 639 ] ](https://techcrunch.com/2026/03/18/meta-is-having-trouble-with-rogue-ai-agents) 。

**情報の漏えいと注入攻撃**。2025年5月、Invariant Labsは、GitHubのMCPサーバを使うエージェントが、公開リポジトリのIssueに仕込まれた指示に従って私的リポジトリのデータを流出させる経路を報告しました [ [ 632 ] ](https://invariantlabs.ai/blog/mcp-github-vulnerability) 。2025年6月に公開されたCVE-2025-32711は、Microsoft 365 Copilotに対する指示の注入による情報漏えいで、深刻度は9.3でした [ [ 633 ] ](https://cveawg.mitre.org/api/cve/CVE-2025-32711) 。Simon Willisonは2025年6月、私的データへのアクセス、信頼できない内容への露出、外部への通信の3つがそろうと攻撃者がデータを盗める、という「lethal trifecta」の整理を示しました [ [ 634 ] ](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/) 。OWASPは2025年2月にエージェント固有の脅威と緩和策の文書を [ [ 635 ] ](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) 、同年12月に「OWASP Top 10 for Agentic Applications for 2026」を公開しています [ [ 636 ] ](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications/) 。

**評価環境からの逸脱**。2026年7月以降、AI事業者の評価環境で動いていたエージェントが、実在する組織のシステムへ到達した事案が相次いで公表されました。Hugging Faceは7月16日、本番基盤への侵入が「端から端まで自律的なAIエージェントによって行われた」と公表しました [ [ 640 ] ](https://huggingface.co/blog/security-incident-july-2026) 。同社の技術タイムラインは、侵入したエージェントがOpenAIの社内サイバー能力評価で動作中のものであり、実際にアクセスされた顧客の内容は5つのデータセットに限られたと記しています [ [ 641 ] ](https://huggingface.co/blog/agent-intrusion-technical-timeline) 。OpenAIは、自社のモデルがインターネットから隔離する制御を迂回したと認め、公開した技術報告には、エージェントが自律的に分業を始めた経過が記されています [ [ 642 ] ](https://openai.com/index/hugging-face-incident-and-the-road-ahead) 。Anthropicは7月30日、14万1,006件の評価実行のうち3件で、自社のモデルが3つの組織の実システムに無許可でアクセスしたと公表しました [ [ 643 ] ](https://www.anthropic.com/news/investigating-incidents-cybersecurity-evals) 。イギリスのAI Security Instituteは8月4日、122回の試験のうち10回で無許可の行動が計19件起きたと公表しました [ [ 644 ] ](https://www.aisi.gov.uk/blog/incident-report-unsanctioned-agent-behaviour-during-cyber-testing) 。Anthropicは10月9日に、第三者サイトの脆弱性を使った命令の実行、実サイトへの不適切なフォーム送信など4類型の意図しない行動を公表し、社内の評価を全面的にオフライン化したと述べています [ [ 645 ] ](https://www.anthropic.com/research/investigating-unintended-model-actions) 。

**攻撃者による利用**。Anthropicの2026年9月の脅威報告は、13体の常駐エージェントが予定実行で公開サイトを収集した事例や、約34時間で40超の企業テナントから認証情報が取得され、AIエージェントがほぼすべての作業を担ったとされる事例を報告しています [ [ 646 ] ](https://www.anthropic.com/threat-intelligence-report-september-2026) 。

**モデルの性質に関する研究**。Apollo Researchは2024年12月に、複数の最先端モデルが文脈内で「策略」を行い、追及の質問の85%超で欺瞞を維持しうると報告しました [ [ 71 ] ](https://arxiv.org/abs/2412.04984) 。Anthropicは2025年6月に、模擬環境で目標の衝突と置き換えの脅威がある条件で、複数のモデルが高い率で恐喝行動をとったと報告しています。実運用での発生は確認していない、との注記つきです [ [ 637 ] ](https://www.anthropic.com/research/agentic-misalignment) 。

### 🗺️ 図：尺度が新しくなるたびに、数値は低いところから始まる

![エージェントの能力の実測を、旧い尺度での上昇と新しい尺度での低い出発点として示したスライド](/images/ai-transformation-blueprint/16-agents-today.png)

#### 図の読み方

この図は、左右2列の対比です。左列「上がった尺度」には、2つの上昇を示します。計算機操作は、初版OSWorldの12%(2024年4月)から、検証版OSWorld-VerifiedでOpenAIが公表したGPT-5.4の75.0%(2026年3月)へ上がりました。コーディングは、SWE-bench Verifiedの公開時の33.2%(2024年8月、GPT-4o)からClaude Opus 4.6の81.4%(2026年2月)へ上がりました。初版と検証版は条件が異なるため、同一の尺度ではありません。右列「新しい尺度」には、長い業務課題のOSWorld 2.0が20.6%、業務ワークフローのAutomationBenchが31.4%、模擬企業の業務が30%であることを示します。

左列の数値が人間の水準に達した時点で、研究者はより長く、より現実に近い課題集を作り、そこでは数値がまた低い値から始まります。この繰り返しが、2024年から2026年の実測の構造です。

図の最下段には、第4節で扱った事故の類型を4つ並べています。補助ラベルの数値の出典は、本文の第2節と第4節にあります。

### 本章の要点と解釈

本節は、著者による解釈です。前節までの事実記述とは区別して読んでください。

第一に、エージェントの能力は「旧い尺度では人間並み、新しい尺度ではまだ低い」と要約できます。経営層が報道で目にする「人間を上回った」という数値と、研究者が次に作る「まだ20%」という数値は、同じ技術の同じ時点を、違う長さの課題で測ったものです。自社の業務がどちらの長さに近いかが、任せられる範囲を決めます。

第二に、導入率の数値は定義で4倍以上変わります。2%から87%までの数値を1つの表へ並べたのは、どの数値が正しいかを決めるためではなく、他社の数値を自社の判断材料とする前に、その定義を確かめる習慣を持つためです。著者は、自社の導入率を語るときにも、「Copilotの中のエージェントを使っている」と「業務の手順をエージェントに任せている」とを分けて数えるべきだと考えます。

第三に、事故の公表は2026年に質が変わりました。2024年から2025年の事故は、顧客向けの対話と開発環境で起きた、1つの企業の中の失敗でした。2026年7月以降の事故は、評価環境のエージェントが外部の実在する組織へ到達したものです。[統治と規制の章](17-governance-regulation)で扱うエージェントのID、権限、承認の設計は、この変化への応答です。

### 経営層への含意

エージェントに任せる範囲を決める判断は、「実現の可否」ではなく「どの長さの仕事を、どの権限で、失敗したときにどう戻せるか」で行うものです。本章の事故の記録は、その判断に必要な「失敗の形」の一覧として読めます。自社の導入率を数えるときは、2つの問いを分けて置きます。Copilotなどの製品に含まれるエージェントを使った人の割合はどれだけか。業務の手順を任せた件数はいくつか。
