---
title: 生成AIの嘘と戦う品質ゲート：帰属先行生成・独立判定器・PRのマージで守る派生物の執筆と公開
tags:
  - Gemini
  - Claude
  - devops
  - LLM
  - Node.js
private: true
updated_at: '2026-09-22T23:57:02+09:00'
id: ab52e61f00e6be390824
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

生成AIのエージェントが書いた技術記事の派生物には、検査を通っても、正本と突き合わせると事実の歪んだ文が混ざります。派生物とは、正本から媒体ごとに切り出して別に書いた原稿のことです。歪みの例は、配信経路に接続していない機能を「除去して送信します」と書く文です。

筆者の出版基盤 publishing-hub では、この歪みを減らすために3つの門を重ねています。正本の文だけを材料に書かせる「帰属先行の生成」、生成した文を別系統の生成AIが正本と照らす「独立判定器」、そして人が行う「PRのマージ」です。前の2つは、下に挙げる正本（Zenn）1本の派生物を作るときだけ動きます。本稿では、3つの門の設計と実装を解説します。

- 正本（Zenn）: [Gitで管理し、CIで検証する「マルチプラットフォーム個人出版」の設計と実装](https://zenn.dev/takenori_kusaka/articles/multi-platform-publishing-architecture)
- 関連リポジトリ: [Takenori-Kusaka/publishing-hub](https://github.com/Takenori-Kusaka/publishing-hub)

---

# 技術選定の理由

1. **生成と照合を分ける:**
   生成AIに派生物を改訂させる評価を繰り返したところ、検査のエラーは0になっても、正本と矛盾する事実が毎回残りました。
   原因の1つは、1回の指示に生成と自己照合と検査への対応を同時に負わせたことです。
   もう1つは、禁止表現の正規表現という代理の指標の結果を生成器に返し続けたことです。代理の指標を最適化させると、生成器はそれをかわす言い換えを学びます。
   そこで、1回の呼び出しには1つの仕事だけを任せ、照合は生成器とは別系統の判定器に任せています。
2. **正本の文だけを材料にする（Attribute First, then Generate）:**
   正本の文にIDを振り、書かせる枠ごとに、使ってよい正本の文だけを渡します。旧稿は渡しません。
   事実を正本のIDに紐づけてから書かせることで、正本にない理由や効果の捏造を入口で防ぎます。
3. **公開の門をPRのマージに一本化する:**
   公開のスイッチ（Qiitaの `private: false` など）は、生成AIを含め誰がブランチで立ててもよいことにしています。
   公開のワークフローは `main` へのpush（マージ）か手動の起動で動き、生成AIは `main` へ直接pushしない決まりにしているからです。手動の起動は生成AIが行ってよく、人だけが通せる門は `main` へのPRのマージです。この決まりのもとでは、生成AIが立てたスイッチの後ろに、このマージが残ります。
   本格的な査読は、公開された記事で行います。表示は媒体ごとに違い、PRでは確かめられないためです。
   人の `Reviewed-by` トレーラーを公開の直前に確かめる検査（H1）も持っていますが、今は求めていません。公開の前に人のマージがある以上、同じ承認をもう一度求めることになるためです。

---

# システム設計とアーキテクチャ

品質の門は、「帰属先行の生成」「独立判定器」「PRのマージ」の3つです。
前の2つは、生成の仕組み（`npm run derive:qiita` と `npm run derive:note`）の段です。この仕組みは、正本1本（`articles/multi-platform-publishing-architecture.md`）のQiita版とnote版を作るときだけ動きます。
ほかの派生物は、生成AIのエージェントが書く場合も含めて、この仕組みを使わずに書きます。その場合は、指示書の手順（正本との1文ずつの照合など）と検査を経て、PRのマージを通ります。

## 1. 帰属先行の生成（Attribute First, then Generate）

生成は次の手順で進めます。

- 正本の本文を文に分け、節番号と出現順から決まるID（`S-<節>-<連番>`）を振って索引にします（`scripts/derive/index.mjs`）。同じ正本からは、何度作っても同じ索引になります。
- 見出し、コードの抜粋、導線、告知はスクリプトで固定します。コードは実装から逐語で差し込み、生成させません。
- 散文の枠ごとに、使ってよい節の正本の文だけを、ID付きの逐語でGemini（Gemini CLI経由）に渡します。旧稿は渡しません。
- 指示（`lint/derive/prompts/draft.md`）では、渡した根拠にある命題だけを書き、理由・効果・起動条件・外部製品の性質・数値を足さないことを求めます。

次は、枠ごとに正本の文を渡して書かせる部分です。

```javascript
// scripts/derive/run-qiita.mjs
const quotesFor = (secs) => index.sentences.filter((s) => secs.includes(s.section));
// ...
async function draftSlot(slot) {
  const quotes = quotesFor(slot.secs);
  const input = `<canonical_sentences>\n${quotes.map((s) => `${s.id}: ${s.text}`).join('\n')}\n</canonical_sentences>\n\nこの枠で伝えたいこと: ${slot.intent}\n媒体: Qiita(技術の手順記事)。1 文は 100 字以内。`;
  const r = callGeminiValidated({
    input, instruction: `${draftPrompt}\n\n上の canonical_sentences の命題だけを使い、Qiita の読者に向けて書き直してください。`,
    // ...
  });
  return r.json.sentences.map((s) => s.text.trim());
}
```

## 2. 独立判定器（Independent Judge）

生成した散文は、生成器（Gemini）とは別系統の判定器（Claude）が文ごとに判定します。
判定器に渡すのは、ID付きの正本の全文と、判定する文です。下書きの過程、規則、生成側が選んだ根拠は渡しません。
判定器は、SUPPORTED（正本に直接支えられている）、NOT_IN_SOURCE（正本にない）、CONTRADICTED（正本と矛盾する）などのラベルを付けます。

判定器には、Claude Codeの非対話モード（`claude -p`）を使い、空の一時ディレクトリで呼びます。
個人の設定とMCPを読み込ませず、ファイルの読み書きやシェルなどの道具も禁じます。各オプションの意味は[Claude CodeのCLIリファレンス](https://code.claude.com/docs/en/cli-reference)にあります。

```javascript
// scripts/derive/lib/judge.mjs
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'derive-judge-'));
  // ...
  // --setting-sources から user を外すと ~/.claude/CLAUDE.md の個人の規則が文脈に入らない(空の cwd で project/local も空)。
  const args = ['-p', '--model', judgeModel, '--setting-sources', 'project,local', '--strict-mcp-config', '--no-session-persistence', '--disallowed-tools', 'Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep', 'WebFetch', 'WebSearch', '--system-prompt', SYSTEM, '--json-schema', JSON.stringify(VERDICT_SCHEMA), '--output-format', 'json'];
  const r = spawnSync(resolveClaude(), args, { cwd, input: prompt, encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 26 });
  // ...
  if (r.status !== 0) throw new Error(`judge が終了コード ${r.status}: ${String(r.stderr).slice(0, 300)}`);
```

判定の根拠として、判定器には正本の一文を逐語で引かせます（`evidence_quote`）。
SUPPORTED、SUPPORTED_LOSSY、CONTRADICTEDの判定なのに引用が正本の部分文字列でなければ、その判定をUNKNOWNに落とします。判定器による引用の捏造を弾くためです。

```javascript
// scripts/derive/lib/judge.mjs
/** 引用(NFKC・空白除去)が出典の部分文字列か */
function quoteInSource(quote, sourceNorm) {
  const q = String(quote || '').normalize('NFKC').replace(/\s+/g, '');
  if (q.length < 6) return false;
  return sourceNorm.includes(q);
}
// ...
  const verdicts = (so.verdicts || []).map((v) => {
    if ((v.label === 'SUPPORTED' || v.label === 'SUPPORTED_LOSSY' || v.label === 'CONTRADICTED') && !quoteInSource(v.evidence_quote, sourceNorm)) {
      return { ...v, label: 'UNKNOWN', why: `${v.why}(引用が出典の部分文字列でないため無効化)` };
    }
    return v;
  });
```

判定器にも限界があります。過去の誤りの文と正本に忠実な文で較正したところ、忠実な言い換えと微妙な捏造を分ける信号は十分に出ませんでした。
そのため判定器は、矛盾と正本外の疑いを0件にする門として使います。残る微妙な歪みを補うのは、人が行うPRのマージと、公開された記事での査読です。
生成した原稿は `.tmp/derive/` に出るだけで、公開の原稿の置き場所には書き込みません。置いたあとは、ほかの原稿と同じく検査とPRのマージを通ります。

## 3. 公開の門：PRのマージ

機械では見分けにくい微妙な事実の歪みは、検査を重ねても残ります。最後の門は、人が行うPRのマージです。

公開のスイッチは媒体ごとに1つです。Zennは `published: true`、Qiitaは `private: false`、noteとSNSは `status: ready` です。
生成AIもブランチでスイッチを立ててよく、PRをマージすることが公開の承認です。公開前の確認の記録も、このマージだけです。
ZennはGitHub連携が `main` を公開し、Qiitaとnoteはワークフローが `main` へのpushか、手動の起動で動きます。
SNSの投稿だけは、マージのあとに `social-publish.yml` を手動で起動し、確認の語（`PUBLISH`）を入力して行います。起動は生成AIが行ってもかまいません。

次は、Qiitaへ同期するワークフローです。`main` へのpushで動き、同期（`publish`）の前にQiitaの原稿の検査（`check`）を通します。

```yaml
# .github/workflows/publish-qiita.yml
on:
  push:
    branches:
      - main
    paths:
      - "platforms/qiita/**"
# ...
  publish:
    name: Sync Articles with Qiita
    needs: check
```

`check` には、人の `Reviewed-by` トレーラー（[git-interpret-trailers](https://git-scm.com/docs/git-interpret-trailers)）を確かめる検査（H1）の段もあります。
H1の仕組みは残したまま、方針のファイル `lint/derive/review-policy.json` の `mode` で切り替えます。
今は `auto` で、`Reviewed-by` を求めません。`human` へ戻すと、公開原稿の本文を変えた最新のコミットと、それより新しいコミットのどれにも人の `Reviewed-by` がなければ、同期しません。
方針のファイルが無いか読めないときは、`human` として扱います。

```javascript
// scripts/lint/check-human-review.mjs
export function reviewMode(channel = null) {
  try {
    if (!exists(REVIEW_POLICY)) return 'human';
    const p = readJson(REVIEW_POLICY);
    const mode = (channel && p.channels?.[channel]) || p.mode;
    return mode === 'auto' ? 'auto' : 'human';
  } catch {
    return 'human';
  }
}
// ...
    if (s.needed && !s.reviewed) {
      if (mode === 'auto') {
        report.note(`${f}: 人の Reviewed-by はありませんが、方針が auto のため求めません。公開前の確認の記録は PR のマージです(lint/derive/review-policy.json)`);
      } else {
        report.error(f, 'H1', `この公開原稿の本文を最後に変更したコミット ${s.commit.slice(0, 7)}${s.ai ? '(生成AIが共著)' : ''} 以降に、人の確認(Reviewed-by)の記録がありません。人が内容を確認してから、原稿を変更するコミットか空のコミットに "Reviewed-by: 名前 <メール>" と "Reviewed-path: ${f}" を付けてください`);
      }
    }
```

この形では、公開の直前で人が微妙な歪みを止める機会は、PRのマージだけです。誤りは、公開後に直す前提です。
マージした人が本文を読んだかどうかは、記録に残りません。

---

# まとめ

正本の文だけを材料に書かせる帰属先行の生成、生成した文を正本と照らす独立判定器、人が行うPRのマージの3つを重ねて、生成AIが書く派生物の事実の歪みを減らしています。
前の2つは正本1本の派生物だけで動き、微妙な歪みは機械だけでは保証できません。そのため公開の可否は、人がPRのマージで決めます。
本格的な査読は、公開された記事で行います。
