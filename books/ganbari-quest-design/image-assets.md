---
title: "第Ⅱ部-17　画像アセット ― 18 の候補から選んだ勇者と、崩さないための決まり"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

コードだけが生成AIの成果物ではありません。ロゴ、ファビコン、スタンプ、キャラクター、紹介ページの画像、リンクを共有したときの画像、Stripe の商品の画像。この製品の画像は、ほぼすべて Gemini で生成されました。コードには静的検査がありますが、画像にはありません。画像を生成AIで量産して、ブランドの見た目がばらばらにならないためには、何を決めておけばよいのでしょうか。

すべての指示文の冒頭に貼るブランドの様式の文を 1 つ持ち、同じ題材は 1 セッションで 10 枚までにし、参照画像を毎回渡します。検査の代わりに人が守る決まりです。それでも、生成AIの画像に固有の壊れ方は、人の目で見るまで分かりませんでした。

## 18 の候補から

シンボルマークは、かわいい勇者のキャラクター（ヘルメット、マント、魔法の杖）です。2026 年 3 月 28 日、Gemini 3 Pro Image で 6 つの構想と 3 つの変種を掛け合わせ、計 18 の候補を生成しました。構想は、芽と手、山頂の旗、星の塔、勇者、家族の木、輝く星です。選ばれたのは勇者の簡略版で、理由は 4 つです。「がんばりクエスト」の名前と RPG の世界観に最も直結すること。0〜18 歳の幅広い年齢に合うこと。ヘルメットで性別を特定しないこと。「やらなきゃいけない大変なこと」ではなく「冒険、楽しさ」を訴えることです[^brand]。

ブランドガイドラインは、デザインの要素を意味と色で表にしています。ヘルメットは冒険者の象徴で青の階調、魔法の杖と星は達成と報酬で金色、胸の星の紋章はがんばりの証、頬の赤みはかわいさで 45% 透過の桃色です。使用の規定は、最小 16 ピクセル、周囲にシンボルの幅の 25% 以上の余白、変形の禁止、キャラクターの改変の禁止です[^brand]。

git の履歴が、試行錯誤の形を残しています。`favicon.svg` は 2026 年 3 月 2 日に最初の版が入り、3 月 28 日までに 6 回変わりました。紹介ページのキャラクター画像は 3 月 28 日から 5 月 9 日に 5 回、圧縮版のロゴは 7 回です。ファビコンの候補 3 枚と比較の画像は 4 月 2 日に、リポジトリの `static/assets/favicon/` に残っています。ガイドラインが参照する候補画像の保管先のディレクトリは、リポジトリに存在しません[^brand]。

## 6 つのスタンプと 8 本のスクリプト

活動を記録すると、おみくじのスタンプが出ます。大吉、中吉、小吉、吉、末吉、大大吉の 6 つで、2026 年 4 月 1 日に生成されました。生成の手順は 4 段です。Gemini Pro で文字なしの画像を生成し、塗りつぶしで背景を透過にし、余白を切り、SVG で文字を個別に配置する。文字を画像に焼き込まず、あとから差し替えられる形です[^stamps]。

生成のスクリプトは 8 本あります。

| スクリプト | 対象 |
| --- | --- |
| `generate-image` | 汎用の道具。分類と希少度を指定するとブランドの様式を自動で付ける |
| `generate-stamp-images` と `regenerate-all-stamps` | おみくじのスタンプ 6 種 |
| `generate-marketing-images` | 交流サイトの見出しの画像と、リンク共有時の画像。Twitter の見出しと投稿、Instagram の投稿、報道向けの主要な画像 |
| `generate-stripe-product-images` | Stripe の商品の画像 2 枚（スタンダードと家族、690×690） |
| `generate-pwa-icons` | `favicon.svg` からホーム画面用のアイコンを sharp で生成 |
| `generate-coreloop-summary` | 紹介ページの「活動 → 習慣 → ごほうび」の循環の図 |
| `check-orphan-assets` | どこからも参照されない画像の検出 |

交流サイト向けの画像はロゴのキャラクターを参照して生成し、Stripe の商品の画像はロゴを元としてプランごとに作ります。どちらも 4 月 3 日と 4 月 4 日の 1〜2 回のコミットで、その後変わっていません[^scripts]。

