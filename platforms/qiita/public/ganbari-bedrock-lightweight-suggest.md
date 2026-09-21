---
title: "Bedrock の Claude Haiku と Gemini を 1 つの窓口で切り替える：「呼んでよい」と「呼べる」を分けた isAvailable の契約"
tags:
  - AWS
  - Bedrock
  - Claude
  - Gemini
  - TypeScript
private: true
updated_at: ''
id: null
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

:::note info
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。
:::

# はじめに

子供の活動を記録するアプリで、生成AIは画面の前面に出ません。活動の名前を入力すると分類とアイコンとポイントを推定する、レシートの写真から金額を読む。それだけで、失敗すればキーワードの規則に静かに縮退（fallback）します。AWS では Bedrock の Claude Haiku、家庭内サーバでは Gemini を、同じ窓口（interface）の裏で切り替えています。縮退があまりに静かだと、生成AIが本当に動いているのか誰にも分かりません。動いていない機能を動いていると思い込み続けないためには、何を用意すればよいのでしょうか。

「呼んでよい」と「呼べる」を分け、呼べるかどうかは実際に呼ぶまで確定しないと契約に書きます。部品は 3 つです。呼び出し先（provider）の抽象化、本番で 1 度も生成AIが成立していなかった事故から書き直した `isAvailable()` の契約、縮退先の規則です。

