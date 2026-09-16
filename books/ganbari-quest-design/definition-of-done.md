---
title: "第Ⅳ部-4　「全対応完了」の証明 ― 10 項目の検証と証跡の真正性"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

生成AIは「完了しました」と言います。チェックボックスを埋め、チケットを close し、レビューを通します。しかし完了の宣言と完了の事実は別物です。この章では、その差が最も大きく開いた事故と、そこから生まれた「完了」の定義、そして完了の証跡が偽装されることまで想定したゲートを扱います。

## 5 秒の grep が暴いたこと

ADR-0060 のコンテキストは、1 つの事故の記録です。ライセンスキー方式を廃止する大規模な変更で、AI は「5 ステップ完了」と報告しました。その直後の出来事です。

> Epic #2525 Phase 7 で「license key atom 5 step 完了」と報告した直後、PO が 5 秒 grep で LP / アプリに「ライセンスキー」言及が 125+ file 残存しているのを発見した。「関連チケットを close したから完了」という判断が、機構撤廃の実態 (アプリ `src/` に 142 occurrence / 28 file、LP `site/` 3 file、メールテンプレ、設計書 5 file) と乖離した虚偽完了報告を生んだ。[^adr60]

ADR はこれを「個別の見落としではなく、完了の証明をチケット status に委ねた構造的失敗」と診断しています。「漏れたらそこだけやる」を繰り返した結果、Stripe のサブスクリプションに移行したはずの顧客接点で「ライセンスキー」を読ませ続ける状態が放置されていました。

## 10 項目の検証義務

対策として、大規模な変更（機構の撤廃、rename、データモデルの変更）の「全対応完了」宣言には 10 項目の検証を必須にしました。

| # | 項目 | 何を確認するか |
| --- | --- | --- |
| 1 | 機械削除完了 | import や参照の残存が grep で 0 |
| 2 | E2E + build 起動 | 5 年齢モードの回帰テストが PASS し、production build が起動する |
| 3 | 振る舞い不変 test | 冗長な層を除去しても振る舞いが不変であることを統合テストで示す |
| 4 | DB 全 backend | すべてのデータベース実装で整合する |
| 5 | LP / メール / 法務 | 顧客接点の文言をすべて書き換える |
| 6 | 旧 URL redirect | 旧 URL の対応表への追加と E2E |
| 7 | 用語 grep 0 + CI gate 恒久化 | 用語の残存 0 を確認し、再混入を止める gate を CI に恒久的に組み込む |
| 8 | 代替手段確定 | 撤廃した機能の代替経路を確定し検証する |
| 9 | env / Secrets 実体撤去 | CDK、Secrets、GitHub Variables の 3 系統から撤去する |
| 10 | 設計書 archive / deprecation 同期 | 撤廃した機構の設計書に deprecation を記し、参照元を同期する |

ADR は 3 つの選択肢を比較しています。Scrum の Definition of Done のようなチェックリストだけでは自己申告に依存して形骸化する。CI の gate だけでは「設計書の意味整合」や「代替手段が顧客体験として成立するか」を表現できない。採用したのは両方の併用で、「検証は実装 Agent の自己申告でなく独立 grep / gate で行う」と明記しています[^adr60]。項目 7 が要です。用語の残存を 1 度 0 にするだけでなく、再混入を止める gate を CI に恒久的に残します。ライセンスキーの再導入を禁止する検査は、本書執筆時点でも CI で動いています。

## AC 検証の 3 層

「完了」の定義は、大規模変更より前に、通常の Issue と PR でも問題になっていました。ADR-0004 は 2 つの事故を記録しています。

> - PR レビューの形骸化: 2026-04-09 に 8 件の Draft PR を一括マージした際、コードレベルのレビュー指摘を一切出力せず全件マージ。結果として CSS ハードコード違反 3 件 / テストカバレッジ欠落 3 件 / 設計書未更新 6 件が本番デプロイされた（#613-#616, #619）。
> - AC 検証の欠落: #1088（LP 情報設計）/ #701（活動パック）/ #572（URL リネーム）で AC 未検証のまま close → 事後発覚で再対応（#1163 等）。[^adr04]

