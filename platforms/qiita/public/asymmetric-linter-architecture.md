---
title: 媒体別に非対称なLinterを構築する：Qiitaやnote、SNSを統合管理する3層検証システム
tags:
  - textlint
  - Node.js
private: true
updated_at: '2026-09-17T21:21:44+09:00'
id: 19b2a98a29c87f238cde
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

:::note info
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。使ったツールと用途は、末尾の「生成AIの利用について」に書いています。
:::

# はじめに

個人発信で複数の技術メディアやSNSを活用することは非常に有効です。しかし、プラットフォームごとに読者が求める文脈や、許容される表現、最適な文章構造はまったく異なります。たとえば、体系的な技術設計を解説するZennの本、目の前のエラー解決を急ぐエンジニア向けのQiita、意思決定プロセスや泥臭い開発秘話を綴るnote、そしてそれらへの導線としてのSNS（LinkedInやBluesky）。

これらに対して単一の原稿をコピペで使い回すマルチポストは、「媒体ごとの読み手の文脈不一致」「重複コンテンツによるSEO評価の分散」「技術的な深さの欠如」といった問題を引き起こします。

本稿では、同一テーマから媒体ごとに最適化された「非対称な派生物」を自動検証する手法を解説します。そして、プラットフォームごとの品質を徹底的に担保するためにリポジトリへ構築した「**3層構造の非対称Linterシステム**」の技術設計と実装を紹介します。

