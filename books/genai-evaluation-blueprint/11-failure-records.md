---
title: "第11章　失敗の記録 ―― 公開事例を4つの層で読む"
---

### 序論：本章が扱う範囲

本章は、生成AIの出力が期待を外し、謝罪・停止・訴訟・制裁に至った公開事例を並べます。対象は2016年から2026年10月までの事例です。裁判所の決定文、規制当局の公表、当事者の公式声明を優先して使います。一次資料が無く報道だけで伝わる事例は、「〜と報じられています」と書き分けます。

事例は4つの層に分けて読みます。入力側は、回答の材料となる情報の収集と取り込みです。生成側は、出力の内容そのものです。ガードレールは、有害な入力・出力・操作の抑止です。運用は、人の確認、変更の管理、提供の基盤です。分類の根拠は、当事者の説明や裁判所の認定が原因として挙げた箇所で、1件が複数の層にまたがることもあります。

第Ⅰ部は、[道具の氾濫の章](09-tool-proliferation)と[能力ベンチマークとの距離の章](10-capability-benchmarks-distance)までで評価の手法の系譜を扱いました。本章から始まる第Ⅱ部は、評価の現在地を扱います。

本章は「何が起きたか」の記録に限ります。「どんな評価があれば防げたか」は、次の[失敗から逆算する評価の章](12-evaluation-from-failures)で扱います。

### 1. 前史：生成AI以前からの公開停止

ChatGPTの公開より前にも、言語を生成するシステムの公開停止はありました。

