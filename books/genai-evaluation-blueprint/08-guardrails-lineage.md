---
title: "第8章　ガードレールの系譜 ―― NeMo、Llama Guard、分類器、注入攻撃(2022〜2026)"
---

### 序論：本章が扱う範囲

ガードレールは、生成AIの入力と出力を動作中に検査して補正する仕組みです。本章は、ガードレールが2022年から2026年にかけてどう現れ、どう評価されてきたかを記述します。本書の枠組みでは、ガードレールは主に生成側のG4安全(有害・漏えい・権限の逸脱・注入が無いか)を担い、注入の防御は入力側のI5出所にもまたがります。[失敗の記録の章](11-failure-records)の失敗の4つの区分では、ガードレールを生成側とは別の区分として扱います。

扱う範囲は4つです。第一に、ガードレールという語と定義です。第二に、安全の分類器と、クラウドが提供するガードレールの製品の系譜です。第三に、危険な要求を通す「見逃し」と、安全な要求を断る「過剰拒否」を両面で測る評価です。第四に、プロンプトインジェクション(注入攻撃)と、レッドチーミングの評価です。

幻覚の検出と計測そのものは[幻覚の計測の章](07-hallucination-measurement)で扱いました。本章では、ガードレールの製品が幻覚の検出を機能として取り込んだ範囲だけを記します。規格と規制が求める安全性の評価は[規格と規制が求める評価の章](13-standards-and-regulation)で扱います。

### 1. ガードレールという語と定義(2023年)

