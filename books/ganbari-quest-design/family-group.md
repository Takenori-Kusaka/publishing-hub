---
title: "第Ⅱ部-8　家族グループ ― 招待、閲覧専用リンク、子供の切替と、書いてよい機能の境界"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

テナントは 1 家族です。家族の中に子供が 1〜N 人、保護者が 1〜N 人います。この章では、家族というグループをどう表現し、保護者を招待し、祖父母に閲覧専用のリンクを渡すかを扱います。共有端末での子供の切り替えも扱います。あわせて、設計書が「実装済み」と「構想」を分けて書く理由も見ます。生成AIは構想を実装済みのように書きがちで、それを LP に載せると [第Ⅲ部-8](lp-delivery) で見た「LP の文言は実装の事実から」の原則を破ります。

## 概念は 3 行

家族グループ管理の設計書は、概念の階層を 3 行で書いています。家族グループ（= テナント = 1 家庭）の下に、こども（1〜N 人、年齢別モード）とメンバー（1〜N 人、保護者の招待と権限管理）。設計書がこの SSOT を必要とした理由は、「こども」管理と「メンバー」管理が別ページとして実装されていながら、概念上は「家族グループ」配下の構成要素であることが文書化されていなかったからです[^familydoc]。

設計書は committed と aspirational を表で完全に分離します。committed は実装ファイルの参照付きで、こども管理（追加、編集、年齢モード、テーマ色、アーカイブ）とメンバー管理（招待、ロール）の 2 つ。aspirational は家族グループの招待リンク、テナント名の設定、家族プロフィールの 3 つで、「LP、法務文書、アプリ UI に『実装済み』と書いてはいけない」と明記されています[^familydoc]。この分離は [第Ⅰ部-1](product) で見た製品方針の、設計書側の実装です。

ロールは 3 つです。owner はテナントの作成者で全権、parent は招待された保護者で子供の管理は全権、メンバー管理は招待のみ、child は親の管理画面に入れません[^familydoc]。無料プランは招待不可で owner だけ、スタンダードは owner を含めて 4 人まで、家族プランは無制限です[^planlimits]。

## 招待の 3 つの guard

招待リンクの実装には、3 つの guard が重なっています。

1 つ目は token です。招待コードは 32 バイトのランダムから生成し、DB には sha256 の hash だけを保存します。生の token は生成時に呼び出し元へ返すだけです。「bare bearer 化による機密性の退行を防ぐ」ためで、token 自体が 256bit の高エントロピーなので salt は不要、パスワードと違い辞書攻撃が成立しない、と設計判断が書かれています。新規の依存は足さず node の crypto だけで、repo 内の既存の慣行（viewer の token 生成、PIN reset の OTP の timing-safe 比較）に揃えています[^invitetoken]。

2 つ目は email の束縛です。宛先 email を指定した招待は、受諾する人の email が一致し、かつ検証済みでなければ受け入れません。`emailVerified === false` は、他人の email を自称した束縛招待の横取りを塞ぐため fail-closed で拒否します。この判定は当初 service 層にありましたが、DSQL の並行実装で判定が非対称になっていました。判定を純関数 1 か所に集約し、両経路が import します[^emailbinding]。[第Ⅱ部-7](multi-tenancy) の「アプリ層単一強制点」と同じ形です。

3 つ目は owner gate です。メンバーの削除、owner の移譲、招待の発行と取消は、テナントの権限そのものを変える mutation なので、owner 限定の seam を通ります。拒否は監査 log に残し、403 と 401 の変換は共通の helper に集約して、各 endpoint に try / catch を複製しません[^ownergate]。

![招待の 3 つの guard](/images/ganbari-quest-design/family-group.png)

## 閲覧専用リンク

祖父母や離れて暮らす家族に、子供の記録を見せたいことがあります。閲覧専用リンクは、認証なしで開ける URL で、token の有効性だけを検証します。有効期限は 7 日、30 日、無制限の 3 択で、token は招待と同じ 32 バイトの base64url です[^viewertoken]。

このリンクは、[第Ⅱ部-7](multi-tenancy) で見た capability lookup の 1 つです。token 単独で row を引き、取得した行の `family_id` に以降を再スコープします。閲覧ページが渡すのは、ニックネーム、年齢、ポイント、レベル、カテゴリ別のステータスだけです。2026 年 9 月の監査で、ポイントの表示が「[object Object] ポイント」になっている不具合が見つかりました。取得関数の戻り値をそのまま代入していたためで、画面に渡す型を `number` と宣言し、同じ取り違えがコンパイルで落ちるようにしました[^viewpage]。

