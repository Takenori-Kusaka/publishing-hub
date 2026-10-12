---
title: 'AI に実装させるリポジトリで「作成者が自分の変更を承認できない」をブランチ保護で強制する — pit-in-template の始め方'
tags:
  - GitHub
  - ブランチ保護
  - ClaudeCode
  - 開発プロセス
  - 生成AI
private: false
updated_at: ''
id: null
organization_url_name: null
slide: false
ignorePublish: false
---

:::note info
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。
:::

# 解決したい課題

生成AIのエージェントに実装を任せると、変更は人が読める速度を超えて増えます。規模の大きな差分を1行ずつ確認する作業は、時間の制約のもとで、実質的な承認操作へ縮退します。そのうえ、承認を得たあとに自分で push して内容を変えられる設定のままでは、作成者が確認を経ていない変更を既定ブランチへ入れられます。

この記事では、ピットイン方式(AI が実装を主導する前提の開発プロセス)の準拠テンプレートを使い、次の2点をリポジトリの設定で強制する手順を示します。

- 作成者は自分の変更を承認できない(最後の push の後に承認を要する)
- 自動検証(G-5)を通らない変更は既定ブランチへ入らない

ピットイン方式は、工程に8つのゲート(G-1〜G-8。判定の場)を置きます。この記事で触れるのは G-5(自動検証)、G-6(独立レビュー)、G-7(出荷判定)の3つです。

