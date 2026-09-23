---
title: 日本語ASRモデルを「実測」で選ぶ：CERのマイクロ平均とブートストラップ信頼区間、そして正規化の落とし穴
tags:
  - Python
  - 音声認識
  - whisper
  - 評価
private: true
updated_at: '2026-09-23T11:38:41+09:00'
id: d03611f9ccb258ff00dc
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

:::note info
この記事は生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。
:::

音声文字起こしアプリの日本語の既定モデルを、感覚ではなく数字で選び直しました。そのときに作った評価コードと、日本語特有の落とし穴を書きます。

結論から言うと、CER（文字誤り率）を出すコード自体は50行ほどで済みます。難しいのは**測り方の決め方**でした。平均の取り方、信頼区間、正規化のどこまでを吸収するか。ここを間違えると、モデルの差ではなく自分の前処理の差を測ることになります。

- 正本（Zenn Books『ローカル完結ボイスジャーナルの設計』）: [既定モデルを実測で覆した章を読む](https://zenn.dev/takenori_kusaka/books/quickscribe-design/viewer/default-model-reversal)
- 実装（OSS）: [Takenori-Kusaka/QuickScribe](https://github.com/Takenori-Kusaka/QuickScribe)

## 技術選定：なぜマイクロ平均とブートストラップなのか

CER の平均には2通りあります。

| 取り方 | 計算 | 性質 |
|---|---|---|
| マクロ平均 | 発話ごとの CER を平均 | 短い発話が過大に効く。「はい」1語の誤りが長文1本と同じ重み |
| **マイクロ平均** | 総編集距離 / 総参照長 | 発話長で重みづけされる。コーパス全体の誤り量を表す |

採ったのはマイクロ平均です。短い発話ほど CER が跳ねやすく、マクロ平均だと**コーパスに含まれる短文の割合で順位が動く**からです。

もう1つは不確実性の扱いです。モデルAが 0.184、モデルBが 0.190 だったとき、これは実際の差と言えるのか。発話単位のブートストラップで95%信頼区間を出し、**区間が重なる差は「差なし」として扱う**と決めました。個人開発でモデルを選ぶ程度の用途でも、これを決めておかないと毎回自分の期待でどちらとも読めてしまいます。

## 実装：CERと信頼区間

編集距離は1行の DP で足ります。外部依存を足さずに済むので、CI の実行時間もぶれません。

```python
# 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/scripts/asr_eval/cer.py
def edit_distance(ref: Sequence, hyp: Sequence) -> int:
    """文字（要素）単位の Levenshtein 距離。"""
    r, h = list(ref), list(hyp)
    if not r:
        return len(h)
    dp = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, dp[0] = dp[0], i
        for j in range(1, len(h) + 1):
            cur = dp[j]
            dp[j] = min(dp[j] + 1, dp[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
            prev = cur
    return dp[len(h)]
```

肝は、発話ごとに CER を出すのではなく、**(編集距離, 参照長) の組を貯めること**です。この形で持っておけば、マイクロ平均とブートストラップの両方が同じ素から計算できます。

```python
# 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/scripts/asr_eval/cer.py
def utterance_stats(pairs: Sequence[Tuple[str, str]]) -> List[Tuple[int, int]]:
    """各発話の (編集距離, 参照長) を返す。マイクロ平均・ブートストラップの素。"""
    return [(edit_distance(r, h), len(r)) for r, h in pairs]


def micro_cer(stats: Sequence[Tuple[int, int]]) -> float:
    """マイクロ平均 CER = 総編集距離 / 総参照長。参照長ゼロは 0.0。"""
    total_len = sum(n for _, n in stats)
    if total_len == 0:
        return 0.0
    return sum(d for d, _ in stats) / total_len
```

信頼区間は、発話を復元抽出でリサンプリングして分布を作ります。

```python
# 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/scripts/asr_eval/cer.py
def bootstrap_ci(
    stats: Sequence[Tuple[int, int]],
    iters: int = 1000,
    seed: int = 1234,
    alpha: float = 0.05,
) -> Tuple[float, float, float]:
    """発話単位リサンプリングでマイクロ平均CERの (点推定, 下限, 上限) を返す。

    seed 固定で決定的（CIログの再現性のため）。alpha=0.05 で 95%CI。
    """
    n = len(stats)
    point = micro_cer(stats)
    if n == 0:
        return (point, 0.0, 0.0)
    rng = random.Random(seed)
    means = []
    for _ in range(iters):
        resample = [stats[rng.randrange(n)] for _ in range(n)]
        means.append(micro_cer(resample))
    means.sort()
    lo = means[int((alpha / 2) * iters)]
    hi = means[min(iters - 1, int((1 - alpha / 2) * iters))]
    return (point, lo, hi)
```

コピペするなら `seed=1234` の固定に注目してください。**CI のログに残る数字が実行ごとに変わると、回帰の判定ができません**。リサンプリングは乱数を使うので、シードを固定して決定的にします。

## 日本語の落とし穴：空白を消さないと誤りが増える

ここが日本語で一番効きました。日本語には語間の空白がありません。ところが正規化や NFKC を通すと空白の現れることがあり、文字単位で比較すると**その空白1つが1文字の誤りとして数えられます**。

```python
# 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/scripts/asr_eval/normalize_ja.py
# 日本語 ASR 評価用テキスト正規化（ADR-0024 / #578）。
# 参照文・仮説文に**同一**適用する。CER の前に空白を完全除去するのが日本語の必須点
# （日本語は語間空白が無いのに正規化で空白が生まれ、文字単位比較で1文字と数えてしまうため）。
#
# パイプライン（ADR-0024）:
#   括弧内注記(ルビ/タグ)除去 → (任意)neologdn → NFKC → ラテン小文字化 → 約物/記号除去 → 空白完全除去
# 数字表記・かな種別の吸収は「モデルの実出力差を隠す」ため**既定 OFF**（コア価値=実差を消さない）。
```

記号の除去は、文字を1つずつ見るのではなく Unicode のカテゴリで判定します。この書き方だと、長音記号（ー）や踊り字（々）が Lm カテゴリなので残ります。約物だけを落としたいときに、除去する文字を列挙して漏らす事故が起きません。

```python
# 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/scripts/asr_eval/normalize_ja.py
def _strip_symbols(s: str) -> str:
    """Unicode カテゴリで約物(P*)・記号(S*)を除去する。々ー等の Lm は保持される。"""
    return "".join(ch for ch in s if unicodedata.category(ch)[0] not in ("P", "S"))


def _strip_spaces(s: str) -> str:
    """半角/全角を含むあらゆる空白を完全除去する（日本語CERの必須処理）。"""
    return re.sub(r"\s+", "", s).replace("　", "")
```

長音やダッシュ、繰り返し記号、半角カナの正規化は [neologdn](https://pypi.org/project/neologdn/) に任せ、未導入の環境ではスキップできるようにしています。C 拡張なので、ローカルの Windows では入らないことがあるからです。

**そして、数字表記（「2つ」と「二つ」）やかな種別の吸収は既定で切っています。** 吸収すれば CER は下がりますが、下がった分はモデルの実際の出力差です。表記を揺らすモデルと揺らさないモデルの区別が消えるので、選定の材料としては使えなくなります。どこまで吸収するかは、**測る目的で決める**しかありません。

## 何を選んだか、そして測れていないこと

既定モデルは `large-v3-turbo`（q5量子化）にしました。判断に使った数字は2種類です。

1つは**外部ベンチの引用**です。第三者の日本語ASRベンチで、会話音声の CER は large-v3-turbo が 0.184、当時の既定だった kotoba-whisper v2.0 が 0.495 でした。これは自分で測った数字ではありません。

もう1つは**自分の実録音での実測**です。11分40秒の録音を同じ設定で通し、タイムスタンプの到達点と RTF を見ました。kotoba は末尾24秒を落とし、turbo は実文末まで到達しました。公開コーパスは自発発話とドメインが違うので、**用途に近い録音で確かめる**ほうを最終判断の材料にしました。

正直に書いておくべきことが2つあります。

1つ目は、**上のCERハーネスと、いま CI が回している回帰ゲートが別物**だという状態です。回帰ゲートの基準値ファイルには、いまもこう書かれています。

```json
// 出典: https://github.com/Takenori-Kusaka/QuickScribe/blob/f51e1104e7a82d56c22739bbab2f270bc10f297d/docs/perf/ja-cer-baseline.json
  "baselines": {
    "tiny": 0.569,
    "base": 0.44,
    "kotoba-q5": 0.383
  }
```

既定にした `large-v3-turbo` の基準値がありません。撤去したモデルの値だけが残っています。**物差しを作ったのに、肝心のモデルを載せ替えていない。** これは記事のために取り繕う理由がない、単なる未完了です。

2つ目は、自前の評価が音読の3サンプルで始まっていることです。公開コーパス（[Common Voice](https://commonvoice.mozilla.org/ja) など）を CI 実行時に取得する設計へ切り替えましたが、**自発発話の日本語コーパスはまだ入っていません**。ブートストラップの信頼区間は N が小さいと広くなるだけで、代表性の不足は埋められません。
