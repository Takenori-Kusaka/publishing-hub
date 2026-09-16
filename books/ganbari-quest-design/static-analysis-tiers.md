---
title: "第Ⅴ部-2　静的解析の階層 ― 実行頻度で設計し、自作ルールで規約を守る"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

静的解析のツールは、導入すれば品質が上がるように見えます。がんばりクエストでは 7 本のツールの導入 Issue が並行して起票され、そのまま全部を PR ごとに走らせようとしていました。この章では、ツールを実行頻度で階層化した判断と、リポジトリ固有の規約を守るために自作した検査、そして既存の違反を凍結して新規だけを止める ratchet の運用を扱います。

## 頻度設計こそが品質戦略

ADR-0007 のコンテキストは、7 本のツールが並んだ状況をこう診断しています。

> 根本原因: 「ツールを導入すれば品質が上がる」という発想のまま 7 本並べ、実行頻度 × blast radius の組合せを設計していない。CI 時間は無尽蔵ではないので、頻度設計こそが品質戦略である。[^adr07]

4 階層の定義は[第Ⅳ部-8](platform-session) で見ました。T1 は 30 秒未満で merge されたら致命的なもの、T2 は 30 秒から 3 分で誤検知があっても merge の判断は人間、T3 は nightly か週次、T4 は四半期か手動です。T1 の合計予算は 3 分、新しいツールは 1 本 30 秒以下が目安です[^adr07]。

新しいツールを入れるときの判断フローも書かれています。実行時間が 30 秒未満なら「merge されたら直ちに本番に影響するか」を問い、YES なら T1、NO なら T3 の負債検知へ。30 秒から 3 分なら T2。3 分以上なら T3 か T4 に確定します。

required（merge を止める）にする実装点は 1 か所です。GitHub の branch ruleset は `ci-gate` という単一の job だけを required にし、個別の job が merge を止めるかどうかは `ci-gate` の `needs:` に登録されているかで決まります。ruleset を触らずに済み、gating policy の変更が PR の diff に現れます[^adr07]。

## 階層の実体

| 検査 | 階層 | 何を守るか |
| --- | --- | --- |
| Biome（lint と整形）、stylelint | T1 | 書式、hex カラーの直書き |
| svelte-check（CI は warning も fail） | T1 | 型 |
| ESLint Svelte（recommended + 自作ルール） | T1 | Runes の誤用、日本語の直書き、インラインスタイル |
| ESLint type-aware（`no-floating-promises` など） | T1（CI 限定） | Promise の取りこぼし |
| type-coverage 97% 以上 | T1 | `any` の蔓延 |
| dependency-cruiser | T2 | import の境界、循環依存、孤立モジュール |
| Playwright E2E、cfn-lint | T2 | 振る舞い、CDK テンプレート |
| jscpd、cspell 広域 | T3 | 重複、綴り |

type-aware の lint が CI 限定なのは、型情報を要するルールをローカルの設定に載せると、開発中の lint 全体が型プログラムを読み込んで遅くなるからです。`no-floating-promises` と `no-misused-promises` だけを分離した設定に隔離し、CI の専用 step で走らせます[^typed]。

dependency-cruiser は、CLAUDE.md の散文の構造ルールを AST の依存解決で宣言的に encode するために入りました。「routes から DB に直接アクセスしない」「`+server.ts` から ORM を直接呼ばない」に加え、既存の vitest では捕捉していなかった循環依存（error）と孤立モジュール（warn）を閉じます[^depcruise]。責務は import の境界に限定し、値域やテナントの述語のような domain の論理を持つ検査は vitest に残す、と線を引いています。

## 自作した 6 本のルール

汎用のツールでは守れない規約は、ESLint のプラグインとして自作しています。routes 配下の Svelte ファイルには 6 本が適用されます[^eslintconfig]。

