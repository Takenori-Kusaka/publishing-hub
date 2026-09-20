---
title: "第Ⅰ部-3　5 つの年齢帯と「準備モード」 ― ひらがなを基底に漢字を重ねる"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

3 歳の子供と 17 歳の子供が同じ画面を使うことはできません。ボタンの大きさも、文字の種類も、画面に載せる情報の量も違います。年齢をどう区切り、区切りごとに何を変え、何を変えないと決めるのでしょうか。そして、その決めを 5 つの年齢帯の画面すべてに守らせ続けるには、どうすればよいのでしょうか。

変えるのは画面だけで、機能は変えません。年齢帯の定義と機能の出し分けは 1 つのファイルに集め、文言はひらがなを基底にして漢字の差分を重ね、逸脱は「禁止パターンが無いこと」を検査するテストで止めます。

## 中心となる 4 つのモードと 1 つの準備モード

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
| 準備モード（`baby`） | 0〜2 歳 | 120px | 1.5 | 親向け |
| 幼児（`preschool`） | 3〜5 歳 | 80px | 1.2 | ひらがなのみ |
| 小学生（`elementary`） | 6〜12 歳 | 56px | 1.0 | ひらがな中心、漢字は最小限 |
| 中学生（`junior`） | 13〜15 歳 | 48px | 1.0 | 漢字 |
| 高校生（`senior`） | 16〜18 歳 | 44px | 1.0 | 漢字、情報の密度が高い |

44px という最小値は、Google のデザイン指針 Material Design が推奨するタップ領域の下限で、幼児向けにはその約 2 倍を確保しています。年齢から既定のモードを導く関数もこのファイルにあり、登録時に年齢だけを入れればモードが決まります。保護者が意図的に別のモードを選んだ場合はその選択が優先され、年齢が上がっても自動では切り替わりません[^agetier]。

## 0〜2 歳を「子供の画面」から外す

当初、年齢帯は 5 段階の「子供モード」として設計されていました。設計判断の記録は、そのうち 0〜2 歳を子供向けのゲーム風の画面の対象から外し、「親の準備モード」に位置づけ直しました。理由は 3 つです[^adr11]。

1. 記録の重複。0〜2 歳は食事・排泄・睡眠の記録が主で、ぴよログやピジョンのアプリのような既存の育児記録アプリと記録の軸が完全に重なる。この製品を開くこと自体が親の手間の重複になる
2. 画面への露出。世界保健機関は 2 歳未満の画面の利用をゼロと推奨しており、子供がアプリを操作する前提の画面を 0〜2 歳に出すこと自体がこの製品のブランドに反する
3. 毎日の輪が成り立たない。0〜2 歳は自分でアプリを操作できず、親が代理で入力する形になるため、達成感や自己効力感や継続の動機が子供に還元されない

一方で、0〜2 歳の子供を持つ親が登録したいという要望は実在します。上の子が 4 歳で下の子が 1 歳という家庭をまとめて管理したい、祖父母からのお小遣いを事前にポイントとして積み立てたい、といったものです。この要望を切り捨てると、上の子が対象年齢の家庭まで取り逃します。

設計判断の記録は 3 つの案を比較しています。既存の子供向けの画面を薄く残す保守的な案は、医学的に推奨されない画面への露出を招き、前章の原則に反するとして退けられました。準備モード自体を廃止して 3 歳に強制移行する急進的な案は、親の準備の要望を満たせないため退けられました。採用されたのは、既存の経路の中で 0〜2 歳を「成長を待つ画面 + 親による初期ポイントの入力画面」に書き換える案です[^adr11]。

この決定の結果、紹介ページからは「0 歳から使える」という訴求が消え、「3〜18 歳のお子さまに」が標準の表現になりました。子供向けの画面の品質を保証する対象は 5 モードから 4 モードに減り、画面操作テストや Storybook の保守範囲も縮小しました[^adr11]。

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

**狙い。** 準備モードにはごほうびショップやスタンプなどのゲーム風の要素を出さない、という方針でした。

**起きたこと。** 判定を各画面の `if (uiMode === 'baby')` に散らしていたところ、ごほうびショップ、ヘッダーのスタンプ、きょうだいランキングの 1 か所だけが漏れました[^agetier]。

**なぜ。** 出し分けの判断が画面の数だけ複製されていたからです。複製が 1 つ増えるたびに、漏れる場所が 1 つ増えます。

**変えたこと。** 出し分けを上の表に集め、「追加する機能はここに 1 行足してから画面で参照する」という決まりにしました[^agetier]。判定関数は未知のモードを「持たない」側に倒します。新しいモードを足したときに表への追記を忘れると、機能が漏れ出すのではなく出なくなる、という安全側の設計です。

