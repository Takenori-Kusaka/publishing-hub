---
title: "GitとGitHub Actionsで構築する！複数メディア（Qiita, Zenn, note, SNS）の自動・安全パブリッシング基盤"
tags:
  - Qiita
  - GitHubActions
  - DevOps
  - 個人開発
private: true
updated_at: ""
id: null
organization_url_name: null
slide: false
ignorePublish: false
---

# はじめに

個人開発や技術発信を行っていると、複数のメディア（Qiita、Zenn、note、各種SNS）に手動で同じ記事をコピペ・転載するコストが課題になります。また、ローカルから手動で投稿を行う運用は、誤公開やAPIトークンなどの機密情報（シークレット）の漏洩リスクを孕んでいます。

本記事では、これらすべての課題を**「Gitを唯一の真実のソース（SSOT：Single Source of Truth）」とし、GitHub Actions（CI/CD）と安全に結合したパブリッシング基盤のアーキテクチャ**として整理・解説します。

---

# 1. パブリッシング基盤の全体像とアーキテクチャ

本システムの中核的なポリシーは、**「同じ本文の単純複製ではなく、同じテーマに基づく個別成果物（バリアント）の統合管理」**です。

長文原稿であるMarkdownが「正本（SSOT）」となり、SNS用のコンパクトなYAMLデータが「バリアント」として連携します。

```text
E:\Github\zenn-content\
├── articles/                          # Zenn 記事
├── books/                             # Zenn 本
├── platforms/
│   ├── qiita/                         # Qiita 記事・CLI設定
│   │   ├── qiita.config.json
│   │   └── public/
│   └── note/                          # note 変換アセット
└── social/
    ├── posts/                         # 各SNS（LinkedIn, Bluesky）用 YAMLバリアント
    └── ledger/                        # 公開台帳システム（2重投稿防止）
```

---

# 2. Qiita CLIを用いた自動投稿設計

Qiitaへの技術配信は、公式のデベロッパーツールである **`@qiita/qiita-cli`** を導入し、GitHub Actionsと完全に統合しています。

## 2.1. 設定ファイル
`platforms/qiita/qiita.config.json` にて、記事ディレクトリを `public` としてマージします。

```json
{
  "root": "public",
  "includePrivate": false,
  "host": "localhost",
  "port": 8888
}
```

## 2.2. CI/CD による検証と自動デプロイ
マージトリガーを契機に、GitHub Secretsから読み込んだ `QIITA_TOKEN` を用い、差分検出された記事のみを公式API経由で即時パブリッシュします。

---

# 3. 本システムがもたらすセキュア運用の強み

1. **安全な公開制御（Environment承認）**
   GitHubのEnvironment機能を利用し、本番パブリッシュ時に人による明示的な承認ボタン（Required Reviewers）を要求。意図しない誤公開を100%防止します。
2. **2重投稿防止（Append-Only Ledger）**
   配信済みの情報を `platform:id:revision` という一意のハッシュとして記録する「台帳システム（Ledger）」を搭載。CIレベルで二重実行を自動的に拒否します。
3. **機密情報の完全防衛**
   Playwrightによるセッション情報のBase64格納や、APIトークンの暗号化により、リポジトリに一切のシークレットをコミットしない運用を確立。

---

# おわりに

コードを書くように「自分の言葉と意思決定を届ける」こと。
Gitによるバージョン管理と自動化テストの恩恵を文章執筆に持ち込むことで、最小の運用コストで世界中に高いセキュリティレベルで記事を発信できるようになります。ぜひこのアーキテクチャをベースに、皆様も快適な複数メディアパブリッシングを構築してみてください！
