---
title: "第Ⅱ部-10　マーケットプレイス ― Strategy と Registry、child を持たない public surface、性別バリアントの判断"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

「みんなのテンプレート」と呼ぶマーケットプレイスから、活動のセット、ごほうびのセット、チェックリストを取り込めます。この章では、5 つの type の取込を 1 つの機構に揃えた ADR-0052、マーケットプレイスが子供の情報を一切持たない設計、プリセットの中身を 1 つずつ市場データで裏付けた監査、そして性別バリアントを維持した PO の判断を扱います。マーケットプレイスは、[第Ⅰ部-1](product) で見た「AI が前面に出ない」製品設計の、AI 提案と並ぶもう 1 つの柱です。

## 1 枚のスクリーンショットから

2026 年 5 月、PO が活動管理画面の 1 枚のスクリーンショットから、構造的な欠陥 4 件を同時に指摘しました。マーケットプレイスからの取込が動かない、管理画面に直接の import UI が重複している、ヘッダーの `?` と overflow menu で二重のガイド、export から import の round-trip が消失している。調査の結果、根本原因は抽象化の欠如が 5 階層に及ぶことでした[^adr52]。

最下層は Strategy パターンの欠如です。4 つの import service が copy-paste で signature が不統一で、あるファイルのコメントは「activity-import-service.ts を template として横展開」と自認していました。5 番目の type は service が存在せず、型の union は 4 値のままで、1 か月放置されていました[^adr52]。

## Strategy と Registry

ADR-0052 は 4 案を比較し、Strategy + Registry を採りました。prior art は VSCode の extension の `contributes`、Obsidian の plugin、Figma の manifest、そして GoF の Strategy。1 type = 1 Strategy = 1 Descriptor で、Strategy は `parse`・`preview`・`apply` の 3 メソッドの契約を持ちます。新しい type の追加は 1 ファイルの増分と、index での side-effect import 1 行です。manifest 駆動の plugin architecture は第三者配布の要件が無く過剰、copy-paste の現状維持は 5 つの EPIC が完成後に再リファクタする浪費を生む、として退けました[^adr52]。

`ImportContext.tenantId` は必須プロパティです。全 Strategy の全メソッドに渡され、cross-tenant のデータ汚染を型レベルで阻止します。Registry の `get` は未登録の type で明確な error を投げ、silent な fallback を持ちません。同一 type の二重登録も error で、「index.ts の double-import を確認せよ」とメッセージが言います[^registry]。

「register 忘れで Registry が空のまま動く」リスクには、CI の gate があります。type の一覧の SSOT から、index の side-effect import、types の module と register 呼び出し、Descriptor の 5 つの field、Strategy のファイル、schema のファイルの存在を構造的に検証します。5 番目の type が 1 か月放置された事例が、この gate の起票根拠です[^mparch]。

round-trip の E2E も必須化されました。5 type 全件で、seed の payload を schema で parse し、JSON に serialize して deserialize し、再び parse して値の同等性を assert します。schema に optional 未指定の field を足せば旧 export の JSON が reject され、transform を足せば同等性が落ちます。[第Ⅱ部-5](per-child-model) で見た値域の SSOT は、この round-trip の延長にあります[^mparch]。

schema は Valibot です。5 type 全部の schema を bundle して gzip で 859 バイト。Zod の v3 の単純 schema 1 件とほぼ同じ大きさに 5 type が収まります[^mparch]。

![Strategy と Registry](/images/ganbari-quest-design/marketplace.png)

## child を持たない public surface

マーケットプレイスは、未認証で閲覧できる public な面です。LP から「どんなものがあるか」の紹介リンクがあるためです。PO の直接の判断が設計書に引かれています。「認証後の marketplace でも、child name は URL や body に出さない。認証外で見られているマーケットプレイスに自分の子供の名前が出てきたらびっくりする。私なら直ちにアプリをアンインストールしデータ削除をクレームとして入れる」[^importflow]。

だから、マーケットプレイスは child の情報を持ちません。URL、body、query、response のどこにも childId やニックネームを露出させず、`?childId=X` の形のパラメータは禁止です。子供の選択は、マーケットプレイスを通過したあとの管理画面のダイアログでだけ行います。「先に子供を選んでからマーケットプレイスへ行く」動線は、PO が「誰を選んでいたのか忘れてしまう」として退けました[^importflow]。

Bounded Context は 3 つです。Marketplace は public な discovery で child 情報を持たない。AdminApp は family-scoped で、取込ダイアログで child の紐付けを決める。ChildExperience は per-child で、登録されたあとにだけ表示する。Marketplace から AdminApp への遷移で型を変換する Anti-Corruption Layer を置き、Marketplace の仕様変更が AdminApp へ直接影響しないようにしています[^importflow]。

取込の CTA は、4 type とも `/admin/<page>?import=<id>` へのリンクに統一され、管理画面側でダイアログが自動で開きます。取込実行中は確定ボタンが spinner と `aria-busy` になり、cancel・backdrop・Esc のどれでも閉じられません。押して無反応に見える事故を防ぐためです[^importflow]。

## プリセットを 1 つずつ裏付ける

プリセットの中身は、3 つの監査文書で 1 つずつ点検されています。活動のプリセットは 15 パック、活動のインスタンス 255、一意な活動は約 70。公教育のカリキュラムと矛盾する性別の非対称が 14 件、カテゴリの誤分類が 3 件、年齢範囲の矛盾が 2 ファイル。ごほうびのプリセットは 77 件で、「ごほうびシール もらえる」のようにアプリ内の機能を二重計上したメタごほうびが 2 件（critical）。チェックリストは、日次の routine 系 12 件が「今日のおやくそく」の機能に移管されて削除され、遠足やプールのようなイベント系 3 件だけが残りました[^audits]。