**読者のリポジトリでは。** 同じ条件分岐が 3 か所に現れたら、条件を表にして 1 か所に置いてください。分岐の複製は、漏れの数の予告です。

年齢帯を扱うコードには、7 つのアンチパターンが明文化されています。上の分岐の散在、実行時の動的な漢字変換、機能フラグによる代替などです[^routesclaude]。この表はその 1 つ目への回答です。

## ひらがなを基底にして漢字を重ねる

年齢帯で最も目に見える差は文体です。幼児モードはひらがなのみ、小学生モードはひらがな中心、中高生モードは漢字を使います。素朴に実装すると、文言のセットをひらがな版と漢字版の 2 つ持つことになります。がんばりクエストはこれを禁じ、差分だけの上書きをひらがなの基底に重ねる、と決めています[^routesclaude]。

```ts
// labels.ts
const CHILD_SHOP_KANJI_OVERRIDES = { exchangeButton: '交換する' } as const satisfies Partial<ChildShopLabels>;

export function getChildShopLabels(uiMode: string): ChildShopLabels {
	const mode = normalizeUiMode(uiMode);
	if (mode === 'baby' || mode === 'preschool' || mode === 'elementary') return CHILD_SHOP_LABELS;
	return { ...CHILD_SHOP_LABELS, ...CHILD_SHOP_KANJI_OVERRIDES };
}
```

理由は単純で、全項目を 2 セット持つと、次に語を足した人が片方だけ更新して割れるからです。ひらがな側を基底にするのは、準備・幼児・小学生が既定であり、中学生と高校生だけが漢字の例外だからです[^routesclaude]。実行時にひらがなを漢字に変換する案は、変換の精度の問題で退けられています。

もう 1 つの決まりは、サーバに保存した表示文言をそのまま出さないことです。保存した値は 1 つの表記しか持てないため、文体を変えたあとも古い行が古い文体のまま残ります。週次チャレンジの理由文は、保存された構造の値（生成の方式とカテゴリ名）から表示のたびに再生成します[^routesclaude]。

## 文体の逸脱をテストで止める

この決まりは、テストで守られています。実測では、幼児モードの初期の活動名やチャレンジの理由文や 404 の本文に漢字が混入していました。逆に中高生モードのショップやステータス画面には幼児向けのひらがなも残っていました。テストの冒頭には検査の設計思想が書かれています。「今の値が正しいか」ではなく、禁止パターンが無いことを検査する。値の一致で書くと、次に文言を変えたときにテストだけを直して乖離が戻るからです[^tonetest]。

幼児モードに出る文字列は漢字を含まないこと、中高生モードの初回の画面は漢字を含むことを、値の一致ではなく正規表現で検査します。文言を変えても、決まりを破らない限りテストは通り続けます。

年齢帯にはもう 1 つ、見えにくい落とし穴がありました。

**狙い。** 年齢が未指定のときの既定のモードは、どのデータベースの実装でも同じ、という前提でした。

**起きたこと。** 3 つのデータベースの実装（本番の Aurora DSQL・セルフホスト用の SQLite・デモ用のメモリ実装）は、既定のモードをそれぞれ別の値にしていました。本番だけを「常に幼児」に固定しており、顧客の使う本番が最も壊れた状態のまま誰にも気づかれず残っていました[^parity]。

**なぜ。** 既定値が実装ごとに書かれていて、共通の関数を経由していなかったからです。手元の実装で動けば、本番の差異は誰の目にも入りません。

**変えたこと。** 対策は 2 段のテストです。3 つの実装に実際に子供を登録して既定値の一致を検査し、さらに各実装が年齢判定の値を直接持たず単一の関数を経由していることを静的に検査します。検査に使う 10 個の年齢（0・2・3・5・6・12・13・15・16・18 歳）は、5 つの年齢帯すべての境界です[^parity]。

**読者のリポジトリでは。** データベースの実装が複数あるなら、既定値の一致を実装間で検査してください。「手元では動く」は、本番の既定値が違うことを教えてくれません。

## 日本語の折り返し

年齢帯とは別に、日本語の見出しやボタンには折り返しの問題があります。日本語は空白で区切られないため、見出しが「かんじよみ / だいすき」のように不自然な位置で折れます。幼児モードのひらがな表記では特に目立ちます。

方針は 2 段です。第一の選択は CSS で、見出しやボタンのラベルに `text-wrap: balance` と `word-break: auto-phrase` を当てます。追加のライブラリは要りません[^design]。紹介ページ側では BudouX という日本語の分かち書きライブラリを配信網（CDN）から読み込む部品として使い、追加のバンドルなしで対応しています。tiny-segmenter は切れすぎ、kuromoji.js は辞書が 17MB、mecab はブラウザで動かすための移植（WebAssembly）の複雑さが理由で不採用でした[^adrreadme]。