| ルール | 守るもの |
| --- | --- |
| `no-hardcoded-jp-text` | テンプレートの日本語直書き。`labels.ts` の定数を使わせる |
| `no-style-attribute` | インラインスタイル（動的な値以外） |
| `no-tailwind-arbitrary-hex` | Tailwind の任意 hex 値 |
| `no-raw-button` | `<button>` の直書き。primitive の `Button` を使わせる |
| `max-style-lines` | `<style>` ブロック 50 行超え |
| `max-svelte-lines` | コンポーネント 500 行超え（warn） |

`no-hardcoded-jp-text` は、第Ⅰ部で見た用語辞書の SSOT を守るルールです。ひらがな、カタカナ、漢字がテンプレートに直接現れると、`labels.ts` の定数を使えと指摘します。対象は Svelte のテンプレートと一部の属性だけで、`<script>` ブロックと `.ts` ファイルは対象外です。ルールの冒頭に「those stay a review concern」、そこはレビューの責任だと明記されています[^jptext]。かつては件数を数える ratchet のスクリプトもありました。しかし 1 違反ごとに落とすルールのほうが直感的で漏れもないため、スクリプトは削除されました。

## 列挙をやめて class から定義する

[第Ⅰ部-4](point-economy) で見たタイムゾーンの不具合を止める検査には、設計の転換があります。

