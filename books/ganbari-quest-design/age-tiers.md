---
title: "第Ⅰ部-3　5 つの年齢帯と「準備モード」 ― ひらがな override と機能の出し分け"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

3 歳の子供と 17 歳の子供が同じ画面を使うことはできません。この章では、がんばりクエストが年齢をどう区切り、区切りごとに何を変えて何を変えないと決めたかを扱います。あわせて、その決めをどう機械的に守っているかを見ます。年齢帯の設計は一見すると UI の話ですが、実際には「機能の差を作らない」というプロダクト方針と、「分岐を散らさない」というコードの規律が中心にあります。

## 4 つのコアモードと 1 つの準備モード

年齢帯の定義は 1 つのファイルに集約されています。年齢の範囲、タップ領域の大きさ、フォントの倍率が並びます[^agetier]。

```ts
// src/lib/domain/validation/age-tier.ts
export const AGE_TIER_CONFIG: Record<UiMode, { label: string; ageMin: number; ageMax: number; tapSize: number; fontScale: number }> = {
	baby: { label: AGE_TIER_LABELS.baby, ageMin: 0, ageMax: 2, tapSize: 120, fontScale: 1.5 },
	preschool: { label: AGE_TIER_LABELS.preschool, ageMin: 3, ageMax: 5, tapSize: 80, fontScale: 1.2 },
	elementary: { label: AGE_TIER_LABELS.elementary, ageMin: 6, ageMax: 12, tapSize: 56, fontScale: 1.0 },
	junior: { label: AGE_TIER_LABELS.junior, ageMin: 13, ageMax: 15, tapSize: 48, fontScale: 1.0 },
	senior: { label: AGE_TIER_LABELS.senior, ageMin: 16, ageMax: 18, tapSize: 44, fontScale: 1.0 },
};
```

| モード | 年齢 | タップ領域 | フォント倍率 | 文体 |
| --- | --- | --- | --- | --- |
| baby（準備モード） | 0〜2 歳 | 120px | 1.5 | 親向け |
| preschool（幼児） | 3〜5 歳 | 80px | 1.2 | ひらがなのみ |
| elementary（小学生） | 6〜12 歳 | 56px | 1.0 | ひらがな中心、漢字は最小限 |
| junior（中学生） | 13〜15 歳 | 48px | 1.0 | 漢字 |
| senior（高校生） | 16〜18 歳 | 44px | 1.0 | 漢字、情報密度が高い |

44px という最小値は Material Design が推奨するタップ領域の下限で、幼児向けにはその約 2 倍を確保しています。年齢から既定のモードを導く関数もこのファイルにあり、登録時に年齢だけを入れればモードが決まります。保護者が意図的に別のモードを選んだ場合はその選択が優先され、年齢が上がっても自動では切り替わりません[^agetier]。

## 0〜2 歳を「子供の画面」から外す

当初、年齢帯は 5 段階の「子供モード」として設計されていました。ADR-0011 はそのうち 0〜2 歳を子供向けゲーミフィケーションの対象から外し、「親の準備モード」に位置づけ直しました。理由は 3 つ挙げられています[^adr11]。

> 1. 多重アクション問題: 0-2 歳は食事・排泄・睡眠等の記録が主で、ぴよログ / ピジョンアプリ等既存育児記録アプリと記録軸が完全重複する。本プロダクトを開くこと自体が親の手間の重複になる
> 2. 電子機器露出問題: 0-2 歳に対する電子機器利用は医学的に推奨されない (WHO 推奨では 2 歳未満にスクリーンタイムゼロ)。子供がアプリを操作する前提のゲーミフィケーション UI を 0-2 歳に出すこと自体が本プロダクトのブランドに反する
> 3. daily engagement loop が成立しない: 0-2 歳は自律的にアプリを操作できず、親が代理入力する形になるため、本来のゲーミフィケーション効用 (達成感 / 自己効力感 / 継続動機) が子供に還元されない[^adr11]

一方で、0〜2 歳の子供を持つ親が登録したいというニーズは実在します。上の子が 4 歳で下の子が 1 歳という家庭をまとめて管理したい、祖父母からのお小遣いを事前にポイントとして積み立てたい、といったものです。このニーズを切り捨てると、上の子が対象年齢の家庭まで取り逃します。

ADR は 3 つの案を比較しています。既存の子供向け UI を薄く残す保守的な案は、医学的に推奨されない電子機器への露出を招き、前章の anti-engagement 原則に反するとして退けられました。baby モード自体を廃止して 3 歳に強制移行する急進的な案は、親の準備ニーズを満たせないため退けられました。採用されたのは、既存のルート内で baby を「成長待機画面 + 親による初期ポイント入力画面」に書き換える案です[^adr11]。

