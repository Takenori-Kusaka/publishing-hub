---
title: "第Ⅷ部-2　postmortem 集 ― 23 回直したライセンスキー、同じ画像の Before と After、鳴らなかったアラーム、平文の PIN、本番だけの 500、全 PR の conflict"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

この本の原則は、うまくいった判断からではなく、事故から生まれました。6 件を、blameless postmortem の形で並べます。事象、影響、根本原因、再発防止、学び。各件の詳細は該当する章にあり、ここでは事故としての形だけを取り出します。

## ライセンスキーを 23 回直した

### 事象

2026-03 から 05 にかけて、ライセンスキー方式の課金を 23 回修正しました。修正のたびに別の箇所が壊れ、期限の判定、認可の経路、設計書の TODO が食い違い続けました[^billingpolicy]。

### 影響

有料プランの認可が正しく動く保証の無いまま、LP は有料プランを訴求していました。開発の時間は、この期間の最大の費目でした。

### 根本原因

期限の SSOT が 3 つ並存し、認可の経路が 2 つあり、設計書の TODO 6 件が 1.5 か月放置されていました。個々の修正は正しく、構造が間違っていました。ライセンスキーという概念自体が、Stripe の Subscription と二重の真実を作っていました。

### 再発防止

2026-05 にゼロベースで再設計し、ライセンスキーを全廃して Stripe の Subscription を SSOT にしました。`families` の 4 列が許す組み合わせを 1 枚の契約状態マトリクスに固定し、書き手 9 か所を列挙しました。[第Ⅱ部-12](billing) です。

### 学び

23 回目の修正の前に、1 回目の修正で構造を疑うべきでした。同じ領域で修正が 2 回続いたら、3 回目は修正ではなく設計です。原則 4 と原則 6 は、ここから来ています。

## Before と After が同じ画像だった

### 事象

2026-05-09、PR #2054 で、UI 変更の証跡として貼られた Before と After のスクリーンショットが、3 ラウンド連続で完全に同一の画像でした。Blob SHA が 1 バイトも違わない。PR はオーナーの判断で close されました[^issue2063]。

### 影響

「見た目を変えた」と主張する PR が、見た目を変えた証拠を持たずにレビューを通過しかけました。QM が 3 ラウンド見抜いたのは、bot が SHA を比較していたからで、目視なら通っていました。

### 根本原因

Agent が実装 branch を 3 回 force push（rebase）したのに、証跡を置く `screenshots` branch は独立していて更新されなかった。PR 本文の表が指す画像は、古いままでした。そして Agent の個体差があり、4 体のうち 2 体は正しく push し、2 体は skip しました。

### 再発防止

CI に Blob SHA の同一性検証を足しました。約 30 行の script で、Before と After の SHA が一致したら fail。prompt や memory の強化は「次の Wave の新 Agent は読まない」ので採らず、機械で止めました。[第Ⅴ部-5](visual-regression) と [第Ⅴ部-6](pr-body-gates) です。

### 学び

AI の証跡は、AI が作れます。証跡の真正性は、証跡を作る側ではなく読む側が機械で検査する。原則 1 と原則 3 の起点です。

## AI 提案が 1 度も動いていなかった

### 事象

2026-08-19、本番の AI 提案が、導入以来 1 度も Bedrock に到達していないことが分かりました。すべてのリクエストが `ValidationException` で落ち、キーワードの規則にフォールバックし、HTTP 200 で「提案」を返していました[^issue4726]。

### 影響

プレミアムプランの筆頭の差別化機能として LP、pricing、FAQ の 7 か所で訴求していた機能が、本番で成立していませんでした。顧客には失敗が見えません。応答は 200 で、それらしい提案が返るからです。

### 根本原因

Claude Haiku 4.5 は base model ID の on-demand 呼び出しを受け付けず、inference profile が必須でした。#4367 の「in-Region に固定するため base model ID を使う」判断が、モデルの制約と衝突していました。そして `ValidationException` はアラームの対象外だったため、全リクエストが失敗し続けても通知はゼロでした。

