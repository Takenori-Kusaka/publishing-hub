---
title: 長尺音声の文字起こしで末尾が消える：whisper.cppの30秒窓を「固定窓チャンク＋担当区間」で回避した実装
tags:
  - Rust
  - whisper
  - 音声認識
  - Tauri
private: true
updated_at: '2026-09-22T22:00:43+09:00'
id: caa499b2f874734b0f48
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

:::note info
この記事は生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。
:::

11分40秒の録音を文字起こしにかけたら、`[00:11:16]` で出力が止まりました。音声はまだ24秒続いているのに、そこから先が丸ごと失われ、末尾は同じトークンの反復で埋まっていました。

原因はモデルではなく、whisper の長尺デコードの構造にありました。この記事は、アプリ側で音声を固定長のチャンクに切り、各チャンクに「担当区間」を持たせて重複と欠落の両方を消した実装の記録です。パラメータ調整では直らなかった理由も書きます。

- 正本（Zenn Books『ローカル完結ボイスジャーナルの設計』）: [既定モデルを実測で覆した章を読む](https://zenn.dev/takenori_kusaka/books/quickscribe-design/viewer/default-model-reversal)
- 実装（OSS）: [Takenori-Kusaka/QuickScribe](https://github.com/Takenori-Kusaka/QuickScribe)

## 何が起きるのか：sequential long-form の seek

whisper の長尺文字起こしは、30秒の窓をスライドさせて進みます。次の窓へ進む量は固定値ではなく、**モデルが予測した末尾タイムスタンプ**です。窓を跨ぐ発話や、末尾タイムスタンプの予測が外れると、seek が最終窓を早期に打ち切り、そこで文字起こしが終わります。VAD で発話区間を切り出してからチャンク化する回避策は、[WhisperX の論文](https://arxiv.org/pdf/2303.00747)が定番として挙げているものです。反復と文脈の持ち越しについては、whisper.cpp 側にも[報告](https://github.com/ggml-org/whisper.cpp/issues/3744)があります。

つまり、出力の終端は音声の長さで決まらず、**モデルのタイムスタンプ予測の当たり外れで決まる**。ここが厄介でした。

## 技術選定：なぜパラメータではなくチャンク分割にしたか

最初に試したのは、前文脈への条件付けを切る設定（`no_context`）です。反復ループは消えました。しかし**末尾の早期終端は直らず、停止位置はむしろ早まりました**（`[11:21]` から `[11:16]` へ）。反復と末尾欠落は別の現象で、前者だけが消えたわけです。

候補は4つありました。

| 候補 | 効くか | 採否 |
|---|---|---|
| デコードのパラメータ調整（`no_context`、温度、beam） | 反復には効く。末尾欠落には効かない | 反復対策として併用。根治にはしない |
| モデルを替える | 弱いモデルでは悪化する。強いモデルでも30秒窓の構造は残る | 併せて実施。ただし構造問題は残る |
| **アプリ側で30秒未満のチャンクに切って個別にデコード** | 最終チャンクが必ず音声の末尾を含むので、末尾欠落が原理的に消える | **採用** |
| Silero VAD で発話区間を切る | 境界が自然になり、無音を跳ばせるので計算量も減る | 見送り（後述） |

VAD を見送ったのは、使っている `whisper-rs 0.14` と vendor されている `whisper-rs-sys 0.13.1` に whisper.cpp の `--vad` が入っておらず、依存の更新が必要だったからです。**依存を上げずに今日直せる手段が固定窓チャンクでした。** 無音の多い録音では VAD のほうが速くなるので、これは残った課題です。

## 実装：分割は「純粋関数」に切り出す

肝は、分割の計算を副作用のない関数に閉じ込めることです。whisper を呼ぶコードと混ぜると、境界条件をテストできません。

```rust
// 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/src-tauri/src/stt.rs
/// 長尺音声のチャンク分割パラメータ（#600 末尾欠落の根治）。
/// whisper の窓は30秒。それ未満のチャンクに切って個別デコードすることで、
/// whisper.cpp の sequential seek が長尺で末尾を落とす構造的問題を回避する。
/// overlap は境界で語が切れないための重なり。担当区間は overlap の中点で切って重複排除する。
pub const CHUNK_SECS: f64 = 24.0;
// overlap は境界の両側マージン。担当区間は overlap の中点で切るため、各チャンクは自分の音声末尾から
// overlap/2 だけ手前までしか担当しない＝末尾帯(whisper が単一窓でも稀に落としうる領域)を担当しない。
// 隣接チャンクは overlap/2 だけ内側から担当を始める＝コールドスタート直後の不安定セグメントも避ける。
// 4s(両側2sマージン)で末尾欠落の再発余地を潰す（独立レビュー指摘）。冗長デコードは約17%。
pub const OVERLAP_SECS: f64 = 4.0;
```

24秒と4秒という値には理由があります。30秒未満にするのは窓の構造を避けるためで、オーバーラップは境界で語が切れないためのマージンです。そして**各チャンクは、自分の音声の末尾までを担当しません**。担当の終わりを `overlap/2` だけ手前に置くことで、単一窓でも稀に落ちる末尾帯を隣のチャンクに任せます。代償は約17%の冗長デコードです。

分割の結果は、サンプル範囲と「担当区間」を持つ構造体で表します。

```rust
// 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/src-tauri/src/stt.rs
/// 1チャンクの分割仕様（純粋計算 / #600）。時刻はセンチ秒（1/100秒＝whisperのt0単位）。
#[derive(Debug, Clone, PartialEq)]
pub struct ChunkSpec {
    /// サンプル開始インデックス（含む）。
    pub start: usize,
    /// サンプル終端インデックス（含まず）。
    pub end: usize,
    /// チャンク先頭の絶対時刻（センチ秒）。セグメント時刻のオフセットに使う。
    pub offset_cs: i64,
    /// このチャンクが出力を担当する絶対区間の開始（含む・センチ秒）。
    pub own_start_cs: i64,
    /// 担当区間の終端（含まず）。最終チャンクは i64::MAX。
    pub own_end_cs: i64,
}
```

時刻の単位をセンチ秒（1/100秒）にしているのは、whisper が返すタイムスタンプの単位に合わせて、変換を1箇所に閉じるためです。浮動小数の秒で持ち回すと、境界の比較で誤差が入ります。

分割計画を作る関数はこうなります。

```rust
// 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/src-tauri/src/stt.rs
pub fn chunk_plan(total: usize, sr: u32, chunk_secs: f64, overlap_secs: f64) -> Vec<ChunkSpec> {
    if total == 0 {
        return Vec::new();
    }
    let sr_f = sr as f64;
    let chunk_n = ((chunk_secs * sr_f).round() as usize).max(1);
    // overlap は「チャンクの半分」を上限に制限する。stride>=chunk/2 を保証し、病的入力
    // (overlap>=chunk)での stride≒1サンプル→チャンク爆発を防ぐ（レビュー指摘）。overlap>50%は無意味。
    let overlap_n = ((overlap_secs.max(0.0) * sr_f).round() as usize).min(chunk_n / 2);
    let stride_n = (chunk_n - overlap_n).max(1);
    // half_overlap は「実際に stride に使う clamp 後の overlap_n」から導出する（生の overlap_secs から
    // 導くと overlap>=chunk の病的入力で担当境界が実 overlap 領域外へずれる / レビュー指摘 Finding3）。
    let half_overlap_cs = ((overlap_n as f64 / sr_f / 2.0) * 100.0).round() as i64;
    // ...
    // 担当区間を埋める: 先頭は0から、以降は自チャンク先頭＋overlap中点。終端は次チャンクの担当開始。
    let n = specs.len();
    for i in 0..n {
        let own_start = if i == 0 {
            0
        } else {
            specs[i].offset_cs + half_overlap_cs
        };
        let own_end = if i + 1 < n {
            specs[i + 1].offset_cs + half_overlap_cs
        } else {
            i64::MAX
        };
        specs[i].own_start_cs = own_start;
        specs[i].own_end_cs = own_end;
    }
    specs
}
```

コピペするなら、注目してほしいのは2つの防御です。

1つ目は `min(chunk_n / 2)` です。設定から `overlap >= chunk` が来ると、stride が1サンプルに潰れてチャンクが爆発します。オーバーラップを半分で打ち止めにして、stride が最低でもチャンクの半分になることを保証します。

2つ目は、`half_overlap_cs` を**打ち止め後の `overlap_n` から導いている**ことです。引数の `overlap_secs` から直接計算すると、病的な入力のときに担当境界が実際のオーバーラップ領域の外へずれます。片方だけ直すと静かに壊れる箇所です。

## 重複排除：区間の所有権で解く

オーバーラップがあるので、同じ発話が2つのチャンクから出てきます。これをテキストの類似度で消そうとすると、閾値の調整地獄に入ります。採ったのは**時刻で所有権を決める**方法です。各チャンクは `[own_start_cs, own_end_cs)` の中に始まるセグメントだけを出力します。

```rust
// 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/src-tauri/src/stt.rs
                let t0_local = state.full_get_segment_t0(i).unwrap_or(0);
                let abs_t0 = spec.offset_cs + t0_local;
                // overlap 中点で切った担当区間外のセグメントは隣接チャンクが出すのでスキップ。
                if abs_t0 < spec.own_start_cs || abs_t0 >= spec.own_end_cs {
                    continue;
                }
```

whisper が返す `t0` はチャンク内のローカル時刻なので、`offset_cs` を足して絶対時刻に直してから比較します。この数行が、**重複排除とタイムスタンプの整合を同時に片付けています**。テキストを見ずに時刻だけで決まるので、結果が決定的になります。

そして各チャンクのデコードでは、反復対策を併用します。

```rust
// 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/src-tauri/src/stt.rs
            // ハルシネーション/反復ループ抑制(#600)。前文脈を使うと末尾無音等での反復ループが固定され
            // 末尾が失われるため、前文脈を使わない。チャンク化と併せ末尾欠落を根治する。
            params.set_no_context(true);
```

チャンクを跨いで文脈を渡さないので、1つのチャンクで反復ループに入っても、次のチャンクは無関係に始まります。**故障の伝播を切るという意味でも、分割は効いています。**

## テストは「不変条件」で書く

分割を純粋関数にした見返りは、境界条件をテストで固定できることです。数値を1つずつ確かめるのではなく、担当区間が満たすべき性質を書きます。

```rust
// 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/src-tauri/src/stt.rs
    #[test]
    fn chunk_plan_ownership_windows_are_contiguous_and_cover_all() {
        // 担当区間は隙間なく連続し、[0, MAX) を覆う（重複も欠落もしない）。
        let sr = 16000;
        let specs = chunk_plan(sr as usize * 60, sr, 24.0, 2.0);
        assert_eq!(specs[0].own_start_cs, 0);
        for w in specs.windows(2) {
            assert_eq!(
                w[0].own_end_cs, w[1].own_start_cs,
                "隣接担当区間は境界を共有（重複/欠落なし）"
            );
        }
        assert_eq!(specs.last().unwrap().own_end_cs, i64::MAX);
        // overlap中点で切れている: chunk1 は offset(22s=2200cs)+overlap/2(100cs)=2300cs から担当。
        assert_eq!(specs[1].own_start_cs, 2200 + 100);
    }
```

「隣接する担当区間が境界を共有する」ことと「最後が `i64::MAX` で終わる」ことを言えば、**重複と欠落が同時にないことを1つのテストで主張できます**。オーバーラップを変えても、チャンク長を変えても、この性質は保たれるべきものです。

病的な入力も同じ形で固定しておきます。

```rust
// 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/src-tauri/src/stt.rs
    #[test]
    fn chunk_plan_pathological_overlap_does_not_explode() {
        // overlap>=chunk の病的入力でも、overlap は chunk/2 に制限され stride>=chunk/2 を保つ。
        // チャンク数は ~2*total/chunk 程度に収まり、爆発しない（レビュー指摘 Finding3）。
        let sr = 16000;
        let total = sr as usize * 120; // 120秒
        let specs = chunk_plan(total, sr, 24.0, 30.0); // overlap>chunk
        assert!(
            specs.len() <= 12,
            "stride>=chunk/2(12s) に制限され爆発しない: {} chunks",
            specs.len()
        );
        // 担当区間は依然として連続（重複/欠落なし）。
        for w in specs.windows(2) {
            assert_eq!(w[0].own_end_cs, w[1].own_start_cs);
        }
        assert_eq!(specs.last().unwrap().own_end_cs, i64::MAX);
    }
```

## 結果と、残った課題

末尾欠落は消えました。16分42秒の録音で、末尾 `[16:38]` まで到達しています。最終チャンクが必ず音声の末尾を含む構造なので、原理的に再発しません。

一方で、**チャンク化は総計算量を減らしません**。オーバーラップの分だけ増えます（設定値では約17%）。同じ16分42秒の録音は、チャンク化しても CPU で196分かかりました。品質の床を直しただけで、速度の床は別の問題として残りました。

残った課題は2つです。

1つ目は VAD です。固定窓は発話の途中で切ります。Silero VAD で発話区間を切れば、境界が自然になり、無音を跳ばせるので計算量も減ります。whisper.cpp 本体は `--vad` で対応済みですが、こちらが使っているバインディングの版に入っていないため、依存の更新が前提になります。

2つ目はオーバーラップ幅の根拠です。4秒という値は「両側2秒のマージンがあれば末尾帯を担当しない」という設計から来ていますが、**発話の切れ方を統計的に測って決めたわけではありません**。冗長デコード17%が妥当かどうかは、まだ測っていません。
