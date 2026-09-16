---
title: "Bedrock の Claude Haiku と Gemini を 1 つの interface で切り替える：「呼んでよい」と「呼べる」を分けた isAvailable の契約"
tags:
  - AWS
  - Bedrock
  - Claude
  - Gemini
  - TypeScript
private: true
updated_at: ''
---

:::note info
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。使ったツールと用途は、末尾の「生成AIの利用について」に書いています。
:::

# はじめに

子供の活動を記録するアプリで、生成AIは画面の前面に出ません。活動の名前を入力するとカテゴリとアイコンとポイントを推定する、レシートの写真から金額を読む。それだけで、失敗すればキーワードの規則に静かに縮退します。AWS では Bedrock の Claude Haiku、家庭内サーバでは Gemini を、同じ interface の裏で切り替えています。

この記事では 3 つをコードとともにまとめます。provider の抽象化、本番で 1 度も AI が成立していなかった事故から書き直した `isAvailable()` の契約、そして縮退先の規則です。privacy の判断や事故の経緯は正本に書きました。

- 正本（Zenn Books『生成AIに実装を任せて商用サービスを作る』）: [AI 提案の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/ai-suggest)
- 実装: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)
- Amazon Bedrock: [公式ページ](https://aws.amazon.com/bedrock/)

# 技術選定: なぜ Bedrock と Haiku か

AWS 側で Bedrock を選んだ理由は 4 つです。Gemini のモデル ID は頻繁に EoL になり、追従が運用の負荷になる。Lambda・DSQL・Cognito の構成へ Bedrock を足すと IAM ベースの認証に統一でき、API key の管理が要らない。Claude の tool_use で JSON Schema を定義すれば、手動のパースなしに構造化出力が得られる。活動の提案とレシートの OCR に高度な推論は不要で、Haiku は最安クラス。

IAM の Resource は `*` にせず、inference profile の ARN 1 本と member リージョンの foundation-model の ARN に絞っています。1 か月の Bedrock の請求は、Haiku と Sonnet を合わせて $0.0006 でした。

# 1 つの interface と 2 つの実装

呼び出す側が見るのは `AiProvider` だけです。テキストから構造化出力を返す method と、画像入力を伴う method の 2 つです。Bedrock は Converse API と tool_use、Gemini は generateContent と JSON のパースで実装します。

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

factory が受理する値は、env の schema と一致させます。schema が通す値を factory が処理しないと、設定が受理されたのに別の provider が動き、設定した本人が気づけません。

# 「呼んでよい」と「呼べる」を分ける

`isAvailable()` の契約は、事故のあとで書き直されました。`false` は確定で、呼んでも無駄なので呼び出し側はフォールバックしてよい。`true` は「設定が配られている」ことまでしか保証しない。権限やモデルアクセスの有無は呼ぶまで確定しないので、`true` を成功の保証として扱わず、失敗時の縮退を必ず持ちます。

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

要点は `BEDROCK_MODEL_ID` の明示的な配布を要求することです。以前の実装はモデル ID の既定値を持ち、既定値があることを根拠に `true` を返していました。既定値があっても「設定が配られている」ことにはならず、「AWS で Bedrock を使うと決めた」ことと「まだ何も配線していない」ことが区別できません。可用性クラスの失敗（権限や資格情報の欠落）は latch に記録し、以降は呼びに行きません。

# 本番で 1 度も成立していなかった AI 提案

本番の管理画面で AI に提案させて CloudWatch のログを見ると、応答は 200 で `source: "fallback"`、例外は毎回同じでした。

```text
ValidationException: Invocation of model ID anthropic.claude-haiku-4-5-20251001-v1:0
with on-demand throughput isn't supported. Retry your request with the ID or ARN
of an inference profile that contains this model.
```

IAM は OK（AccessDenied ではなく ValidationException なので、API に到達し検証まで進んでいる）。モデルアクセスも env の配布も OK。原因はモデル ID の指定方法で、Claude Haiku 4.5 は base model ID の on-demand 呼び出しを受け付けず、inference profile の ID か ARN が必須でした。縮退する設計が強すぎて、HTTP 200 で規則の結果が返り続け、AI が動いていないことが 1 か月以上見えませんでした。

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

既定値は `us.` の inference profile に変えました。呼べない ID を既定値に残すと同じ罠を再生産するからです。`us.` の profile は米国内の複数リージョンで推論されえますが、分散するのは推論処理であって保存先ではなく、いずれも運営者の AWS アカウント内です。米国外を含みうる `global.` の profile は、privacy の開示で移転先国を「米国」としている前提が崩れるため採りません。

もう 1 つの学びは、`aws bedrock get-foundation-model-availability` の `agreementAvailability` を信用しないことです。同じモデル ID とリージョンで Converse が実際に成功する状態でも `NOT_AVAILABLE` を返した実績があり、静的な根拠だけで「Bedrock が未有効化」と結論づけると誤検出になります。稼働の判定は実呼び出しだけです。

# 縮退先はキーワードの規則

AI が使えないときの縮退先は、キーワードの規則です。AI の提案と規則の提案は同じ型を返し、`source` の field で区別します。

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

規則は活動名の部分一致でカテゴリを採点し、最も高いカテゴリの先頭アイコンを既定にしてからキーワード別のアイコンで上書きします。習い事系の語が含まれればポイントを上げます。AI が落ちても製品は落ちません。ただしその保証が、AI の不作動を隠します。縮退の率を alarm にする（15 分で失敗 2 件以上かつ 50% 以上）のは、この事故のあとに足しました。

# 子供の識別情報を外に出さない

Bedrock に送るのは子供の識別子を含まない内容だけです。この約束は法務文書にだけ書くのではなく、外部の AI の SDK を import してよいファイルを allowlist で固定する走査テストでコードに置いています。新しいファイルが SDK を掴んだ時点でテストが落ち、「その payload に子供の識別情報が入っていないか」を人が判断する契機になります。

# まとめ

- provider の差は interface の裏に閉じ、切り替えは env で行います。factory が受理する値は env の schema と一致させます
- `isAvailable()` は「設定が配られているか」だけを申告し、`true` を成功の保証にしません。既定値を可用性の根拠にしません
- Claude Haiku 4.5 は base model ID の on-demand を受け付けず、inference profile が必須です。呼べない ID を既定値に残しません
- 稼働の判定は実呼び出しだけで、`agreementAvailability` や env の一覧のような静的根拠で結論づけません
- 縮退は製品を守りますが、不作動を隠します。縮退の率を監視します

# 生成AIの利用について

この記事の作成には、生成AIの Claude（Anthropic の Claude Fable 5.1）を使いました。正本の該当章からの構成の検討、本文の下書きと改稿、コードの抜粋の照合、校正に使っています。筆者が内容を確認し、必要に応じて修正しました。公開した内容の責任は筆者が負います。
