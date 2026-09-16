---
title: "第Ⅱ部-11　AI 提案 ― 前面に出ない生成AI、provider の抽象化、1 度も成立していなかった本番"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

がんばりクエストの生成AIは、画面の前面に出ません。活動の名前を入力すると、カテゴリとアイコンとポイントを推定する。レシートの写真から金額を読む。それだけで、チャットやキャラクターは無く、失敗すればキーワードの規則に静かに縮退します。この章では、AWS と NUC で provider を切り替える抽象化、「呼んでよい」と「呼べる」の契約、本番で 1 度も成立していなかった AI 提案、そして子供の識別情報を外部の AI に送っていた配線の撤去を扱います。

## 2 つの provider と 1 つの interface

AI の呼び出しは `AiProvider` の interface に隠蔽されています。`converseWithTool` はテキストから構造化出力を返し、`converseWithImageAndTool` は画像入力を伴います。Bedrock の実装は Converse API と tool_use、Gemini の実装は generateContent と JSON のパースで、provider 固有の API の差はこの interface の裏に閉じます。呼び出す service は 4 つで、活動の提案、チェックリストの提案、ごほうびの提案、レシートの OCR です[^provider]。

環境変数 `AI_PROVIDER` で切り替えます。既定は Bedrock で Lambda 向け、`gemini` は NUC 向けです。factory が受理する値は env の schema と一致させます。schema が通す値を factory が処理しないと、設定が受理されたのに別の provider が動き、設定した本人が気づけません[^factory]。

Bedrock を選んだ理由は 4 つです。Gemini のモデル ID は頻繁に EoL になり追従が運用負荷。Lambda・DSQL・Cognito の構成に Bedrock を足すことで IAM ベースの認証に統一でき、API key の管理が不要。Claude の tool_use で JSON Schema を定義し、手動パースなしで構造化出力を得られる。そして活動の提案とレシートの OCR に高度な推論は不要で、Haiku は最安クラス[^awsdesign]。

モデルは Claude Haiku 4.5 で、IAM の Resource は profile の ARN 1 本と member 3 リージョンの foundation-model の ARN 3 本に絞り、`*` にしません。[第Ⅲ部-1](serverless-cost) で見たとおり、8 月の Bedrock の請求は Haiku 4.5 と Sonnet 4.6 で合わせて $0.0006 でした。

## 「呼んでよい」と「呼べる」

`isAvailable()` の契約は、2026 年 8 月に書き直されました。`false` は確定で「呼んでも無駄」を意味し、呼び出し側はフォールバックしてよい。`true` は「設定（API key かモデル ID）が配られている」ことまでしか保証しない。権限やモデルアクセスの有無は実際に呼ぶまで確定しないため、`true` を成功の保証として扱ってはならず、呼び出し失敗時の縮退を必ず持つこと。可用性クラスの失敗は latch に記録し、以降の `isAvailable()` を `false` に倒します[^provider]。

契約を厳しくした背景があります。Bedrock の実装は、モデル ID の既定値を持っていました。既定値があること自体は「設定が配られている」ことを意味しないのに、既定値を根拠に `isAvailable()` を `true` にしていたのが欠陥でした。可用性の判定に既定値は使わず、`BEDROCK_MODEL_ID` の明示的な配布を要求します。呼べない ID を既定値に残すと同じ罠を再生産するため、既定値も呼べる ID に変えました[^bedrock]。

NUC では、AI provider は Gemini に固定されています。`GEMINI_API_KEY` は任意ですが、未設定だと AI 提案が全部キーワード提案に縮退し、deploy の workflow が warning を出します。deploy は続行します[^infraclaude]。

## 1 度も成立していなかった AI 提案

2026-08-19、オーナーが本番の管理画面で AI 提案を 2 回実行し、CloudWatch のログを見ました。2 回とも同じ例外で、応答は 200 で `source: "fallback"` でした。

