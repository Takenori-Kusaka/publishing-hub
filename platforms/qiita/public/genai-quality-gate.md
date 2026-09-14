---
title: 生成AIの嘘と戦う品質ゲート：帰属先行生成とGit署名による自律エージェントの安全な執筆・配信ガード
tags:
  - Gemini
  - ChatGPT
  - devops
  - LLM
  - Node.js
private: true
updated_at: '2026-09-14T22:13:04+09:00'
id: ab52e61f00e6be390824
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

生成AIのエージェント（ClaudeやGeminiなど）に技術記事やその派生物を改訂・執筆させる試みは、作業の効率化において非常に魅力的です。しかし、多くの開発者を悩ませるのが「ハルシネーション（AIの嘘や捏造）」です。文法的には極めて滑らかで一見正しく見えるものの、正本（SSOT）と突き合わせると「実際には実装されていない機能が実装済みと書かれている」「存在しない仕様や動作条件が創作されている」といった致命的な歪みが頻繁に発生します。

本リポジトリでは、AIエージェントに自律的な執筆を許可しつつ、ハルシネーションを極小化し、万が一の低品質コンテンツの公開を完全に遮断するための「**帰属先行型の品質ゲートシステム**」を構築しました。本稿では、その背後にある技術設計と実装の詳細を解説します。

- 正本（Zenn）: [Gitで管理し、CIで検証する「マルチプラットフォーム個人出版」の設計と実装](https://zenn.dev/takenori_kusaka/articles/multi-platform-publishing-architecture)
- 関連リポジトリ: [Takenori-Kusaka/publishing-hub](https://github.com/Takenori-Kusaka/publishing-hub)

---

# 技術選定の理由

生成AIをコンテンツ発信に実戦投入するにあたり、以下の技術的課題をクリアする必要がありました。

1. **自己校正ループの限界の突破:**
   AI自身に間違いの確認を自問自答させる自己校正ループ（Self-Correction）は、一見うまく機能するように思えます。
   しかし、評価検証を繰り返した結果、静的なLinter規則を最適化させると、AIは検証ルールをかわす言い換えを学習してしまいます。
   事実の歪みそのものは解決しないため、生成器とは切り離されたデータ設計と、別系統の検証ロジックが必要でした。
2. **生成側への物理的な「事実」の制約付与:**
   AIが自由に文章を創作できる余地がある限り、ハルシネーションは確率的に発生します。
   これを防ぐため、正本の事実を文単位に分解・インデックス化しました。
   AIには「使ってよい正本の文（命題）」だけを渡し、そこから逸脱した創作を物理的に禁止する「帰属先行（Source-Attributed Generation）」アプローチを採用しています。
3. **人間による検証記録（H1）の暗号論的・Gitによる保証:**
   自動化されたパイプラインであっても、最後の「公開ボタン」は人間が管理するべきです。AIエージェントが自律的に公開ステータスを書き換えたり、配信ワークフローを起動することを防ぐため、Gitのコミット履歴とPGP署名/人手による `Reviewed-by` トレーラーを検証する厳格な公開ゲートを構築しました。

---

# システム設計とアーキテクチャ

本システムにおける自律的な安全配信は、「**帰属先行生成**」、「**独立判定器**（Judge）」、そして「**Gitコミット署名検証ゲート**（H1）」の3本の柱で構成されています。

## 1. 帰属先行生成（Attribute First, then Generate）

正本（Zenn記事など）からQiitaやnoteといった媒体別のバリアントを自動生成する際、文章をそのまま翻訳・要約させるのではなく、以下のステップを踏みます。
- 正本の文章を文単位に分解し、ID付きのインデックスとして登録します（`index.json`）。
- 生成時には、固定された記事構成（スロット）ごとに、「このスロットに割り当ててよい、事実が保証された文ID（例: 7.1, 7.3）」だけを Gemini 等のLLMにコンテキストとして渡します。
- LLMには強い制約をプロンプトで与えます。具体的には、「与えられた命題（事実）のみを用いて、ターゲット媒体（例: Qiita）の読者に最適な表現で執筆せよ」と指示します。

これにより、LLMは正本に記載のない「架空の仕様」や「不確定な効果」を創作できなくなります。

以下は、帰属先行生成を処理するスクリプトの実装の一部です。

```javascript
// scripts/derive/run-qiita.mjs
import fs from 'node:fs';
import path from 'node:path';
import { readText, splitFrontmatter, abs } from '../lint/lib.mjs';
import { callGeminiValidated } from './lib/gemini-cli.mjs';
import { judgeUnits, aggregate } from './lib/judge.mjs';
```

## 2. 独立判定器（Independent Judge System）

生成されたドラフト原稿は、生成を担ったエージェントから切り離された別系統のLLMによって検証されます。
（例: [Playwright](https://playwright.dev/)や[Git公式ツール](https://git-scm.com/)などを扱わない、MCPやローカル規則が排除されたクリーンなコンテキストのClaude）

判定器は下書きのプロセスを見ず、純粋に「生成された各文章が、正本から論理的に導き出せるか」を文単位で判定します。
このとき、判定の証拠として `evidence_quote` （正本からの逐語引用）を義務付けます。
その引用文が実際に正本に実在する部分文字列であるかどうかも、機械的にアサートします（AIによる証拠の捏造を防ぐため）。

以下は、判定器を隔離環境で呼び出す判定モジュールのコアコードの一部です。

```javascript
// scripts/derive/lib/judge.mjs
import { spawnSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
```

## 3. Gitコミット履歴による「人間承認ゲート（H1）」

どれほど自動検証を徹底しても、微妙なニュアンスのズレや文脈の整合性は人間にしか判断できません。本システムでは、CIの公開パイプラインの直前に、「人間が確認した証拠」がGitのメタデータとして記録されているかを厳格にアサートします。
原稿に変更を加えた最後のコミット（自動生成コミットなど）と同じか、それより新しいコミットを検証します。
そこに、人間のレビュアーによる `Reviewed-by` 署名がCommit Message Trailerとして明記されている必要があります。

以下は、この人間によるレビュー署名をCI上で検証し、公開を遮断するゲートスクリプトの一部です。

```javascript
// scripts/lint/check-human-review.mjs
import { readText, readJson, readYaml, listFiles, isLegacyQiita, splitFrontmatter, exists, Report, parseArgs, finish, isMain } from './lib.mjs';
import { loadDisclosurePolicy } from './disclosure.mjs';
import { git, showAt, hasFullHistory, trailerNames } from './git-baseline.mjs';
```

このGitレベルのチェックにより、「AIが勝手に下書きを書き換えて、人間が誰も知らないうちに本番環境へ公開されてしまう」というシナリオが完全に防御されます。

---

# まとめ

本稿では、帰属先行生成（制約設計）、独立判定器（隔離された検証）、H1検証ゲート（レビュー履歴署名）を解説しました。この多層的な配信ガードは、自律AIエージェントの生産性を享受しつつ、正確性を犠牲にしない強力なDevOps基盤の答えです。

## 生成AIの利用について

この記事の作成には、生成AIの Gemini CLI（Google の gemini-3.7-flash）を使いました。本稿の新規執筆と、引用したスクリプト（check-human-review.mjs や run-qiita.mjs、judge.mjs）の引用を整備しました。また、下書きと改稿、校正に使いました。筆者が内容を確認し、必要に応じて修正しました。公開した内容の責任は筆者が負います。