構造的な欠陥は、Issue テンプレートに AC の検証計画がないこと、PR テンプレートに「どの AC をどう検証したか」の証跡がないこと、CI が AC の充足を検証しないことでした。対策は 3 層です。Issue テンプレートでは検証計画を必須にし、AC を測定可能な数値、文字列、ファイルパスで書かせます。PR テンプレートには「AC 検証マップ」の表を置き、AC 番号、内容、検証手段、結果の 4 列を埋めさせます。CI はマップの欠落を検出します[^adr04]。

レビューにも規律があります。指摘がない場合も「Reviewed: lint rules, CSS tokens, test coverage, design doc sync / No findings.」と明記し、「レビューしたが指摘なし」と「レビューしていない」を区別します[^adr04]。

## 書式ではなく真正性を守る

3 層の機械強制は、2026-07-30 に一部が緩められました。AC マップの書式検査が統合 PR を 4 日間 BLOCK した一方で、実体は 60 件中 57 件の検査が緑で満たされていたからです。ADR-0004 は線引きをこう書き換えました。

| 検査 | 何を見るか | 2026-07-30 以降 |
| --- | --- | --- |
| AC マップの体裁 | 4 列そろっているか、空セルがないか | advisory（警告）。merge を止めない |
| `verify-pr-head` | PR body が「対応済み」と主張する修正が HEAD に実在するか | hard-fail を維持 |
| `check-ss-blob-sha-uniqueness` | Before / After のスクリーンショットが同一 blob の偽装でないか | hard-fail を維持 |

> AC の内容妥当性は AI レビュアが担う。機械が守るのは「主張と実体が一致していること」だけに絞る。[^adr04]

体裁の不備で merge を止めても顧客のリスクは減らず、止まった分だけ他の修正の到達が遅れます。一方、「body の主張が HEAD に存在しない」「スクリーンショットが同一画像の使い回し」は、レビュー全体の前提を崩すため、機械で止める価値があります。この線引きは、[第Ⅳ部-1](one-human-many-sessions) で見た憲章 §0 の「80 点で止める」と同じ判断です。

スクリーンショットの偽装検査には、具体的な事故があります。実装 branch を rebase して force push すると、スクリーンショットを保存する別 branch は自動では更新されません。修正前と修正後の画像は同一のまま PR に残り、3 ラウンド連続で「偽装」の判定を受けた PR がありました。検査は Before と After の blob SHA を比較し、一致すれば偽装として落とします。UI を変える PR で画像を添付しないこともできません。UI 関連ファイルを含む PR にはスクリーンショットの添付が必須で、「UI 変更なし」の宣言は行単位で判定され、未チェックのチェックボックスや HTML コメントの中では宣言と見なされません[^routesclaude]。

## 正直に書ける逃げ道を残す

ゲートを厳しくすると、嘘をつく誘因が生まれます。統合 PR の「残 NG 0 件」宣言を検査するスクリプトには、その配慮が書かれています。

> gate を hard-fail のみにすると「正直に 残 NG 1 件 と書くと merge できない」ため、嘘の 0 件宣言に倒すインセンティブが生まれる（#4304 は正直に書いたのに gate が緑だったのが問題であって、正直さを罰するのが目的ではない）。よって逃げ道は塞がず、[^acmap]

残 NG が 1 件以上あるまま merge する場合は、追跡する Issue の番号を含む受容宣言を明記すれば通ります。禁じているのは「残 NG がある」ことではなく、「残 NG があるのに 0 と書く」ことです。前章で見た逃げ口上の救済策と同じ構造で、正直な記述に出口を用意します。

## 判定の形そのものを固定する

PR body を読むゲートは、それ自体が同じ種類の不具合を 4 回起こしました。

> 背景 (同 class 4 回):
>   #4084  SS ペア 0 件を skip で通した            (検査できなかったのに pass)
>   #4255  story 参照を「それっぽい文字列」で通した (実在性を見ない)
>   #4333  見出しの存在だけで NG-0 を常に緑にした   (見出し行・コメント・否定文を拾う)
>   #4348  上記と同 class が gate 6 箇所に残存      (本 guard の起票元)[^partialmatch]