紹介ページの循環の図は、正本を SVG に変えました。既定の経路は SVG から sharp で透過の PNG に変換する、結果の決まった手順で、Gemini の鍵は要りません。Gemini で SVG そのものを再生成する経路は選んだときだけ動く形で残し、「出力は JPEG のバイト列の可能性があるため PR レビューで透過チェックが必要、透過保証が必要なら SVG を手動編集する運用に切り替えること」と注記しています[^assetcatalog]。

## ブランドを崩さない

Gemini の画像生成の手引きは、すべての指示文の冒頭に必ず貼るブランドの様式の文を持ちます。`kawaii chibi flat illustration`、頭身 1:1.5、顔の 35〜40% を占める大きな目、`cel-shaded` の暖かいパステル。2〜3 ピクセルの平らな輪郭、透過の PNG、文字と透かしと画面の部品は無し。ブランドの 3 色、参照するキャラクターは候補 D3 の勇者。手引きは「このブロックなしに生成するとブランドから逸脱した画像が生まれる」と書いています[^guide]。

希少度には見た目の語彙があります。通常は単純で単色の差し色、レアはきらめき、スーパーレアは金色の光と宝石、ウルトラレアは虹色の揺らめきと後光です。道具で `--rarity SR` と指定すると、様式の文に語彙が自動で足されます[^guide]。

セッションの管理の決まりが、生成AIの画像に固有です。「同一テーマの画像を 1 セッションで 10 枚以上生成しない。10 枚を超えると Gemini のコンテキストが薄れ、スタイルが徐々にブランドから逸脱する。新しいセッションを開始し、参照画像を再提供する」。参照画像は主となるキャラクターの一覧図で、2026 年 4 月 25 日に 1 枚だけ作られました[^guide]。

避ける語の標準の組もあります。`realistic`、`photorealistic`、`3D render`、`shadow`、`text`、`watermark`、`adult`、`complex shading`、`dark theme`。子供向けの製品で、画像が写実に寄ることを防ぎます[^guide]。

![画像を 1 枚作るまでの流れ。ブランドの様式の文と参照画像と避ける語から指示文を組み立てて Gemini に渡す。出力を透過にして余白を切り SVG で文字を置き、最後に人の目で確かめる](/images/ganbari-quest-design/image-assets.png)

## 作る予定のまま

画像のカタログは、判断の基準を明示しています。画像が要るのは、ゲーミフィケーションの報酬（シール、バッジ、トロフィー）、キャラクターとマスコット、ブランド、レベルとランクの表示、OS の間で見た目が変わると困る要素です。絵文字でよいのは、状態のラベル、一覧の飾り、そして利用者が自分で選ぶ活動のアイコンです[^assetcatalog]。

カタログの一覧には「現状」と「目標」の列があります。優先度が最も高い 3 つ、シール 16 種以上、実績のバッジ 20 種以上、称号のアイコン 15 種以上は、現状が絵文字 1 文字で、目標がイラストのままです。分類のアイコン、レベルアップの演出、特別な報酬のアイコンも同じです。作られたのは、おみくじのスタンプ 6 つ、バトルのキャラクターと敵、そしてブランド系の画像です[^assetcatalog]。

OS に依存する絵文字を SVG に置き換えた例もあります。紹介ページの信頼を示す 4 つの印（広告なし、家族限定、保護者専用のカギ、データを家族の手元に）は、当初 🚫👪🔑🔍 の絵文字で、Safari と Android で見た目が大きく異なりました。ブランド色の単色の平らな SVG 4 種に置き換えました[^assetcatalog]。

紹介ページの画像は、大きさの閾値で最適化されています。圧縮版のロゴは 757.6KB から 19.2KB へ 97.5% 削減しました。最大の要素が描画されるまでの時間の改善と、検索での表示と、直帰率が目的です[^assetcatalog]。

作られたものにも、あとから直したものがあります。

**狙い。** バトル画面のキャラクター画像を、背景が透けた形で表示すること。