- 正本（Zenn の本『生成AIに実装を任せて商用サービスを作る』）: [AI 提案の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/ai-suggest)
- 実装: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)
- Bedrock: [公式ページ](https://aws.amazon.com/bedrock/)

# 技術選定理由: なぜ Bedrock と Haiku か

AWS 側で Bedrock を選んだ理由は 4 つです。Gemini はモデルの識別子の提供終了が頻繁で、追いかけるだけで運用の負担になる。すでに Lambda、Aurora DSQL、Cognito で組んでいる構成なら、Bedrock を足しても認証は IAM のままで済み、API の鍵を別に管理しなくてよい。Claude のツール呼び出しに JSON の形を渡せば、応答を手で読み取らずに決まった形の出力が得られる。活動の提案とレシートの文字読み取りには高度な推論が要らず、Haiku は最も安い部類に入る。

IAM で許す対象は全部を許す指定にせず、推論プロファイル（inference profile）の識別子 1 本と、それに含まれる 3 リージョンの基盤モデルの識別子（base model ID）に絞っています。2026 年 8 月の Bedrock の請求は、Haiku と Sonnet を合わせて $0.0006 でした。

# 1 つの窓口と 2 つの実装

呼び出す側が見るのは `AiProvider` だけです。テキストから決まった形の出力を返す関数と、画像の入力を伴う関数の 2 つです。Bedrock は `Converse` の API とツール呼び出し（`tool_use`）、Gemini は `generateContent` と JSON の読み取りで実装します。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/ai/provider.ts
export interface AiProvider {
	/** プロバイダー名（ログ用） */
	readonly name: string;

	/**
	 * AI を呼んでよいかを申告する。
	 *
	 * **契約 (#4366)**:
	 * - `false` は確定である。「呼んでも無駄」を意味し、呼び出し側はフォールバックしてよい。
	 * - `true` は **設定 (API キー / モデル ID) が配られている**ことまでしか保証しない。
	 *   権限やモデルアクセスの有無は実際に呼ぶまで確定しないため、ここでは判定できない。
	 *
	 * したがって呼び出し側は `isAvailable() === true` を成功の保証として扱ってはならず、
	 * 呼び出し失敗時の縮退を必ず持つこと。実装は可用性クラスの失敗を `availability.ts` の
	 * latch に記録し、以降の `isAvailable()` を `false` に倒す。
	 */
	isAvailable(): boolean;

	/**
	 * テキスト入力で構造化出力を取得する。
	 * Bedrock: Converse API + tool_use
	 * Gemini: generateContent + JSON パース
	 */
	converseWithTool(opts: {
		system: string;
		userMessage: string;
		tool: ToolDefinition;
		maxTokens?: number;
	}): Promise<ToolUseResult>;

	/**
	 * 画像入力付きで構造化出力を取得する。
	 * Bedrock: Converse API + image + tool_use
	 * Gemini: generateContent + inlineData + JSON パース
	 */
	converseWithImageAndTool(opts: {
		system: string;
		userText: string;
		imageBase64: string;
		imageMimeType: string;
		tool: ToolDefinition;
		maxTokens?: number;
	}): Promise<ToolUseResult>;
}
```

切り替えは環境変数 `AI_PROVIDER` で、既定は Bedrock です。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/ai/factory.ts
type ProviderType = 'bedrock' | 'gemini';

const providers: Record<ProviderType, AiProvider> = {
	bedrock: new BedrockClaudeProvider(),
	gemini: new GeminiProvider(),
};
// ...
export function getAiProvider(): AiProvider {
	const env = process.env.AI_PROVIDER;
	const type: ProviderType = env === 'gemini' || env === 'bedrock' ? env : 'bedrock';
	return providers[type];
}
```

切り替えの関数が受け付ける値の集合は、環境変数の検証定義が通す値の集合と揃えます。検証が通す値を切り替えの関数が扱わないと、設定は受理されたのに別の呼び出し先が動き、設定した本人が気づけません。

# 「呼んでよい」と「呼べる」を分ける

`isAvailable()` の契約は、事故のあとで書き直されました。`false` は確定で、呼んでも無駄なので呼び出し側は縮退してよい。`true` は「設定が配られている」ことまでしか保証しない。権限やモデルへのアクセスの有無は呼ぶまで確定しないので、`true` を成功の保証として扱わず、失敗したときの縮退を必ず持ちます。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/ai/bedrock-claude-provider.ts
	isAvailable(): boolean {
		if (process.env.BEDROCK_DISABLED === 'true') return false;
		// env の明示配布を要求する。未配布 = この環境では Bedrock を使わないと読む。
		if (!process.env.BEDROCK_MODEL_ID) return false;
		// 権限・資格情報の欠落で既に落ちている provider は、以降呼びに行かない。
		if (isProviderLatchedUnavailable(this.name)) return false;
		return true;
	}
```

要点は `BEDROCK_MODEL_ID` の明示的な配布を要求することです。以前の実装はモデルの識別子の既定値を持ち、既定値があることを根拠に `true` を返していました。既定値があっても「設定が配られている」ことにはならず、「AWS で Bedrock を使うと決めた」ことと「まだ何も配線していない」ことが区別できません。使えない種類の失敗（権限や資格情報の欠落）は、一度記録したら人が戻すまで戻らない印（latch）に記録し、以降は呼びに行きません。

印の実体と、どの失敗を印に記録するかの分類は [`src/lib/server/ai/availability.ts`](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/ai/availability.ts) にあります。

# 本番で 1 度も成立していなかった AI 提案

本番の管理画面で AI に提案させて CloudWatch のログを見ると、応答は 200、出どころが `fallback`、例外が毎回同じでした。

```text
ValidationException: Invocation of model ID anthropic.claude-haiku-4-5-20251001-v1:0
with on-demand throughput isn't supported. Retry your request with the ID or ARN
of an inference profile that contains this model.
```

切り分けると、IAM は白です。返ったのが権限の拒否ではなく検証の例外なので、要求は API に届いて検証まで進んでいます。モデルへのアクセスの許可と環境変数の配布も白でした。黒だったのはモデルの指定の仕方です。Claude Haiku 4.5 は基盤モデルの識別子でのオンデマンド呼び出しを受け付けず、推論プロファイルの識別子が必須です。縮退する設計が強すぎて、応答は 200 で規則の結果が返り続け、生成AIが動いていないことが 1 か月以上見えませんでした。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/ai/bedrock-claude-provider.ts
const DEFAULT_MODEL_ID = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

/**
 * 呼び出しごとに env を読む。module 読込時に固定すると、テストからも運用からも
 * 「配られていない」状態を再現できなくなる (#4366 の検出が遅れた一因)。
 */
function resolveModelId(): string {
	return process.env.BEDROCK_MODEL_ID || DEFAULT_MODEL_ID;
}
```

既定値は米国の推論プロファイル（識別子が `us.` で始まるもの）に変えました。呼べない識別子を既定値に残すと同じ穴を再生産するからです。`us.` のプロファイルは米国内の複数のリージョンで推論されえますが、複数のリージョンに散るのは推論の処理だけで保存先ではなく、どのリージョンも運営者の AWS アカウントの中です。米国外を含みうる全世界のプロファイル（`global.`）は採りません。プライバシーポリシーで、データの移転先の国を米国と開示しているからです。

もう 1 つの学びは、モデルの利用合意の状態を返す Bedrock の API（`get-foundation-model-availability` の `agreementAvailability`）を信用しないことです。同じモデルの識別子とリージョンで実際の呼び出しが成功する状態でも「利用不可」を返した実績があり、静的な根拠だけで「Bedrock が未有効化」と結論づけると誤検出になります。稼働しているかは、実際に呼んだ結果だけで判定します。

# 縮退先はキーワードの規則

生成AIが使えないときの縮退先は、キーワードの規則です。生成AIの提案と規則の提案は同じ形で返り、出どころの項目 `source` で区別します。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/services/activity-suggest-service.ts
/** キーワード→アイコンの詳細マッピング */
const KEYWORD_ICONS: Record<string, string> = {
	サッカー: '⚽',
	さっかー: '⚽',
	野球: '⚾',
	やきゅう: '⚾',
	水泳: '🏊',
	すいえい: '🏊',
	プール: '🏊',
	自転車: '🚴',
// ...
	// キーワード別アイコンを探す
	let icon = CATEGORY_ICONS[best.categoryName]?.[0] ?? '📝';
	for (const [kw, ic] of Object.entries(KEYWORD_ICONS)) {
		if (lower.includes(kw.toLowerCase())) {
			icon = ic;
			break;
		}
	}
// ...
	return {
		name: text.slice(0, 50),
		categoryId: best.categoryId,
		icon,
		basePoints: points,
		...inferNames(text),
		source: 'fallback',
	};
}
```

規則は活動名の部分一致で分類を採点し、最も高い分類の先頭のアイコンを既定にしてからキーワード別のアイコンで上書きします。習い事系の語が含まれればポイントを上げます。生成AIが落ちても製品は落ちません。ただしその保証が、生成AIの不作動を隠します。縮退の率を見る警報（CloudWatch アラーム。15 分で失敗 2 件以上かつ 50% 以上）は、この事故のあとに足しました。

警報はログの失敗と成功の件数から率を出す CloudWatch の式で、定義は [`infra/lib/ops-stack.ts`](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/lib/ops-stack.ts#L586-L613) にあります。

# 子供の識別情報を外に出さない

Bedrock に送るのは子供の識別子を含まない内容だけです。この約束を法務文書だけに置かず、外部の生成AIのライブラリを読み込んでよいファイルを許可一覧（allowlist）が固定する走査テストとして、コードの側でも表明しています。新しいファイルがライブラリを掴んだ時点でテストが落ち、「送る内容に子供の識別情報が入っていないか」を人が判断する契機になります。

許可一覧と走査の本体は [`tests/unit/architecture/external-ai-client-boundary.test.ts`](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/external-ai-client-boundary.test.ts) にあります。

# まとめ

- 呼び出し先の差は窓口の裏に閉じます。切り替えは環境変数の値で行い、切り替えの関数が受け付ける値は環境変数の検証定義と一致させます
- `isAvailable()` は「設定が配られているか」だけを申告し、`true` を成功の保証にしません。既定値を使えることの根拠にしません
- Claude Haiku 4.5 は基盤モデルの識別子でのオンデマンド呼び出しを受け付けず、推論プロファイルが必須です。呼べない識別子を既定値に残しません
- 稼働の判定は実際の呼び出しだけで、利用合意の状態や環境変数の一覧のような静的な根拠で結論づけません
- 縮退は製品を守りますが、不作動を隠します。縮退の率を監視します

権限と環境変数は正しく配られ、モデルの識別子も配られていました。ただしその識別子は、オンデマンドでは呼べない種類でした。値が配られていることと、その値で本当に呼べることは別の事実で、テストもそれぞれに要ります。この考え方は、[Zenn の本の終盤の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/principles)にまとめました。

動いているサービス: [がんばりクエスト](https://www.ganbari-quest.com/)
