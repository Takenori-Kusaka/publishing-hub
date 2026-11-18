---
title: JWT の受け手の検証を 9 つの要素に分け、1 つずつ外して攻撃を当てる(Python・PyJWT)
tags:
  - JWT
  - Python
  - OAuth
  - PyJWT
  - Security
private: false
updated_at: '2026-11-18T06:33:15+09:00'
id: ef2b86d57156cf1d1aca
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

:::note info
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。
:::

# はじめに

JWT を受け取る API で「署名は検証しているから大丈夫」と考えていると、どの確認が実際にどの攻撃を止めているのかが見えません。この記事は、受け手の検証を要素の集合として書き、要素を 1 つずつ外して攻撃と正規の要求を当て直す、除去実験の作り方の要点です。題材は、組織で共用する独自クレームを扱うケーススタディです。

- 正本(Zenn): [JWT の独自クレームは契約である ― 設計ガイドと、攻撃を当てて測ったケーススタディ](https://zenn.dev/takenori_kusaka/articles/jwt-claims-design-guide)
- コードと結果: [jwt-claims-casestudy](https://github.com/Takenori-Kusaka/jwt-claims-casestudy)(`cs/verify.py`、`results/summary.md`)
- ケーススタディのスライド(49 枚): [Web スライド](https://takenori-kusaka.github.io/jwt-claims-casestudy/)、[Docswell](https://www.docswell.com/s/takenori_kusaka/KJWMVQ-jwt-claims-casestudy)
- 前提のガイド(スライド 152 枚): [jwt-claims-guide](https://github.com/Takenori-Kusaka/jwt-claims-guide)

# 技術選定の理由

| 要素 | 選んだもの | 理由 |
| --- | --- | --- |
| 判定 | LLM を使わない決定的な検証、仮想の時計、固定した乱数の種 | 同じ手順で何度でも同じ判定にするため |
| IdP | Keycloak 26.8 を実際に動かす | IdP の実際の挙動を測るため |
| 行単位の制御 | Postgres 16 の RLS | テナントの条件がデータ側で効くかを確かめるため |
| ほかの IdP | Entra ID・Okta・Cognito・Auth0 は模擬 | 2026 年 11 月時点の公式文書にある形を再現する |

署名の検証には PyJWT 2.10.1 を使っています。受け手が確かめる項目の考え方は [RFC 8725(JWT Best Current Practices)](https://www.rfc-editor.org/rfc/rfc8725) にあり、`jwt.decode` の `algorithms` と `options` の意味は [PyJWT のドキュメント](https://pyjwt.readthedocs.io/en/stable/api.html) にあります。

# 確かめる 9 つの要素

共通の基準(構成 B)は、次の 9 要素です。

| 要素 | 確かめること |
| --- | --- |
| alg | alg は RS256 だけ。jku・jwk・x5u・x5c は無視し、kid は登録済みの鍵だけ |
| iss | iss を許可リストと完全一致。鍵はその発行者に登録されたものだけ |
| aud | aud に自分が含まれる |
| exp | exp が必須。ずれは 30 秒まで |
| typ | アクセストークンだけを受ける(Cognito は token_use) |
| required | 組織で必須と決めたクレームが無ければ拒否 |
| types | 必須クレームの型(ID は文字列、配列は配列) |
| immutable_id | 利用者のキーは sub などの不変の ID。ログイン名やメールを使わない |
| namespace | 組織のクレームは、組織の名前空間の中だけを読む |

何も入れない構成 N は、よくある誤りの再現です。構成 BE は、B に題材ごとの重点を足したものです。重点とは、マルチテナント SaaS ならテナントと発行者の照合、AIエージェントの委任なら承認の束縛のように、その題材で足す対策です。除去実験は、B や BE から 1 要素だけ抜いた集合を作れば書けます。

# 要素の名前で確認を切り替える

検証器は、有効にする要素の名前の集合 `f` を受け取り、名前があるときだけその確認をします。署名の検証と、その後の判定を抜粋します。`jwt.decode` には署名を確かめさせ、aud・exp・iat・nbf の検証は `options` で切って、要素ごとの分岐に受け持たせます。sub などの型の確認は PyJWT 2.10 の既定のまま残ります。

```python
# https://github.com/Takenori-Kusaka/jwt-claims-casestudy/blob/1d7792c82d2aa86df1beae7cfc767cd4cc9b265c/cs/verify.py
    def verify(self, token):
        h, p, hs, ps, sig = parts(token)
        f = self.f
        # ...
            key = next((k for k in pool if k.kid == h.get('kid')), None)
            if key is None:
                raise Reject('unknown key for this issuer')
            try:
                jwt.decode(token, key.pub_pem, algorithms=['RS256'], options={'verify_aud': False, 'verify_exp': False, 'verify_iat': False, 'verify_nbf': False})
            except jwt.PyJWTError as e:
                raise Reject(type(e).__name__) from e
        if 'iss' in f and p.get('iss') not in self.allowed:
            raise Reject('issuer not allowed')
        if 'aud' in f and self.audience is not None:
            a = p.get('aud')
            if self.audience not in (a if isinstance(a, list) else [a]):
                raise Reject('aud')
        if 'exp' in f:
            if not isinstance(p.get('exp'), (int, float)):
                raise Reject('exp missing')
            if p['exp'] + self.leeway <= self.clock.now():
                raise Reject('expired')
        if 'typ' in f and self.typ:
            ok = self.typ(h, p) if callable(self.typ) else h.get('typ') in self.typ
            if not ok:
                raise Reject('wrong token type')
        for path, typ in self.required.items():
            v = get_path(p, path)
            if v is None:
                if 'required' in f:
                    raise Reject('missing required claim ' + path)
                continue
            if 'types' in f and not isinstance(v, typ) or 'types' in f and isinstance(v, bool) and typ is not bool:
                raise Reject('wrong type ' + path)
        return p
```

ポイントは 3 つです。

- `exp` は「あれば確かめる」ではなく、数値で無ければ拒否します。exp の無いトークンは、期限のない合鍵になるからです。
- `required` は組織で必須と決めたクレームの欠落を拒否します(fail closed)。欠けたトークンを、既定値で処理させないためです。
- `types` は、ID を文字列、配列を配列に固定します。真偽値を数値として通さない条件も入れています。

要素 `alg` が無い構成は、過去の誤りを再現した別の処理に進みます。トークン自身が名乗る alg や jku・jwk を信じ、kid をファイルのパスとして読む処理です。

# 1 つ外すと、何が再び通るか

汎用の題材には攻撃が 14 件あり、B で通ったのは 0 件でした。そこから 1 つずつ外すと、再び通る攻撃は要素ごとに分かれます。

- alg を外す:alg none、HS256 への差し替え、kid のパス、jku、jwk、別の発行者の鍵で iss を偽るトークン
- iss を外す:別の発行者のトークンと、別の発行者の鍵で iss を偽るトークン
- exp を外す:exp の無いトークンと、期限切れのトークン
- aud・typ・required・types を外す:それぞれ 1 件(宛先違い、ID トークン、テナントのクレームの欠落、配列になったテナント)

別の発行者の鍵で iss を偽るトークンは、alg と iss の両方に出てきます。どちらを外しても通るので、2 つの要素がそろって初めて止まります。重複を除くと、外して通る攻撃は 13 件です。14 件のうち残る 1 件は sub を数値にしたトークンで、何も入れない構成 N でも拒否されました。PyJWT 2.10 が、この形を自ら拒否するためです。

一方で、不変の ID と組織の名前空間は、汎用の攻撃では外しても何も通りませんでした。この 2 つは、別の題材で効いています。社内業務システムでは、Okta のログイン名を再利用した新しい社員が、前任者のデータを読む攻撃を不変の ID が止めました。マルチテナント SaaS では、パスと X-Tenant でテナントを偽る攻撃を名前空間が止めました。1 つの題材の結果だけで、要素を削らないようにします。

AIエージェントの委任の題材では、12 件の攻撃のどれも B では止まらず、B から何を外しても結果は同じでした。止めたのは、承認の束縛、宛先に束縛した交換、タスク単位の短命トークンなどの重点の要素です。宛先に束縛した交換は、呼び出しのたびに単一の宛先向けのトークンへ交換し、受け取ったトークンをそのまま渡さない要素です。題材ごとの全ケースと除去の結果は、リポジトリの `results/summary.md` にあります。

# 実行

リポジトリの `run_all.py` が、コンテナの起動、全題材と除去実験、測定、`results/` への書き出し、コンテナの停止までを行います。前提は WSL の Docker で、Keycloak 26.8.0 と Postgres 16 のイメージを使います。鍵とパスワードはすべて試験用です。

# まとめ

- 受け手の検証を要素の集合で書くと、除去実験は集合の差で書ける
- exp と必須クレームは、無ければ拒否する
- 要素の要否は複数の題材で判断する。AIエージェントの委任は、共通の基準だけでは止まらない

重点の費用(誤拒否、遅延)、Keycloak 26.8 の実測、共有クレームを変えたときの契約テストの限界、寿命の試算は、正本の [Zenn の記事](https://zenn.dev/takenori_kusaka/articles/jwt-claims-design-guide) にまとめています。
