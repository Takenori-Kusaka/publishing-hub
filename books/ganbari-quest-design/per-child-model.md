---
title: "第Ⅱ部-5　per-child 主軸と限定 family master ― 6 つの type に scope を決める"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

活動、チェックリスト、ごほうび、ボーナスルール、特別ルール、チャレンジ。マーケットプレイスから取り込める 6 つの type は、「家族で 1 つ持つのか、子供ごとに持つのか」がばらばらでした。この章では、その scope を 1 つの原則で決めた ADR-0055 と、原則を破った取込の事故、そして export と import の値域が二重定義されていた事故を扱います。データの scope は、UI の見た目より深いところで製品の思想を決めます。

## 6 つの type の混在

2026 年 5 月の時点で、type ごとの scope は歴史的経緯で選ばれていました。活動は family master に年齢の範囲で per-child の visibility を付けたもの。チェックリストは per-child の instance。ごほうびは per-child。ボーナスルールは家族全体の KVS。特別ルールは per-child にプラグイン的な拡張。チャレンジは family-wide で全員が自動参加し、「兄弟」前提の命名が 1 人っ子の家庭に違和感を与えていました[^adr55]。

PO の判定は、6 type それぞれに 3〜8 の顧客 use case を並べて行われました。結果として確定した原則は「親管理目線でもどこまでも子供主体であるべき」「年齢フィルターはマーケットプレイス側だけで、親の管理画面では子供別の管理に統一」です[^adr55]。

## 3 つの案と framing bias

| 案 | 内容 | 判定 |
| --- | --- | --- |
| A | per-child instance を主軸にし、family master は限定的に残す | 採用 |
| B | 全 type を family master にし、visibility chip で per-child の ON / OFF を表現 | 「親は子供別にカスタマイズしたい」に矛盾。chip では per-child の point レートや年齢適合の微調整を表現できない |
| C | master を持ちつつ各 child が override の行を持つ 2 層 | 3 ラウンド連続の誤実装の原因 |

案 C の判定理由が、この ADR で最も生成AI固有の記述です。「family master 主軸 + override」を提案するたびに、ユーザーが「親は子供主体で考える」と修正した。framing bias が rationalization を生み、同じ提案が 3 回繰り返された。ADR はそれを、確立パターン（CMS の i18n の base と locale override）に引きずられた結果と記録しています[^adr55]。

採用した案 A には prior art があります。Cozi は家族共有の to-do を member に assign して per-child 化しています。Greenlight は chore と allowance が per-child で、家族 master は決済ルールだけです。Apple の Family Sharing は Screen Time や Ask to Buy が per-child で、Music や Storage は family です。DDD の Aggregate Root が child に閉じることで、child を跨ぐ不変条件が不要になり Repository が単純化する、という設計上の利点も挙げられています[^adr55]。

## 6 つの scope

| Type | scope | 根拠 |
| --- | --- | --- |
| 活動 | per-child instance | 親は子供別にカスタマイズしたい |
| チェックリスト | family master の template + per-child の進捗 | 「保育園じゅんび」のような template は家族で共有するのが自然 |
| ごほうび | per-child instance | 子供別の目標、別のレート、独立した進捗 |
| ボーナスルール | family master | 家族全体のルール |
| 特別ルール | 削除 | 複雑度が価値を上回る |
| チャレンジ | per-child instance + UI の工夫 | 1 人っ子でも自然。「みんなで頑張る」は UI で再現 |

family master を許すのは 3 条件を全部満たすときだけです。顧客の use case で「家族共通が自然」が過半、per-child のカスタマイズ要件が当面不要、1 record で全 child に効くことが UX 上自然。新しい type の既定は per-child です[^scope]。

取込時の子供の紐付けは、マーケットプレイス側では行いません。マーケットプレイスに child の情報を一切流さず、親の管理画面に遷移してから「誰に追加するか、全員か」をダイアログで選びます。URL や body に childId が露出しない、privacy の設計です[^adr55]。

![6 つの scope](/images/ganbari-quest-design/per-child-model.png)

## dedup の scope が違っていた

原則は、取込の重複判定で 1 度破られました。per-child の type（活動、ごほうび、チャレンジ）の import は、child 単位で重複を判定しなければなりません。ところが活動の import が、tenant 全体で「どこか 1 人でも同名を持てば全 child で skip」する dedup になっていました。1 人目に取込済みのパックを 2 人目に取り込むと全部 skip され、`imported: 0` で「追加を押しても無反応」に見えます。顧客のクレームになりました[^scope]。