```text
ValidationException: Invocation of model ID anthropic.claude-haiku-4-5-20251001-v1:0
with on-demand throughput isn't supported. Retry your request with the ID or ARN
of an inference profile that contains this model.
```

プレミアムプランの差別化機能の筆頭として LP・pricing・FAQ の計 7 か所で訴求している「AI 自動提案」が、本番で 1 度も成立していませんでした。顧客にはキーワード規則の結果が「AI の提案」として返り、HTTP 200 なので失敗したことも分かりません[^issue4726]。

切り分けは表になっています。IAM は OK（AccessDenied ではなく ValidationException で、API に到達し検証まで進んでいる）。モデルアクセスも OK。env の配布も OK。原因はモデル ID の指定方法で、Claude Haiku 4.5 は base model ID の on-demand 呼び出しを受け付けず、inference profile の ID か ARN が必須でした[^issue4726]。

判断の経緯が興味深いところです。その 2 週間前の Issue は「`us.` の profile は us-east-2 や us-west-2 でも推論されうるので base model ID に固定する」と決めていました。子供の活動テキストを AWS の外に出さない、という privacy の目的からの判断です。しかし base model 固定はこの構成では原理的に 1 回も成立しません。オーナーの決裁で US geo の inference profile に戻しました。分散するのは推論処理であって保存先ではなく、米国内 3 リージョンはいずれも運営者の AWS アカウント内で、privacy の主目的は保たれます。米国外を含みうる `global.` の profile は、移転先国「米国」の開示が崩れるため採りません[^bedrock]。

もう 1 つの学びは「アラームが拾わない」ことでした。AI 不達の alarm は latch 型で、可用性クラスの失敗だけを見ていました。ValidationException は latch されず、丸一日以上 100% fallback のまま、発見はオーナーの手動実行でした。[第Ⅲ部-5](observability) で見た「件数と率」の alarm（15 分で失敗 2 件以上かつ 50% 以上）は、この事故のあとに足されました。

`agreementAvailability` の API も信用しません。同じモデル ID とリージョンで Converse が実際に成功する状態でも `NOT_AVAILABLE` を返した実績があり、「稼働判定は実呼び出しのみ」と provider のコメントに書かれています[^bedrock]。

![1 度も成立していなかった AI 提案](/images/ganbari-quest-design/ai-suggest.png)

## 子供の識別情報を外に出さない

2026 年 8 月、アバターの AI 生成機能が廃止されました。この機能は、子供のニックネームと年齢をそのまま prompt に埋めて Gemini（Google）に送る配線でした。プライバシーポリシー第 10 条「子供の識別情報は運営者の環境の外にある生成AIサービスには送信しません」と正面から食い違います。しかも動いていた実績がありませんでした。本番の Lambda に `GEMINI_API_KEY` が配布されておらず、押しても常にフォールバックの SVG が保存されていました。「未実証の機能を、開示に反する形で起動させようとしていた」状態で、直すのではなく無くしました。アバターは顧客が子供の写真を選んで設定するもので、AI が生成した画像で満足する体験は無い、というオーナーの判断です[^issue4397]。

廃止と同時に、外部の AI の SDK を import してよいファイルを allowlist で固定する fitness function が入りました。[第Ⅴ部-4](fitness-functions) で見た「顧客への約束をコードに置く」です。

Bedrock に送る内容も規律があります。子供の識別子を含まないリクエストだけを送り、「Bedrock は入力を保存しない」の一次情報は Issue の比較表に AWS 公式の引用として置き、provider のコメントは「ここで独自に断定しているのではない」と参照の形を取ります。前提が変わったら比較表と privacy の開示を併せて見直します[^bedrock]。

## 縮退する設計

AI が使えないときの縮退先は、キーワードの規則です。活動名に「サッカー」が含まれれば ⚽、「水泳」なら 🏊、カテゴリごとにアイコンの候補を持ちます。AI の提案と規則の提案は同じ `SuggestedActivity` の形を返し、`source` の field で `gemini` か `fallback` かを区別します[^suggest]。

