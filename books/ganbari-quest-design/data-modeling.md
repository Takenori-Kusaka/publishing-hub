---
title: "第Ⅱ部-4　AI と行う形式データモデリング ― 概念・論理・物理の 3 ゲートと 13 冊のレビュー台帳"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

第Ⅱ部のデータの群（第Ⅱ部-4〜7）は、ここから始まります。4 つの章で、データモデルの設計・scope の決め方・DB の選定・家族ごとの分離を順に追います。

2026 年 7 月、データベースを DynamoDB から Aurora DSQL に移すにあたり、データモデルをゼロから設計し直しました。`docs/design/dsql/` には、概念モデル、論理モデル、物理モデル、実装計画の 4 つの成果物と、13 冊のレビュー台帳、合わせて約 2,900 行が残っています。この章では、その設計プロセスを扱います。生成AIに「まず作る」のではなく、ANSI-SPARC の 3 層を順にゲートで通し、各ゲートで独立したレビュー agent に落とさせる方法です。

## 杜撰さの根本原因

きっかけは、大方針の設計書が「方向性 OK」と判定されたあと、そこからの落とし込みが杜撰だったことです。プロセスの文書は、根本原因を 6 つに分解しています[^process]。

| # | 原因 | 対策 |
| --- | --- | --- |
| R1 | 大方針と実装の間に詳細設計のゲートが無く、「凍結、パネル決裁済」で即コード | 概念、論理、物理の 3 ゲートを挟み、exit 基準を満たすまで下流に着手しない |
| R2 | 「まず作る」バイアス。コードを進捗の単位とし、テストが緑なら設計が正しいと誤認 | 進捗の単位を設計成果物にする。実装は物理モデルの exit 後のみ |
| R3 | 設計レイヤーが未分離で、概念、論理、物理を混同 | ANSI-SPARC の 3 層を明示的に分離 |
| R4 | 単一パスの自己検証。多角的、敵対的なレビューが無い | 各ゲートで独立、敵対的なレビューを決裁条件にする |
| R5 | 決裁条件が曖昧 | 各ゲートに明文のチェックリスト |
| R6 | トレーサビリティの欠如 | 全設計判断を決定台帳で管理し、空欄がある間は exit 不可 |

R2 と R4 は、生成AIに設計を任せるときの典型です。AI はコードを書けるので、書いてしまう。書いたコードのテストが緑なので、設計が正しいと思う。自分で書いたものを自分で検証するので、盲点が残る。プロセスは、この 3 つを構造で潰します。

## 標準の写像であること

文書は「私の発明ではない」ことを繰り返し強調します。概念から論理、物理への 3 段は、データモデリングの業界標準。レイヤーの分離は 1975 年の ANSI-SPARC 三層スキーマ。ゲートの entry と exit の条件は Phase-Gate と NASA の Software Engineering Handbook。レビューの工程は Fagan inspection、役割は Architecture Review Board と ATAM。それぞれに 2026-07-05 の web 調査の出典が付き、「プロセスが私の独断でなく標準実務であることを、出典で検証可能にする」と書かれています[^process]。

これは [第Ⅱ部-1](stack-selection) で見た「OSS を先に探す」ルールの、プロセス版です。自己流の手順を作る前に、確立された手順を探す。生成AIは手順も発明できてしまうので、発明させない規律が要ります。

## 3 つのゲート

| ゲート | 成果物 | exit 条件の要点 |
| --- | --- | --- |
| M1 概念 | ER 図、集約境界、ドメイン不変条件、DB 非依存の class 定義 | 全 entity が製品ドメインの概念に対応し、DynamoDB の遺産の継承ではない。独立レビュー 2 観点をパス |
| M2 論理 | 正規化済みのリレーション、キー戦略、参照整合のルール | 全リレーションが M1 から導出可能。3NF からの逸脱は根拠付き |
| M3 物理 | 確定 DDL、fitness function、cutover の runbook | 全物理判断が M2 と PoC の実測に紐づく。相互矛盾ゼロ。敵対的レビューに耐える |

M1 の「DynamoDB の遺産を継承しない」は、この設計の核心でした。概念モデルの冒頭は、既存の型定義やスキーマを「現状の振る舞いを理解するための参照であって anchor ではない」と宣言します。single-table 時代の歪みは概念に持ち込まず、指摘して削ぐ。歪みとして挙がるのは、単一の opaque な識別子の一律強制・非正規な埋め込み・派生値の二重保持・暗黙のテナント導出・役割の二重書きです[^m1]。

M3 は、実機の制約に拠って立ちます。PK は作成後に変更不可、SERIAL と FK は無い、index は ASYNC 必須。1 トランザクションは 3,000 行と 10MiB まで、DDL は 1 文ずつ、OCC で 40001、RLS は無い。10 の制約それぞれに spike の実測と AWS 公式の出典が付き、「すべて構造決定（実測不要）」とされています[^m3]。

## 13 冊の台帳

各ゲートのレビューは、context を継承しない fresh な agent が 3 つの独立した観点で行います。ドメイン専門、データアーキテクチャ、そして敵対的 skeptic。Fagan inspection に倣い、成果物の提示、独立並列レビュー、欠陥ログ、rework、再レビューを、未解決の [must] と [critical] がゼロに収束するまで回します。台帳は 13 冊です。M1 が 6 ラウンド、M2 が 3、M3 が 3、M4 が 1[^process]。

M1 の Round 1 台帳は、3 観点すべてが FAIL を出したところから始まります。[must] は 13 件。根因は 1 つで、家族設定の KVS を読み替え規則で処理せず暗黙に捨てていたことでした。この根因対応から [must] の大半が連鎖して解消され、ParentGate、DecayPolicy、AccountLifecycle などが概念に昇格しました[^m1ledger]。