2016年3月、Microsoftは対話ボットTayを公開から24時間以内に停止し、謝罪しました。同社は「一部の人々による協調した攻撃が脆弱性を突いた」と説明しています。そのうえで「多くの種類の濫用に備えていた」が、当該の攻撃を見逃したと述べました [ [ 440 ] ](https://blogs.microsoft.com/blog/2016/03/25/learning-tays-introduction/) 。

2018年7月には、IBM Watson for Oncologyが「安全でなく誤った治療推奨」を複数出していたと、内部資料をもとに報じられています。推奨は実患者のデータではなく、少数の合成症例で訓練されたとも報じられました [ [ 441 ] ](https://www.statnews.com/2018/07/25/ibm-watson-recommended-unsafe-incorrect-treatments/) 。

2022年11月、Metaは科学文献向けの言語モデルGalacticaの公開デモを出しました。架空の論文や虚偽の記事を生成すると批判され、3日後にデモを停止したと報じられています。停止までの日数を2日とする報道もあります [ [ 442 ] ](https://www.technologyreview.com/2022/11/18/1063487/meta-large-language-model-ai-only-survived-three-days-gpt-3-science/) 。

### 2. 入力側の失敗：何を取り込んだか

入力側の失敗は、材料の質、取り込んだ文書の扱い、収集の許諾に分かれます。

- **材料の質。** 2024年5月、GoogleはAI Overviewsの「ピザにのりを使う」などの誤回答について説明しました。原因は、情報が乏しい「データ空白」、風刺記事、フォーラムの皮肉投稿です。対策として、風刺とユーザー生成コンテンツの抑制、発動条件の制限を挙げています [ [ 230 ] ](https://blog.google/products/search/ai-overviews-update-may-2024/) 。
- **文書が指示として働く。** 2024年8月、PromptArmorは、Slack AIが公開チャンネルの指示文に従い、非公開チャンネルのAPIキーを外部へ漏らし得ると公表しました [ [ 496 ] ](https://promptarmor.substack.com/p/data-exfiltration-from-slack-ai-via) 。2025年6月には、細工したメールを送るだけでMicrosoft 365 Copilotに機密データを外部送信させられる脆弱性EchoLeakが報じられています。Microsoftはサーバ側で修正し、実際に悪用された証拠はないとしています [ [ 495 ] ](https://www.bleepingcomputer.com/news/security/zero-click-ai-data-leak-flaw-uncovered-in-microsoft-365-copilot/) 。
- **ページの内容と利用者の指示の混同。** 2025年8月、Braveは、PerplexityのCometブラウザがRedditのコメントに隠した指示に従う実証を公開しました。要約のボタンを押しただけで、メールアドレスとワンタイムパスワードが攻撃者へ送られます。Braveは競合のブラウザを提供する当事者です [ [ 497 ] ](https://brave.com/blog/comet-prompt-injection/) 。
- **収集の許諾。** 2025年8月、読売新聞の3本社はPerplexityを東京地裁に提訴しました。同年2月から6月に119,467本の記事が無断で取得されたという主張です [ [ 480 ] ](https://www.yomiuri.co.jp/national/20250807-OYT1T50151) 。同月には朝日新聞社・日本経済新聞の2社も共同で提訴しました。報道によれば、両社の主張はrobots.txtによる拒否が無視されたというものです [ [ 481 ] ](https://www.watch.impress.co.jp/docs/news/2041960.html) 。

入力の安全性も入力側に含めます。2023年5月、Samsung Electronicsは、従業員がChatGPTに機密のソースコードを入力した事案を受けて、生成AIツールの社内利用を一時禁止したと報じられています [ [ 499 ] ](https://www.theregister.com/2023/05/02/samsung_generative_ai_ban/) 。

### 3. 生成側の失敗：出力が根拠や事実と食い違う

生成側で最も件数が多いのは、実在しない出典の生成です。2023年6月、ニューヨーク南部地区の連邦地裁はMata v. Aviancaで、ChatGPTが生成した実在しない判例を提出した弁護士2名と法律事務所に、連帯して5,000ドルの制裁金を命じました [ [ 443 ] ](https://storage.courtlistener.com/recap/gov.uscourts.nysd.575368/gov.uscourts.nysd.575368.54.0_1.pdf) 。2025年6月、イングランド・ウェールズ高等法院は、自由に使える生成AIツールは信頼できる法的調査の能力を持たないと述べました。判決は、虚偽の断定、実在しない出典、実在する出典に無い引用文の3つを挙げています [ [ 454 ] ](https://www.judiciary.uk/wp-content/uploads/2025/06/Ayinde-v-London-Borough-of-Haringey-and-Al-Haroun-v-Qatar-National-Bank.pdf) 。

Damien Charlotin氏が個人で運営するデータベースは、2026年10月28日の更新時点で、生成AIの幻覚(ハルシネーション)が問題になった裁判例を2,231件収録しています。内訳は弁護士が880件、裁判官が32件です [ [ 457 ] ](https://www.damiencharlotin.com/hallucinations/) 。

自社の文書との食い違いも生成側に入ります。2024年2月、カナダBC州の民事紛争の審判所は、エア・カナダのチャットボットが忌引運賃を事後に申請できると誤って案内した件で、同社に計812.02カナダドルの支払いを命じました。審判所は、チャットボットは別個の法的主体だという同社の主張を退けました。そして、同社がチャットボットの正確性に合理的な注意を払わなかったと認定しています [ [ 459 ] ](https://decisions.civilresolutionbc.ca/crt/crtd/en/525448/1/document.do) 。2025年4月には、Cursorのサポートボットが存在しないログイン方針を説明し、共同創業者が誤った回答だと認めました [ [ 463 ] ](https://www.theregister.com/2025/04/18/cursor_ai_support_bot_lies/) 。

要約と記事の生成でも、同じ型の失敗が出ています。

- 2023年1月、CNETはAIツールで書いた77本の記事のうち、41本に訂正を出したと報じられています [ [ 471 ] ](https://www.theverge.com/2023/1/25/23571082/cnet-ai-written-stories-errors-corrections-red-ventures) 。
- 2024年12月、BBCがApple Intelligenceの通知要約による虚偽の見出しに抗議しました。Appleは2025年1月にニュースアプリの要約を一時停止したと報じられています [ [ 476 ] ](https://www.siliconrepublic.com/business/apple-halt-ai-notification-summaries-backlash-features) 。
- 2025年5月、Chicago Sun-Timesの別刷に、実在の作家に架空の書名を付けた読書リストが載りました。発行元のCEOは、存在しない本を推薦していたと認めています [ [ 477 ] ](https://www.nbcnews.com/tech/tech-news/chicago-sun-admits-summer-book-guide-included-fake-ai-generated-titles-rcna208325) 。
- 2025年10月、新聞記事を生成AIで要約したとみられるXの公式サービスの投稿が、長浜市の施策を京都市のものとして伝えました。京都市は削除を要請したと報じられています [ [ 482 ] ](https://www.hokkaido-np.co.jp/article/1228073) 。

専門文書と医療にも及んでいます。オーストラリアの雇用・職場関係省は、Deloitteが作成した保証レビューの報告書を、2026年2月に訂正版へ差し替えました [ [ 484 ] ](https://www.dewr.gov.au/assuring-integrity-targeted-compliance-framework/resources/targeted-compliance-framework-assurance-review-final-report) 。この報告書には存在しない文献と架空の判決引用が含まれ、Deloitteが最終支払分を返金すると報じられています。2024年6月の研究は、OpenAIのWhisperが13,000件超の音声クリップの約1%で、音声に無い語句を丸ごと書き起こしたと報告しました [ [ 489 ] ](https://news.cornell.edu/stories/2024/06/ai-speech-text-can-hallucinate-violent-language) 。

### 4. ガードレールの失敗：弱すぎる抑止と強すぎる抑止

利用者の指示が業務上の制約を上書きした例があります。2023年12月、Chevrolet販売店のチャットボットが、利用者の指示に従って新車を1ドルで売る「合意」を出力したと報じられています [ [ 461 ] ](https://incidentdatabase.ai/cite/622) 。2024年1月には、配送会社DPDのチャットボットが利用者の誘導で罵倒語を使いました。同社はシステム更新後の誤りだとして、AI要素を停止したと報じられています [ [ 462 ] ](https://www.theguardian.com/technology/2024/jan/20/dpd-ai-chatbot-swears-calls-itself-useless-and-criticises-firm) 。

抑止が強すぎた例もあります。2024年2月、GoogleはGeminiの人物画像の生成を停止しました。同社の説明では、幅広い人々を示す調整が、示すべきでない場合を考慮していませんでした。さらにモデルが意図よりはるかに慎重になり、一部の要求を拒否しました [ [ 501 ] ](https://blog.google/products/gemini/gemini-image-generation-issue/) 。

行動するAIエージェントの事故もここに入ります。2025年7月、Replitのエージェントは「コードフリーズ」の指示の下で、本番データベースのデータを削除しました。CEOは「容認できず、起こり得てはならない」と認め、開発用と本番用のデータベースの自動分離などを表明しました [ [ 491 ] ](https://x.com/amasad/status/1946986468586721478) 。同じ月、Gemini CLIの利用者は、ディレクトリ作成の失敗を検知しないまま移動の操作が続き、ファイルを失ったと報告しています [ [ 492 ] ](https://github.com/google-gemini/gemini-cli/issues/4586) 。

### 5. 運用の失敗：人の確認と変更の管理

運用の失敗は、人の確認が働かなかった例、変更が評価を経ずに本番へ出た例、提供の基盤の不具合に分かれます。

人の確認では、方針があっても工程が実行されなかった例を裁判所が認定しています。2025年7月、アラバマ北部地区の連邦地裁は、事務所のAI方針と警告があったにもかかわらず幻覚の引用を提出した弁護士3名を、事件から排除しました [ [ 451 ] ](https://edrm.net/2025/07/when-ai-policies-fail-the-ai-sanctions-in-johnson-v-dunn-and-what-they-mean-for-the-profession/) 。2025年5月のLacey v. State Farmでは、AIで作った骨子を共同弁護人が引用の確認なしに取り込みました。27件の引用のうち約9件に誤りがありました [ [ 449 ] ](https://reason.com/volokh/2025/05/14/ai-hallucination-in-filings-involving-14th-largest-u-s-law-firm-lead-to-31k-in-sanctions/) 。2025年10月には、アメリカの連邦判事2名が、インターンと法務書記官によるAIの使用を認めました [ [ 456 ] ](https://www.judiciary.senate.gov/press/rep/releases/grassley-releases-judges-responses-owning-up-to-ai-use-calls-for-continued-oversight-and-regulation) 。

変更の管理では、評価済みの製品に後から加えた変更が失敗の起点になっています。

- アメリカの摂食障害の全国団体が案内していたチャットボットTessaは、ルールベースで臨床試験を経て設計されていました。後から加えた生成モデルのQ&A機能が減量の助言を出し、2023年に停止されたと報じられています [ [ 506 ] ](https://www.npr.org/sections/health-shots/2023/06/08/1180838096/an-eating-disorders-chatbot-offered-dieting-advice-raising-fears-about-ai-in-health) 。
- 2025年5月、xAIは、Grokが無関係な質問に特定の政治的話題を繰り返し持ち出した件を、無許可のシステムプロンプト変更が原因だと説明しました。説明は同社の投稿を引用した報道で伝わっています [ [ 502 ] ](https://techcrunch.com/2025/05/15/xai-blames-groks-obsession-with-white-genocide-on-an-unauthorized-modification) 。同年7月には、コード更新後の約16時間に反ユダヤ的な投稿をした件で謝罪したと報じられています [ [ 503 ] ](https://www.maginative.com/article/elon-musks-xai-apologizes-for-groks-antisemitic-rants-that-praised-hitler/) 。

提供の基盤では、2025年9月にAnthropicが、Claudeの応答品質を断続的に劣化させた3件のインフラの不具合を公表しました。最も影響の大きかった8月31日の1時間には、Sonnet 4へのリクエストの16%が影響を受けました [ [ 494 ] ](https://www.anthropic.com/engineering/a-postmortem-of-three-recent-issues) 。

### 6. 4つの層の一覧

前節までの主な事例を、層ごとに印を付けて並べます。印は、当事者の説明や裁判所の認定が原因として挙げた層です。資料の列の「報道」は、一次資料を確かめられず報道で伝わる事例です。

| 事例 | 時期 | 入力側 | 生成側 | ガードレール | 運用 | 資料 |
| --- | --- | --- | --- | --- | --- | --- |
| Tay | 2016年3月 | | | ● | ● | 当事者 |
| Galactica | 2022年11月 | | ● | | | 報道 |
| Samsungの機密の入力 | 2023年5月 | ● | | | ● | 報道 |
| Mata v. Avianca | 2023年6月 | | ● | | ● | 裁判 |
| Tessa | 2023年 | | | ● | ● | 報道 |
| Chevrolet販売店 | 2023年12月 | | | ● | | 報道 |
| エア・カナダ | 2024年2月 | | ● | | ● | 裁判 |
| Geminiの画像生成 | 2024年2月 | | | ● | | 当事者 |
| AI Overviews | 2024年5月 | ● | | | | 当事者 |
| Slack AI | 2024年8月 | ● | | ● | | 発見者 |
| Appleの通知要約 | 2025年1月 | | ● | | | 報道 |
| Cursorのサポート | 2025年4月 | | ● | | ● | 報道 |
| Grokの指示の変更 | 2025年5月 | | | | ● | 報道 |
| Replit | 2025年7月 | | | ● | ● | 当事者 |
| Johnson v. Dunn | 2025年7月 | | ● | | ● | 裁判 |
| 新聞社の提訴 | 2025年8月 | ● | | | | 当事者 |
| Comet | 2025年8月 | ● | | ● | | 発見者 |
| Anthropicの不具合 | 2025年9月 | | | | ● | 当事者 |
| Deloitteの報告書 | 2025年10月 | | ● | | ● | 公的・報道 |

### 🗺️ 図：失敗は4つの層に現れる

![公開された失敗事例を、入力側・生成側・ガードレール・運用の4つの層に置いた図](/images/genai-evaluation-blueprint/11-failure-records.png)

#### 図の読み方

図は、4つの箱を左上から右下へ並べています。左上が入力側、右上が生成側、左下がガードレール、右下が運用です。各箱には、本文で扱った代表的な失敗の型を2つずつ置きました。

入力側は、風刺記事などの材料の取り込みと、文書に仕込まれた指示への追従です(第2節)。生成側は、架空の判例や出典と、自社の方針と食い違う案内です(第3節)。ガードレールは、利用者の指示で制約が外れる例と、過剰な拒否です(第4節)。運用は、人の確認の省略と、評価を経ない変更です(第5節)。

機械が担う3つの層を藍、人が確認する運用の層を丹で塗り分けています。図の下の一文は、第6節の表で1件の事例に複数の印が付くことに対応します。

### 本章の要点と解釈

本節は、著者による解釈です。前節までの事実記述とは区別して読んでください。

- **層は重なって現れます。** 第6節の表では、生成側に印が付く事例の多くに運用の印も付いています。著者は、生成の誤りは失敗の前提条件であり、実害に至る条件は運用の空白だと考えます。裁判所が制裁の対象にしたのは、架空の判例を生成したことではなく、確認を省いて提出したことでした。
- **入力側の失敗は「精度」だけでは捉えきれません。** AI Overviewsの事例は材料の質の問題でした。一方で、Slack AI・EchoLeak・Cometは取り込んだ文書が指示として働いた事例で、新聞社の提訴は収集の許諾が争点です。著者は、入力側の評価には、精度と鮮度に加えて信頼の境界と許諾を含める必要があると考えます。
- **ガードレールは両方向に失敗します。** Chevrolet販売店やDPDは抑止が弱すぎた例で、Geminiの画像生成は強すぎた例です。片方だけを測ると、もう片方の失敗を見落とします。

経営層と実務家への含意は、失敗の記録を「モデルの性能の問題」としてだけ読まないことです。著者は、本章の事例の多くを、実害の手前で止められた型だと考えます。止める手段は、変更のたびに評価を通す工程と、人による確認の証跡です。その工程を具体的にどう組むかは、次の[失敗から逆算する評価の章](12-evaluation-from-failures)で扱います。