この決定の結果、LP からは「0 歳から使える」という訴求が消え、「3〜18 歳のお子さまに」が標準表現になりました。子供向け UI の品質を保証する対象は 5 モードから 4 モードに減り、E2E テストや Storybook の保守範囲も縮小しました[^adr11]。

## 機能の出し分けは 1 か所で決める

準備モードで何を出さないかは、各画面に散らさず 1 つの表で決めます。

```ts
// src/lib/domain/validation/age-tier.ts
export const AGE_TIER_CAPABILITIES: Record<UiMode, AgeTierCapabilities> = {
	// 準備モード: 親が記録の下ごしらえをする画面。ゲーミフィケーションは一切出さない
	baby: { rewardShop: false, stampCard: false, siblingRanking: false, battle: false },
	// battle は #1323 / #1491 の方針で preschool にも出さない (route も 404)
	preschool: { rewardShop: true, stampCard: true, siblingRanking: true, battle: false },
	elementary: { rewardShop: true, stampCard: true, siblingRanking: true, battle: true },
	junior: { rewardShop: true, stampCard: true, siblingRanking: true, battle: true },
	senior: { rewardShop: true, stampCard: true, siblingRanking: true, battle: true },
};
```

この表が生まれた経緯はコメントに残っています。判定を各画面の `if (uiMode === 'baby')` に散らしていたところ、ごほうびショップ、ヘッダーのスタンプ、きょうだいランキングの 1 か所だけが漏れました。そこで「追加する機能はここに 1 行足してから画面で参照する」という規律に変えました[^agetier]。判定関数は未知のモードを「持たない」側に倒します。新しいモードを足したときに表への追記を忘れると、機能が漏れ出すのではなく出なくなる、という安全側の設計です。

年齢帯を扱うコードには、7 つのアンチパターンが明文化されています。`if (uiMode === 'baby')` の散在、実行時の動的な漢字変換、機能フラグによる代替などです[^routesclaude]。この表はその第 1 項への回答です。

## ひらがなを基底にして漢字を重ねる

年齢帯で最も目に見える差は文体です。幼児モードはひらがなのみ、小学生モードはひらがな中心、中高生モードは漢字を使います。素朴に実装すると、文言のセットをひらがな版と漢字版の 2 つ持つことになります。がんばりクエストはこれを禁じ、「差分だけの override を基底に spread で重ねる」と決めています[^routesclaude]。

```ts
// labels.ts
const CHILD_SHOP_KANJI_OVERRIDES = { exchangeButton: '交換する' } as const satisfies Partial<ChildShopLabels>;

export function getChildShopLabels(uiMode: string): ChildShopLabels {
	const mode = normalizeUiMode(uiMode);
	if (mode === 'baby' || mode === 'preschool' || mode === 'elementary') return CHILD_SHOP_LABELS;
	return { ...CHILD_SHOP_LABELS, ...CHILD_SHOP_KANJI_OVERRIDES };
}
```

理由は単純で、全キーを 2 セット持つと、次に語を足した人が片方だけ更新して割れるからです。ひらがな側を基底にするのは、baby / preschool / elementary が既定であり、junior / senior だけが漢字の例外だからです[^routesclaude]。実行時にひらがなを漢字に変換する案は、変換精度の問題で退けられています。

もう 1 つの規律は、サーバに保存した表示文言をそのまま出さないことです。保存した値は 1 つの表記しか持てないため、文体を変えたあとも古い行が古い文体のまま残ります。週次チャレンジの理由文は、保存された構造値（生成モードとカテゴリ名）から表示時に再生成します[^routesclaude]。

## 文体の逸脱をテストで止める

この規律は、テストで守られています。実測では、幼児モードのシード活動名やチャレンジの理由文や 404 の本文に漢字が混入していました。逆に中高生モードのショップやステータス画面には幼児向けのひらがなも残っていました。テストの冒頭には、検査の設計思想が書かれています。

> 「今の値が正しいか」ではなく 禁止パターンの不在 を assert する。値の一致で書くと、次に文言を変えたときにテストだけ直して乖離が戻る。[^tonetest]

幼児モードに出る文字列は漢字を含まないこと、中高生モードの初回画面は漢字を含むことを、値の一致ではなく正規表現で検査します。文言を変えても、規律を破らない限りテストは通り続けます。

年齢帯にはもう 1 つ、見えにくい落とし穴がありました。3 つのデータベース実装（本番の Aurora DSQL・セルフホスト用の SQLite・デモ用のメモリ実装）は、年齢未指定時の既定モードをそれぞれ別の値にしていたのです。本番だけを「常に幼児」に固定しており、顧客の使う本番が最も壊れた状態のまま誰にも気づかれず残っていました[^parity]。対策は 2 段のテストです。3 つの実装に実際に子供を登録して既定値の一致を検査し、さらに各実装が年齢判定のリテラルを持たず単一の関数を経由していることを静的に検査します。検査に使う 10 個の年齢（0・2・3・5・6・12・13・15・16・18 歳）は、5 つの年齢帯すべての境界です[^parity]。