- 概要(Zenn): [ピットイン方式とは — AI が実装する時代の開発プロセスを、一枚の図で理解する](https://zenn.dev/takenori_kusaka/articles/pit-in-process-overview)
- テンプレート: [Takenori-Kusaka/pit-in-template](https://github.com/Takenori-Kusaka/pit-in-template)
- 標準本文: [Takenori-Kusaka/process-compass](https://github.com/Takenori-Kusaka/process-compass)

# 技術選定理由

## 規約ではなく、ブランチ保護(ルールセット)で止める

「作成者は承認しない」は、規約に書くだけでは守られません。ピットイン方式は、遵守が必須の規則を、AI への指示ファイルではなく実行環境の設定に置きます。指示ファイルの遵守は保証されないためです。GitHub では、ブランチ保護規則とリポジトリルールセットのどちらでもブランチを保護できます([GitHub Docs](https://docs.github.com/ja/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets))。テンプレートは、ルールセットの JSON を同梱しています。以下、この設定を「ブランチ保護(ルールセット)」と呼びます。

要点は `require_last_push_approval` です。これが `true` でないと、承認を得たあとに作成者が push して内容を変えられます。GitHub の[プルリクエストのルールの説明](https://docs.github.com/ja/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets#require-a-pull-request-before-merging)にあるとおり、最後の push を行った人以外の承認が要るようになります。

## 必須チェックを1つに集約する

個々の検査ジョブを必須チェックに並べると、検査を足すたびに保護設定を変える必要があります。テンプレートは集約ジョブ `gate-g5` の1つだけを必須にします。実際に走るテスト・静的解析・ライセンス検査のコマンドは、言語ごとのアダプタ(`adapters/<stack>.json`)から差し込みます。README が挙げるアダプタは node / python / go / none の4種です。スタックが未定のあいだは `undetermined` を選べます。

# 手順

テンプレートのスキル(`/process-init`、`/pit`)は Claude Code 用です。構成(`process.config.json`)は `/process-init` が生成します。README は、このファイルを手で編集しないよう求めています。構成が未設定のあいだ、`gate-g5` は検査を実施しないまま合格を返します。手順2を済ませてから、手順3へ進んでください。

## 1. テンプレートからリポジトリを作る

GitHub の **Use this template** から新しいリポジトリを作り、手元へ clone します。

## 2. プロセス構成を決める

Claude Code でリポジトリを開き、次を実行します。

```text
/process-init
```

人数・事業の段階・品質要求・最悪の場合の帰結・開発形態などの設問と、使う言語のアダプタ(node / python / go / none。未定なら undetermined)を聞かれます。回答から、`process.config.json`(機械が読む構成)と `PROCESS-PROFILE.md`(人が読む構成書)を生成します。あわせて、有効なゲートだけを残したワークフローと、構成に応じたルールセットも `.github/` に生成されます。

## 3. ルールセットを適用する

独立レビュー(G-6)を適用する構成で選ばれるルールセットは、次の `team.json` です。テンプレートの実装から逐語で抜粋しています。規制業、安全重要度(最悪の故障の帰結で決める区分)が CL2 以上、またはレビュア2名を要する構成では、別の `regulated.json` が選ばれます。1〜2名で確認者がいない構成では、承認を強制しない `checks-only.json` が選ばれます。

```jsonc
// https://github.com/Takenori-Kusaka/pit-in-template/blob/main/.github/rulesets/team.json
{
  "name": "team",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] }
  },
  "rules": [
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": true,
        "required_review_thread_resolution": true
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [{ "context": "gate-g5" }]
      }
    },
    { "type": "non_fast_forward" },
    { "type": "deletion" }
  ]
}
```

初期化の出力に、適用するルールセットのコマンドが出ます。適用は人が行います(エージェントは実行しません)。README の例は次の形で、`checks-only.json` を指しています。`team.json` が選ばれた構成では、ファイル名を `team.json` に読み替えます。そのまま写すと、承認を強制しない設定が入ります。

```text
gh api repos/{owner}/{repo}/rulesets --input .github/rulesets/checks-only.json
```

## 4. 自動検証(G-5)のワークフローを確認する

必須チェック `gate-g5` を出すワークフローの冒頭です。構成が未設定のあいだは検査の中身を判定しない、という分岐から始まります。

```yaml
# https://github.com/Takenori-Kusaka/pit-in-template/blob/main/.github/workflows/gate-g5.yml
# ...
name: gate-g5

on:
  pull_request:
    # ...
    types: [opened, synchronize, reopened, edited, labeled, unlabeled]
  # ...
  # 既定ブランチの名前が main でない場合は、ここを改める(このファイルは強制層であり、変更は AI維持管理者の承認を要する)
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pull-requests: write
  # ...
  issues: read

jobs:
  # プロセス構成が未設定のあいだは、検査の中身を判定しない
  config:
    name: config
    runs-on: ubuntu-latest
    outputs:
      configured: ${{ steps.read.outputs.configured }}
    steps:
      - uses: actions/checkout@v4
      - id: read
        run: |
          v=$(node -e "const c=require('./process.config.json');console.log(c.configured===false?'false':'true')")
          echo "configured=$v" >> "$GITHUB_OUTPUT"
          if [ "$v" = "false" ]; then
            echo "::notice::プロセス構成が未設定です。/process-init を実行するまで G-5 の検査は実施しません"
          fi
```

テストや静的解析のコマンドは `adapters/<stack>.json` から差し込まれます。`none` を選んでテストのコマンドを空のままにすると G-5 は失敗します。検査を実施していない状態を、通過した記録にしないためです。

## 5. 次の一手に従う

以降は作業を始めるたびに `/pit` を実行し、出力された次の一手に従います。`/pit` は、構成・判定記録・ブランチの状態から次の一手を出すコマンドです。人の判断を要する段階(ゲートの判定、受入基準(仕様の合格条件)へ戻る判断、出荷の実行など)では、AI は先へ進まず、判定を待つ席(役割)を示して止まります。

# 落とし穴

- **1人 + AI の体制では、独立レビュー(G-6)の判定者を置けません。** 作成を指示した本人以外が確認する、という条件が1人では成立しないためです。テンプレートはこの構成に対して承認を強制しない `checks-only.json` を提示し、G-6 を省略ではなく「未達」として、構成書と `/pit` の出力に表示し続けます。省略は規則により外した状態、未達は目的を達成する構成を示せていない状態です。
- **ルールセットが止めるのは、変更の作成者本人による承認です。** 作成者が AI や bot のとき、作成を指示した人は作成者ではありません。指示した人の承認は、ルールセットでは止まりません。標準は、この承認を独立した確認に数えません。出荷判定(G-7)で差し戻します。証跡の集約は出荷の時点で働くため、マージの時点では止まりません。
- `main` 以外を既定ブランチにしている場合は、`gate-g5.yml` の `push.branches` を改めます。このファイルは強制層であり、変更には AI 維持管理者(AI への指示資産と実際の挙動の一致を検証する席)の承認を要します。

# まとめ

| 強制したいこと | 置き場所 |
| --- | --- |
| 作成者は自分の変更を承認できない | ルールセットの `require_last_push_approval: true` |
| 自動検証を通らない変更を入れない | 必須チェック `gate-g5` |
| 検査を実施していない状態を通過にしない | テストのコマンドが空なら G-5 が失敗する |

ブランチ保護だけが目的でも、手順2(構成の生成)は省けません。手順3まで済ませれば、冒頭の2点は強制されます。プロセスの全体像(ゲートの一覧と3つの原則)は、冒頭の Zenn の記事にまとめています。