設計書にはアプリ側にも BudouX の Svelte 向けの部品を用意すると記されていますが、この原稿の時点でその実装はリポジトリに存在しません。アプリ側は CSS のみで動いています。設計書が実装より先に走った例で、こうした乖離を検出する仕組みは無く、レビューで見つけるしかありません。

## 年齢で機能を変えない

最後に、年齢帯で「変えないこと」を確認します。年齢モードで変わるのは文体、タップ領域、フォント倍率、情報の密度、そして準備モードと幼児モードでの一部機能の非表示です。それ以外の機能は 6 歳から 18 歳まで同一です。紹介ページの内容設計書は、この事実から「中学生から使える専用機能」のような訴求を禁止しています[^lpmap]。

将来、中高生向けに差をつけるなら、それは振り返りやポートフォリオの軸であり、滞在時間を延ばす軸ではないと決められています。文部科学省のキャリア・パスポートに整合した長期の目標や、子供が自分で開示の範囲を決めるプライバシー設定などが候補です。その実装は、製品が市場に受け入れられたあと、上の年齢帯の利用者が実在し、自分たちで使ってからという 3 条件がそろってから、と定めています[^lpmap]。年齢帯は製品を分岐させるためではなく、同じ製品を 15 年間使い続けられるようにするための仕組みです。

## 持ち帰るもの

- 年齢や役割で変えるのは画面だけにし、機能の差は作らない。差を作った瞬間に、検証すべき組み合わせが倍になる
- 出し分けの条件は表にして 1 か所に置き、未知の値は「出さない」側に倒す
- 文言の変種は、基底に差分を重ねる形で持つ。2 セット持つと、次に語を足した人が片方だけ直す

次の章では、記録がポイントになり、ポイントがごほうびになるまでの経済を、増殖した仕掛けをどう削ったかとあわせて見ます。

[^agetier]: 年齢帯の定義。`AGE_TIER_CONFIG`（年齢・タップ領域・フォント倍率）、`AGE_TIER_CAPABILITIES`（機能の出し分けの正本とその経緯のコメント）、`hasAgeTierCapability`（未知のモードを安全側に倒す）、`getDefaultUiMode`、保護者による明示的な上書きの判定。出典: [src/lib/domain/validation/age-tier.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/domain/validation/age-tier.ts)

[^adr11]: 0〜2 歳の準備モードの設計判断の記録（ADR-0011）。3 つの構造的な問題、実在する要望、3 案の比較、結果とトレードオフ。出典: [docs/decisions/0011-baby-mode-as-parent-preparation.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0011-baby-mode-as-parent-preparation.md)

[^routesclaude]: 画面実装の規則。年齢帯の変種の基本原則と 7 つのアンチパターン、差分だけの上書きを基底に重ねる決まりとコード例、保存済みの文言を表示時に解決し直す決まり、日本語テキストの折り返しの方針。出典: [src/routes/CLAUDE.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/routes/CLAUDE.md)

[^tonetest]: 年齢帯ごとの文体を機械で検証するテスト。実測されていた乖離の一覧と「禁止パターンの不在を検査する」設計思想。出典: [tests/unit/domain/age-tier-tone-4690.test.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/domain/age-tier-tone-4690.test.ts)

[^parity]: 3 つのデータベースの実装の既定モードが一致することを機械で強制する契約テスト。本番だけが `'preschool'` 固定で最も壊れていた経緯、挙動と由来の 2 段の検証。出典: [tests/unit/architecture/child-ui-mode-default-parity.test.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/child-ui-mode-default-parity.test.ts)

[^design]: デザインシステムの正本。日本語テキストの折り返し（CSS を第一の選択、BudouX を代替）、年齢帯別の画面（中心となる 4 つのモード + 準備モード）。出典: [docs/DESIGN.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/DESIGN.md)

[^adrreadme]: 設計判断の記録の一覧にある「OSS 採用記録」。BudouX の採用理由と、tiny-segmenter / kuromoji.js / mecab の不採用理由。出典: [docs/decisions/README.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/README.md)

[^lpmap]: 紹介ページの内容設計書。「年齢差別化軸は UI 軸のみ」と、将来の上位の年齢帯の差別化を振り返り・ポートフォリオの軸に限定し、市場に受け入れられたあと・上位の利用者の実在・自家利用の 3 条件を関門とする方針。出典: [docs/design/lp-content-map.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/lp-content-map.md)
