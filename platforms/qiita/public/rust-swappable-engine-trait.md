---
title: Rustで「実行時にユーザーが選ぶ実装」を差し替える：enum直書き・ジェネリクスと比べて trait オブジェクトに決めた理由
tags:
  - Rust
  - trait
  - 設計
  - OSS
private: true
updated_at: '2026-09-22T22:52:28+09:00'
id: bae1f340d99b5775efcd
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

:::note info
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。
:::

設定画面でユーザーが選んだ文字列から、対応する処理実装を組み立てて返す。よくある要件ですが、Rust だと最初の一手で迷います。enum を直接 match するか、ジェネリクスで型パラメータにするか、`Box<dyn Trait>` を返すか。

個人開発のデスクトップアプリで、この分岐を2つのサブシステム（音声の文字起こしと、テキストの整形）に対して実装しました。どちらも「ローカル実装1つ + クラウド実装4〜6種」を実行時に切り替えます。結論は trait オブジェクトでしたが、**同じ要件を2箇所で別々の書き方で解いてしまい、片方が明らかに保守しやすくなった**ので、その差分まで含めて書きます。

- 正本（Zenn Books『ローカル完結ボイスジャーナルの設計』）: [エンジン抽象の章を読む](https://zenn.dev/takenori_kusaka/books/quickscribe-design/viewer/engine-abstraction)
- 実装（OSS）: [Takenori-Kusaka/QuickScribe](https://github.com/Takenori-Kusaka/QuickScribe)

## 前提にした要件

コードを見る前に、何を満たしたかったのかを書いておきます。ここが違うと結論も変わります。

- 実装は複数ある。文字起こしはローカルとクラウド4種、整形はローカルとクラウドで合計6種。
- **選ぶのは実行時のユーザー**。ビルド時には決まりません。設定に保存された `"groq"` や `"ollama"` のような文字列から組み立てます。
- 未設定や未知の文字列が来たら、鍵の要らないローカル実装に倒す。設定ミスで意図せず外部へ送信してしまう事故を、型システムの外側でも防ぎたい。
- プロバイダが増えても、呼び出し側を書き換えない。

3番目が地味に効きます。文字列は自由入力に近いので、`match` の網羅性チェックが助けてくれない領域です。

## 技術選定：なぜ trait オブジェクトにしたか

候補は3つありました。

| 候補 | 実行時に選べるか | 見送った / 採った理由 |
|---|---|---|
| `enum` + `match` を呼び出し側に直書き | 選べる | 分岐が呼び出し側へ漏れる。プロバイダを足すたびに使用箇所すべてを直すことになる |
| ジェネリクス `<E: Engine>` | **選べない** | 実装がコンパイル時に確定する必要がある。型が呼び出し連鎖に伝播し、単相化でコードも膨らむ |
| trait オブジェクト `Box<dyn Engine>` | 選べる | 実行時に1つ選んで返せる。呼び出し側は trait だけを見る |

ジェネリクスを落とした理由は、いちばん明快でした。要件の2番目「選ぶのは実行時のユーザー」と、ジェネリクスの「実装はコンパイル時に確定する」が正面から衝突します。速度のためにジェネリクスを選びたくなるところですが、そもそも要件を満たしません。

動的ディスパッチのコストも、この用途では論点になりませんでした。呼び出しは「重い処理を1回」で、中身はネットワーク往復かモデル推論です。vtable の間接参照1回は、その隣に置くと誤差になります。逆に言えば、1秒間に何万回も呼ぶ層で同じ判断をしてはいけない、ということでもあります。

言語仕様と設計指針は、公式ドキュメントに当たるのが確実です。trait オブジェクトの仕組みとコストは [The Rust Programming Language の 18-02](https://doc.rust-lang.org/book/ch18-02-trait-objects.html) にまとまっています。`dyn` が2つのポインタ（データと vtable）を持つ話と、ジェネリクスよりコードサイズが小さくなる点は [std の `dyn` の項](https://doc.rust-lang.org/std/keyword.dyn.html) にあります。「trait オブジェクトとして使うなら object-safe に保て」という指針は [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/flexibility.html) の C-OBJECT です。

## 抽象は小さく保つ

trait は小さいほど実装を足しやすくなります。文字起こし側はこれだけです。

```rust
// 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/src-tauri/src/stt.rs
/// 文字起こしエンジンの抽象（S2.3 / Strategy・DIP 境界）。
pub trait TranscriptionEngine {
    fn transcribe(
        &self,
        audio: &[f32],
        lang: Option<&str>,
        timestamps: bool,
        on_progress: Box<dyn FnMut(i32) + Send>,
        on_segment: Box<dyn FnMut(String) + Send>,
    ) -> Result<String, String>;
}
```

ここで効いているのは `Box<dyn FnMut(i32) + Send>` の `Send` です。文字起こしは重いので別スレッドで走らせ、進捗と確定テキストをコールバックで返します。`Send` を trait の型に書いておくと、スレッドを跨げないクロージャを渡す実装がコンパイル時に弾かれます。**抽象境界は「何を差し替えられるか」だけでなく「差し替える実装が守るべき制約」まで型で語れる**、というのがこの1行の意味です。

整形側はさらに小さく、1メソッドです。

```rust
// 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/src-tauri/src/refine.rs
pub trait FormattingEngine {
    fn refine(&self, req: &RefineRequest) -> Result<String, String>;
}
```

エラーを `Result<String, String>` で統一しているのも意図的です。プロバイダごとに違う失敗（鍵なし、ネットワーク、非対応形式）を境界の内側に閉じ込め、上位でユーザー向けの安定したエラーコードへ変換します。

## 組み立てる場所を1箇所に閉じる

肝は、文字列からエンジンを組み立てる場所を1箇所にまとめることです。文字起こし側はファクトリ関数がその一点です。

```rust
// 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/src-tauri/src/stt.rs
pub fn engine_for(cfg: SttConfig) -> Box<dyn TranscriptionEngine> {
    SttProvider::parse(&cfg.provider).make_engine(cfg)
}
```

解釈と組み立ては `SttProvider` という enum に集約されています。文字列の解釈はこうです。

```rust
// 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/src-tauri/src/stt.rs
    pub fn parse(provider: &str) -> Self {
        match provider.trim().to_ascii_lowercase().as_str() {
            "groq" => Self::Groq,
            "openai" => Self::OpenAi,
            "deepgram" => Self::Deepgram,
            "azure" => Self::Azure,
            _ => Self::Local,
        }
    }
```

コピペするなら、注目してほしいのは最後の `_ =>` です。未設定・未知の値はすべて `Local`、つまりローカル実装に倒れます。これは保険というより、要件の3番目を型システムの外側（設定文字列の揺れ）に対して守るための実装です。`trim()` と `to_ascii_lowercase()` を通しているのも同じ理由で、設定ファイルを手で編集した人の大文字や空白を事故にしません。

プロバイダの数と実装の数は一致しなくてよい、という点も trait オブジェクトの利点に含まれます。Groq と OpenAI は OpenAI 互換APIなので、同じエンジン実装を共有しています。

## 同じ問題を2通りに解いて、差が出た

ここが本題です。整形側では、同じ問題をもう一段違う形で解きました。プロバイダ文字列の解釈・別名・既定モデル・エンジン生成を、enum に集約したのです。

```rust
// 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/src-tauri/src/refine.rs
pub fn engine_for(provider: &str) -> Box<dyn FormattingEngine> {
    RefineProvider::parse(provider).make_engine()
}
```

ファクトリ関数は `RefineProvider` へ委譲するだけの薄い関数になりました。enum 側が `parse`（別名解釈）、`default_model`、`is_aws`、`make_engine` を持ちます。

いま両方が同じ形に揃っているのは、最初からそうだったからではありません。**初期の文字起こし側は、`engine_for` の中で文字列を直接 match し、各プロバイダの構造体をその場で組み立てていました**。動きはします。しかし「プロバイダとは何か（別名・既定モデル・種別）」という知識が関数の中に閉じていて、外から問い合わせられません。整形側の enum なら、プロバイダに関する問いをすべて1つの型へ投げられます。探す場所が決まっている、という違いです。

差がはっきりしたので、あとで文字起こし側も enum へ寄せました。集約のコミットには、整形側で先に済ませた単一ソース化を横へ広げた改修だと記録されています。**片方だけ先に良い形へ寄せておくと、比較対象ができて、後の判断が楽になります。** 2箇所で別々に解いたのは事故でしたが、結果としては設計の実験になりました。

## まとめ

- 実行時にユーザーが実装を選ぶなら、ジェネリクスは要件を満たしません。trait オブジェクトを返すファクトリに寄せます。
- 動的ディスパッチのコストは、呼び出しの中身（ネットワーク、モデル推論）と比べて判断します。呼ぶ回数が支配的な層では結論が変わります。
- ワイルドカードのフォールバック先を「安全側の実装」にしておくと、設定文字列の揺れが事故になりません。
- ファクトリを「文字列を match する関数」ではなく「enum に委譲する薄い関数」にすると、プロバイダに付随する知識の置き場所が決まります。増えるのが分かっているなら、最初からこちらを選ぶのがよかったと思っています。
