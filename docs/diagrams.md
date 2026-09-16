# アーキテクチャ図の標準（D2 + TALA）

publishing-hub に載せるアーキテクチャ図は、**D2 で書いて PNG に描き出す**のを標準とします。図のソース（`.d2`）と、描き出した PNG と、再現用のメタ情報（`.png.json`）の3点を、すべてリポジトリに置きます。

## なぜこの方式か

**Zenn は本文幅（約700px）より広い画像を縮小して表示します。** 横長の図はそこで文字が潰れて読めません。だから図は「自然幅が本文幅に収まる」ように作る必要があり、これは機械で検査できます（D5）。

**Mermaid はソフトウェアのコンポーネント図・コンテナ図の表現に向きません。** 直交のエッジルーティングとコンテナの入れ子が弱いため、ノードが増えると横に広がります。以前この本の図を Mermaid に置き換えたところ、まさに上の2点で読めなくなりました。

**TALA はソフトウェアアーキテクチャ図のために作られた直交レイアウトエンジンです。** Dagre や ELK のような DAG ベースのエンジンと違い、ホワイトボードに手で描いた図に近い直交レイアウトを作り、コンテナ（入れ子の図形）をレイアウトの全段で一級に扱います。2026-09-07 に MPL-2.0 で公開され、**D2 v0.9.0 から同梱**されました。ライセンスキーと別途インストールは、どちらも要りません。

- TALA の公開の告知: <https://d2lang.com/blog/tala-is-open-source/>
- TALA の解説: <https://d2lang.com/tour/tala/>
- D2 本体: <https://github.com/terrastruct/d2>（MPL-2.0）

> **注意。** GitHub の `terrastruct/TALA` リポジトリの README は古く、「closed-source」「paid layout engine」「ライセンスが無いと透かしが入る」と書いてあります。これは公開前の記述です。現在の一次情報は上の告知と D2 v0.9.0 のリリースノートです。

## 置き場所と命名

```text
images/c4/
  engine-abstraction-components.d2        # ソース（手で書く／編集する）
  engine-abstraction-components.png       # 掲載用（生成物・コミットする）
  engine-abstraction-components.png.json  # 再現用のメタ情報（生成物・コミットする）
```

本文からは PNG を参照します。

```markdown
![エンジン抽象のコンポーネント構成](/images/c4/engine-abstraction-components.png)
```

対象ディレクトリは `lint/policies/diagrams.json` の `diagram_dirs` です。この配下の画像は**ソースがあることを必須**にしています。ソースの無い画像は、後から誰も更新できなくなるからです（実際にそうなっていた図が7枚ありました）。

## 使い方

```bash
npm run figures:render          # 変更/欠落しているものだけ描き直す
npm run figures:render -- --all # 全部描き直す
npm run figures:render -- images/c4/foo.d2   # 指定したものだけ
npm run figures:check           # 書かずに、描き直しが要るかだけ報告する
npm run check:diagrams          # 再現性と Zenn 幅を検査する（npm run check にも入っている）
```

図を追加・変更する手順はこれだけです。

1. `images/c4/<名前>.d2` を書く（または直す）
2. `npm run figures:render` で PNG とメタ情報を作る
3. 出力された自然幅を見る。700px を超えたら後述の方法で詰める
4. 本文から PNG を参照する
5. `npm run check` を通す

**PNG を手で差し替えないでください。** ソースと合わなくなり、検査（D4）で止まります。直すのは常に `.d2` の側です。

## レイアウトエンジンの選び方

既定は `tala` です（`lint/policies/diagrams.json` の `layout`）。ただし TALA には公式に明記された弱点があります。

- **乱数性がある。** ノードを1つ足すと、レイアウト全体が別物になることもあります
- **DAG は苦手。** 一方向に流れるフロー図は Dagre や ELK のほうが素直です
- **大きい図で遅くなる**（非線形にスケールします）

そこで**図ごとに上書き**できます。一方向のフロー（`A → B → C` と流れて分岐するだけの図）は `dagre` のほうが綺麗に出ます。実際、物理トリガーの図は TALA だと始点が右下に置かれて流れが読めなくなったため、dagre に変えています。

```d2
vars: {
  d2-config: {
    layout-engine: dagre
  }
}
```

判断の目安はこうです。

