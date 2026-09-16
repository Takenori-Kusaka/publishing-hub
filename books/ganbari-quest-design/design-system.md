---
title: "第Ⅱ部-3　デザインシステム ― 3 層のカラートークン、18 の primitives、用語の 2 層 SSOT"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

`docs/DESIGN.md` は、新しい画面を作る AI が最初に読むファイルです。2026-04-10 に作られ、92 回改訂されました。この章では、そこに書かれた 3 つの構造を扱います。色を Base、Semantic、Component の 3 層で管理するトークン、Ark UI を包んだ 18 の primitives、そして用語を atom と compound の 2 層で管理する辞書です。3 つとも「同じものを 2 か所に書かない」ための構造で、生成AIが最も破りやすい規約でもあります。

## 色の 3 層

色は 3 層です。hex 値は `app.css` の定義ブロックの中にだけ書けます。Base トークン（`--color-brand-500` のような生のスケール）は、Semantic トークンの定義の中でだけ参照できます。routes・features・components が使ってよいのは Semantic トークン（`--color-action-primary` や `--color-surface-card`）だけです。`app.css` は 1,226 行で、`--color-` で始まるトークンは 328 個あります[^design]。

DESIGN.md はトークンの一覧を掲載しません。「`app.css` の `@theme` ブロックが SSOT」で、DESIGN.md は 3 層の使い分けルールと禁忌だけを定義し、発見性は grep と IDE の補完、整合性は CI が担保します。掲載をミラーしない方針は、用語辞書でも primitives でも同じです。実体を足しても DESIGN.md は更新せず、ルール自体が変わったときだけ手で直します[^design]。

禁忌の検出は 3 つの道具に分かれます。hex の直書きは stylelint、Tailwind の arbitrary hex と inline style は自作の ESLint ルール、Base トークンの routes での直接使用は [第Ⅴ部-4](fitness-functions) で見た ratchet（221 か所の baseline）です。

コントラストには、値そのものを読む規約があります。同じ色を「白文字を載せる塗り」と「白背景に載せる文字」の両方に使ってよい、ただしその色は白に対して 4.5:1 以上でなければならない。ブランド色をそのまま使うと届かないことが多く、`--color-action-primary` は白文字で 3.34:1 で不足するため `-strong` の variant を使います。利用者データ由来の色（カテゴリ色やアイコン色）は文字色に使いません。コントラストを保証できないからです[^design]。

CSS の変数には、テーマで解決させるときの落とし穴があります。`:root` に `--color-action-primary-strong: var(--theme-primary-strong)` と書くと、`[data-theme]` の配下でも `:root` で解決済みのブランド色が継承されます。実測では、ピンクのテーマの子供ヘッダーがブランドの青になりました。テーマごとに値が変わる Semantic トークンは、各テーマのブロックで同じ宣言を繰り返します[^design]。

![色の 3 層](/images/ganbari-quest-design/design-system.png)

## 18 の primitives

`src/lib/ui/primitives/` には 18 のコンポーネントがあり、それぞれに Storybook の story が付いています。Button、Card、Alert、FormField、Dialog、Badge、Menu、Select、Tabs、Toast、PinInput、Progress、ChildSelectionDialog など。routes から Ark UI を直接 import することは禁止で、ボタンは必ず `Button.svelte`、フォーム要素は `FormField.svelte` です。新しいパターンが要るなら、先に primitives へ追加してから使います[^design]。

生の `<button>` を routes に書くと、自作の ESLint ルールが落とします。ルールの scope は `src/routes/` に限定され、primitives の内側では生の `<button>` を使えます[^eslintlocal]。

primitives の一覧も DESIGN.md には載りません。載るのは、使い分けに判断が要る primitive の節だけです。Button の `loading` prop は非同期処理の visible feedback のため。Dialog を「閉じさせない」modal にするには `closable` と `closeOnEscape` の両方を false にする必要があり、片方だけでは Esc でバイパスできる。FormField の `type` は 11 種。Toast は成功のフィードバック、確認を要する操作は Dialog、永続する警告は Alert[^design]。

`<style>` ブロックは 50 行以下、route のコンポーネントは 500 行以下。どちらも自作の ESLint ルールで、超えたら分割か features への抽出を促します[^eslintlocal]。

## 用語の 2 層

UI に表示される文言は、`terms.ts`（atom、1,994 行、70 の namespace）と `labels.ts`（compound、13,002 行、478 の namespace）の 2 階層で管理されます。atom は単一の用語で、プラン名、価格、期間、解約、無料訴求など。compound は atom を文に組み立てた表示文字列で、`${PLAN_FULL_TERMS.standard}以上で…` のような template literal で参照します。atom の値を compound 側にリテラルで直書きすることは禁止です[^terms]。

2 層にした理由は ADR-0045 にあります。当初の `labels.ts` は約 6,700 行、135 の namespace で、atom と compound が同じ階層に並んでいました。用語を変えたとき「atom を変えたら compound も変わるはず」という連動が機械検出できませんでした。アプリ本体の `.svelte` に「スタンダードプラン以上で…」の直書きが 15 件以上、LP の fallback テキストが手動同期で乖離、法務文書のプラン名が compound で重複定義、という実害が続いていました。PO の期待は「atom 1 行を変えれば LP、アプリ本体、法務文書のすべてに伝播する状態を作れ」でした[^adr45]。