診断も 3 方向に誤りました。静的な根拠から「不作動」と 7 回連続で誤断し、応答 JSON が返ることを「稼働」と誤読し、「Dev の環境に AWS の資格情報が無い」という古い記述を確かめずに「調査不能」と引き継ぎました。

### 再発防止

US の inference profile に戻し、稼働の判定を応答の `source` フィールドと CloudWatch の実ログだけで行うことにしました。アラームは `ValidationException` を latch 対象に足すのではなく、fallback の発生率で鳴らす設計に改めています。[第Ⅱ部-11](ai-suggest) と [第Ⅲ部-5](observability) です。

### 学び

値が正しいことと、値が効いていることは別です。IAM・env・モデルアクセスのすべてが正しく、それでも 1 度も動いていなかった。原則 9 は、この事故そのものです。

## PIN とメールが平文でログに出た

### 事象

2026-09-12、おやカギコード（親の 4 桁 PIN）を 1 回間違えると、その PIN が平文相当で CloudWatch Logs に残る状態が見つかりました。保護者のメールアドレスの平文も 15 か所ありました[^issue4947]。

### 影響

運営者の障害調査用のログに、顧客の認証情報と PII が残りました。過去分の削除は不可逆の操作で、オーナーの手番として別 Issue になりました。

### 根本原因

第 22 回リリース直後の hotfix が、logger の `context` を console に出すよう変えました。Lambda では console だけが CloudWatch への経路なので、それまで本番のどこにも到達していなかった context が一斉に露出した。そこに、#2335 で入れた「時限」のデバッグログ（PIN の char code の列）が、削除され忘れて乗っていました。

### 再発防止

最初の修正は context の key 名で隠すものでしたが、QM が BLOCK しました。message に直接埋め込まれた PII や、想定外の key 名に入った PII を素通りさせるからです。最終的に、console と CloudWatch に渡す直前の 1 本の文字列に対して、値のパターン（メール、PIN）で伏せる redaction を出口に置きました。[第Ⅱ部-13](errors-and-logs) です。

### 学び

「時限」のログに時限はありません。消す仕組みが無ければ、永久に残ります。そして PII の遮断は、入口の key 名ではなく出口の値で行う。原則 4 の「class として扱う」は、ここでは「PII がログに出る class を出口 1 か所で閉じる」でした。

## 本番だけでアバターが 500 になった

### 事象

2026-09-13、本番でアバター画像をアップロードすると、どのファイルでも必ず 500 になる、と顧客から報告がありました。画面は「5MB 以下の JPEG / PNG / WebP を選択してください」と案内しますが、ファイルは何も悪くありませんでした[^pr4957]。

### 影響

顧客が今まさに踏んでいる不具合で、案内の文言が原因を誤って伝えていました。しかも、sharp を導入して以来ずっと壊れていました。本番でアバターを上げた人がいなかったので、露見しなかっただけです。

### 根本原因

画像の再エンコードで使う `sharp` が `devDependencies` にありました。Lambda のイメージは `npm ci --omit=dev` で作られるため、platform binary が落ちる。一方 JS の本体は Vite が bundle するので存在し、ローダーだけが失敗する。NUC は dev 込みで `npm ci` するので無傷で、AWS Lambda だけの障害でした。

真因が読めたのは、前日の #4947 で logger が context を出すようになったからです。それ以前は、例外と storageKey は本番から見えませんでした。

### 再発防止

`sharp` を dependencies に移しました。より構造的には、[第Ⅲ部-4](deploy-gates) の staging deploy と smoke test が、本番と同じイメージで「本番だけの経路」を踏む場所です。アバターのアップロードは、その smoke に入っていませんでした。

### 学び

本番だけで起きることは、本番と同じ作り方をした環境でしか分かりません。テストが 1,102 ファイルあっても、`--omit=dev` で作ったイメージを走らせるテストが無ければ、この 500 は見えません。原則 3 の「顧客に届いたかで判断する」の、痛い例です。

## 全 PR が conflict した

### 事象

2026-08-12、develop に PR を 1 本 merge するたびに、残りの全 PR が conflict するようになりました。conflict しているのは `graphify-out/` の 3 ファイルだけで、手書きのファイルの conflict は 0 件でした[^issue4536]。