## 日本語の折り返し

年齢帯とは別に、日本語の見出しやボタンには折り返しの問題があります。日本語は空白で区切られないため、見出しが「かんじよみ / だいすき」のように不自然な位置で折れます。幼児モードのひらがな表記では特に目立ちます。

方針は 2 段です。第一選択は CSS で、見出しやボタンのラベルに `text-wrap: balance` と `word-break: auto-phrase` を当てます。追加のライブラリは要りません[^design]。LP 側では BudouX という日本語の分かち書きライブラリを CDN の Web Component として読み込み、追加バンドルなしで対応しています。tiny-segmenter は切れすぎ、kuromoji.js は辞書が 17MB、mecab は WASM の複雑さが理由で不採用でした[^adrreadme]。

正直に書くと、設計書にはアプリ側にも BudouX の Svelte action を用意すると記されていますが、この原稿の時点でその実装はリポジトリに存在しません。アプリ側は CSS のみで動いています。設計書が実装より先に走った例で、本書の後半で扱う「設計書は SSOT」の原則にとって、こうした乖離をどう検出するかが課題として残っています。

## 年齢で機能を変えない

最後に、年齢帯で「変えないこと」を確認します。年齢モードで変わるのは文体、タップ領域、フォント倍率、情報密度、そして準備モードと幼児モードでの一部機能の非表示です。それ以外の機能は 6 歳から 18 歳まで同一です。LP の内容設計書は、この事実から「中学生から使える専用機能」のような訴求を禁止しています[^lpmap]。

将来、中高生向けに差をつけるなら、それは振り返りやポートフォリオの軸であり、滞在時間を延ばす軸ではないと決められています。文部科学省のキャリア・パスポートに整合した長期目標や、子供が自分で開示範囲を決めるプライバシー設定などが候補です。その実装は PMF のあと、上の年齢帯の利用者が実在し、自分たちで使ってからという 3 条件がそろってから、と定めています[^lpmap]。年齢帯は製品を分岐させるためではなく、同じ製品を 15 年間使い続けられるようにするための仕組みです。

[^agetier]: 年齢帯の定義。`AGE_TIER_CONFIG`（年齢・タップ領域・フォント倍率）、`AGE_TIER_CAPABILITIES`（機能の出し分け SSOT とその経緯のコメント）、`hasAgeTierCapability`（未知のモードを安全側に倒す）、`getDefaultUiMode`、保護者による明示的な上書きの判定。出典: [src/lib/domain/validation/age-tier.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/domain/validation/age-tier.ts)

[^adr11]: ADR-0011「0-2 歳スコープ判断 — baby モードは『親の準備モード』として扱う」。3 つの構造的問題、実在するニーズ、3 案の比較、結果とトレードオフ。出典: [docs/decisions/0011-baby-mode-as-parent-preparation.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0011-baby-mode-as-parent-preparation.md)

[^routesclaude]: routes 配下の UI 実装ルール。年齢帯 variant の基本原則と 7 つのアンチパターン、「差分だけの override をベースに spread で重ねる」規律とコード例、保存済み文言を表示時に解決し直す規律、日本語テキスト折り返しの方針。出典: [src/routes/CLAUDE.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/routes/CLAUDE.md)

[^tonetest]: 年齢帯ごとの文体を機械検証するテスト。実測されていた乖離の一覧と「禁止パターンの不在を assert する」設計思想。出典: [tests/unit/domain/age-tier-tone-4690.test.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/domain/age-tier-tone-4690.test.ts)

[^parity]: 3 つのデータベース実装の既定モードが一致することを機械強制する fitness function。本番だけが `'preschool'` 固定で最も壊れていた経緯、挙動と由来の 2 段の検証。出典: [tests/unit/architecture/child-ui-mode-default-parity.test.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/child-ui-mode-default-parity.test.ts)

[^design]: デザインシステムの SSOT。§3「日本語テキスト折り返し」（CSS を第一選択、BudouX をフォールバック）、§8「年齢帯別 UI（4 コアモード + 準備モード）」。出典: [docs/DESIGN.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/DESIGN.md)

[^adrreadme]: ADR 一覧の「OSS 採用記録」。BudouX の採用理由と、tiny-segmenter / kuromoji.js / mecab の不採用理由。出典: [docs/decisions/README.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/README.md)

[^lpmap]: LP 内容設計書。「年齢差別化軸は UI 軸のみ」と、将来の上位年齢帯の差別化を振り返り・ポートフォリオ軸に限定し、PMF 後・上位利用者の実在・自家利用の 3 条件をゲートとする方針。出典: [docs/design/lp-content-map.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/lp-content-map.md)
