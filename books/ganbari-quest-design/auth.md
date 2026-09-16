---
title: "第Ⅱ部-9　認証 ― Cognito の 2 層、おやカギコード、共有端末で子供が突破できない PIN reset"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

認証の設計で最も特殊な前提は、「認証済みのセッション ≠ 親」です。家庭内の共有端末では、親のセッションのまま子供が操作します。だから、Cognito で認証されていても親の画面には入れず、4 桁のおやカギコード（PIN）を要求します。この章では、Cognito の 2 層構造、おやカギコードの設計、PIN を忘れた親を「子供が知らない材料」で本人確認する仕組み、そして運営者の画面の認可を扱います。

## Identity と Context の 2 層

本番の認証は 2 層です。Layer 1 は Identity で、Cognito の JWT を `identity_token` の cookie から取り、署名（RS256）と発行者と audience と期限を検証して userId と email を得ます。期限切れなら `gq_refresh` の cookie で Cognito の token endpoint を叩いて更新し、失敗したら refresh の cookie を消します。Layer 2 は Context で、HMAC-SHA256 で署名した `context_token` から tenantId・role・childId を得ます[^security]。

Context の TTL は role で違います。owner は 24 時間、子供は 24 時間、共用アカウントの親モードは 30 分[^contexttoken]。[第Ⅱ部-7](multi-tenancy) で見たとおり、課金状態は token に載せません。載せていた時期は、Stripe の webhook が DB を更新しても cookie が切れるまで古いままで、支払い済みの顧客が最大 24 時間有料機能を使えず、解約済みの顧客が最大 24 時間使えました。

Cognito の User Pool は、email とパスワードのサインイン、MFA は任意（TOTP のみ、SMS 無効）、パスワードは 8 文字以上で大小英字と数字、アカウント回復は email のみ、削除保護は RETAIN です。Google の federation も条件付きで有効で、IdP を UserPool の client より先に作る依存関係を CDK に明示しています。IdP が作成途中だと client が「The provider Google does not exist」で失敗するためです[^authstack]。

email 属性は `mutable: true` です。`false` にすると、Google で再認証したとき Cognito が IdP から取得した email を「属性更新」として扱い、`Attribute cannot be updated` でログイン不能になります。この設定変更が、[第Ⅲ部-4](deploy-gates) で見た CloudFormation の in-place 更新の事故を起こしました[^security]。

refresh の cookie を保存する経路は 3 つ（OAuth の callback、signup の自動ログイン、email とパスワードのログイン）で、新しいログイン経路を足すときは必ず配線する規約です。identity の token だけを保存するとセッションが 1 時間で失効します[^security]。

## おやカギコード

親の PIN gate の脅威モデルは、同じ端末を親子が共有する家庭で、子供が `/switch` の「ご家族の見守り画面」から `/admin/*` に到達することです。Apple の Screen Time や BusyKid と整合させ、4 桁の PIN、httpOnly の署名付き cookie、15 分の inactivity で失効する sliding session を導入しました[^security]。

cookie の署名方式は、OSS 4 件を比較して `cookie-signature` を選びました。Express の標準で 16 年の実績、依存ゼロで 1KB 未満、API は sign と unsign の 2 関数だけ。jose（JWT）は session token として OWASP 非推奨で、4 桁 PIN の短命 session に過剰。iron-session は暗号化するが payload に PII が無いので無駄。lucia-auth は full framework で、既存の Cognito と二重管理になる。payload は tenantId・verifiedAt・lastActiveAt の 3 つで、改ざん防止だけ満たせば足ります[^adr50]。

強制点は 3 つだけです。`hooks.server.ts` が admin 系 API の書き込みと一括で PII を返す読み取りを 403 で止め、`withParentGate` が admin の form action を `fail(403)` で止めます。303 にしないのは、画面遷移で保護者の入力が消えるためです。そして admin の layout が page の表示を `/switch` へ redirect します。「個々の endpoint に PIN 判定を書き足さない。強制点が増えると、書き忘れた 1 本がそのまま穴になる」[^security]。

PIN gate には、ログアウトで消し忘れる事故がありました。signout と logout という 2 handler がそれぞれ cookie 5 件を個別に削除していて、親 gate の session cookie は両方から漏れていました。共有端末でログアウトしても、24 時間以内に同じ家族の大人が再ログインすると PIN なしで親画面に入れます。「ログアウトで消すべき cookie」を 1 か所に列挙し、両 handler がそれを呼び、網羅はテストが固定します[^sessioncookies]。

## PIN を忘れた親

PIN を忘れたとき、セッションだけで reset を許すと子供が gate を突破できます。だから本人確認には「子供が知らない材料」を使います。パスワードのユーザーは、アカウントのパスワードの再入力。Google で federate したユーザーは Cognito のパスワードを持たないため、登録メールへ 6 桁の確認コードを送り、それを入力させます[^security]。

federated の本人確認は、当初「最近ログインしたこと」でした。しかし Cognito は `prompt=login` を IdP に転送せず、Hosted UI の cookie が失効したあとの Google の silent SSO で `auth_time` が更新されます。共有端末で親の session が生きていれば、子供が無入力で通過できる穴がありました。子供はメールを読めないので、email の OTP で塞ぎました。OTP は DB に保存しない stateless 方式です。code の hash・失効（10 分）・tenantId・試行回数を、親 gate と同じ `cookie-signature` で署名した cookie に格納します。schema の変更はありません[^adr50]。

