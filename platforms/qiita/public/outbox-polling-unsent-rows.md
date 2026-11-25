---
title: アウトボックスのポーリングは「未送信の行」を読む ― 連番の続きだけ読むと読み飛ばす(PostgreSQL・Python)
tags:
  - PostgreSQL
  - Python
  - Redpanda
  - マイクロサービス
  - 設計
private: false
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

DB の更新と同じトランザクションで送信用の表(アウトボックス)に行を書き、別のプロセスがその行をブローカーへ運ぶ。この運び手をポーリングで作るとき、最後に読んだ連番を覚えておき、それより大きい行だけを読む作りにしたくなります。この作りは、障害を入れなくても、応答済みの更新を読み飛ばしました。この記事は、読み飛ばす作りと読み飛ばさなかった作りの違いと、測った結果です。

- 正本(Zenn): [データはコードより長く残る ― 大規模クラウドサービスの設計ガイドと、2 回ずつ測ったケーススタディ](https://zenn.dev/takenori_kusaka/articles/data-intensive-design-guide)
- コードと結果: [data-intensive-design-casestudy](https://github.com/Takenori-Kusaka/data-intensive-design-casestudy)(`cs/a/relay.py`、`results/a/summary.md`)
- ケーススタディのスライド: [Web スライド](https://takenori-kusaka.github.io/data-intensive-design-casestudy/)、[Docswell](https://www.docswell.com/s/takenori_kusaka/5Y8XLE-2026-11-25-213232)
- 前提のガイド: [data-intensive-design-guide](https://github.com/Takenori-Kusaka/data-intensive-design-guide)

題材は架空の宅配注文サービスで、会社・サービス・数値は架空です。測ったのは 1 台の Docker 環境で、件数は、この手順と試行の数での結果です。

# 設計の背景:なぜ読み飛ばすのか

実験の構成は次のとおりです。注文サービスが、注文の表の更新と同じトランザクションで、アウトボックスの表に行を書きます。運び手がその行を読み、ブローカー(Kafka 互換の Redpanda)へ発行します。ブローカーから読む受け手は 2 つです。索引は、注文ごとの最新の状態を持つ検索用の表です。通知は、送信の履歴です。どちらも、別の PostgreSQL に置いています。

アウトボックスの表の連番は bigserial で振っています。連番は INSERT の時点で決まり、行がほかのセッションから見えるのはコミットの後です。

並行する 2 つのトランザクションを考えます。先に INSERT した側が小さい連番を取り、後から INSERT した側が大きい連番を取ります。後の側が先にコミットすると、運び手は大きい連番の行を読み、「ここまで読んだ」と覚えます。その後で小さい連番の行がコミットされても、覚えた連番より小さいので、もう読まれません。

呼び出し元には成功と応答済みで、DB にも行はあります。この実験では、読み飛ばしがあった実行でも、呼び出し元に失敗が返った要求は 0 件でした。運び手のコードにも、読み飛ばしに気づく分岐はありません。

# 2 つの読み方

運び手は、読み方を切り替えられるように作りました。読み方が `unsent` のときは未送信の行を連番の順に読み、そうでないときは、覚えた連番より大きい行だけを読みます。ブローカーの確認応答を待ってから、行に送信済みの印を付けます。

```python
# https://github.com/Takenori-Kusaka/data-intensive-design-casestudy/blob/9a7becae28f06cc72fd751f30daf28a87d4dc282/cs/a/relay.py
    while not _stop:
        if mode == 'unsent':
            rows = conn.execute('select id, aggregateid, payload from outbox where not sent order by id limit %s',
                                (C.RELAY_BATCH,)).fetchall()
        else:
            last = conn.execute('select last_id from relay_state where k = 1').fetchone()[0]
            rows = conn.execute('select id, aggregateid, payload from outbox where id > %s order by id limit %s',
                                (last, C.RELAY_BATCH)).fetchall()
        if not rows:
            time.sleep(C.RELAY_POLL_MS / 1000)
            continue
        failed = []

        def cb(err, msg):
            if err is not None:
                failed.append(err.name())
        for _id, key, body in rows:
            producer.produce(spec['topic'], key=key, value=body, on_delivery=cb)
        left = producer.flush(15)
        if failed or left:
            # not acknowledged: keep the rows and publish the whole batch again
            # (rows of the batch that did reach the broker are then sent twice)
            time.sleep(0.2)
            continue
        published += len(rows)
        # ...
        ids = [r[0] for r in rows]
        with conn.transaction():
            conn.execute('update outbox set sent = true where id = any(%s)', (ids,))
            if mode == 'watermark':
                conn.execute('update relay_state set last_id = %s where k = 1', (ids[-1],))
```

ポイントは 3 つです。

- 未送信の行を読む作りは、後からコミットされた小さい連番の行も、次の周回で読みます。読む条件が連番の大小ではなく、送信済みの印だからです。
- 確認応答が無ければ印を付けず、同じ行をもう一度発行します。ブローカーに届いていた行は 2 回送られます。
- そのため、受け手には重複が届きます。受け手は、イベントの ID を効果と同じトランザクションで処理済みの表に入れ、既にある ID を飛ばす作りにしました。

# 測った結果

測り方は次のとおりです。

- 1 試行は、注文 200 件への更新 2,000 件です。試行ごとに、コンテナとボリュームを作り直します。
- 条件ごとに 5 試行し、その全体を、同じコードで最初から 2 回流しました。
- 表の数は 5 試行の合計です。「1 回目・2 回目」の順に並べ、かっこの中は、1 件以上起きた試行の数です。数が 1 つだけの欄は、2 回とも同じ値でした。
- 障害は入れていません。

数えたものは 2 つです。「読み飛ばし」は、呼び出し元に成功と応答したのに、索引に 1 回も効かなかったイベントの数です。「最終状態の食い違い」は、最後まで待った後、索引の最後のイベントが、注文の表の最後のイベントと違う注文の数です。どちらも、種を固定した生成器から作った正解と、DB と索引の最終状態を比べて数えました。

| 条件 | 連番の続きだけ読む:読み飛ばし | 連番の続きだけ読む:最終状態の食い違い(注文) | 未送信の行を読む:読み飛ばしと食い違い |
| --- | --- | --- | --- |
| 並行度 1 | 0 | 0 | 0 |
| 並行度 4 | 12(5/5 試行)・1(1/5 試行) | 2(2/5 試行)・0 | 0 |
| 並行度 16 | 76(5/5 試行)・85(5/5 試行) | 10(4/5 試行)・6(3/5 試行) | 0 |
| 長いトランザクション＋並行度 4 | 54(5/5 試行)・58(5/5 試行) | 3(3/5 試行)・4(4/5 試行) | 0 |

長いトランザクションの条件は、書き手の 1 つが 25 件に 1 回、コミットまで 200 ms 待つものです。

読み飛ばしの数より、最終状態の食い違いは少なくなりました。索引は、同じ注文に後から別の更新が届くと、上書きで一致に戻るからです。食い違ったまま残ったのは、その注文の最後の更新を読み飛ばした場合だけです。通知は上書きされないので、読み飛ばした分は失われたまま戻りません。

実験では、注文の表と索引の差を数えて直す照合も流しました。照合が見つけた数は、上の表の最終状態の食い違いと同じで、読み飛ばしの数より少なくなっています。並行度 4 の 2 回目は、1 件を読み飛ばし、照合が見つけた差は 0 でした。照合で拾えるのは索引に残った差だけで、通知の欠落は戻りません。

並行度 4 の結果は、2 回の実行で大きく違いました。1 回しか流していなければ、どちらか一方だけを結果として書いていたはずです。未送信の行を読む作りの「0」も、この手順と試行の数で起きなかったという意味で、起きないことの証明ではありません。

# 未送信の行を読む作りが払ったもの

この実測で読み飛ばしが 0 件だった作りにも、費用がありました。

- 重複:運び手を、確認応答の後、印を付ける前に強制終了するケースを流しました(3 試行。1 試行で 3 回の強制終了)。受け手に届いた重複は 77 回・164 回で、受け手の状態に 2 回効いた数は 0 でした。受け手の冪等性を外すと、届いた重複 74 回・72 回が、すべて通知に 2 回効きました。
- 遅れ:呼び出し元への応答は DB のコミットで返り、索引に届くのはその後です。DB のコミットから索引に効くまでの p50 は、障害なしの並行度 1 で 19.4 ms・17.2 ms でした。ポーリングの間隔は 50 ms の 1 通りだけで測っています。同じ環境の中での値です。

# もう 1 つの運び方:CDC

アウトボックスの運び方には、ポーリングのほかに、CDC(Debezium が DB の変更のログを読んで発行する方式)があります。同じ実験で、この構成も 2 回流しました。障害なしの並行度 1 の遅れは、読み取りの間隔を指定しない設定で、ポーリングより長くなりました。

遅れが設定で変わるかは、1 回だけ流した追加実験(障害なしの並行度 1、各 5 試行)で確かめました。2 回の比較はありません。コネクタが新しい変更イベントを待つ間隔(poll.interval.ms)を縮めるたびに、遅れの p50 は縮みました。試した範囲では、同じセッションのポーリングとの大小は入れ替わっていません。設定の意味と既定値は、[Debezium 3.7 の PostgreSQL コネクタの文書](https://debezium.io/documentation/reference/3.7/connectors/postgresql.html#postgresql-property-poll-interval-ms)にあります。値と条件は正本にあります。

# 実行

手順は、リポジトリの `cs/a/README.md` の「流し方」にあります。要点は次のとおりです。

- 前提は、WSL2 の中の Docker Engine と `uv` です。初回だけ `cs/a/setup_venv.sh` で Python の環境を作ります。
- `cs/a/run.sh` を引数なしで流すと、題材の全部が流れます。Apache Kafka での照合も含み、イメージは合計で約 4 GB です。一部だけ流すときは、段の名前を引数で選びます。
- 結果は、1 回の実行を 1 行として `results/a/` の JSONL に追記されます。
- 並行の競合に頼る数は、流すたびに変わります。

# まとめ

- アウトボックスの運び手は、連番の続きではなく、未送信の行を読む
- 読み飛ばしがあっても、呼び出し元に失敗は返らなかった。照合が拾ったのは索引に残った差だけで、通知の欠落は戻らない
- 未送信の行を読む作りは重複を届けるので、受け手を冪等にする
- 「0 件」は、試行の数と、流し直したかを添えて読む

この実験は、大規模クラウドサービスの設計ガイドの主張を確かめたケーススタディの一部です。ほかの題材の結果は、正本の [Zenn の記事](https://zenn.dev/takenori_kusaka/articles/data-intensive-design-guide) にまとめています。