## 共有端末で子供を切り替える

家庭では、1 台のタブレットを親子で共有します。「いまどの子供として使っているか」は cookie に持ちます。書き手が `/switch` の選択と子供画面の layout と、ログイン直後の着地決定の 3 か所に分かれ、属性（path、httpOnly、有効期限）が書き手ごとにずれると「書いたのに次のリクエストで読めない」が起きるため、読み書きを 1 か所に集約しました。寿命は 1 年で、機微な情報は持たない id だけです[^childcookie]。

子供を選ぶ操作には、もう 1 つの意味があります。親が子供モードへ戻った瞬間に、親の PIN セッションの cookie を削除します。次に子供が親の画面へ行こうとすると、再び PIN を要求されます。[第Ⅱ部-9](auth) で見る親の PIN gate は、この「切替で失効する」設計が核心です[^security]。

## 今ならこうする

家族グループの設計で最も効いたのは、committed と aspirational の表です。生成AIは、設計書に「家族プロフィール」と書いてあれば実装し、LP に「家族で共有」と書いてあれば機能があると信じます。どちらも書かれていましたが、実装はありませんでした。表で分けたことで、LP に書いてよい機能の一覧が機械的に決まりました。

招待の 3 つの guard は、それぞれ別の事故から生まれています。token の hash 化は DSQL 移行時の設計、email の束縛は横取りの穴、owner gate は権限変更の濫用。3 つが同じ形（1 か所の純関数か seam を両経路が通る）に収束したのは偶然ではなく、[第Ⅳ部-5](sixty-to-hundred) の class-lock の帰結です。

閲覧専用リンクの `[object Object]` は、型が緩いところで起きる典型です。戻り値が union の関数をそのまま画面に渡すと、片方の型が画面に漏れます。画面に渡す形を先に宣言する規律は、この 1 件で入りました。

[^familydoc]: 家族グループ管理の設計書。設計背景、概念階層、committed と aspirational の表、共通権限ポリシー、ナビゲーション配置。出典: [docs/design/family-group-management.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/family-group-management.md)

[^planlimits]: プラン別の上限表の SSOT。domain の葉に置く理由（循環依存と CLI からの流入）、free / standard / family の値。出典: [src/lib/domain/plan-limits.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/domain/plan-limits.ts)

[^invitetoken]: 招待 token の生成と照合。設計判断（node の crypto のみ、hash だけを保存、salt 不要の理由、既存の慣行との整合）。出典: [src/lib/server/auth/invite-token.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/auth/invite-token.ts)

[^emailbinding]: 招待 email 束縛判定の SSOT。service 層と DSQL 実装の非対称を根治した経緯、fail-closed の判定。出典: [src/lib/server/auth/invite-email-binding.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/auth/invite-email-binding.ts)

[^ownergate]: owner gate の共通 Response 変換。403 と 401 の扱い、監査 log のコンテキスト。出典: [src/lib/server/auth/owner-gate.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/auth/owner-gate.ts)

[^viewertoken]: 閲覧専用リンクの管理サービス。token の生成、有効期限の 3 択。出典: [src/lib/server/services/viewer-token-service.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/services/viewer-token-service.ts)

[^viewpage]: 閲覧専用ページの load。画面に渡す型の宣言と `[object Object]` の修正。出典: [src/routes/view/[token]/+page.server.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/routes/view/%5Btoken%5D/%2Bpage.server.ts)

[^childcookie]: 選択中の子供を覚える cookie の SSOT。書き手が 3 か所に分かれていた背景、寿命。出典: [src/lib/server/auth/selected-child-cookie.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/auth/selected-child-cookie.ts)

[^security]: セキュリティ設計書 §4.3 の主要 flow（明示削除: 親が child mode へ戻った瞬間に session が失効する）。出典: [docs/design/14-セキュリティ設計書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/14-%E3%82%BB%E3%82%AD%E3%83%A5%E3%83%AA%E3%83%86%E3%82%A3%E8%A8%AD%E8%A8%88%E6%9B%B8.md)