**起きたこと。** 2026 年 9 月 12 日、バトル画面のキャラクター画像に市松模様の「偽の透過」の背景が焼き込まれていることが見つかりました。生成AIが透過を表現するときに描く市松模様が、そのまま画像に入っていました[^issue4921]。

**なぜ。** コードのテストは透過を検証しません。生成AIの画像に固有の壊れ方で、人の目で見るまで分かりませんでした。

**変えたこと。** 画像を直しました。

**読者のリポジトリでは。** 生成AIに作らせた透過画像を、白以外の背景の上に置いて見てみてください。

## 効いたか、足りなかったか

ブランドの様式の文と 10 枚のセッションの上限は、生成AIで画像を量産するときの最小の決まりとして正しかったと考えています。コードには静的検査がありますが、画像にはありません。「冒頭に必ず貼る」「10 枚で切る」「参照画像を渡す」は、検査の代わりに人が守る決まりです。

作られなかった画像の一覧は、正直に残っています。バッジと称号は絵文字のままです。カタログの「現状」の列は 2026 年 4 月から更新されておらず、目標は目標のままです。画像を作るコストは低いのですが、作った画像を製品に組み込み、年齢帯ごとに検証し、見た目の回帰検査の基準値に載せるコストは低くありません。[第Ⅴ部-5](visual-regression) の 3 層の基準値は、画像を足すたびに更新が要ります。

偽の透過の市松模様は、生成AIの画像に固有の壊れ方です。コードのテストは透過を検証しません。人の目で見るまで分かりませんでした。

## 持ち帰るもの

- 画像を生成AIに作らせるなら、様式の文と参照画像を 1 つずつ持ち、全部の指示文に付ける
- 同じ題材を 1 セッションで作る枚数に上限を置く。文脈が薄れると見た目が黙って逸脱する
- 生成した画像は人の目で見る。透過や背景の壊れ方は、コードのテストでは分からない

次の章から第Ⅲ部に入り、この製品を動かしている AWS の構成と、実測の月額を扱います。

[^brand]: ブランドガイドライン。シンボルマークの節（デザイン選定の経緯、18 の候補、選定の理由、デザイン要素の表、ファイルの一覧、使用の規定）と、アイコンの再生成の手順。出典: [docs/design/15-ブランドガイドライン.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/15-%E3%83%96%E3%83%A9%E3%83%B3%E3%83%89%E3%82%AC%E3%82%A4%E3%83%89%E3%83%A9%E3%82%A4%E3%83%B3.md)。ファビコンの候補は [static/assets/favicon/](https://github.com/Takenori-Kusaka/ganbari-quest/tree/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/static/assets/favicon)

[^stamps]: おみくじのスタンプの再生成の手順。出典: [scripts/regenerate-all-stamps.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/regenerate-all-stamps.mjs)。画像は [static/assets/stamps/](https://github.com/Takenori-Kusaka/ganbari-quest/tree/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/static/assets/stamps)

[^scripts]: 生成のスクリプト群。汎用の道具は [scripts/generate-image.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/generate-image.mjs)。交流サイト向けは [scripts/generate-marketing-images.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/generate-marketing-images.mjs)。Stripe は [scripts/generate-stripe-product-images.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/generate-stripe-product-images.mjs)。参照されない画像の検出は [scripts/check-orphan-assets.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/check-orphan-assets.mjs)

[^assetcatalog]: 画像アセットのカタログ。判断の基準、アセットの一覧（現状と目標）、信頼を示す SVG 4 種、紹介ページの巨大な画像の最適化、循環の図（SVG の正本化）。出典: [docs/design/asset-catalog.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/asset-catalog.md)

[^guide]: Gemini の画像生成の手引き。ブランドの様式の文、希少度ごとの見た目の語彙、セッションの管理（10 枚の閾値）、避ける語、モデルの選択。出典: [docs/reference/gemini_image_generation_guide.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/reference/gemini_image_generation_guide.md)。参照画像は [static/assets/brand/master-character-sheet.png](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/static/assets/brand/master-character-sheet.png)

[^issue4921]: バトル画面のキャラクター画像に偽の透過の背景が焼き込まれていた課題票。出典: [Issue #4921](https://github.com/Takenori-Kusaka/ganbari-quest/issues/4921)
