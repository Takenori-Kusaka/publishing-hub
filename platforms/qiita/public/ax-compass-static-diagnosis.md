---
title: 'Svelte 5 と Vite で作る、サーバ無し・外部送信無しの経営層向け自己診断アプリ：採点規則、localStorage と URL ハッシュの保存、GitHub Pages 配信'
tags:
  - Svelte
  - Vite
  - GitHubPages
  - localStorage
  - JavaScript
private: false
updated_at: ''
id: null
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

経営層が自社の現在地を選択式で答え、次の一手と会議資料の下書きを持ち帰る。そういう道具をサーバ無しで配りたい場面があります。設問は生成AIの利用契約の有無や顧客との取引の実態を聞くので、入力を外部へ送らない構成を選びました。

AXコンパスは、Zenn の本『AIトランスフォーメーションの設計図』の枠組みを GUI にした静的 Web アプリです。Vite、Svelte 5、TypeScript で作り、GitHub Pages で配信しています。入力はブラウザの中だけで処理し、localStorage に保存します。外部スクリプト、CDN、外部フォント、アクセス解析は使っていません。

扱う課題は 3 つです。

- 診断の採点。段階の平均を四捨五入し、「該当しない」を除外し、最も低い答えを次に上げる場所として示す
- 状態の保存と共有。localStorage と URL ハッシュを使い分け、復元した直後にハッシュを消し、不正な JSON を拒む
- GitHub Pages への配信。検証に通った成果物だけを配る

採点の規則と会議資料の型は本が正本で、アプリは同じ規則と文言で動きます。