Round 6 の変更は、レビューの収束の仕方を示しています。3 ラウンド続けて同じ根（点数の次元の値を持つが台帳の付与に裏付けられない観測値）から [must] が出たため、列挙で塞ぐのをやめ、述語で根絶しました。「台帳の経済的付与エントリに対応する衛星観測値のみ reconcile の対象、台帳付与に裏付けられない点数次元の値は定義上 scope 外」。新たな非台帳の点数値が現れても自動的に scope 外になり、列挙漏れが起きません[^m1]。[第Ⅴ部-4](fitness-functions) の「網羅漏れを黙って見逃さない」と同じ形の判断が、設計の段階で行われています。

![13 冊の台帳](/images/ganbari-quest-design/data-modeling.png)

## 人が決めるもの

プロセスの決裁の主体は PO で、AI は成果物とチェックリストの充足状況を提示してレビューにかけます。「自己申告で pass しない」と明記されています。ただし例外があり、cutover の安全レビュアが出す [critical]（NUC の破壊やデータ喪失）だけは、agent の board ではなく人へエスカレーションします[^process]。

2026-07-05 の指示で、AI の役割はオーケストレーターに固定されました。起票、実装、テスト、検収はすべてサブエージェントで、AI は手を動かさずチームを統括する。人の確認は NUC の破壊とデータ喪失に限る。[第Ⅳ部-6](parallel-agents) で見た並列 Agent の運用は、この設計プロセスで最も大規模に使われました[^process]。

「大量トークンを消費して何も残らない、を再発させない」という一文が、成果物を docs に残す理由として書かれています。設計の議論は会話で消えます。台帳はその議論の形を残します。

## 物理モデルの帰結

M3 の帰結は、物理制約を逆手に取った設計です。FK が無いので、参照整合は 4 つの手段に分類されました。複合 PK に参照先のキーを含めて構造的に存在を保証する、生成列と UNIQUE index で DB に物理強制させる、app 層の単一強制点で書込パスが保証する、そして存在保証の無い弱参照。owner が家族に 1 人以下という不変条件は、生成列 `owner_guard` と UNIQUE index で DB が物理的に拒否します。PoC で同一家族 2 人目の owner が 23505 で拒否されることを実機確認しました[^m3]。

PK は変更不可なので、全テナント表の PK は manifest で凍結されています。`family_id` を先頭に置く複合 PK で、UUID v4 は hot partition を作らず、時刻列は PK に入れません。manifest と Markdown の表と drizzle の schema の 3 つが一致することを fitness function が検査し、PK の変更は「表と manifest の同時更新 + migration の ADR」を人手で強制する点です[^pkfreeze]。現在の schema は 59 テーブルです。

## 今ならこうする

このプロセスは、この製品で最も成功した AI との協働だったと考えています。R1 から R6 の根本原因は、7 か月の他の場面でも繰り返し現れたものです。設計をゲートで通し、fresh な agent に落とさせ、台帳に残す。この形を最初の月に持っていれば、[第Ⅲ部-2](cdk-stacks) の cross-stack や [第Ⅱ部-2](layered-architecture) の Policy Gate のような「設計は正しいが配線されていない」事故は減ったはずです。

代償はトークンです。13 冊の台帳と 2,900 行の設計文書は、fresh な agent を繰り返し起動して得たものです。[第Ⅷ部-1](by-the-numbers) で、この期間のトークン消費を見ます。

もう 1 つの限界は、プロセスが DSQL 移行という 1 つの大規模変更のために作られ、その後の日常の変更には適用されていないことです。「承認後に ADR 化して運用」と題にありますが、ADR にはなっていません。プロセスは成功し、制度にはなりませんでした。

[^process]: DSQL 詳細設計プロセス。根本原因 R1〜R6 と対策、採用する方法論と出典、3 つのゲートの INPUT / OUTPUT / 決裁条件、多角検証の制度化、決裁の主体、マルチエージェント設計レビュー board（Fagan 準拠の工程、fresh agent の役割、合格規準）、オーケストレーターとしての役割。出典: [docs/design/dsql/detailed-design-process.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/dsql/detailed-design-process.md)

[^m1]: M1 概念データモデル。Round 1〜6 の主変更の要約、層の位置づけ、導出方針（DynamoDB 時代の歪みを持ち込まない）、境界づけられたコンテキスト 8 つ。出典: [docs/design/dsql/m1-conceptual-model.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/dsql/m1-conceptual-model.md)

[^m1ledger]: M1 Round 1 のレビュー応答台帳。根因対応、[must] 13 件への対応と反映箇所、[should]、未決論点の決裁。出典: [docs/design/dsql/m1-review-round1-ledger.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/dsql/m1-review-round1-ledger.md)。台帳は m1 が 6 冊、m2 が 3 冊、m3 が 3 冊、m4 が 1 冊で、同じディレクトリにある

[^m3]: M3 物理データモデル。§P0 DSQL 物理制約 10 項目と出典、§3 参照整合の物理実装（4 手段の分類、owner_guard の実機確認）、§3.4 テナント分離の物理強制、§6 トランザクション境界。出典: [docs/design/dsql/m3-physical-model.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/dsql/m3-physical-model.md)

[^pkfreeze]: PK 凍結 manifest。凍結の根拠、manifest と Markdown 表と schema の 3 点一致を検査する fitness function、凍結対象外の表。出典: [src/lib/server/db/pk-freeze-manifest.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/db/pk-freeze-manifest.ts)
