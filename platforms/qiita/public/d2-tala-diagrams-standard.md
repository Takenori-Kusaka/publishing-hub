---
title: "D2+TALA+resvgでアーキテクチャ図をPNG自動レンダリングしCI検証する技術レシピ"
tags: ["D2", "WASM", "GitHubActions", "CI", "resvg"]
private: true
ignorePublish: false
updated_at: '2026-09-16T00:00:00+09:00'
---

:::note info
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。
:::

## 1. 概要と開発の目的
技術ブログやドキュメントをGit管理する際、アーキテクチャ図の維持管理は常に悩ましい課題です。
画像ファイルを手動で編集すれば「ソースコード（.d2）と実際のPNG画像が乖離する」リスクが生じます。
また、Mermaidでは「複雑なコンテナを入れ子にした際、横方向へ際限なく広がり表示幅をオーバーする」問題が起きます。

本稿では、D2とTALA、また resvg-js の組み合わせを用います。
この構成から、WASMベースで動作するアーキテクチャ図の自動レンダリングと、CIでの再現性・表示幅（700px）検証システムを構築する手順を説明します。

本稿で解説する仕組みの正本（SSOT）となる詳細な設計と運用ルールは、以下のZenn記事にて公開しています。
- 正本記事：[Zennの表示崩れを防ぐ：D2 + TALAとCIによるアーキテクチャ図の自動生成と再現性検証](https://zenn.dev/takenori_kusaka/articles/d2-tala-diagrams-standard)

---

## 2. 技術選定理由
本システムの実装において、なぜこれらの技術を組み合わせたのか、その選定理由を以下に記載します。

1. **D2 ＋ TALA の採用：**
   従来のレイアウトエンジン（Dagre等）は一方向のフロー図に強みがあります。
   しかし、複雑なコンテナ構造の表現には弱く、線が交差して見づらくなりがちでした。
   TALAは直交レイアウトに特化しています。
   これにより、ホワイトボードに描いたような直線配置を自動生成します。
   D2 v0.9.0以降、TALAはオープンソース（MPL-2.0）として同梱され、ライセンスなしで利用できます。
2. **WASM & Native JS モジュールの採用：**
   D2の公式CLI（`d2` コマンド）を用いてPNGを出力する場合、内部的に Playwright 等を起動してヘッドレスブラウザ経由でラスタライズを行います。
   動作が重く、CI環境での依存ライブラリのセットアップも繁雑になります。
   本システムでは npm パッケージ `@d2lang/d2`（WASM実装）および `@resvg/resvg-js`（Rust実装の高速SVGラスタライザ）を直接Node.jsから叩きます。
   これにより、ブラウザ起動が完全に不要になり、極めて軽量かつゼロ依存で動作します。
3. **メタデータ（.png.json）による再現性確保：**
   TALAエンジンはレイアウト計算に「乱数性」を持つため、同一のソースファイル（.d2）から生成しても描画環境やバージョンによってノード配置が変わります。
   結果として、予期せぬレイアウトになるリスクを伴います。
   これを防ぐため、出力ハッシュやバージョン情報、自然サイズをメタデータとして画像に並置し、CIで厳密に不一致を検知します。

---

## 3. コアコードの実装
本図面生成システムを支えるNode.jsスクリプトのコアロジックから、重要な3箇所を逐語で抜粋して紹介します。

### 3.1 D2 WASM によるコンパイルと resvg ラスタライズ
ソーステキストからD2エンジンを起動してSVGを出力し、それを resvg-js でPNGバイナリへと高速変換する一連の処理です。

```javascript
// scripts/figures/render-d2.mjs
// ...
  const d2 = new D2();
  const compiled = await d2.compile(srcText, { layout, ...policy.render });
  const svg = await d2.render(compiled.diagram, compiled.renderOptions);
  await d2.dispose();

  const natural = naturalSize(svg);
  const fontFamily = policy.fonts.default_font_family;
  const buf = new Resvg(svg, {
    fitTo: { mode: 'width', value: Math.max(1, Math.round(natural.width * policy.raster.scale)) },
    font: { loadSystemFonts: policy.fonts.load_system_fonts, defaultFontFamily: fontFamily },
  })
    .render()
    .asPng();

  const size = pngSize(buf);
  return {
    srcText,
    layout,
    natural,
    fontFamily,
    png: buf,
    pngInfo: { ...size, sha256: sha256(buf) },
  };
// ...
```

### 3.2 PNGのバイナリ（IHDR）から寸法を読み取る処理
外部の重い画像処理ライブラリに依存せず、PNGバイナリのヘッダから直接安全に幅と高さを抽出するユーティリティ関数です。

```javascript
// scripts/figures/render-d2.mjs
// ...
/** PNG の IHDR から寸法を読む(依存なし) */
export function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
// ...
```

### 3.3 D2ソースファイルからのレイアウトエンジン判定
d2ソースコードに特定のレイアウトエンジン指定の変数が含まれる場合にそれを正規表現で抽出し、無ければ標準ポリシーのレイアウト（tala）にフォールバックするロジックです。

```javascript
// scripts/figures/render-d2.mjs
// ...
/** この図のレイアウトエンジン。d2 ソースが vars.d2-config.layout-engine で上書きしていれば従う */
export function layoutFor(src, policy) {
  const m = /layout-engine\s*:\s*(dagre|elk|tala)/.exec(src);
  return m ? m[1] : policy.layout;
}
// ...
```

---

## 4. GitHub ActionsによるCI自動検査のレシピ
メタデータ（.png.json）を利用して、CI上でアーキテクチャ図の自然幅（700px以下）と再現ハッシュを検証するワークフローの一部は、以下のように定義します。

```yaml
# .github/workflows/validate.yml
# ...
      - name: Run all content checks (npm run check)
        id: check
        run: npm run check
# ...
```

このリントステップによって、以下の規則（D1〜D6）が検証されます。
- `D4`：手動で上書きされたPNGファイルを検出（メタデータのハッシュ不一致を検知）
- `D5`：自然幅（natural.width）が700pxを超えている場合にエラー（Zenn等での文字潰れを防止）
- `D6`：既定のレイアウトエンジンを変更している場合、d2ソース内にその理由コメント（例：`# 一方向フローのため dagre を選択`）があるかを検証

---

## 5. まとめと関連リソース
D2 + TALA + resvg-js の組み合わせは、ヘッドレスブラウザを必要としない軽量・高速な図面ラスタライズ環境を提供します。
GitのコミットフックやCIの検査にこれを組み込むことで、ドキュメントの記述と図面の同期を完全に自動検証できるようになります。

さらに深く学びたい方は、以下の公式ドキュメントおよびリポジトリを参照してください。
- D2 公式ドキュメント: [D2 Tour](https://d2lang.com/tour/tala/)
- D2 GitHub リポジトリ: [terrastruct/d2](https://github.com/terrastruct/d2)
- Rust製SVGラスタライザ resvg: [crates.io resvg](https://crates.io/crates/resvg)