- 正本（Zenn の本）: [3つの現在地と自己診断の質問の章](https://zenn.dev/takenori_kusaka/books/ai-transformation-blueprint/viewer/32-three-positions) / [AX プロジェクトの立ち上げの章](https://zenn.dev/takenori_kusaka/books/ai-transformation-blueprint/viewer/37-launching-ax-project) / [会議資料と 90 日計画の章](https://zenn.dev/takenori_kusaka/books/ai-transformation-blueprint/viewer/38-meeting-pack)
- 公開しているアプリ: [AXコンパス](https://takenori-kusaka.github.io/ax-compass/)
- 実装: [Takenori-Kusaka/ax-compass](https://github.com/Takenori-Kusaka/ax-compass)
- Svelte: [公式ドキュメント](https://svelte.dev/docs/svelte/overview) / Vite: [静的サイトのデプロイ](https://vite.dev/guide/static-deploy) / GitHub Pages: [公式ドキュメント](https://docs.github.com/ja/pages)

# 設計方針

## 送る先を作らない

入力を外部へ送らないという約束は、送る先が無い構成にすると守りやすくなります。アプリは HTML、JavaScript、CSS だけで動き、状態は端末のブラウザに残ります。GitHub Pages のプロジェクトサイトは `https://<user>.github.io/<repo>/` の下に置かれるため、Vite の `base` をリポジトリ名に固定します。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ax-compass/blob/5c165964fd2323184369048fd85c0426ad9aff01/vite.config.ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// GitHub Pages のプロジェクトサイト(https://<user>.github.io/ax-compass/)で動かすため base を固定する
export default defineConfig({
  base: '/ax-compass/',
  plugins: [svelte()],
  build: { target: 'es2022' },
});
```

## ロジックを純関数の 1 ファイルに置く

採点、次の一手（現在地と道筋から次に上げる段階を並べたもの）の生成、Markdown の出力、URL の符号化は `src/lib/engine.mjs` に集め、DOM や localStorage に触れません。TypeScript ではなく JSDoc つきの JavaScript にしてあるのは、Svelte のコンポーネントと `node --test` の双方で同じ関数をそのまま読み込むためです。画面側は `$state` で 1 つのオブジェクトを持ち、保存と復元は `App.svelte` が担います。Svelte 5 の仕様は公式ドキュメントの [$state](https://svelte.dev/docs/svelte/$state) と [$effect](https://svelte.dev/docs/svelte/$effect) にあります。

# 採点：平均の四捨五入、該当しないの除外、最も低い答え

診断の軸は 3 つです。事業フェーズは、売上の動きなど 5 問で決める事業の局面（探索、成長、成熟、再生）です。導入フェーズは生成AIの導入の深さで、S1（触れる）から S6（顧客へ届ける）までの 6 段階です。文化フェーズは組織の受け入れ方で、C1（禁止・無関心）から C5（AI・データネイティブ）までの 5 段階です。定義は[本の章](https://zenn.dev/takenori_kusaka/books/ai-transformation-blueprint/viewer/32-three-positions)にあります。

採点の規則のうち、平均の四捨五入と「該当しない」の除外は段階式の診断なら他のアプリにも持ち帰れます。顧客向けの 2 問だけに「該当しない」を置くことと、事業フェーズの多数決は、この本の枠組みに固有の規則です。

導入フェーズと文化フェーズは、答えた段階の数字を平均し、四捨五入した段階を現在地にします。最大値を取らないのは、1 問だけ高い答えで段階が跳ねないようにするためです。顧客向けの製品やサービスを持たない会社のために、顧客向けの 2 問には「該当しない」の選択肢があります。この答えは平均から除外し、回答済みの数には含めます。除外した結果が 0 件なら S1 です。事業フェーズは 5 問の多数決で、同数なら事業フェーズの第 1 問（売上の動き）の答えを優先します。

```javascript
// 出典: https://github.com/Takenori-Kusaka/ax-compass/blob/5c165964fd2323184369048fd85c0426ad9aff01/src/lib/engine.mjs
/** 「該当しない」の選択肢の値。顧客向けの製品・サービスを持たない会社が、顧客向けの設問に答えるためのもの。段階の平均と最も低い答えの計算から除外する */
export const NOT_APPLICABLE = 0;
// ...
/**
 * 数値段階の軸(導入 S1〜S6、文化 C1〜C5)。回答の平均を四捨五入して段階にする。
 * 段階は累積的ではなく「目安」なので、最大値ではなく平均を使う(1 問だけ高い回答で段階が跳ねないようにする)。
 * 「該当しない」(NOT_APPLICABLE)は回答済みとして数えるが、平均からは除外する。除外後に回答が 0 件なら S1 とする。
 * @param {Axis} axis
 * @param {Record<string, number>} answers
 */
export function scoreLevelAxis(axis, answers) {
  const values = axis.questions.map((q) => answers[q.id]).filter((v) => typeof v === 'number' && Number.isFinite(v));
  const total = axis.questions.length;
  if (values.length === 0) return { level: null, mean: null, answered: 0, total };
  const counted = values.filter((v) => v !== NOT_APPLICABLE);
  if (counted.length === 0) return { level: 1, mean: null, answered: values.length, total };
  const mean = counted.reduce((a, b) => a + b, 0) / counted.length;
  const max = Math.max(...axis.questions.flatMap((q) => q.options.map((o) => Number(o.value))));
  const level = Math.min(max, Math.max(1, Math.round(mean)));
  return { level, mean, answered: values.length, total };
}
```

現在地は平均で決めますが、次に上げる場所は最も低い答えにあります。段階が上がるほど出力を評価する仕組みと統治（ガイドライン、データ、ID、承認）が先に要るので、低い答えが 1 つあればそこが次の制約です。同点の設問が複数あるときは表の上にある設問を 1 つ示し、残りは数だけ添えます。未回答と「該当しない」は対象にしません。

```javascript
// 出典: https://github.com/Takenori-Kusaka/ax-compass/blob/5c165964fd2323184369048fd85c0426ad9aff01/src/lib/engine.mjs
/**
 * 数値段階の軸で、最も低い答えの設問を返す。現在地は平均で決めるが、次に上げるべき場所(ボトルネック)は最も低い答えにある。
 * 同点の設問はすべて返す(設問の順)。未回答の設問と「該当しない」の設問は対象にしない。
 * @param {Axis} axis
 * @param {Record<string, number>} answers
 * @returns {{ level: number | null, items: { question: Question, value: number, label: string }[] }}
 */
export function weakestAnswers(axis, answers) {
  const answered = axis.questions
    .map((q) => ({ q, v: answers[q.id] }))
    .filter((x) => typeof x.v === 'number' && Number.isFinite(x.v) && x.v !== NOT_APPLICABLE);
  if (answered.length === 0) return { level: null, items: [] };
  const min = Math.min(...answered.map((x) => /** @type {number} */ (x.v)));
  const items = answered
    .filter((x) => x.v === min)
    .map((x) => ({ question: x.q, value: min, label: x.q.options.find((o) => o.value === min)?.label ?? '' }));
  return { level: min, items };
}

/**
 * 「次に上げるべき場所」の 1 行。本 第32章の採点の規則どおり、最も低い答えの設問を 1 つ示し、
 * 同点の設問が複数あるときは表の上にある設問(第1問なら契約の有無)を優先する。残りの同点は数だけ添える。
 * @param {Axis} axis
 * @param {Record<string, number>} answers
 * @param {{ prefix?: string }} [opts] prefix は設問番号の前に置く軸の短い名前(「導入」「文化」)
 * @returns {{ level: number | null, primary: { no: number, text: string } | null, ties: number, text: string }}
 */
export function weakestSummary(axis, answers, opts = {}) {
  const prefix = opts.prefix ?? axis.label.replace(/フェーズ$/, '');
  const w = weakestAnswers(axis, answers);
  if (w.level === null || w.items.length === 0) return { level: null, primary: null, ties: 0, text: '' };
  const first = w.items[0];
  const primary = { no: axis.questions.indexOf(first.question) + 1, text: first.question.text };
  const ties = w.items.length - 1;
  const tag = axis.id === 'adoption' ? `S${w.level}` : axis.id === 'culture' ? `C${w.level}` : String(w.level);
  const tieNote = ties > 0 ? `。同点の設問がほか ${ties} 問あり、表の上にある ${prefix} ${primary.no} を優先` : '';
  const text = `${axis.label}: ${prefix} ${primary.no}「${primary.text}」(${tag})${tieNote}`;
  return { level: w.level, primary, ties, text };
}
```

コードのコメントにある「第1問なら契約の有無」は導入フェーズの第 1 問です。事業フェーズの第 1 問（売上の動き）とは別の表で、同点の扱いが軸ごとに違うわけではありません。

境界は `test/engine.test.mjs` で固定しています。平均 2.5 は 3 に、平均 2.33（5 問は 2、1 問は 4）は 2 になること、「該当しない」だけの軸は S1 になること、同点のときに第 1 問が選ばれることを `node --test` で確かめます。Node.js のテストランナーの使い方は[公式ドキュメント](https://nodejs.org/api/test.html)にあります。

# 保存と共有：localStorage と URL ハッシュ

起動時は共有 URL を優先し、無ければ前回の続きを localStorage から読みます。URL のハッシュ（`#s=`）から復元したら、その場でアドレスバーからハッシュを消します。残しておくと再読込のたびに古い回答で上書きされ、復元後の編集が消えるためです。以後は localStorage を正とし、状態が変わるたびに `$effect` で書き込みます。プライベートモードなどで書けない環境では保存を諦め、例外を握りつぶします。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ax-compass/blob/5c165964fd2323184369048fd85c0426ad9aff01/src/App.svelte
  const STORAGE_KEY = 'ax-compass:state:v1';
  // ...
  onMount(() => {
    // 共有 URL が優先。なければ前回の続き。
    // ハッシュから復元したら、アドレスバーのハッシュを消す。残すと再読込のたびに古い回答で上書きされ、以後の編集が消えるため。
    // 復元後は localStorage を正とする
    const m = location.hash.match(/^#s=([A-Za-z0-9_-]+)$/);
    const fromUrl = m ? decodeState(m[1], questions) : null;
    if (fromUrl) {
      replaceState(fromUrl);
      history.replaceState(null, '', location.pathname + location.search);
    } else {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? parseState(JSON.parse(raw), questions) : null;
        if (parsed) replaceState(parsed);
      } catch {
        // 保存領域が使えない環境では復元を諦める
      }
    }
    ready = true;
  });

  $effect(() => {
    if (!ready) return;
    const json = JSON.stringify(app);
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {
      // プライベートモードなどで書けないときは保存しない
    }
  });
```

`history.replaceState` は履歴を増やさずに現在の URL を書き換えるので、戻るボタンで古いハッシュに戻ることもありません（[MDN](https://developer.mozilla.org/ja/docs/Web/API/History/replaceState)）。その直前で呼んでいる同名の `replaceState` は自作の関数で、`$state` のオブジェクトの参照を保ったまま中身を差し替えます。参照を変えないので、各コンポーネントが持つ `app` への束縛はそのまま使えます。

```typescript
// 出典: https://github.com/Takenori-Kusaka/ax-compass/blob/5c165964fd2323184369048fd85c0426ad9aff01/src/lib/store.svelte.ts
// アプリの状態は 1 つのオブジェクト。全コンポーネントがここを読み書きする。
// localStorage への保存と URL ハッシュからの復元は App.svelte が担う(ここは DOM に触れない)。
import { createNotes, createState, type AppState } from './engine.mjs';

export const app: AppState = $state(createState());

/** 読み込んだ状態で置き換える(参照を保ったまま中身を差し替える) */
export function replaceState(next: AppState): void {
  app.version = next.version;
  app.step = next.step;
  app.answers = next.answers;
  app.path = next.path;
  app.concerns = next.concerns;
  app.openQuestions = next.openQuestions ?? '';
  app.notes = { ...createNotes(), ...(next.notes ?? {}) };
}

export function resetState(): void {
  replaceState(createState());
}
```

外から来る JSON と URL は信用しません。読み込みの入口は `parseState` の 1 つで、`version` が 1 で認識できる回答が 1 つ以上あるときだけ状態を返します。それ以外は `null` を返し、呼び出し側は直前の状態を保ちます。選択肢に無い値は捨て、自由記述は上限で切ります。共有 URL は設問の順に選択肢の添字を並べた JSON を base64url にしたもので、復号に失敗しても `null` です。会議資料の自由記述（担当役員、投資と効果と撤退基準、決裁事項など）は個人情報を含みうるため URL には入れず、localStorage、JSON、Markdown にだけ含めます。

```javascript
// 出典: https://github.com/Takenori-Kusaka/ax-compass/blob/5c165964fd2323184369048fd85c0426ad9aff01/src/lib/engine.mjs
/**
 * 回答の検証。外部から読み込む JSON と URL は信用せず、形と値域を確かめてから使う。
 * version が 1 で、認識できる回答が 1 つ以上あるときだけ状態を返す。それ以外は null(読み込みの失敗として扱い、直前の状態を壊さない)。
 * @param {unknown} raw
 * @param {QuestionSet} questions
 * @returns {AppState | null}
 */
export function parseState(raw, questions) {
  if (!raw || typeof raw !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  if (o.version !== STATE_VERSION) return null;
  const state = createState();
  let recognized = 0;
  const answers = /** @type {Record<string, unknown>} */ (o.answers && typeof o.answers === 'object' ? o.answers : {});
  for (const axis of questions.axes) {
    const src = /** @type {Record<string, unknown>} */ (answers[axis.id] && typeof answers[axis.id] === 'object' ? answers[axis.id] : {});
    for (const q of axis.questions) {
      const v = src[q.id];
      if (q.options.some((opt) => opt.value === v)) {
      // ...
      }
    }
  }
  if (typeof o.path === 'string' && PATH_IDS.includes(/** @type {PathId} */ (o.path))) state.path = /** @type {PathId} */ (o.path);
  if (Array.isArray(o.concerns)) state.concerns = o.concerns.filter((c) => typeof c === 'string').slice(0, 50);
  if (typeof o.step === 'number' && Number.isInteger(o.step) && o.step >= 0 && o.step <= 4) state.step = o.step;
  if (typeof o.openQuestions === 'string') state.openQuestions = o.openQuestions.slice(0, OPEN_QUESTIONS_MAX);
  const notes = /** @type {Record<string, unknown>} */ (o.notes && typeof o.notes === 'object' ? o.notes : {});
  for (const k of NOTE_KEYS) {
    const v = notes[k];
    if (typeof v === 'string') state.notes[k] = v.slice(0, OPEN_QUESTIONS_MAX);
  }
  if (recognized === 0) return null;
  return state;
}

/**
 * URL のハッシュ用の短い形。設問の順に選択肢の添字を並べる(未回答は -1)。
 * 自由記述(答えていない問い、担当役員、投資と効果と撤退基準、決裁事項など)は個人情報を含みうるため URL に入れない。
 * @param {AppState} state
 * @param {QuestionSet} questions
 */
export function encodeState(state, questions) {
  /** @type {Record<string, number[]>} */
  const a = {};
  for (const axis of questions.axes) {
    const all = /** @type {Record<string, Record<string, string | number>>} */ (state.answers);
    const src = all[axis.id] ?? {};
    a[axis.id] = axis.questions.map((q) => q.options.findIndex((opt) => opt.value === src[q.id]));
  }
  const compact = { v: STATE_VERSION, a, p: state.path, k: state.concerns };
  return toBase64Url(JSON.stringify(compact));
}

export function decodeState(encoded, questions) {
  let compact;
  try {
    compact = JSON.parse(fromBase64Url(encoded));
  } catch {
    return null;
  }
  if (!compact || typeof compact !== 'object' || compact.v !== STATE_VERSION) return null;
  // ...
  return parseState(raw, questions);
}
```

# 配信：検証に通った成果物だけを GitHub Pages に置く

配信は `main` への push と手動起動で動くワークフロー 1 本です。`build` ジョブで `npm ci` のあと `npm run check` を走らせます。これは `svelte-check`、`node --test`、`vite build`、ブランド基盤の複製の検査（複製した CSS とトークンのハッシュが台帳と一致するか）をまとめた 1 つのコマンドです。1 つでも落ちれば成果物は上がりません。通ったら `dist` を Pages の成果物として上げ、`deploy` ジョブが `github-pages` 環境へ配信します。公式の Pages アクションには `pages: write` と `id-token: write` の権限が要ります（[GitHub Docs](https://docs.github.com/ja/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)）。同じグループの実行は 1 つに絞り、古い実行を取り消します。

```yaml
# 出典: https://github.com/Takenori-Kusaka/ax-compass/blob/5c165964fd2323184369048fd85c0426ad9aff01/.github/workflows/deploy.yml
# main への push と手動起動で、検証(svelte-check・test・build・brand:check)のあと GitHub Pages へ配信する
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run check
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

# まとめ

- 入力を外部へ送らない約束は、送る先の無い静的サイトにすると構成で守れます。Vite の `base` をリポジトリ名に固定すれば GitHub Pages のプロジェクトサイトで動きます
- 採点は平均の四捨五入で、「該当しない」は平均から除外して回答済みには数えます。次に上げる場所は最も低い答えで、同点は表の上を優先します
- 復元は共有 URL が優先で、復元したらハッシュを消して localStorage を正にします。外から来る JSON と URL は形と値域を確かめ、通らなければ直前の状態を保ちます
- 自由記述は URL に入れず、端末の保存と書き出しにだけ含めます
- 配信は検証をまとめた 1 つのコマンドに通した成果物だけを Pages に上げます

段階の名前、設問、採点の規則は本の表が正本で、アプリの定義文は本と逐語で揃え、その一致をテストで確かめています。全体のコードは [GitHub](https://github.com/Takenori-Kusaka/ax-compass) にあります。