いずれも、PR body の見出しや宣言を部分一致や本文全体への 1 本の正規表現で判定していたことが原因です。対策のテストは、PR body に対する `.includes(` や `<regex>.test(body)` のような判定を、理由付きで allowlist に登録されたものだけに限定します。新しく増やせば落ち、allowlist に書いたのに現物が消えても落ちます。正しい判定は「見出し行の完全一致 + HTML コメントとコードブロックの除去」を行う共通モジュールに集約し、新しいゲートはそれを import します[^partialmatch]。

「検査できなかったのに pass」は、生成AIとの開発で繰り返し現れる形です。検査が対象を見つけられなかったとき、skip を pass と数えると、検査はあるのに何も守っていない状態が生まれます。

## 完遂の原則

「完了」の定義は、ゲートだけでなく Dev セッションの行動規範にも書かれています。完遂原則の文書は、「やりきり」を定義しています。

> User の言う「やりきり」は 「1 PR で完遂」ではなく「全 phase を実施スケジュールに含め、申し送りを残さない」 の意。[^completion]

困難に遭遇したときの「きれいな状態」への逃げ方には 3 つあります。PR を close しての再起動・scope の分割・follow-up Issue の起票です。いずれも PO からは「何度試しても最終 goal に到達しない」と映ります。文書は順序を定めています。難しいと気づいた瞬間に close の判断を凍結し、同じ PR で fix-forward し、進捗を PR 数や commit 数ではなく「動く機能」で測ります[^completion]。

後工程で前工程の不備が見つかったときの手順もあります。作業中の PR で「つじつま合わせ」をせず、元のフェーズの Issue を再オープンし、設計書を修正して単独で merge してから、後工程の PR に戻ります。設計書と実装の乖離を、後のフェーズに持ち越さないためです[^completion]。

## 完了とは何か

この章のゲートと原則を並べると、「完了」の定義が 3 段階で厳しくなったことが分かります。最初は「チケットを close した」でした。次に「AC の検証マップを埋めた」になりました。そして最終的に「主張と実体が一致していることを、独立した機械検証で示した」になりました。同時に、体裁の検査は警告に降格し、正直に書ける逃げ道が用意されました。厳しくする方向と緩める方向は矛盾していません。どちらも「証跡の真正性」を守ることに収束しています。

[^adr60]: ADR-0060「『全対応完了』宣言の 10 項目検証義務 (チケット close ≠ 完了)」。5 秒の grep で 125 ファイル以上の残存が見つかった経緯、3 つの選択肢、10 項目の検証。出典: [docs/decisions/0060-completion-definition-10-item-verification.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0060-completion-definition-10-item-verification.md)

[^adr04]: ADR-0004「レビュー & AC 検証品質」。2026-04-09 の一括マージ事故、AC 検証の 3 層機械強制、2026-07-30 の改訂（書式検査を advisory に降格し、実体検査と偽装検査を hard-fail で維持）。出典: [docs/decisions/0004-review-and-ac-verification.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0004-review-and-ac-verification.md)

[^routesclaude]: routes 配下の UI 実装ルール。rebase 後のスクリーンショット branch の push 必須（#2063 の 3 ラウンド連続の偽装）、SS の命名規約と gate が検査できなかったときの扱い、「UI 変更なし」宣言の行単位判定。出典: [src/routes/CLAUDE.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/routes/CLAUDE.md)

[^acmap]: AC 検証マップと残 NG 宣言の検査スクリプト。残 NG > 0 を正直に書ける受容宣言を用意した理由。出典: [scripts/check-ac-verification-map.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/check-ac-verification-map.mjs)

[^partialmatch]: PR body の判定を部分一致で行うコードを機械で止める fitness function。同じ class の不具合 4 回の背景と、判定の形そのものを固定する設計。出典: [tests/unit/architecture/pr-body-partial-match-guard.test.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/pr-body-partial-match-guard.test.ts)

[^completion]: Dev セッションの完遂原則。「やりきり」の定義、困難時の振る舞いの順序、はりぼて実装に逃げない、後工程で前工程の不備が発覚したときの手順。出典: [docs/sessions/dev-process/completion-principles.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/sessions/dev-process/completion-principles.md)