> 初版は検出対象を `getFullYear` / `getMonth` / `getDate` / `getDay` の 4 語の列挙で定義していた。列挙は「今知っている書き方」しか塞げないため、同じ欠陥クラスに属する別の書き方がそのまま残った (#4127 の実測):
>   - `recordedAt.getHours()`        → 列挙に無い getter。はやおきボーナスが UTC で 9h ずれる
>   - `new Date().toISOString().slice(0,10)` → getter を 1 つも使わずに UTC の暦日を作る。
>   - `toLocaleDateString('ja-JP')`  → 表示側の暦日をプロセス TZ (SSR 時は Lambda=UTC) で決める[^tzgetter]

初版は 7 か所を素通ししました。転換後は、`Date.prototype` の全メンバーを走査し、タイムゾーンに依存しないと言い切れるもの（`getUTC*`、`getTime`、`toISOString` など）を SAFE として列挙し、それ以外をすべて依存と扱います。`Date.prototype` は言語仕様で閉じた有限集合なので、これは記法の列挙ではなく class の表明になります。分類の網羅は自己検査され、将来メンバーが増えたら落ちます[^tzgetter]。

さらに、値が正しくても落とす規則があります。

> いずれも値は正しい。正しいまま SSOT が複数あることが欠陥であり、次に暦の規則を変える人が全部を直せない。そこで「`Date` から暦要素 (年 / 月 / 日 / 曜日 / 時) を取り出す・組み立てる計算は `date-utils.ts` の中だけ」を不変条件とし、外に出た時点で落とす。[^tzgetter]

UTC の算術で正しく書いても、暦の計算が `date-utils.ts` の外にあれば落とします。守っているのは値の正しさではなく、暦の規則を変える経路が 1 本であることです。allowlist の各項目は `kind` を持ち、kind ごとに機械検査されます。自由文の理由だけでは通りません。

同じ発想の検査が他にもあります。環境変数の直接参照は `src/lib/runtime/env.ts` にだけ許し、既存のファイルは grandfather list で管理し、新規ファイルは即座に落とします[^envaccess]。プラン名、価格、トライアル期間、解約の文言の直書きは、`terms.ts` の atom を経由させます[^planliterals]。

## 既存の違反を凍結し、新規だけを止める

ESLint の Svelte 推奨ルールを有効にすると、既存のコードに 483 のエラーが出ました。内訳は、resolve を通さない navigation が 166 件、each の key 欠落が 133 件、不要な children snippet が 113 件などです。全部を直してから有効化するのは現実的でなく、ルールを緩めるのは ADR-0006 が禁じています。採ったのは ESLint 10 の bulk suppressions で、既存の違反を `eslint-suppressions.json` に凍結し、新規の違反だけを CI で落とす ratchet です。段階的に返済したら `--prune-suppressions` で baseline を下げます[^adr07]。

同じ形は各所にあります。dependency-cruiser の既存違反 12 件（循環 8、孤立 4）は既知違反のファイルに固定され、新規だけが落ちます。routes と features で Base のカラートークンを直接使う箇所は 221 を baseline とし、超えると落ちます。`labels.ts` の中のプラン名の直書きは 27 件を上限にしています。いずれも「今より悪くしない」を機械で保証し、「今より良くする」は人の判断に任せる形です。

## lint が沈黙する領域

ADR-0007 は、lint の限界も明記しています。Svelte 5 の公式が最も警告する「`$effect` で state を派生させるな、`$derived` を使え」は、静的に捕まるのは単一代入の自明な形だけです。effect の本体に分岐や複数の文が入ると、linter は沈黙します。

> 「この effect は derived にすべき」の意図判断は ESLint では原理的に不可能なため、lint は syntactic footgun を潰し、semantic 判断は PR review で補う[^adr07]

[第Ⅳ部-5](sixty-to-hundred) で見た「形の検査は形で破られる」と同じ境界です。静的解析は構文の落とし穴を潰し、意味の判断はレビューに残す。その境界を文書に書いておくことで、「lint が緑だから正しい」という誤読を防いでいます。

## 装置と製品の比率

この章の検査群は、[第Ⅳ部-8](platform-session) で見た「装置が製品の 0.76 倍」の主要な構成要素です。階層化と ratchet は、その装置の実行コストと保守コストを抑える設計でした。それでも装置は増え、凍結に至りました。静的解析の設計で最後に効いたのは、新しいツールを足す判断フローではなく、「稼働中だが keep list に無い」を削除理由にしない、という判断原則 v2 の 1 行です。何を守っているかを言えない検査は、階層に関係なく削除の候補になります。

[^adr07]: ADR-0007「静的解析 tier ポリシー」。根本原因、4 階層の定義と判断フロー、`ci-gate` への required 集約、ESLint Svelte の 483 件の baseline 凍結、Runes の semantic 判断が lint 対象外である理由、dependency-cruiser の required 昇格。出典: [docs/decisions/0007-static-analysis-tier-policy.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0007-static-analysis-tier-policy.md)

[^typed]: type-aware lint を CI 限定の分離設定に隔離した理由。出典: [eslint.typed.config.js](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/eslint.typed.config.js)

[^depcruise]: dependency-cruiser の設定。CLAUDE.md の構造ルールの AST 依存解決による encode、循環依存と孤立モジュールの検出、責務の境界。出典: [.dependency-cruiser.cjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.dependency-cruiser.cjs)

[^eslintconfig]: ESLint の設定。routes と lib の Svelte ファイルに適用する自作ルール 6 本と、sonarjs の閾値。出典: [eslint.config.js](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/eslint.config.js)

[^jptext]: 日本語の直書きを禁じる自作 ESLint ルール。対象がテンプレートに限られ `<script>` と `.ts` はレビューの責任である旨、件数 ratchet のスクリプトを削除した経緯。出典: [eslint-plugin-local/no-hardcoded-jp-text.js](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/eslint-plugin-local/no-hardcoded-jp-text.js)

[^tzgetter]: タイムゾーン依存の日付導出を止める検査。4 語の列挙が 7 か所を素通しした経緯、`Date.prototype` の走査による class 側からの定義、暦の計算を `date-utils.ts` に閉じる不変条件、allowlist の kind 別の機械検証。出典: [scripts/check-local-tz-date-getters.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/check-local-tz-date-getters.mjs)

[^envaccess]: 環境変数の直接参照を `env.ts` に限定する検査と grandfather list。出典: [scripts/check-no-direct-env-access.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/check-no-direct-env-access.mjs)

[^planliterals]: プランの値と用語の直書きを止める検査。出典: [scripts/check-no-plan-literals.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/check-no-plan-literals.mjs)