セルフホストには別の機構があります。「deploy 環境の env を書ける = owner 本人」を実認証とみなし、`PARENT_PIN_RESET` の env と再起動で PIN を未設定に戻します。env が無ければ完全に no-op、同じ token は二度と適用しない冪等、適用は監査 log に記録[^security]。

初回の PIN は「作る」で、既定の PIN での login は廃止されました。PIN 未設定のテナントが gate に到達すると、入力と確認の 2 段の作成 modal が出ます。既定値のヒントは、顧客が見る UI のどこにも表示しません。業界 4 サービスの調査で「初期 PIN のヒントは setup 時のみ、認証 modal では非表示」が 100% だったことと、既定 PIN が存在しなくなったことで案内が誤案内になるためです。ヒントの残存は fitness function が検出します[^security]。

## 運営者の画面

運営者の `/ops` は、Cognito の `ops` group 所属という 1 つの述語だけで守ります。判定は `requireOpsAccess` の単一強制点で、page の layout と API の両方が呼びます。identity が無い、local、groups が欠落、はすべて 403 の fail-closed で、reason を返さないのは非 ops に group の存在を示唆しないためです。CloudFront に運営者の IP allowlist は置きません。遮断対象に `/admin`（顧客の画面）が含まれると全顧客が 403 になるからです[^security]。

MFA は要求しません。2026-08-06 のオーナー決裁です。運営 1 人、ops group のメンバー 0 人の段階では TOTP 登録の運用コストに見合わない。設計書は「これで弱くなること」を明記しています。`/ops` は全顧客の売上、コホート、コスト、PL を持ち、MFA を外すと防御は「Cognito 認証 + ops group」だけになり、ops アカウントのパスワード 1 つが漏れた時点で入られる。再評価のトリガーは 3 つで、有料家庭が 10 世帯を超える、ops group が 2 人以上になる、`/ops` に書込や顧客個人情報の表示が増える[^security]。

当初の `/ops` は共有 secret の Bearer token でした。actor が識別できず監査 log に誰が操作したか残らない、漏洩時の影響範囲が無限大、cookie の平文保存。ops group への刷新で、actor は Cognito の sub になりました[^opslayout]。

## ローカルの開発

認証画面の開発と検証には `npm run dev:cognito` を使います。`DEV_USERS` には 10 アカウントが定義されています。owner・parent・child・free・standard・family・trial 期限切れ・Google の federated 相当・ops・MFA 未設定の ops です。実 AWS を呼ばずに PIN reset や `/ops` の認可を実ブラウザで歩けます。画面が email とパスワードを literal で持つと案内だけが古くなるため、案内は SSOT から導出します[^cognitodev]。

## 今ならこうする

「認証済み ≠ 親」の前提は、この製品固有の判断で、正しかったと考えています。共有端末は家庭の現実で、Cognito の認証はそれを解決しません。PIN gate は「speed bump であって実認証ではない」と設計書に明記されており、その限界を認めた上で、切替での失効、PIN reset の材料、ログアウトでの消去を積み上げました。

PIN reset の穴は、生成AIが「最近ログインした」を本人確認の材料として提案し、Cognito の silent SSO の挙動を見落とした例です。Cognito の Hosted UI が `prompt=login` を IdP に転送しないことは、一次情報を読まないと分かりません。AI の提案を採用する前に、「共有端末で子供が通れるか」を問う 1 行が、ログイン手段のマトリクスとして設計書に残りました。

MFA を要求しない決裁は、正直な文書の例です。弱くなることと、残る防御と、戻すトリガーを書いた上で決めています。

[^security]: セキュリティ設計書。§4.1 は Cognito モード（2 層・サイレントリフレッシュ・User Pool 設定・email の mutable・Context Token）。§4.3 は親 PIN gate（脅威モデル・仕様・強制点 3 つ・初期 PIN ヒント）。§4.3b はログイン手段マトリクス。§4.4 は PIN reset（本人確認の分岐、operator reset）。§5.2.9 は `/ops` の認可と MFA を要求しない決定。出典: [docs/design/14-セキュリティ設計書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/14-%E3%82%BB%E3%82%AD%E3%83%A5%E3%83%AA%E3%83%86%E3%82%A3%E8%A8%AD%E8%A8%88%E6%9B%B8.md)

[^contexttoken]: Context token の署名。role 別の TTL、載せる claim の明示列挙。出典: [src/lib/server/auth/context-token.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/auth/context-token.ts)

[^authstack]: AuthStack の CDK 定義。User Pool の設定、Google IdP の依存関係、staging での省略。出典: [infra/lib/auth-stack.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/infra/lib/auth-stack.ts)

[^adr50]: ADR-0050「Parent-Gate Session Cookie 署名方式」。OSS 4 件の比較、cookie の schema、署名キーの配布証跡、PIN reset 機構の supersede 記録（email-OTP、operator reset）。出典: [docs/decisions/0050-parent-gate-session-cookie-signature.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0050-parent-gate-session-cookie-signature.md)

[^sessioncookies]: ログアウトで破棄する cookie 集合の SSOT。親 gate の cookie が漏れていた背景。出典: [src/lib/server/auth/session-cookies.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/auth/session-cookies.ts)

[^opslayout]: `/ops` の layout。旧実装（共有 secret）の問題点と ops group への刷新、単一強制点。出典: [src/routes/ops/+layout.server.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/routes/ops/%2Blayout.server.ts)

[^cognitodev]: cognito-dev mode の provider と `DEV_USERS`。出典: [src/lib/server/auth/providers/cognito-dev.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/src/lib/server/auth/providers/cognito-dev.ts)