設計書は「dedup の read scope は aggregate root の scope と必ず一致させる」を規約にし、type ごとの実体を表にしました。活動とごほうびは child 単位、チャレンジは dedup 無しで常に per-child の instance を作成、チェックリストとボーナスルールは family master なので tenant 単位が正しい[^scope]。scope は、テーブルの設計だけでなく、読む側のクエリの範囲まで決めます。片方だけ正しくても、顧客には壊れて見えます。

## UI の軸とデータの scope は別

データの scope が type ごとに違っても、admin の管理画面の表示軸は 3 資源（活動、ごほうび、チェックリスト）とも子供主軸に統一されています。子供タブで「選択中の child のリソース」を表示し、追加と取込は「どのお子さまに?」のダイアログで先を選びます。チェックリストは family master の template のまま、「選択中の child に配信済みの template」を絞って表示するだけで、template を子ごとに複製しません[^registry]。

この宣言は registry に集約され、UI の表示軸、紐付けの UI、そしてデータの scope の 3 つを 1 か所で持ちます。データの scope の宣言と設計書の表の整合は drift gate が検査し、doc 側だけ、registry 側だけを変えると CI が落ちます。[第Ⅴ部-4](fitness-functions) で見た「registry か明示除外リストのどちらかで説明されていること」の要求も、この registry に対するものです[^registry]。

## 値域が 2 か所に書かれていた

per-child の設計と別に、export と import の値域にも二重定義の事故がありました。ドメインの validation は Zod、wire の schema は Valibot で、別ファイル、別ライブラリに値域の literal が書かれていました。「アプリが許容する値域 ⊆ export と import が往復できる値域」という不変条件がどこにも機械表明されておらず、2 サイクル連続で round-trip の blocker が出て統合監査を止めました[^adr66]。

activity-pack だけで実際のドリフトが 5 件ありました。basePoints はドメインが 100 以下、wire が 10,000 以下で 100 倍差。ageMax はドメインが 20 以下、wire が 18 以下で、19 や 20 の行が往復不能。icon はドメインが 1〜2 grapheme、wire が 20 UTF-16 unit で、表現方式そのものが違い、ZWJ の絵文字 2 個が往復不能[^adr66]。

選択肢は 3 つでした。schema 変換の OSS で片方から生成する案は、transform や refine が変換非互換で手動の断絶が残る。単一の Valibot に完全統合する案は、ドメインの Zod が form action や API 境界に広く根付いていて 1 PR に過大。採用したのは、値域の定数をドメイン層に 1 か所だけ定義して両 schema が import する案です。表現方式が異なる値域は判定関数そのものを共有します。整合は fitness test が実 validator を oracle にして boundary を probe し、全 type を COVERED か明示 TODO に分類させます。silent skip は禁止です[^adr66]。

## 今ならこうする

ADR-0055 は、製品の思想をデータの scope に翻訳した ADR です。「子供主体」は LP の言葉ですが、それが `childId` の FK と Aggregate Root の境界になりました。AI が 3 回同じ誤提案をしたのは、確立パターンが「master + override」を勧めるからで、確立パターンを探す規律が製品固有の判断を上書きしかけた例です。OSS を先に探すルールには、「探した結果を製品の思想で棄却する」判断が対になります。

dedup と値域の 2 つの事故は、同じ形をしています。データの scope を決めても、それを読む側、往復させる側が別の場所に自分の定義を持てば、壊れます。定義は 1 か所に置き、他は import する。[第Ⅱ部-3](design-system) のトークンと用語辞書、[第Ⅱ部-4](data-modeling) の PK manifest と同じ形です。

[^adr55]: ADR-0055「Per-child 主軸 + 限定 family master データモデル原則」。6 type の現状と経緯、PO 集計の結論、3 案の比較（prior art、framing bias）、6 type の scope 適用表、取込時の child binding ルール、UI 表示軸の統一。出典: [docs/decisions/0055-per-child-primary-data-model-pattern.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0055-per-child-primary-data-model-pattern.md)

[^scope]: 6 type データモデル scope SSOT。設計原則（per-child 既定、family master の 3 条件、取込ダイアログ）、scope 適用表、dedup の scope 規約と `imported: 0` の事故。出典: [docs/design/data-model-resource-scope.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/data-model-resource-scope.md)

[^registry]: admin リソース管理画面の正準スロット契約と child-binding モデルの SSOT。organizingModel と dataScope が別レイヤーである理由、drift gate。出典: [src/lib/features/admin/admin-resource-model-registry.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/features/admin/admin-resource-model-registry.ts)

[^adr66]: ADR-0066「export/import 値域 SSOT」。2 サイクル連続の blocker、5 件のドリフト、3 案の比較、決定の 4 原則。出典: [docs/decisions/0066-export-import-schema-range-ssot.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0066-export-import-schema-range-ssot.md)
