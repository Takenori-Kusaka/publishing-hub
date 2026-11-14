---
title: エージェント評価の pass^k・信頼区間・無事故の上限を Python の標準ライブラリだけで計算する
tags:
  - Python
  - LLM
  - AIエージェント
  - 統計
  - 評価
private: true
updated_at: ''
id: null
organization_url_name: null
slide: false
ignorePublish: false
---

:::note info
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。
:::

# はじめに

AIエージェントの評価で「成功率 90%」と報告すると、次の 3 つが抜け落ちます。同じタスクを繰り返して毎回成功するか、その 90% がどれだけ確かか、危険な操作 0 件の意味は何か、です。この記事は、この 3 つを Python の標準ライブラリだけで計算する手順です。外部パッケージは使いません。

- 正本（Zenn）: [RAG の次に学ぶ AgentOps ― 間違えても危険な操作が通らないエージェントの作り方](https://zenn.dev/takenori_kusaka/articles/agentops-reliability-guide)
- コード: [GitHub リポジトリ](https://github.com/Takenori-Kusaka/agentops-reliability-guide)（`tools/eval_stats.py`）

# 技術選定の理由

| 要素 | 選んだもの | 理由 |
| --- | --- | --- |
| 組み合わせの数 | `math.comb` | pass^k と pass@k の推定は二項係数の比で書ける。Python 3.8 以降の標準ライブラリにある |
| 正規分布の分位点 | `statistics.NormalDist` | Wilson 区間と必要件数の計算に使う z 値を、SciPy なしで求められる |
| 入力 | `csv.DictReader` | 試行ごとに 1 行の CSV（task_id と success）を読むだけで足りる |

`math.comb` の仕様は [Python の公式ドキュメント](https://docs.python.org/ja/3/library/math.html#math.comb)、`NormalDist` は [statistics モジュールのドキュメント](https://docs.python.org/ja/3/library/statistics.html#statistics.NormalDist) にあります。

# pass^k と pass@k

pass^k は、1 つのタスクを独立に k 回実行したとき、すべて成功する確率です。τ-bench が導入した指標で、タスクごとに計算してから平均します。n 回試して c 回成功したタスクでは、成功した c 回から k 回を選ぶ組み合わせの数を、n 回から k 回を選ぶ組み合わせの数で割ります。

```python
# https://github.com/Takenori-Kusaka/agentops-reliability-guide/blob/3af72443abba1f789d0f925f0c56e478566361bb/tools/eval_stats.py
def pass_hat_k(n: int, c: int, k: int) -> float:
    """pass^k for one task: probability that k trials drawn from n are all successes (tau-bench)."""
    if k > n:
        raise ValueError("k must be <= n")
    return math.comb(c, k) / math.comb(n, k)


def pass_at_k(n: int, c: int, k: int) -> float:
    """pass@k for one task: probability that at least one of k trials drawn from n succeeds."""
    if k > n:
        raise ValueError("k must be <= n")
    return 1.0 - math.comb(n - c, k) / math.comb(n, k)


def mean_over_tasks(trials: dict, k: int, metric=pass_hat_k) -> float:
    """trials: {task_id: [0/1, ...]}. Average the per-task metric (do not raise the mean success rate to k)."""
    vals = [metric(len(t), sum(t), k) for t in trials.values()]
    return sum(vals) / len(vals)
```

タスク A が 4 回中 4 回、タスク B が 4 回中 2 回成功した場合、pass^2 は A が 1、B が 6 分の 1 で、平均は約 0.583 です。平均成功率 0.75 を 2 乗すると 0.5625 になり、値がずれます。タスクごとの成功しやすさを無視するからです。

# Wilson 区間

成功率の信頼区間には Wilson 区間を使います。件数が少なくても、成功率が 0% や 100% に近くても、区間が 0〜1 の範囲に収まります。

```python
# https://github.com/Takenori-Kusaka/agentops-reliability-guide/blob/3af72443abba1f789d0f925f0c56e478566361bb/tools/eval_stats.py
def wilson(c: int, n: int, conf: float = 0.95):
    """Wilson score interval for a success rate c/n."""
    z = NormalDist().inv_cdf(1 - (1 - conf) / 2)
    p = c / n
    d = 1 + z * z / n
    m = p + z * z / (2 * n)
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return (m - h) / d, (m + h) / d
```

20 件中 18 件の成功（90%）の 95% 信頼区間は 69.9% から 97.2% です。20 件の評価では、90% と 70% を区別できません。

# 全件無事故のときの上限

n 件の独立した試行で危険な操作が 1 件もなかったとき、危険率の片側 95% の上限は次の式で求まります。およそ 3/n で、3 の法則と呼ばれます。

```python
# https://github.com/Takenori-Kusaka/agentops-reliability-guide/blob/3af72443abba1f789d0f925f0c56e478566361bb/tools/eval_stats.py
def zero_failure_upper(n: int, conf: float = 0.95) -> float:
    """One-sided upper bound of the failure rate when all n independent trials had no failure.
    Approximately 3/n at 95% (rule of three)."""
    return 1 - (1 - conf) ** (1 / n)
```

100 件で 0 件なら上限は 2.95%、300 件で 0 件なら 0.99% です。独立で同じ確率という仮定での値なので、実際には試験だけでなく、実行時に操作を止める仕組みも置きます。

# 実行

試行ごとに 1 行の CSV を用意します。列は `task_id` と `success`（成功なら 1、失敗なら 0）です。タスク A を 4 回実行して 4 回成功、タスク B を 4 回実行して 2 回成功した結果なら 8 行になります。

`python tools/eval_stats.py passk results.csv 2` を実行すると、上の CSV で `tasks=2  pass^2=0.583  pass@2=0.917` を出力します。`python tools/eval_stats.py demo` は、Wilson 区間、無事故の上限、同じタスクで新旧を比べる McNemar の正確検定、2 群の比較に要る件数の例をまとめて出力します。

# まとめ

- pass^k はタスクごとに計算して平均する。平均成功率を k 乗しない
- 成功率には信頼区間を添える。20 件では 90% と 70% を区別できない
- 評価で 0 件でも危険率 0 の証明ではない。上限はおよそ 3/n

評価の設計の全体（採点器の組み合わせ、軌跡の評価、評価器の監査）と、出力・行動の制御、回復、運用は、正本の [Zenn の記事](https://zenn.dev/takenori_kusaka/articles/agentops-reliability-guide) とスライドにまとめています。
