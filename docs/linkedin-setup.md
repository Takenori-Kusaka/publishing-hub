# LinkedIn 認証・初期設定とトークン更新手順 (linkedin-setup.md)

LinkedIn Posts APIを使用して本番公開するための、認証トークンの初期取得、および60日ごとのローカル更新・ローテーション手順について説明します。

---

## 1. 開発者ポータルでの初期設定 (1回のみ)

1. **LinkedIn Developer Portal にサインイン:**
   - [LinkedIn Developers](https://www.linkedin.com/developers/) へアクセスします。
2. **アプリケーションの作成:**
   - [Create App] ボタンを押し、会社名（無ければ個人名）、アプリケーション名、およびロゴ画像をアップロードして作成します。
3. **「Share on LinkedIn」製品の追加:**
   - 作成したアプリの [Products] タブを選択し、**Share on LinkedIn** を追加（Request Access）します。数分で自動承認され、アクティブになります。
4. **リダイレクトURLの設定:**
   - [Auth] タブの [OAuth 2.0 settings] ➔ [Authorized redirect URLs] に、ローカルでの認証用URL（例: `http://localhost:8080/callback`）を登録します。

---

## 2. アクセストークンの初期取得および更新手順

LinkedInのユーザーアクセストークン（`w_member_social`）の有効期限は現在**60日間**です。失効、または週次モニターで警告（14日以下）が出た場合は、以下の手動手順でローカル更新を完了してください。

### ステップ 2.1: 認可コード（Authorization Code）の取得
ブラウザに以下のURL（1行に連結したもの）を入力し、ログインしてアクセスを承認します。

```text
https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=<YOUR_CLIENT_ID>&redirect_uri=http://localhost:8080/callback&scope=w_member_social&state=random_state_string
```
- `<YOUR_CLIENT_ID>`: アプリの [Auth] タブに記載されている **Client ID**。
- 承認後、ブラウザが `http://localhost:8080/callback?code=AQxxxx...&state=random_state_string` へリダイレクトされます。
- アドレスバーから **`code` の値** をコピーします（これが一時認可コードです）。

### ステップ 2.2: 認可コードをアクセストークンへ交換（Token Exchange）
ターミナル（またはPostman等のHTTPクライアント）から、以下のPOSTリクエストを送信して本番トークンを取得します。

```bash
curl -X POST https://www.linkedin.com/oauth/v2/accessToken \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=<AQxxxx_一時認可コード>" \
  -d "redirect_uri=http://localhost:8080/callback" \
  -d "client_id=<YOUR_CLIENT_ID>" \
  -d "client_secret=<YOUR_CLIENT_SECRET>"
```
- `<YOUR_CLIENT_SECRET>`: アプリの [Auth] タブに記載されている **Client Secret**。

**正常レスポンス (JSON):**
```json
{
  "access_token": "AQxxxx_実アクセストークン値_ここに登場します",
  "expires_in": 5183999
}
```
- `expires_in` は秒数（約60日）です。
- **現在の日時にこの `expires_in` 秒を足した日付**を算出し、ISO 8601 形式（例: `2026-11-10T12:00:00+09:00`）で控えておきます。

### ステップ 2.3: 投稿者URNの取得 (Person URN)
取得した `access_token` を使い、自身のPerson URN（ID）を取得します。

```bash
curl -X GET https://api.linkedin.com/v2/userinfo \
  -H "Authorization: Bearer <AQxxxx_実アクセストークン値>"
```

レスポンスJSON内の `sub` フィールド（例: `urn:li:person:AbCd12345`）が、あなたの **LinkedIn Author URN** です。

---

## 3. GitHub Environment Secrets への登録・更新

取得した新しい情報を、リポジトリの **Environment Secrets** へ安全に登録します。

1. GitHub リポジトリの [Settings] ➔ [Environments] を選択します。
2. **`social-production`** 環境を選択（無ければ新規作成し、Required Reviewersをご本人様に設定）します。
3. 以下の項目を登録・更新します。

| 設定項目 | 種別 | 値の例 | 説明 |
|---|---|---|---|
| `LINKEDIN_ACCESS_TOKEN` | **Environment Secret** | `AQxxxx...` | ステップ2.2で得た `access_token` の実値 |
| `LINKEDIN_AUTHOR_URN` | **Environment Variable** | `urn:li:person:AbCd12345` | ステップ2.3で得た Person URN の値 |
| `LINKEDIN_TOKEN_EXPIRES_AT` | **Environment Variable** | `2026-11-10T12:00:00+09:00` | トークン失効期限日（ISO 8601形式） |
| `LINKEDIN_VERSION` | **Environment Variable** | `202604` | LinkedIn APIバージョン。年4桁＋月2桁（例: `202604`） |

---

## 4. 有効トークンの失効（緊急取り消し / Revocation）手順
トークン漏洩の疑いがある場合は、速やかに以下のエンドポイントへPOSTリクエストを送信してトークンを無効化してください。

```bash
curl -X POST https://www.linkedin.com/oauth/v2/revoke \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=<YOUR_CLIENT_ID>" \
  -d "client_secret=<YOUR_CLIENT_SECRET>" \
  -d "token=<AQxxxx_漏洩したアクセストークン>"
```
無効化が成功すると HTTP `200` が返り、そのトークンによるPosts APIへのアクセスは即座に拒否されます。その後、GitHub Environment Secretsから漏洩したトークン値を削除または上書きしてください。
