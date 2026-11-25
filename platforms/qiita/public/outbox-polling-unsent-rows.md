---
title: アウトボックスのポーリングは「未送信の行」を読む ― 連番の続きだけ読むと読み飛ばす(PostgreSQL・Python)
tags:
  - PostgreSQL
  - Python
  - Kafka
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

DB の更新と同じトランザクションで送信用の表(アウトボックス)に行を書き、別のプロセスがその行をブローカーへ運ぶ。この運び手をポーリングで作るとき、最後に読んだ連番を覚えておき、それより大きい行だけを読む作りにしたくなります。この作りは、障害を入れなくても、応答済みの更新を読み飛ばしました。この記事は、その再現の仕方と、読み飛ばさない作りの要点です。

- 正本(Zenn): [データはコードより長く残る ― 大規模クラウドサービスの設計ガイドと、2 回ずつ測ったケーススタディ](https://zenn.dev/takenori_kusaka/articles/data-intensive-design-guide)
- コードと結果: [data-intensive-design-casestudy](https://github.com/Takenori-Kusaka/data-intensive-design-casestudy)(`cs/a/relay.py`、`results/a/summary.md`)
- ケーススタディのスライド: [Web スライド](https://takenori-kusaka.github.io/data-intensive-design-casestudy/)、[Docswell](https://www.docswell.com/s/takenori_kusaka/5Y8XLE-2026-11-25-213232)
- 前提のガイド: [data-intensive-design-guide](https://github.com/Takenori-Kusaka/data-intensive-design-guide)

題材は架空の宅配注文サービスで、会社・サービス・数値は架空です。測ったのは 1 台の Docker 環境で、件数は、この手順と試行の数での結果です。

# 設計の背景:なぜ読み飛ばすのか

アウトボックスの表の連番は bigserial で振っています。連番は INSERT の時点で決まり、行がほかのセッションから見えるのはコミットの後です。

並行する 2 つのトランザクションを考えます。先に INSERT した側が小さい連番を取り、後から INSERT した側が大きい連番を取ります。後の側が先にコミットすると、運び手は大きい連番の行を読み、「ここまで読んだ」と覚えます。その後で小さい連番の行がコミットされても、覚えた連番より小さいので、もう読まれません。

呼び出し元には成功と応答済みで、DB にも行はあります。エラーはどこにも出ません。

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

1 回の実行は、注文 200 件への更新 2000 件です。障害は入れていません。同じ実験を最初から 2 回流し、条件ごとに 5 試行しました。数は「1 回目・2 回目」の順で、かっこの中は、1 件以上起きた試行の数です。

| 条件(障害なし) | 連番の続きだけ読む:応答済みなのに索引に効果なし | 未送信の行を読む |
| --- | --- | --- |
| 並行度 1 | 0・0 | 0 |
| 並行度 4 | 12(5/5 試行)・1(1/5 試行) | 0 |
| 並行度 16 | 76(5/5 試行)・85(5/5 試行) | 0 |
| 長いトランザクション＋並行度 4 | 54(5/5 試行)・58(5/5 試行) | 0 |

長いトランザクションの条件は、書き手の 1 つが 25 件に 1 回、コミットまで 200 ms 待つものです。

並行度 4 の結果は、2 回の実行で大きく違いました。この条件の最終状態の食い違いは、1 回目 2 注文(2/5 試行)、2 回目 0 注文です。1 回しか流していなければ、どちらか一方だけを結果として書いていたはずです。未送信の行を読む作りの「0」も、この手順と試行の数で起きなかったという意味で、起きないことの証明ではありません。

読み飛ばしたイベントの残り方は、受け手で違いました。索引は、同じ注文に後から別の更新が届くと、上書きで一致に戻ります。食い違ったまま残ったのは、最後の更新を読み飛ばした注文です。通知は、失われたまま戻りません。

# 未送信の行を読む作りが払うもの

読み飛ばしを 0 件にした作りにも、費用があります。

- 重複:確認応答の後、印を付ける前に運び手を強制終了すると、再起動の後に同じ行が再び発行されました。受け手の冪等性を外した構成では、届いた重複がそのまま通知の重複になっています。
- 遅れ:呼び出し元への応答は DB のコミットで返り、索引に届くのはポーリングの後です。届くまでの遅れは、ポーリングの間隔に左右されます。

運び手を Debezium(CDC)に替える構成も測りました。その遅れは、コネクタが新しい変更イベントを待つ間隔の設定(poll.interval.ms)で変わりました。この設定の意味と既定値は、[Debezium 3.7 の PostgreSQL コネクタの文書](https://debezium.io/documentation/reference/3.7/connectors/postgresql.html#postgresql-property-poll-interval-ms)にあります。数値と条件は正本にあります。

# 実行

リポジトリの `cs/a/run.sh` が、コンテナの起動から結果の書き出しまでを行います。前提は WSL2 の中の Docker Engine で、PostgreSQL 18.7 と Redpanda v26.2.7 を使います。1 回の実行ごとに、コンテナとボリュームを作り直します。並行の競合に頼る数は、流すたびに変わります。

# まとめ

- アウトボックスの運び手は、連番の続きではなく、未送信の行を読む
- 読み飛ばしはエラーにならない。正と導出の差を数える照合が無いと見つからない
- 未送信の行を読む作りは重複を届けるので、受け手を冪等にする
- 「0 件」は、試行の数と、流し直したかを添えて読む

二重書き込みとの比較、CDC のスロットが失われたときの挙動、スキーマ変更や複製の実測は、正本の [Zenn の記事](https://zenn.dev/takenori_kusaka/articles/data-intensive-design-guide) にまとめています。