レシートの OCR は、画像の上限が 5MB です。AWS の本番では、base64 の JSON body が Function URL の 6MB の上限を超えないよう、約 4.1MB に下方調整されます。この値は route の reject 判定と撮影ボタンの表示 MB を同一の定数から導出する SSOT です[^ocr]。

## 今ならこうする

「前面に出ない AI」は、製品の判断としても、運用の判断としても正しかったと考えています。チャット型の AI は滞在時間を伸ばし、[第Ⅰ部-2](anti-engagement) の原則に反します。縮退する設計は、AI が落ちても製品が落ちないことを保証しました。皮肉なことに、その保証が強すぎて、AI が 1 度も動いていないことを 1 か月以上隠しました。

「呼んでよい」と「呼べる」の区別は、生成AIに設定コードを書かせるときの一般則です。AI は既定値を置きたがり、既定値があれば動くと判断します。動くかどうかは呼ぶまで分かりません。isAvailable の契約は、その分からなさを型と文書で明示しました。

アバター生成の廃止は、機能を足す判断より、機能を消す判断の方が難しいことを示しています。動いていない機能、開示に反する機能を「直す」提案は AI からいくらでも出ます。「無くす」はオーナーにしかできませんでした。

[^provider]: AI provider の共通 interface。`isAvailable()` の契約（false は確定、true は設定の配布まで）、2 つのメソッド。出典: [src/lib/server/ai/provider.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/ai/provider.ts)

[^factory]: AI provider の factory。`AI_PROVIDER` の判定順と、env の schema と一致させる理由。出典: [src/lib/server/ai/factory.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/ai/factory.ts)

[^awsdesign]: AWSサーバレスアーキテクチャ設計書 §7.1 AI 推論基盤。モデル選定、US inference profile、IAM の Resource、選定理由 4 つ、使用箇所、環境変数。出典: [docs/design/13-AWSサーバレスアーキテクチャ設計書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/13-AWS%E3%82%B5%E3%83%BC%E3%83%90%E3%83%AC%E3%82%B9%E3%82%A2%E3%83%BC%E3%82%AD%E3%83%86%E3%82%AF%E3%83%81%E3%83%A3%E8%A8%AD%E8%A8%88%E6%9B%B8.md)

[^bedrock]: Bedrock Claude の provider 実装。既定モデル ID の扱い、US geo profile を既定にした経緯（オーナー決裁 2026-08-19）、privacy の一次情報の参照、`agreementAvailability` の誤判定。出典: [src/lib/server/ai/bedrock-claude-provider.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/ai/bedrock-claude-provider.ts)

[^infraclaude]: infra 配下の CLAUDE.md の必須 production env の表（`GEMINI_API_KEY` と NUC の縮退）。出典: [infra/CLAUDE.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/CLAUDE.md)

[^issue4726]: 本番 Bedrock が全リクエストで ValidationException になり AI 提案が 100% fallback だった Issue。症状、CloudWatch の実測、切り分けの表。出典: [Issue #4726](https://github.com/Takenori-Kusaka/ganbari-quest/issues/4726)

[^issue4397]: アバターの AI 生成機能を廃止した Issue。廃止の理由（オーナー判断）、動いていた実績が無いこと、プライバシーポリシーとの食い違い。出典: [Issue #4397](https://github.com/Takenori-Kusaka/ganbari-quest/issues/4397)

[^suggest]: 活動の提案 service。`SuggestedActivity` の形、カテゴリ別のアイコン候補、キーワードのマッピング。出典: [src/lib/server/services/activity-suggest-service.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/services/activity-suggest-service.ts)

[^ocr]: レシート OCR の service。画像の上限と Function URL の制約、system prompt。出典: [src/lib/server/services/receipt-ocr-service.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/services/receipt-ocr-service.ts)
