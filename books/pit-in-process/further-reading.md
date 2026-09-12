---
title: "もっと詳しく — 標準本文とフィードバック"
free: true
---

本書は要点をまとめたものです。プロセスの本文は、全8章と附属書としてサイトで公開しています。

https://takenori-kusaka.github.io/process-compass/

---

## どこから読むか

| 知りたいこと | 読むところ |
| --- | --- |
| プロセス全体の規定 | [第1章 総則](https://takenori-kusaka.github.io/process-compass/phase4-process-design/overview/) |
| ライフサイクルとステージ | [第2章](https://takenori-kusaka.github.io/process-compass/phase4-process-design/lifecycle/) |
| 役割・責任分担・会議体 | [第3章](https://takenori-kusaka.github.io/process-compass/phase4-process-design/roles-responsibilities/) |
| ゲートの判定基準(全部) | [第4章](https://takenori-kusaka.github.io/process-compass/phase4-process-design/gate-criteria/) |
| 人と AI の役割境界、自律レベル | [第5章](https://takenori-kusaka.github.io/process-compass/phase4-process-design/human-ai-boundary/) |
| 成果物テンプレート11種 | [第6章](https://takenori-kusaka.github.io/process-compass/phase4-process-design/deliverable-templates/) |
| 例外とエスカレーション | [第7章](https://takenori-kusaka.github.io/process-compass/phase4-process-design/exception-escalation/) |
| 規模・ステージによる調整 | [第8章 テーラリング](https://takenori-kusaka.github.io/process-compass/phase4-process-design/tailoring-guide/) |
| 開発者の日々の手順 | [附属書E](https://takenori-kusaka.github.io/process-compass/phase4-process-design/developer-guide/) |
| 安全関連ソフトウェアへの適用 | [附属書F](https://takenori-kusaka.github.io/process-compass/phase4-process-design/safety-verification/) |

実装リファレンス(Git 戦略、CI ゲート構成、AI 実行環境、コンテキスト基盤)も公開しています。

そこへ至る過程——既存プロセスの調査、AIDLC の分析、ギャップ分析——も、すべて残してあります。結論だけでなく、なぜそう考えたかを追えるようにするためです。

---

## 決定の記録

あとから変えにくい決定は、判断記録(ADR)として公開しています。本書に関係が深いものを挙げます。

| ADR | 決定 |
| --- | --- |
| [ADR-0012](https://takenori-kusaka.github.io/process-compass/adr/0012-ai-output-as-unverified-input/) | AI の出力を未検証の入力として扱う |
| [ADR-0023](https://takenori-kusaka.github.io/process-compass/adr/0023-review-package-cues-not-conclusions/) | レビューパッケージは手がかりを与え、結論を与えない |
| [ADR-0026](https://takenori-kusaka.github.io/process-compass/adr/0026-evidence-level-marking/) | 根拠の弱い記述を、読者に見える構文でマークする |
| [ADR-0027](https://takenori-kusaka.github.io/process-compass/adr/0027-process-name-pit-in/) | プロセスの通称を「ピットイン方式」とする |
| [ADR-0028](https://takenori-kusaka.github.io/process-compass/adr/0028-unmet-gate-distinct-from-omitted/) | 達成できないゲートを省略と区別し、未達として表示し続ける |

**採らなかった選択肢と、その理由も書いてあります。 **後から読む人が同じ検討を繰り返さないためです。

---

## この標準の限界

正直に書いておきます。

- **閾値の多くは実測に基づく値ではない**。運用を始めなければ実測が得られず、実測がなければ値を確定できないため。根拠の弱い記述には識別子と見直し期限を付けて公開している
- **特定の業界規格への適合を証明するものではない**。適用する規格は組織が特定する
- **実運用のフィードバックはこれから集める段階**。参照モデルであり、完成品ではない
- **形骸化を完全には防げない**。防げるのは、条件が特定できた範囲だけ

「この標準に従えば品質が保証される」とは言えません。示せるのは「**どの判定を誰がどの基準で行い、その記録が残っているか**」 までです。

---

## フィードバックのお願い

このプロジェクトは、多くの人の意見を取り込んで精度を上げていく前提で作っています。

https://github.com/Takenori-Kusaka/process-compass/issues

とくに次のような声を求めています。

| 種類 | 例 |
| --- | --- |
| 現場の実態 | 「このギャップは自社ではこう現れる」 |
| 打ち手の効果 | 「この打ち手は効かなかった / 効いた」 |
| 条件の違い | 「うちの条件だとどうなるのか」 |
| 見落とし | 「この論点が抜けている」 |
| 反論 | 「この前提は違うと思う」 |

**反論は特に歓迎します。 **根拠の弱い箇所を自分で全部見つけるのには限界があります。

Zenn のコメント欄でも構いません。読んで、どこかで引っかかったなら、それはたぶん書き方が足りていない箇所です。

---

## 関連リポジトリ

| | |
| --- | --- |
| 標準本文とサイト | https://github.com/Takenori-Kusaka/process-compass |
| 準拠テンプレート | https://github.com/Takenori-Kusaka/pit-in-template |
| この本の原稿 | https://github.com/Takenori-Kusaka/publishing-hub |

ドキュメントは CC BY 4.0、コードは MIT で公開しています。 **そのまま持ち帰って、自社の標準の下敷きにしてもらって構いません。**

---

## 最後に

> マシンは人間より速い。それでも、決められた場所では必ず人間が触る。

AI が実装を担うようになっても、何を作るかを決め、それが正しいと引き受ける人は要ります。その人の帯域は増えません。

だから、判定の場を絞り、その一点を本物にする。それがピットイン方式の全部です。

ここまでお読みくださり、ありがとうございました。

---

[← 前の章](getting-started) ／ [最初の章へ](summary)