監査の原則は「こんなの させたかった！」「こんなの もらいたかった！」で、顧客の付加価値で 1 件ずつ判定します。プリセットの数を訴求する LP の文言は、[第Ⅴ部-5](visual-regression) で見たとおり、ユニークな活動名の数を CI が裏取りします。

現在のプリセットは、活動 12 パック、ごほうび 8 セット、チェックリスト 3 件です。2026 年 6 月の PO 判断で、マーケットプレイスは活動、ごほうび、チェックリストの 3 type に絞られ、チャレンジは陳列対象から外れました。週間チャレンジはアプリが自動生成する一本化方式で、親による手動の取込は存在しないためです。型と schema と Registry の登録は互換のため残し、取込の導線は持ちません[^mparch]。

## 性別バリアントを維持する

活動パックには、中立の年齢別パックと、男の子と女の子のバリアントがあります。2026-04-20、これを廃止するかどうかの ADR が 1 日で 3 回改訂されました。初稿は「性別ステレオタイプの解消」「内閣府の方針」「海外のトレンド」を根拠に廃止を単独推奨しました。PO の指摘は「日本社会における実家庭の割合でどうかを知りたい。海外の風潮から SNS 発信が増えていることは承知しているが、具体的な家庭でそうだという裏付けにはならない」でした[^adr42]。

改訂 1 は 3 案を並べ、興味タグで性別 UI を置き換える案を推奨しました。PO の指摘は「現在の 5 カテゴリを増やすかどうか、という話？増やす必要はない。多くのペルソナ像にとってはライトゲームユーザー以下であることを前提にすると複雑度を上げるのはあり得ない選択肢」。そして最終の指摘は「性別バリアント廃止を承認した覚えはない。子供にとっては登録された活動プリセットがすべてなのでプリセットが多く用意されていることはまったく子供にとっての複雑度を高めていない」[^adr42]。

決定は「維持する。廃止しない。ただし内容は市場データで精査し、既存の非対称を解消する」。問うべき核心は「日本の家庭において性別バリアントに付加価値があるか」で、150 以上の出典を持つ市場調査が一次資料です[^adr42]。

この ADR は archive に移されましたが、「PO 3 回誤提案の判断根拠。読まないと同じ誤提案を繰り返す」として保全されています。生成AIが「表明された選好」（SNS や調査）を「行動データ」より重く見て、製品の判断を一般論で上書きしようとした記録です。

## 今ならこうする

Strategy と Registry の機構は、5 type の copy-paste を止めました。5 番目の type が 1 か月放置された事例は、type の一覧と実装が別々に増えるときの典型で、CI の gate が「一覧に足した時点で 5 つの実装を要求する」形にしたことで再発しなくなりました。

child を持たない public surface は、privacy の設計として最も明確なものです。「持たない」は「守る」より強い。マーケットプレイスに子供の情報を渡さなければ、漏れる経路がそもそもありません。[第Ⅴ部-4](fitness-functions) で見た「顧客への約束をコードに置く」の、設計段階の実践です。

性別バリアントの 3 回の改訂は、AI の提案が製品の思想と衝突したときに何が起きるかの記録です。AI は一般論に強く、製品固有の判断に弱い。archive に残した理由が「読まないと同じ誤提案を繰り返す」であることが、その限界を正直に示しています。

[^adr52]: ADR-0052「MarketplaceTypeRegistry + ImportStrategy パターンによる 5 type 統一抽象化」。1 枚のスクリーンショットからの 4 件の指摘、抽象化欠如の 5 階層、4 案の比較、本 PR のスコープ、tenant isolation の型強制。出典: [docs/decisions/0052-marketplace-type-registry.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0052-marketplace-type-registry.md)

[^registry]: MarketplaceTypeRegistry の実装。fail-fast の設計、二重登録の error。出典: [src/lib/marketplace/registry.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/marketplace/registry.ts)

[^mparch]: マーケットプレイスのアーキテクチャ SSOT。設計背景、設計原則、§9.5 challenge-set の陳列対象外、§9.6 bundle size の実測、§10 Registry 完整性の CI 検知、§11 round-trip E2E の必須化。出典: [docs/design/marketplace-architecture.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/marketplace-architecture.md)

[^importflow]: 取込フローの sequence SSOT。privacy 要件と UX 要件の PO 直接判断、Bounded Context の分離、取込ダイアログの SSOT 化と loading 表示。出典: [docs/design/marketplace-import-flow.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/marketplace-import-flow.md)

[^audits]: プリセットの監査文書 3 本。活動は [docs/design/marketplace-preset-activity-audit.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/marketplace-preset-activity-audit.md)。ごほうびは [docs/design/marketplace-preset-reward-audit.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/marketplace-preset-reward-audit.md)。チェックリストは [docs/design/marketplace-preset-checklist-audit.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/marketplace-preset-checklist-audit.md)

[^adr42]: 旧 ADR-0042「マーケットプレイス性別バリアントは維持、市場データで中身を見直す」（archive）。改訂履歴、PO の指摘 3 回の引用、決定の要点。出典: [docs/decisions/archive/0042-marketplace-gender-variant-policy.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/archive/0042-marketplace-gender-variant-policy.md)
