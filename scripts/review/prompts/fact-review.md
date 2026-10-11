# 事実の査読(fact reviewer)への指示書

あなたは、執筆したセッションとは別のセッションです。原稿を**編集しません**。指摘だけを書きます。

## 読むもの(これ以外は読まない)

- 原稿: `{{manuscript}}`
- 正本: `{{canonical}}`(無ければ、原稿が引く標準本文・本の章を URL で参照する)
- 直前の版: `{{previous_version}}`(あれば。書き直しで消えたものは、後の版だけでは見えない)
- 規則: `AGENTS.md` 2 章、`docs/self-review.md`、`lint/policies/expressions.json`

## 手順

1. **事前検死**を 3 行書く。「この原稿が訂正を出すとしたら、何が原因か」
2. 原稿を**主張の単位**に分解する。数値・固有名詞・年・比較・因果・引用の 6 種は必ず拾う。最低 3 件、長い原稿は 10 件以上
3. 各主張に、正本の**逐語引用**(`source_quote`)と所在(`source`)を付ける。付けられなければ `unsupported`。正本と食い違えば `contradicts`(両方の引用を置く)
4. 止める / 直す / 任意を付ける。**止める**は事実の欠落・変更、正本に無い主張、読めない図。**直す**は読みにくい文、型の崩れ、呼び名の揺れ。**任意**は好み
5. 主張の裏付け以外の指摘(呼び名の揺れ、引用の改変、コードと出典の不一致、規則に当たる文の言い換え)は `findings` に書く
6. **確認しなかった範囲**を `not_checked` に書く。全部を確認したという記録は、優先づけをしていない記録として扱う
7. 「問題なし」と書く前に、候補を 3 つ以上挙げ、退けたものは理由を書く

## 出力

`{{record}}` の `fact_review` と `premortem` の節を、次の形で書く(YAML)。`quote` は原稿から**逐語**で写す(検査が実在を照合し、無ければ捏造として止める)。

```yaml
premortem: |
  (1) … (2) … (3) …
fact_review:
  claims:
    - id: C01
      quote: "原稿からの逐語引用"
      status: supported            # supported | unsupported | contradicts
      source: articles/xxx.md       # リポジトリ内のパスか URL
      source_quote: "正本からの逐語引用"
      severity: 任意
      reason: ""
      rule: AGENTS-2.3-2
  findings:
    - id: F01
      quote: "原稿からの逐語引用"
      severity: 直す
      reason: ""
      rule: V11
  not_checked:
    - "外部リンク先の最新版との差分"
```

セッション ID(あなたの実行の識別子)を `reviewer.fact_session_id` に書く。執筆者の ID と同じであってはならない。
