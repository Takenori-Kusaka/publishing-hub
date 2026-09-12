# Bluesky アプリパスワードの設定と無効化手順 (bluesky-setup.md)

Bluesky APIを使用してGitHub Actionsから本番投稿するための、専用「アプリパスワード」の作成、および漏洩時の緊急失効（Revoke）手順について説明します。

---

## 1. Bluesky アプリパスワードとは
GitHub Actionsなどの自動スクリプトからBlueskyへ接続する際は、**通常ログイン用のマスターパスワードを使用してはなりません。** 
代わりに、権限やアクセスを限定し、いつでも個別に破棄・失効させることができる「アプリパスワード（App Password）」を作成して使用します。

---

## 2. アプリパスワードの作成手順 (マスターパスワードは使用しない)

1. **Bluesky にサインイン:**
   - 普段お使いのクライアント（公式Webアプリ：[bsky.app](https://bsky.app/)など）にログインします。
2. **設定画面を開く:**
   - [設定] (Settings) ➔ [高度な設定] (Advanced) ➔ [アプリパスワード] (App Passwords) を選択します。
3. **新規パスワードの生成:**
   - [アプリパスワードを追加] (Add App Password) ボタンを押します。
   - 分かりやすい名前（例: `GitHub Actions - Publishing Hub`）を入力し、[アプリパスワードを生成] を選択します。
4. **生成されたパスワードの保存:**
   - 画面に `xxxx-xxxx-xxxx-xxxx` 形式の文字列が表示されます。
   - **このパスワードは一度画面を閉じると再表示できません。** 速やかにコピーし、安全なパスワードマネージャー等に一時的に控えてください。

---

## 3. GitHub Environment Secrets への登録

作成したアプリパスワードを、リポジトリの **Environment Secrets** へ登録します。

1. GitHub リポジトリの [Settings] ➔ [Environments] を選択します。
2. **`social-production`** 環境を選択（Required Reviewersを設定していることを確認）します。
3. 以下の項目を登録・更新します。

| 設定項目 | 種別 | 値の例 | 説明 |
|---|---|---|---|
| `BSKY_APP_PASSWORD` | **Environment Secret** | `xxxx-xxxx-xxxx-xxxx` | ステップ3で生成したアプリパスワードの実値 |
| `BSKY_IDENTIFIER` | **Environment Variable** | `takenori.bsky.social` | 自身のBlueskyハンドル（または登録メールアドレス） |
| `BSKY_SERVICE` | **Environment Variable** | `https://bsky.social` | 接続先PDSサービス。標準は `https://bsky.social` |

---

## 4. アプリパスワードの失効（緊急取り消し / Revocation）手順
パスワード漏洩の疑いがある場合、またはActions統合を緊急停止したい場合は、以下のいずれかの方法でアプリパスワードを即座に破棄（失効）してください。

### 方法 4.1: Web UI からの削除（推奨）
1. Blueskyの [設定] ➔ [高度な設定] ➔ [アプリパスワード] 画面を開きます。
2. 削除対象のパスワード（例: `GitHub Actions - Publishing Hub`）の横にある **ゴミ箱アイコン（または削除ボタン）** をクリックします。
3. 削除を承認すると、そのパスワードによるすべての接続は即座に拒否されます。

### 方法 4.2: AT Protocol API を使ったコマンドによる失効
もしWeb UIにアクセスできないなどの緊急事態が発生した場合は、以下のエンドポイントを直に叩いて破棄を申請できます。

```bash
curl -X POST https://bsky.social/xrpc/com.atproto.server.revokeAppPassword \
  -H "Content-Type: application/json" \
  -u "<YOUR_HANDLE>:<YOUR_MASTER_PASSWORD>" \
  -d '{"name": "GitHub Actions - Publishing Hub"}'
```
- `<YOUR_HANDLE>`: 自身のハンドル（例: `takenori.bsky.social`）。
- `<YOUR_MASTER_PASSWORD>`: 通常ログイン用のマスターパスワード。

破棄の成功後は、GitHub Environment Secretsから漏洩したパスワードを削除またはダミー値に書き換えてください。