| 図の性格 | 推奨 |
| --- | --- |
| コンテナ（入れ子）があり、要素が相互に参照するアーキテクチャ図 | `tala` |
| 一方向に流れるパイプライン・フロー図 | `dagre` |
| 階層が深く、辺の交差を最小化したい図 | `elk` |

**どのエンジンを選ぶかは判断が要るので、機械では決められません。** そこで検査（D6）は「選んだ理由がソースに残っていること」だけを担保します。既定以外を指定したら、`#` のコメントにエンジン名を含めて理由を書いてください。後から図を触る人が、その選択を追試できるようにするためです。

```d2
# 一方向のフローなので layout は dagre（TALA は公式に「DAG は苦手」と明記）
vars: { d2-config: { layout-engine: dagre } }
```

## 自然幅を Zenn の本文幅に収める

`npm run check:diagrams` の D5 が、自然幅が 700px を超えた図を**エラーで止めます**。超えたときの詰め方は次の順で試してください。

1. **`direction: down` にする。** 横に流すと確実に幅が出ます
2. **`grid-rows` で縦に積む。** 並列な要素をコンテナに入れ、`grid-rows: 2` のように行数を指定すると縦に並びます
3. **ラベルを短くする。** 説明は本文に書き、図のラベルは名前だけにします
4. **図を分割する。** 1枚に詰め込むより、2枚に分けたほうが読めます

```d2
entry: "2つの入口" {
  grid-rows: 2
  hotkey: グローバルホットキー
  cli: CLI 起動
}
```

高さは 2000px を目安に警告します（縦に長すぎると全体を把握しにくいため）。エラーにはしません。

## メタ情報（`.png.json`）の役割

TALA は乱数性があるため、**ソースだけでは同じ絵に戻せません**。そこで PNG の隣に再現情報を置きます。

```json
{
  "source": "images/c4/engine-abstraction-components.d2",
  "sourceSha256": "…",
  "layout": "tala",
  "renderer": { "d2js": "@d2lang/d2@0.1.34", "rasterizer": "@resvg/resvg-js@2.6.2" },
  "renderOptions": { "pad": 20, "themeID": 0, "sketch": false, "scale": 1 },
  "raster": { "scale": 2 },
  "fonts": { "loadSystemFonts": true, "defaultFontFamily": "Yu Gothic" },
  "natural": { "width": 423, "height": 836 },
  "output": { "width": 846, "height": 1672, "sha256": "…" }
}
```

これで次のことができます。

- **描き直しが必要かを機械で判定する**（ソースのハッシュが変わっていれば描き直す）
- **画像の手差し替えを検出する**（出力のハッシュが合わなければ止める）
- **どの版・どのオプションで作った絵かを後から確認する**

メタ情報は手で編集しないでください。`npm run figures:render` が生成します。

## 検査（`npm run check` の diagrams 段）

| 規則 | 内容 |
| --- | --- |
| D1 | 掲載用の画像に D2 のソースがある（ソースの無い画像は作らせない） |
| D2 | ソースに対応する PNG とメタ情報がある |
| D3 | メタ情報のソースのハッシュが現在の `.d2` と一致する（変えたら描き直す） |
| D4 | メタ情報の出力のハッシュが現在の PNG と一致する（手差し替えを止める） |
| D5 | 自然幅が Zenn の本文幅に収まる（超えると縮小され文字が潰れる） |
| D6 | 既定のエンジンを上書きするなら、選んだ理由がソースのコメントにある |

写真やカバー画像のようにソースを持てない画像は、`lint/policies/diagrams.json` の `exempt` に理由つきで登録します。

## 日本語のフォント

D2 の既定フォント（Source Sans Pro）は日本語グリフを持ちません。ラスタライズ側（resvg）でシステムフォントに解決させています（`fonts.load_system_fonts`）。**厳密な画素一致には同じフォント環境が必要**で、使った設定はメタ情報に記録されます。日本語フォントの無い環境で描き直すと、文字が豆腐になります。その場合はフォントを入れてから描き直してください。

## 依存

`package.json` の devDependencies に入っています。バイナリのダウンロードとライセンスキーは、どちらも不要です。

- `@d2lang/d2` — D2 の WASM ビルドのラッパー。TALA を含む
- `@resvg/resvg-js` — SVG を PNG にする（ヘッドレスブラウザ不要）

D2 の CLI 本体（`d2` コマンド）は使っていません。WASM 版で足りるうえ、CLI の PNG 書き出しは Playwright でヘッドレスブラウザを立ち上げるので、CI では重くなるためです。
