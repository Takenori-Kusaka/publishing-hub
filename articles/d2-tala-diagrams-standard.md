---
title: "Zennの表示崩れを防ぐ：D2 + TALAとCIによるアーキテクチャ図の自動生成と再現性検証"
emoji: "🎨"
type: "tech"
topics: ["d2", "tala", "githubactions", "architecture", "devops"]
published: false
---

:::message
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。使ったツールと用途は、末尾の「生成AIの利用について」に書いています。
:::

## 1. はじめに：技術発信における「図」の可読性問題

技術記事において、アーキテクチャ図やシステム構成図は読者の理解を助ける重要な要素です。
しかし、Gitで管理するMarkdownベースの執筆環境において、図の運用にはいくつかの課題が存在します。
本システムのソースコードおよび検証スクリプトは、[Takenori-Kusaka/publishing-hub](https://github.com/Takenori-Kusaka/publishing-hub)（GitHubリポジトリ）にて公開しています。

### 1.1 Zennの「本文幅700px」問題
Zennは、本文幅（約700px）を超える画像を自動で縮小し、表示します。
この仕様によって、横長の図は縮小された際、文字の潰れが発生して全く読めなくなってしまいます。
そのため、掲載する図の自然サイズ（元の幅）を、本文幅（700px）へ収まるよう設計します。

### 1.2 Mermaidの構造的な限界
Markdown環境で広く使われるMermaidは、フローチャートやシーケンス図を手軽に描く用途へ適しています。
しかし、ソフトウェアの複雑なコンテナ構造を描画する際、いくつかの弱点を持っています。

- **直交エッジルーティングが弱い：** ノード同士を結ぶ線が斜め、または複雑な形で交差しやすく、ホワイトボードに描いたような見やすい直線配置へ仕上げるのが困難です。
- **コンテナ（入れ子）の自動配置は弱い傾向にあります。** ノードの増加に伴って横方向へ際限なく広がるため、簡単に700pxの本文幅を超えてしまいます。

これらの課題を解決するため、本リポジトリでは図をテキスト（D2）で管理し、自動レイアウトエンジン（TALA）を組み合わせてPNG画像を自動生成し、さらにCI（GitHub Actions）で画像の「自然幅」と「再現性」を厳格に検査する仕組みを標準化しました。

![エンジン抽象のコンポーネント構成](/images/c4/engine-abstraction-components.png)

---

## 2. 技術選定：なぜ D2 + TALA + resvg-js なのか

本システムでは、図の生成基盤として **D2 + TALA + resvg-js** を採用しています。

### 2.1 D2 と直交レイアウトエンジン TALA
D2（[terrastruct/d2](https://github.com/terrastruct/d2)）は、テキストから美しい図を生成する宣言型の言語です。
D2の最大のメリットは、2026年9月7日にオープンソース（MPL-2.0）化された点にあります。
D2 v0.9.0からはレイアウトエンジン「TALA」も標準同梱され、ライセンスなしで利用できます。

TALAは、ソフトウェアアーキテクチャ図のために特別に設計された直交レイアウトエンジンです。
DagreやELKのようなDAG（有向無サイクルグラフ）ベースのエンジンと異なり、コンテナの入れ子構造をレイアウトの全段で一級の要素として扱います。
これにより、ホワイトボードに手で描いたような、すっきりとした直交レイアウトを自動生成します。

### 2.2 JS (WASM) ラッパーの採用による「ゼロ依存」と高速化
通常、D2のCLIツールでPNGを書き出す場合は、内部でPlaywright等を介してヘッドレスブラウザを立ち上げる必要があります。
このため、CI環境での依存解決や実行速度がボトルネックになります。

本システムでは、CLIツールを使わず、npmパッケージの **`@d2lang/d2`**（WASMビルド）と、高速なSVGラスタライザである **`@resvg/resvg-js`**（Rust実装のNodeラッパー）を使用しています。
これにより、ヘッドレスブラウザが完全に不要になり、CI上でもゼロ依存かつ極めて高速にラスタライズが行えます。

---

## 3. アーキテクチャ図の「再現性」と「手差し替え」防止

TALAは優れたエンジンですが、公式ドキュメントにも記載されている通り **「レイアウトに乱数性がある」** という弱点があります。
ノードを1つ追加しただけで、図全体の配置が大きく変わってしまうことがあります。

このため、`.d2`ソースファイルだけをリポジトリで管理していると、誰かが別の環境で再レンダリングした際、意図せず図のレイアウトが崩れたり変わったりしてしまいます。
この再現性問題と、画像が手動で差し替えられることによるソースとの不一致を防ぐため、本システムでは以下のルールを定めています。

### 3.1 メタ情報（`.png.json`）による再現性の記録
画像のレンダリング時に、PNGファイルの隣に再現用のメタ情報ファイル（`<名前>.png.json`）を自動生成し、コミット対象とします。

```json
{
  "source": "images/c4/engine-abstraction-components.d2",
  "sourceSha256": "5f6b...",
  "layout": "tala",
  "renderer": {
    "d2js": "@d2lang/d2@0.1.34",
    "rasterizer": "@resvg/resvg-js@2.6.2"
  },
  "renderOptions": { "pad": 20, "themeID": 0, "scale": 1 },
  "natural": { "width": 423, "height": 836 },
  "output": { "width": 846, "height": 1672, "sha256": "8a3d..." }
}
```

このメタデータによって、CI（`npm run check`）では以下の自動検証を行えます。

1. **ソース不一致の検出：** 現在の `.d2` ファイルのハッシュ値が、メタ情報の `sourceSha256` と一致するか（ソース変更時は再ラスタライズが必要）。
2. **手差し替えの検出：** 現在の `.png` ファイルのハッシュ値が、メタ情報の `output.sha256` と一致するか（手動でのPNG編集を検知）。
3. **自然幅の検査：** メタ情報の `natural.width` が 700px 以下に収まっているか。

---

## 4. 設計と実装

### 4.1 自動レンダリングスクリプト（`render-d2.mjs`）のコアロジック

以下は、WASM版のD2とresvg-jsを使って図を自動レンダリングし、再現メタ情報を構築するスクリプトのコア部分です。

```javascript
// scripts/figures/render-d2.mjs
// ...
import { D2 } from '@d2lang/d2';
import { Resvg } from '@resvg/resvg-js';

async function renderOne(srcAbs, policy) {
  const srcText = fs.readFileSync(srcAbs, 'utf8');
  const layout = layoutFor(srcText, policy);
  const d2 = new D2();
  
  // D2 WASM によるコンパイルとSVGのレンダリング
  const compiled = await d2.compile(srcText, { layout, ...policy.render });
  const svg = await d2.render(compiled.diagram, compiled.renderOptions);
  await d2.dispose();

  // SVG の自然サイズを取得
  const natural = naturalSize(svg);
  const fontFamily = policy.fonts.default_font_family;

  // resvg-js による PNG ラスタライズ
  const buf = new Resvg(svg, {
    fitTo: { mode: 'width', value: Math.max(1, Math.round(natural.width * policy.raster.scale)) },
    font: { loadSystemFonts: policy.fonts.load_system_fonts, defaultFontFamily: fontFamily },
  }).render().asPng();

  const size = pngSize(buf);
  return {
    srcText,
    layout,
    natural,
    fontFamily,
    png: buf,
    pngInfo: { ...size, sha256: sha256(buf) },
  };
}
```

---

## 5. 自然幅を700pxに収めるためのプラクティス

CIのD5検証（自然幅が700pxを超えるとビルドエラーで停止）に引っかかった場合、以下の設計アプローチを順に試して図をスリムにします。

1. **`direction: down` に統一する：**
   D2は標準で左から右（`direction: right`）にレイアウトされるため、横に広がりやすくなります。
   これを縦方向（`down`）に強制することで、幅を大幅に圧縮できます。
2. **`grid-rows` でコンテナ内を縦に積む：**
   並列する複数のノードがある場合、コンテナ（入れ子）を定義し、`grid-rows: 2` のように行数を指定して意図的に複数行に折り返します。
3. **テキストの引き算：**
   ノード内の説明文は最小限（名前のみなど）にし、詳細な説明はMarkdownの本文に委ねます。
4. **図の分割：**
   1枚の図に多くのコンポーネントを詰め込みすぎず、サブシステム単位や処理の流れ（シナリオ）ごとに図を複数枚に分割します。

---

## 生成AIの利用について

この記事の作成には、生成AIの Gemini（Google の gemini-3.7-flash）を使いました。構成の検討、本文の下書きと改稿、校正に使っています。Gemini CLI（Google の gemini-3.7-flash）で、本稿「Zennの表示崩れを防ぐ：D2 + TALAとCIによるアーキテクチャ図の自動生成と再現性検証」（Zenn正本）を新規に作成しました。筆者が内容を確認し、必要に応じて修正しました。公開した内容の責任は筆者が負います。