選択肢は 4 つでした。別ファイルに分離する（採用）、同一ファイル内でコメントの境界で分ける（境界が機械検出できない）、i18n ライブラリを先行導入する（多言語化の要件が未確定で単一 PR が膨らむ）、現状維持（再発を防ぐ機械機構が無い）。ADR は採用案を DDD の Value Object、Atomic Design、そして CSS の 3 層トークンと同型の責務分離として位置づけています[^adr45]。

LP と法務文書への伝播は、[第Ⅲ部-8](lp-delivery) で見た生成スクリプトが担います。Svelte の template ブロックの日本語直書きは、自作の ESLint ルールが error で検出します。2026 年 4 月、このルールと検査スクリプトで baseline を 1,607 件から 0 件に落とす作業が 4 段階で行われ、SSOT 100% に到達しました。ただし `<script>` ブロックと `.ts` ファイルは対象外で、そこはレビューで担保します[^iconlabel]。

`labels.ts` は 5 月の 6,700 行から 9 月の 13,000 行に倍増しました。用語辞書が肥大するのは、画面が増えたからでもありますが、生成AIが新しい画面のたびに新しい namespace を足すからでもあります。既存の namespace を探すより、足す方が速いのです。DESIGN.md の確認手順は「新規ラベルを追加する前に grep で既存の compound を確認する」ですが、これは機械強制されていません。

## 年齢帯の文言と概念アイコン

年齢帯で文言を変えるとき、全キーを 2 セット持つと、次に語を足した人が片方だけ更新して割れます。規約は「差分だけの override をベースに spread で重ねる」です。ひらがなの側を base にし、中学生と高校生だけ漢字の override を持ちます。逸脱は「禁止語の不在」を assert するテストが検出します[^routesclaude]。[第Ⅰ部-3](age-tiers) で見た「年齢による差は UI の差であり機能の差ではない」原則の、文言側の実装です。

システム上の固定の概念（活動、ごほうび、チェックリスト、ルール、チャレンジ、テンプレート、AI 提案、ヘルプ）に紐づくアイコンの絵文字は、`CONCEPT_ICONS` の atom が SSOT です。「同一概念 = 同一アイコン」を 1 か所で保証します。対象外は、ユーザーがカスタマイズする活動アイコンで、データ値の絵文字は固定化しません[^design]。

## 今ならこうする

3 層のカラートークンと 2 層の用語辞書は、同じ形をしています。実体は 1 か所、参照は名前で、直書きは機械で落とす。この同型性は偶然ではなく、ADR-0045 が CSS の 3 層を明示的に手本にしました。生成AIに規約を守らせるとき、規約が 1 つの形に揃っていることは、規約の数より効きます。

一方で、用語辞書の肥大は止められていません。13,000 行の辞書は、人が読む前提を超えています。namespace の重複を検出する仕組みか、画面ごとの辞書を生成する仕組みか、どちらかが要ります。「grep で確認する」という手順は、AI にとっては守る動機の無い手順でした。

コントラストの規約は、Lighthouse の実測で 1.51:1 が見つかるまでありませんでした。3 層のトークンは「どこに書くか」を決めますが、「値が正しいか」は決めません。値を読むテストが加わって、初めてデザインシステムは色の正しさを守るようになりました。

[^design]: デザインシステム SSOT。§2 カラートークン（3 層、禁忌、コントラスト、テーマ配下の再宣言）、§5 コンポーネントプリミティブ（ルール、Button / Dialog / FormField / Toast の使い分け）、§6 用語辞書（2 層、確認手順、概念アイコン）、§12 更新ルール。出典: [docs/DESIGN.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/DESIGN.md)

[^eslintlocal]: 自作の ESLint ルール 6 本。`no-raw-button`（routes に限定）、`no-style-attribute`、`no-tailwind-arbitrary-hex`、`no-hardcoded-jp-text`、`max-style-lines`（50 行）、`max-svelte-lines`（500 行）。出典: [eslint-plugin-local/](https://github.com/Takenori-Kusaka/ganbari-quest/tree/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/eslint-plugin-local)

[^terms]: 用語集（atom 専用）。階層図、設計原則、export の一覧。出典: [src/lib/domain/terms.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/domain/terms.ts)

[^adr45]: ADR-0045「terms.ts SSOT 2 階層化原則」。単一 namespace 混在の限界、直近の実害、PO 期待、4 つの選択肢、確立パターンとの照合、Phase 進捗、適用原則。出典: [docs/decisions/0045-terms-ssot-2-layer.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0045-terms-ssot-2-layer.md)

[^iconlabel]: アイコン・ラベル統一規約。§SSOT 完全化の達成記録（baseline 1,607 → 0 の 4 段階、CI gate の運用ルール、残されたフォローアップ）。出典: [docs/design/22a-アイコン・ラベル統一規約.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/22a-%E3%82%A2%E3%82%A4%E3%82%B3%E3%83%B3%E3%83%BB%E3%83%A9%E3%83%99%E3%83%AB%E7%B5%B1%E4%B8%80%E8%A6%8F%E7%B4%84.md)

[^routesclaude]: routes 配下の CLAUDE.md §年齢帯 variant（差分だけの override、ひらがな側を base にする、禁止語の不在を assert するテスト）。出典: [src/routes/CLAUDE.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/routes/CLAUDE.md)