### 影響

1 本 merge するたびに、残りの PR が rebase、CI 全走、merge の直列化を強いられました。8 月 13 日は 10 本を一括で正規化して回避しましたが、毎回できる作業ではありません。

### 根本原因

採用したばかりの Graphify が、`.husky/post-commit` で branch を問わずコミットのたびに 27MB の graph.json を再生成していました。branch が分岐したあと、各 branch が独立した複製を持ち、merge のたびに衝突する。再生成の単位が「commit」だったことが原因で、coldstart 解消の意図には develop 上の内容が最新であれば足りました。

### 再発防止

post-commit は develop と main だけで再生成し、develop 上の再生成は push 契機の workflow が bot PR で担う形にしました。追跡を止める案は「coldstart 解消の意図を壊す」としてオーナーが不採用にし、新しい CI check も足さず、既存の hook と workflow の条件変更だけで解きました。[第Ⅵ部-4](graphify) と [第Ⅶ部-1](monorepo-and-artifacts) です。

### 学び

生成物の再生成の単位は、置き場と同じくらい重要です。そして、装置を増やさずに解く選択肢は、たいてい存在します。原則 7 と、[第Ⅳ部-8](platform-session) の「装置を減らす」です。

## 6 件に共通するもの

6 件のうち 4 件は、「動いているように見えた」事故です。AI 提案は 200 を返し、アバターは案内文を出し、PIN はアラームを鳴らさず、スクリーンショットは貼られていました。落ちなかったから見つからなかった。

見つけたのは、機械が 2 件（SHA の比較、conflict）、実ログを読んだ人が 3 件（AI 提案、PIN、アバター）、構造を疑った人が 1 件（ライセンスキー）です。機械が見つけたのは、機械が見るように作った事故だけです。残りは、人が本番のログと画面を見て見つけました。[第Ⅵ部-6](skills-as-sop) の live-ui-verification が「全 CI 緑のあとにブラウザ 1 回で見つかった」と書いたのと、同じ形です。

[^billingpolicy]: 課金の再設計方針。「license key 方式で 23 回失敗。3 つの期限 SSOT 並存 / 2 つの認可経路 / 設計書 TODO 6 件 1.5 ヶ月放置という構造的問題が露見」。出典: [docs/design/billing-redesign/billing-redesign-policy.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/billing-redesign/billing-redesign-policy.md)

[^issue2063]: Issue #2063「SS 品質チェック workflow に before/after Blob SHA 同一性検証を追加（PR-2054 偽装事例の根本解決）」。偽装のメカニズム、prompt 強化では防げない理由、選択肢 A〜C。出典: [Issue #2063](https://github.com/Takenori-Kusaka/ganbari-quest/issues/2063)

[^issue4726]: Issue #4726「本番 Bedrock が全リクエストで ValidationException になり AI 提案が 100% fallback」。症状、CloudWatch の実測、切り分けの表、#4367 AC3 の判断を覆す決裁、アラームの穴。出典: [Issue #4726](https://github.com/Takenori-Kusaka/ganbari-quest/issues/4726)

[^issue4947]: PR #4947「おやカギコードと保護者メールが CloudWatch に平文で出る」。経緯、QM BLOCK への対応（key 名から値ベースの redaction へ）、過去分の削除 #4951。出典: [PR #4947](https://github.com/Takenori-Kusaka/ganbari-quest/pull/4947)

[^pr4957]: PR #4957「本番でアバター画像のアップロードが必ず 500 になる（sharp が devDependencies で Lambda image から欠落）」。真因、NUC との差、sharp 導入以来の潜在、#4947 で読めた経緯。出典: [PR #4957](https://github.com/Takenori-Kusaka/ganbari-quest/pull/4957)

[^issue4536]: Issue #4536「graphify-out の per-commit 再生成が並行 PR を機械的に conflict させる」。実測、根本原因、対応方針、不採用にした案。出典: [Issue #4536](https://github.com/Takenori-Kusaka/ganbari-quest/issues/4536)