ガードレールを名に掲げた道具は、2023年の春に相次いで公開されました。Guardrails AIのPythonパッケージの最初の版0.1.0は2023年3月13日に公開され、説明は「大規模言語モデルにガードレールを加える」でした [ [ 308 ] ](https://pypi.org/project/guardrails-ai/#history) 。NVIDIAは2023年4月25日、NeMo Guardrailsをオープンソースで公開しました。話題を逸らさない話題のガードレール、正確で適切な情報を返す安全のガードレール、安全と分かっている外部のアプリにだけ接続するセキュリティのガードレールの3種を定義しています [ [ 309 ] ](https://blogs.nvidia.com/blog/ai-chatbot-guardrails-nemo) 。

同年10月16日の論文は、ガードレールを「LLMの出力を制御する特定の方法」と定義しました。学習でモデルに埋め込む整合(alignment)とは異なり、対話管理に着想を得た実行時のプログラム可能なレールだと位置づけています [ [ 310 ] ](https://arxiv.org/abs/2310.10501) 。つまりガードレールは、モデルを作り直さずに、モデルの外側で入出力を検査する仕組みとして定義されました。

### 2. 分類器と製品の系譜(2022〜2026)

入力と出力を検査する安全の分類器は、ガードレールという語より前からありました。OpenAIは2022年8月10日にModerationのエンドポイントを刷新し、性的な内容・憎悪・暴力・自傷・嫌がらせなどを検出する分類器の手法を論文で公開しました [ [ 307 ] ](https://openai.com/index/new-and-improved-content-moderation-tooling/) 。

その後の主な公開を時系列に並べます。

| 時期 | 提供元 | 名称 | 何を検査するか |
| --- | --- | --- | --- |
| 2023年12月7日 | Meta | Llama Guard(Purple Llama) | 入出力の安全リスクの分類 [ [ 311 ] ](https://ai.meta.com/blog/purple-llama-open-trust-safety-generative-ai/) |
| 2024年3月 | Microsoft | Prompt Shields、Groundedness detection | 直接と間接の注入攻撃、資料に根拠づかない応答 [ [ 312 ] ](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/whats-new) |
| 2024年4月23日 | AWS | Guardrails for Amazon Bedrock(一般提供) | 有害な内容、注入攻撃などのカテゴリ [ [ 313 ] ](https://aws.amazon.com/blogs/aws/guardrails-for-amazon-bedrock-now-available-with-new-safety-filters-and-privacy-controls/) |
| 2024年7月10日 | AWS | contextual grounding check | 根拠と関連性の2つの閾値による応答の遮断 [ [ 1103 ] ](https://aws.amazon.com/blogs/aws/guardrails-for-amazon-bedrock-can-now-detect-hallucinations-and-safeguard-apps-built-using-custom-or-third-party-fms/) |
| 2024年7月23日 | Meta | Llama Guard 3、Prompt Guard | 多言語の安全分類、注入攻撃のフィルター [ [ 1101 ] ](https://ai.meta.com/blog/meta-llama-3-1/) |
| 2025年2月3日 | Anthropic | Constitutional Classifiers | 汎用的な脱獄 [ [ 1105 ] ](https://www.anthropic.com/news/constitutional-classifiers) |
| 2025年8月6日 | AWS | Automated Reasoning checks(一般提供) | 形式検証による事実の誤りの検出 [ [ 1104 ] ](https://aws.amazon.com/blogs/aws/minimize-ai-hallucinations-and-deliver-up-to-99-verification-accuracy-with-automated-reasoning-checks-now-available/) |

この表から2つの動きが読み取れます。1つは、有害な内容を対象としていたガードレールが、2024年に「資料に根拠づかない応答」の検出を取り込んだことです。もう1つは、検査の対象に、利用者の入力だけでなく文書や画像に埋め込まれた間接の攻撃が加わったことです。AWSはAutomated Reasoning checksについて「最大99%の検証精度」をうたっていますが、これは提供事業者の主張です [ [ 1104 ] ](https://aws.amazon.com/blogs/aws/minimize-ai-hallucinations-and-deliver-up-to-99-verification-accuracy-with-automated-reasoning-checks-now-available/) 。

### 3. 見逃しと過剰拒否：2つの誤りを同時に測る

ガードレールの誤りには2つの向きがあります。危険な要求を通す見逃しと、安全な要求を断る過剰拒否です。

過剰拒否は、2023年8月2日のXSTestで評価の対象として定式化されました。無害さを求めると危険な要求を断る必要があり、その分だけ有用さが下がるという緊張があります。XSTestは、危険な問いと似た語を含むだけで安全な問いまで断る振る舞いを、250の安全な問いと200の危険な問いで測ります [ [ 316 ] ](https://arxiv.org/abs/2308.01263) 。Anthropicは2024年3月4日のClaude 3の発表で、前の世代が文脈の理解を欠いた不要な拒否をしていたとし、ガードレールの境界にある問いへの拒否を減らしたと述べました [ [ 323 ] ](https://www.anthropic.com/news/claude-3-family) 。過剰拒否が、製品の発表で語られる指標になった例です。

2025年5月のClaude Opus 4とSonnet 4のsystem cardは、2つの向きの数値を並べて報告しています。違反する要求への無害応答率は、Opus 4で98.43%、Sonnet 4で98.99%でした。安全な要求を誤って断る過剰拒否の率は、Opus 4で0.07%、Sonnet 4で0.23%でした。Opus 4の98.43%はASL-3の保護を付けない値で、保護を付けると98.76%でした [ [ 324 ] ](https://www-cdn.anthropic.com/6d8a8055020700718b0c49369f60816ba2a7c285.pdf) 。これらは外付けの分類器ではなく、モデル自体の応答の値です。

ガードレールの費用を数値で示した例もあります。AnthropicのConstitutional Classifiersでは、自動評価での脱獄の成功率が分類器なしの86%から4.4%に下がりました。その代わりに拒否率が0.38ポイント上がり、計算の費用が23.7%増えています [ [ 1105 ] ](https://www.anthropic.com/news/constitutional-classifiers) 。論文は、この拒否率の増加を、本番の通信での絶対値の増加として報告しています [ [ 314 ] ](https://arxiv.org/abs/2501.18837) 。

これとは別の試作版の分類器について、論文は、183人が参加した3,000時間超のバグバウンティで汎用的な脱獄が見つからなかったと報告しました [ [ 314 ] ](https://arxiv.org/abs/2501.18837) 。同社によれば、この試作版は無害な問い合わせを多く断り、計算の費用も大きいものでした。2025年2月3日から10日の公開の挑戦では、339人が参加し、4人がすべての段階を突破しました。そのうち1人の方法を、同社は汎用的な脱獄と判断しています [ [ 1105 ] ](https://www.anthropic.com/news/constitutional-classifiers) 。評価のデータには、実際の利用者の問い合わせに基づく毒性の検出データToxicChat(2023年10月26日)なども公開されています [ [ 315 ] ](https://arxiv.org/abs/2310.17389) 。

### 4. 注入攻撃：攻める側が動く評価

「prompt injection」という語は、2022年9月12日にSimon Willisonが名付けました。翻訳の指示を無視して別の文を出力させる例を受けたものです [ [ 305 ] ](https://simonwillison.net/2022/Sep/12/prompt-injection/) 。2022年11月17日のFábio PerezとIan Ribeiroは、目的の乗っ取りとプロンプトの漏えいの2つの攻撃を定式化しました [ [ 306 ] ](https://arxiv.org/abs/2211.09527) 。2023年2月23日のGreshakeらは、検索されるデータに指示を仕込む間接プロンプトインジェクションを示し、LLMを組み込んだアプリケーションではデータと指示の境界が曖昧になると論じました [ [ 1102 ] ](https://arxiv.org/abs/2302.12173) 。

業界団体のOWASPは2023年8月1日、LLMアプリケーションのリスクの上位10項目の第1版で、1番目にPrompt Injectionを置きました [ [ 318 ] ](https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-2023-v1_0.pdf) 。2025年版は2024年11月17日に公開されています [ [ 591 ] ](https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/) 。

AIエージェントがツールを使うようになると、評価の環境も作られました。2024年6月19日のAgentDojoは、メールの管理やネットバンキングの操作などの97の課題と629のセキュリティテストを備えます。最先端のLLMは攻撃がなくても多くの課題に失敗し、既存の攻撃は安全性の一部だけを破ると報告しました [ [ 319 ] ](https://arxiv.org/abs/2406.13352) 。OpenAIのOperatorのsystem card(2025年1月23日)は、プロンプトインジェクションを「入力のどこかに現れた信頼できない指示に、モデルが誤って従うこと」と定義しています [ [ 328 ] ](https://openai.com/index/operator-system-card/) 。

注入攻撃の数値は、試行の回数と環境で大きく変わります。

| 時期 | 評価 | 条件 | 結果 |
| --- | --- | --- | --- |
| 2025年9月29日 | Claude Sonnet 4.5のsystem card | 攻撃防止のスコア | 分類器なし92.0%、あり94.0% [ [ 325 ] ](https://assets.anthropic.com/m/12f214efcc2f457a/original/Claude-Sonnet-4-5-System-Card.pdf) |
| 2025年11月24日 | Claude Opus 4.5、ブラウザ利用 | 環境あたり100回試行する適応的攻撃 | 攻撃成功率はモデルのみ8.0%、改良した保護で1.4% [ [ 1106 ] ](https://www.anthropic.com/research/prompt-injection-defenses) |
| 2026年8月26日 | Claude in Chrome | 専門のレッドチームが作った強い攻撃 | モデルに届いた攻撃の成功率はOpus 4.5で17.6%、Opus 5で3.8% [ [ 327 ] ](https://claude.com/blog/claude-in-chrome-generally-available) |

Anthropicは2025年11月24日の記事で、1%の攻撃成功率でも意味のあるリスクであり、注入攻撃に免疫のあるブラウザのエージェントは無いと述べました [ [ 1106 ] ](https://www.anthropic.com/research/prompt-injection-defenses) 。2026年8月26日の記事は、成功率0%で飽和した従来の評価を引退させ、より強い攻撃による評価に替えたと記しています [ [ 327 ] ](https://claude.com/blog/claude-in-chrome-generally-available) 。評価の飽和と入れ替えが、提供事業者の公式の記録に残った例です。

### 5. レッドチーミングの評価

レッドチーミングは、攻撃者の視点でAIシステムの弱点を探す評価です。DeepMindのEthan Perezらは2022年2月7日、別のLMで攻撃の例を作り、2,800億パラメータの対話モデルから数万の攻撃的な応答を見つけました [ [ 320 ] ](https://arxiv.org/abs/2202.03286) 。2024年2月6日のHarmBenchは、18のレッドチーミングの手法と33の対象モデルと防御を大規模に比較し、手法の標準化を図りました [ [ 317 ] ](https://arxiv.org/abs/2402.04249) 。

提供事業者は、手法の標準が無いことを自ら記しています。Anthropicは2023年7月26日、生物安全保障の専門家と150時間超をかけて、有害な生物情報を出力する能力を評価したと公表しました [ [ 321 ] ](https://www.anthropic.com/news/frontier-threats-red-teaming-for-ai-safety) 。同社は2024年6月12日、AIのレッドチーミングでの標準化された実践の欠如が、AIシステムの安全性の客観的な比較を難しくしていると述べています [ [ 1107 ] ](https://www.anthropic.com/news/challenges-in-red-teaming-ai-systems) 。OpenAIは2023年9月19日に外部の専門家のRed Teaming Networkを公募し、「red team」という語が多様な手法を含み、誤った安心感を与えうると認めました [ [ 322 ] ](https://openai.com/index/red-teaming-network/) 。

日本では、AIセーフティ・インスティテュートが2024年9月25日に「AIセーフティに関するレッドチーミング手法ガイド」の第1.00版を公表しました [ [ 331 ] ](https://aisi.go.jp/assets/pdf/ai_safety_RT_v1.00_ja.pdf) 。

### 🗺️ 図：見逃しと過剰拒否は、同時に測る

![モデル自体の見逃しの側と過剰拒否の側の率を並べ、外付けの分類器の費用を添えた図](/images/genai-evaluation-blueprint/08-guardrails-lineage.png)

#### 図の読み方

この図は、上段にモデル自体の2つの率、下段に外付けの分類器の費用を置いています。上段の左の箱は違反する要求で、見逃しを測る側です。2025年5月のClaude Opus 4のsystem cardでは、違反する要求への無害応答率が98.43%でした。右の箱は安全な要求で、過剰拒否を測る側です。同じsystem cardで、Opus 4の過剰拒否の率は0.07%でした。いずれも第3節で引用した、モデル自体の数値です。

読み順は左の箱、右の箱、下の帯の順です。下の帯は、外付けの分類器で見逃しを減らすと、拒否と計算の費用が増えることを表します。Constitutional Classifiersでは、脱獄の成功率は86%から4.4%へ下がりました。その代わり、拒否率が0.38ポイント増え、計算の費用も23.7%増えました。片方の数値だけを報告する評価では、この交換が見えません。

---

### 本章の要点と解釈

本節は、著者による解釈です。前節までの事実記述とは区別して読んでください。

要点は3つです。第一に、ガードレールは2023年に「モデルの外側で入出力を検査する仕組み」として定義され、2024年には有害な内容に加えて、根拠のない応答と間接の注入攻撃を検査の対象に取り込みました。第二に、2025年の提供事業者の報告は、見逃しと過剰拒否の2つの向きの数値を並べる形に揃いつつあります。第三に、注入攻撃の評価は、攻める側の手法が進むために飽和と入れ替えを繰り返しており、成功率の数値は試行の回数と環境によって桁が変わります。

著者は、実務家への含意を「ガードレールを導入したかどうかではなく、2つの誤りの率と費用を自社の業務で測ったかどうかを問う」ことだと考えます。過剰拒否は利用者の不満として表に出にくく、見逃しだけを測る評価では有用さの損失が隠れます。注入攻撃については、単一の成功率を安全の証明とみなさず、攻撃の強さと試行の回数を添えて記録するべきです。経営層にとっての含意は、ガードレールの性能に「免疫」は無いと提供事業者が自ら記した内容を前提に、運用中の再評価を予算に含めることです。生成側の安全の測り方は[生成側の評価の章](18-evaluating-generation)で扱います。