- 正本（Zenn）: [Gitで管理し、CIで検証する「マルチプラットフォーム個人出版」の設計と実装](https://zenn.dev/takenori_kusaka/articles/multi-platform-publishing-architecture)
- 関連リポジトリ: [Takenori-Kusaka/publishing-hub](https://github.com/Takenori-Kusaka/publishing-hub)

---

# 技術選定の理由

本検証システムにおいて、各種チェック機構を自作・統合した背景には以下の理由があります。

1. **単一の静的校正ツールの限界:**
   一般的な校正ツール（例: textlintの一律設定）では、媒体ごとのトーン＆マナー（例: Qiitaでは感嘆符をエラーとし、SNSでは警告とするなど）を柔軟に切り分けることが困難でした。そのため、媒体を「配信チャネル（Channel）」としてモデル化し、検証ルールを動的に切り替えるカスタムランナーが必要となりました。
2. **構造（セマンティクス）の機械的判定の必要性:**
   文法の正しさだけでは不十分です。そのため、Qiita向けに「動作するコードや公式ドキュメントへの十分なリンク」、note向けに「生コードやMermaid図の完全な排除」といった媒体特有の構造ポリシーを定義しました。これを保証するために、JSON SchemaやASTを活用したカスタムポリシーチェッカーを採用しています。
3. **SEO重複ペナルティと捏造（ハルシネーション）の回避:**
   媒体間でほぼ同じ文章が流通することを防ぐため、Dice/Jaccard係数に基づく類似度測定を自動化し、独自性を機械的に検証する必要がありました。また、自律的な執筆エージェントが動作した際に、事実を歪めないための整合性チェックをCI上で厳格に行うために、独自パーサーやgitメタデータを用いた強固なゲート機構を構築しました。

---

# システム設計とアーキテクチャ

本検証システムは、文章の美しさをチェックする「校正層」、媒体ごとの要件をチェックする「構造ポリシー層」、引いては表記揺れを防ぐ「用語統一層」の**3層の検証アーキテクチャ**として設計されています。

このアーキテクチャの根幹となるのは、どのファイルがどの配信媒体（チャネル）に属し、どの検証ルールを適用するかを定義した「配信チャネル台帳」である `lint/channels.json` です。

```json
// lint/channels.json
{
  "//": "配信チャネルの台帳。各チャネルに、対象ファイル・textlint プロファイル・構造ポリシーを対応づける。詳細は docs/linting.md",
  "channels": {
    "zenn": {
      "title": "Zenn（正本 / SSOT）",
      "role": "知識の正本。完全な技術設計・図・出典・動作するコードを備えた教科書",
      "kind": "markdown",
      "include": ["books/**/*.md", "articles/**/*.md"],
      "exclude": ["articles/README.md", "articles/srb-appendix-bibliography.md"],
      "textlint": "lint/textlint/zenn.json",
      "policy": "lint/policies/zenn.json"
    },
    "qiita": {
      "title": "Qiita（技術課題解決バリアント）",
      "role": "課題解決を急ぐエンジニア向けの再現レシピ。選定理由・コアコード3箇所・GitHub 導線",
      "kind": "markdown",
      "include": ["platforms/qiita/public/*.md"],
      "exclude": [],
      "skipLegacyQiita": true,
      "textlint": "lint/textlint/qiita.json",
      "policy": "lint/policies/qiita.json"
    },
    "note": {
      "title": "note（思想・ナラティブバリアント）",
      "role": "意思決定の物語。生コードと図の記法を含まないエッセイ",
      "kind": "markdown",
      "include": ["platforms/note/public/*.md"],
      "exclude": ["platforms/note/public/README.md"],
      "textlint": "lint/textlint/note.json",
      "policy": "lint/policies/note.json"
    },
    "social": {
      "title": "SNS（LinkedIn / Bluesky）",
      "role": "正本への導線。超ショートフォーム",
      "kind": "social-yaml",
      "include": ["social/posts/*.yaml", "social/posts/*.yml"],
      "exclude": [],
      "textlint": "lint/textlint/social.json",
      "policy": "lint/policies/social.json"
    },
    "docs": {
      "title": "運用ドキュメント",
      "role": "リポジトリ内の設計・手順書。配信対象ではない",
      "kind": "markdown",
      "include": ["docs/**/*.md", "README.md", "lint/README.md", "social/README.md", "platforms/note/public/README.md"],
      "exclude": [],
      "textlint": "lint/textlint/docs.json",
      "policy": null
    }
  }
}
```

この台帳を参照し、Linterが各階層の役割を以下のように分担して検証します。

## 1. 第1層：媒体別校正（textlint）

文章の表現・スタイルを検証する層です。`textlint` をコア技術に採用しつつ、媒体別にプロファイルを切り替えています。たとえば、Zenn（正本）は商業出版レベルの硬い学術的トーン（`preset-ja-technical-writing`）を要求しますが、Qiitaでは過剰な感情表現を排除した簡潔な断定を求めます。さらに、SNS用のYAMLデータからは本文テキストのみを抽出して、一文あたり100文字以内、読点「、」3つ以内といった過酷な極小の文字数制約の中で校正ランナーを動かします。

以下は、チャネル情報に基づいてファイルを収集し、校正対象を抽出する校正ランナーの実装です。

```javascript
// scripts/lint/run-textlint.mjs
import { createLinter, loadTextlintrc } from 'textlint';
import { ROOT, abs, rel, readJson, readYaml, listFiles, isLegacyQiita, Report, parseArgs, finish, isMain } from './lib.mjs';

/** SNS 原稿(YAML)から校正対象の本文を取り出す。check-terms からも使う */
export function collectSocialTexts(data) {
  const out = [];
  if (data?.linkedin?.text) out.push({ label: 'linkedin.text', text: String(data.linkedin.text) });
  if (data?.linkedin?.article?.description) out.push({ label: 'linkedin.article.description', text: String(data.linkedin.article.description) });
  (data?.bluesky?.posts || []).forEach((p, i) => {
    if (p?.text) out.push({ label: `bluesky.posts[${i}].text`, text: String(p.text) });
    if (p?.external?.description) out.push({ label: `bluesky.posts[${i}].external.description`, text: String(p.external.description) });
  });
  return out;
}

export function loadChannels() {
  return readJson('lint/channels.json').channels;
}

/** チャネルの対象ファイル(リポジトリ相対) */
export function channelFiles(ch, only = []) {
  let files = listFiles(ch.include, { exclude: ch.exclude || [] });
  if (ch.skipLegacyQiita) files = files.filter((f) => !isLegacyQiita(f));
  if (only.length) {
    const wanted = new Set(only.map((p) => rel(abs(p))));
    files = files.filter((f) => wanted.has(f));
  }
  return files;
}
// ...
```

## 2. 第2層：構造ポリシー（AST/JSON Schema）

校正ツールでは捕捉できない「コンテンツとしての妥当性」を検証する層です。
- **Qiita向け（レシピ要件）:** 散文1,500文字以上（Q1）、設計や選定理由の見出し（Q2）、リポジトリ導線（Q3）を機械的に検証します。さらに、[textlint公式サイト](https://textlint.github.io/)や[Node.js公式](https://nodejs.org/)などへの2ホスト以上の参照（Q4）、言語名付きコードブロック3箇所以上（Q5）の配置を強制します。
- **note向け（ナラティブ要件）:** コードブロック、インラインコード、Mermaid図の混入を例外なくエラー（N2/N3）とし、完全に散文主体の物語に変換されていることを保証します。
- **非対称チェック（Variants）:** 派生物と正本の類似度を比較し、テキスト重複率が30%を超えた場合はエラーと判定します。また、見出しの50%以上が共通している場合も「構成のコピペ」として警告を発し、プラットフォームごとの再構築を強制します。

## 3. 第3層：用語統一（Scoped Dictionary）

「サーバ」の表記や、和欧間スペース（「生成AI」）の競合を検証する層です。
本システムでは、すべてのファイルに一方向の辞書を当てるのではなく、`lint/terms/index.yaml` によって、対象となるディレクトリや書籍ごとに辞書の適用スコープを動的に限定します。これにより、歴史の本では許容される古典的な名詞が、現代のソフトウェア設計記事で警告になるといったコンテキストの衝突を賢く防いでいます。

---

# 公開の門とCI連携

本リポジトリに実装された12段階の検証プロセスは、ただ個別に実行されるのではなく、`check-all.mjs` を通して一元管理されています。

```javascript
// scripts/lint/check-all.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { ROOT, abs, parseArgs, isMain } from './lib.mjs';

// ...

export function gitState() {
  const run = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    return { head: run(['rev-parse', '--short', 'HEAD']), index_tree: run(['write-tree']).slice(0, 7), uncommitted: run(['status', '--porcelain']).split('\n').filter(Boolean).length };
  } catch {
    return null;
  }
}

export function stateLine(s) {
  return s ? `検査した状態: HEAD ${s.head}、index の tree ${s.index_tree}、未コミットの変更 ${s.uncommitted} 件` : '検査した状態: git が使えないため記録できません';
}

// 派生物の段階(qiita / note / variants)は --strict で実行し、警告も失敗にします。正本との照合で直せる指摘だからです。
export const STAGES = [
  { id: 'textlint', title: '校正(媒体別 textlint プロファイル)', cmd: ['scripts/lint/run-textlint.mjs'], report: true },
  { id: 'books', title: '本の構成(config.yaml 突合・Zenn の制限)', cmd: ['scripts/check-books.mjs'] },
  { id: 'figures', title: '図の可読性(Mermaid の規範)', cmd: ['scripts/check-figures.mjs'] },
  { id: 'diagrams', title: '図の再現性と Zenn 幅(D2 + TALA)', cmd: ['scripts/lint/check-diagrams.mjs', '--strict'], report: true },
  { id: 'japanese', title: '日本語の文字集合・複数称の排除', cmd: ['scripts/check-japanese.mjs'] },
  { id: 'links', title: '章ラベルのリンク', cmd: ['scripts/check-links.mjs'] },
  { id: 'terms', title: '用語統一(題材別辞書・表記ゆれ検出)', cmd: ['scripts/lint/check-terms.mjs'], report: true },
  { id: 'zenn', title: 'Zenn 正本の構造(genre・記述規範)', cmd: ['scripts/lint/check-zenn.mjs'], report: true },
  { id: 'qiita', title: 'Qiita バリアントの構造(レシピの要件)', cmd: ['scripts/lint/check-qiita.mjs', '--strict'], report: true },
  { id: 'note', title: 'note  バリアントの構造(エッセイの要件)', cmd: ['scripts/lint/check-note.mjs', '--strict'], report: true },
  { id: 'variants', title: '媒体間の非対称(重複率・正本への導線)', cmd: ['scripts/lint/check-variants.mjs', '--strict'], report: true },
  { id: 'social', title: 'SNS 原稿(スキーマ・意味検査・編集規則)', cmd: ['scripts/social/cli.mjs', 'validate'] },
];
// ...
export function checkAll({ only = null, reportDir = '.tmp/lint', quiet = false } = {}) {
  const dir = abs(reportDir);
  fs.mkdirSync(dir, { recursive: true });
  const stages = only ? STAGES.filter((s) => only.includes(s.id)) : STAGES;
  const results = [];
  for (const stage of stages) {
    console.log(`\n=== [${stage.id}] ${stage.title}`);
    const r = runStage(stage, dir);
    if (!quiet || !r.ok) console.log(r.out.trim().split('\n').map((l) => '  ' + l).join('\n'));
    console.log(`--- ${r.ok ? '✅ 合格' : '❌ 失敗'} (errors ${r.counts.errors}, warnings ${r.counts.warnings}, ${(r.ms / 1000).toFixed(1)}s)`);
    results.push(r);
  }
// ...
```

この `STAGES` に定義された各フェーズは、たとえ途中の段階でエラーが発生しても最後まで検証をやり切り、最終結果をひと目で俯瞰できるマージ形式のMarkdownレポート（`report.md`）として出力されます。

GitHub Actions上のCIフロー（`validate.yml`）では、すべてのコミットおよびプルリクエストに対してこの `npm run check` がトリガーされます。さらに、Qiitaやnote、SNSの公開処理を伴うワークフローでは、公開対象となるチャネルのチェックが強制的に `--strict` モードで実行されます。これにより、警告レベルの表記ゆれやフォーマットの乱れが1件でも残っていれば、公開デプロイのパイプライン自体が厳格に遮断されます。

---

# まとめ

技術記事のマルチプラットフォーム配信は、効率的である一方で、読者のコンテキストを無視したスパム的コピペに陥る高いリスクを孕んでいます。

本稿で解説した、配信チャネル台帳（`channels.json`）を核とする3層の「非対称Linter検証アーキテクチャ」は、文章の正しさ・構造の健全性・用語の一貫性を機械的にチェックすることで、このリスクを強力に制御します。同じテーマを共有しながらも、読者にとって最適な形式に変形された文章だけが、自動的に検証され配信されます。

個人開発のコンテンツ発信を効率化しつつ、徹底的に品質を追求したいDevOpsエンジニアにとって、この「非対称品質ゲート」の構築は1つの強力な答えとなるはずです。
