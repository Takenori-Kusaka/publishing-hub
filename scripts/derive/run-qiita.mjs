// 帰属先行の生成で Qiita 版を 1 本作る(研究に基づく設計の最小実行)。
//
//   node scripts/derive/run-qiita.mjs
//
// 考え方(Attribute First, then Generate / COPE): 構造の骨組みは固定し、散文の枠ごとに「使ってよい正本の文(ID 付き逐語)」だけを
// Gemini に渡して書かせる。旧稿は渡さない。Gemini は渡された命題しか書けないので、正本にない理由・効果・起動条件を作れない。
// コードは HEAD の逐語の抜粋をそのまま差し込む(コードは忠実性の問題ではない)。導線・開示はテンプレートで決定的に作る。
// 仕上げに、生成した散文を隔離した別系統の判定器(ゆるめの高精度の門)にかけ、矛盾・正本外を 0 件にする。

import fs from 'node:fs';
import path from 'node:path';
import { readText, splitFrontmatter, abs } from '../lint/lib.mjs';
import { callGeminiValidated } from './lib/gemini-cli.mjs';
import { judgeUnits, aggregate } from './lib/judge.mjs';

const decisions = JSON.parse(readText('lint/derive/decisions.json'));
const req = JSON.parse(readText('lint/derive/requirements/multi-platform-publishing-architecture.json'));
const index = JSON.parse(readText('.tmp/derive/index.json'));
const code = JSON.parse(readText('.tmp/derive/qiita-code-blocks.json'));
const headFm = splitFrontmatter(readText('platforms/qiita/public/multi-platform-publishing-architecture.md')).frontmatter;
const CANON_URL = 'https://zenn.dev/takenori_kusaka/articles/multi-platform-publishing-architecture';
const GH = 'https://github.com/Takenori-Kusaka/publishing-hub';
const sourceFull = index.sentences.map((s) => `${s.id}: ${s.text}`).join('\n');
const byId = new Map(index.sentences.map((s) => [s.id, s]));
const quotesFor = (secs) => index.sentences.filter((s) => secs.includes(s.section));

const draftPrompt = readText('lint/derive/prompts/draft.md');
const DRAFT_SCHEMA = { type: 'object', properties: { sentences: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } } }, required: ['sentences'] };

// 散文の枠。使ってよい正本の節 ID と、その枠で伝えたいこと(intent)。
const slots = [
  { id: 'intro', secs: ['1', '4.1'], intent: '導入。複数媒体への手貼りで修正の反映が追いつかないこと、自動化時の誤公開と漏洩の不安、同じ本文の複製ではなく同じテーマの別成果物として切り出す方針。3〜4 文。', min: 2 },
  { id: 'arch', secs: ['4.1'], intent: '正本を Zenn に 1 つ置き、媒体ごとに別稿を切り出す構成。次に示すディレクトリ構成図の前置き。2〜3 文。', min: 2 },
  { id: 'gate', secs: ['7.1', '7.3'], intent: '公開の門。スイッチは媒体ごとに1つで、生成AIを含め誰がブランチで立ててもよい。公開の門は、人が行う main へのプルリクエストのマージ。Qiita は検査を通らないと同期しない。Zenn は連携が直接公開するため検査で止まらない。4〜6 文。', min: 3 },
  { id: 'code_intro', secs: ['7.4', '9'], intent: 'コアコードの前置き。note 投稿は Playwright でエディタに流し込み公開ボタンを押す方式で、画面構造に依存する限界がある。2〜3 文。', min: 2 },
  { id: 'exif', secs: ['9'], intent: 'EXIF 除去のコードの前置き。実装済みだが投稿のアップロード経路には未接続で、対象は JPEG の APP1 だけで PNG には触れない。2〜3 文。', min: 2 },
  { id: 'check', secs: ['6.2', '7.1'], intent: '検証の前置き。1 つのコマンドで 12 段階の検査を順に実行する。CI はプルリクエストと main への push のたびに、この検査とテストを実行する。3〜4 文。', min: 2 },
  { id: 'summary', secs: ['4.1', '7.1'], intent: 'まとめ。正本を1つに置き、派生物は別に書く。公開の門は、人が行う main へのマージ 1 つに置く。2〜3 文。', min: 2 },
];

async function draftSlot(slot) {
  const quotes = quotesFor(slot.secs);
  const input = `<canonical_sentences>\n${quotes.map((s) => `${s.id}: ${s.text}`).join('\n')}\n</canonical_sentences>\n\nこの枠で伝えたいこと: ${slot.intent}\n媒体: Qiita(技術の手順記事)。1 文は 100 字以内。`;
  const r = callGeminiValidated({
    input, instruction: `${draftPrompt}\n\n上の canonical_sentences の命題だけを使い、Qiita の読者に向けて書き直してください。`,
    model: decisions.model_requested, expectModel: decisions.model_actual,
    logPath: abs(`.tmp/derive/qiita/draft-${slot.id}.json`),
    validate: (j) => {
      const e = [];
      if (!j.sentences || j.sentences.length < slot.min) e.push(`sentences が ${slot.min} 文未満`);
      for (const s of j.sentences || []) if (!s.text || [...s.text].length > 120) e.push(`長すぎる文: ${String(s.text).slice(0, 20)}`);
      return e;
    },
  });
  return r.json.sentences.map((s) => s.text.trim());
}

function codeBlock(key) {
  return `\`\`\`${code[key].lang}\n${code[key].code}\n\`\`\``;
}

const run = async () => {
  fs.mkdirSync(abs('.tmp/derive/qiita'), { recursive: true });
  const drafted = {};
  for (const slot of slots) {
    process.stdout.write(`draft ${slot.id}… `);
    drafted[slot.id] = await draftSlot(slot);
    process.stdout.write(`${drafted[slot.id].length} 文\n`);
  }

  const title = headFm.title;
  const fmLines = ['---', `title: ${JSON.stringify(title)}`, 'tags:', ...headFm.tags.map((t) => `  - ${t}`), 'private: false', `updated_at: ${JSON.stringify(headFm.updated_at)}`, `id: ${JSON.stringify(headFm.id)}`, 'organization_url_name: null', 'slide: false', 'ignorePublish: false', 'posting_campaign_uuid: null', 'agreed_posting_campaign_term: false', '---'];
  const body = [
    ':::note info',
    'この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。',
    ':::',
    '',
    '# はじめに',
    '',
    drafted.intro.join(''),
    '',
    `- 正本（Zenn）: [Gitで管理し、CIで検証する「マルチプラットフォーム個人出版」の設計と実装](${CANON_URL})`,
    `- リポジトリ: [Takenori-Kusaka/publishing-hub](${GH})`,
    '',
    '# システム構成',
    '',
    drafted.arch.join(''),
    '',
    codeBlock('tree'),
    '',
    '# 公開の門：プルリクエストのマージ',
    '',
    drafted.gate.join(''),
    '',
    '# コアコードの実装',
    '',
    drafted.code_intro.join(''),
    '',
    codeBlock('publish_note'),
    '',
    drafted.exif.join(''),
    '',
    codeBlock('images'),
    '',
    'Blueskyの文字数は書記素で数えます。次は書記素を数えるバリデーターです。',
    '',
    codeBlock('graphemes'),
    '',
    '- Playwright: [Playwright Documentation](https://playwright.dev/)',
    '- AT Protocol: [The AT Protocol specifications](https://atproto.com/)',
    '',
    '# 検証',
    '',
    drafted.check.join(''),
    '',
    codeBlock('validate'),
    '',
    '# まとめ',
    '',
    drafted.summary.join(''),
    '',
  ];
  const md = `${fmLines.join('\n')}\n\n${body.join('\n')}`;
  const outPath = abs('.tmp/derive/qiita/multi-platform-publishing-architecture.md');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`\n原稿: ${outPath}(${[...md].length} 字)`);

  // 判定: 生成した散文の文だけを、隔離した判定器で 1 回判定する(ゆるめの高精度の門)
  const units = [];
  let n = 0;
  for (const slot of slots) for (const text of drafted[slot.id]) units.push({ n: n++, text, slot: slot.id });
  const batches = [];
  for (let i = 0; i < units.length; i += 5) batches.push(units.slice(i, i + 5));
  const verds = [];
  let cost = 0;
  for (const b of batches) {
    const r = judgeUnits(b, sourceFull, { judgeModel: decisions.judge_model, logPath: abs(`.tmp/derive/qiita/judge-b${b[0].n}.json`) });
    verds.push(...r.verdicts);
    cost += r.cost;
  }
  const agg = aggregate([verds], 'R3');
  const bad = agg.filter((a) => a.samples.some((v) => v.label === 'CONTRADICTED') || a.samples.filter((v) => v.label === 'NOT_IN_SOURCE').length >= 1);
  console.log(`\n=== 判定($${cost.toFixed(2)}、ゆるめの門)`);
  console.log(`生成した散文 ${units.length} 文。矛盾・正本外の疑い: ${bad.length} 件`);
  for (const a of bad) {
    const u = units.find((x) => x.n === a.n);
    console.log(`  [${u.slot}] ${u.text.slice(0, 55)} → ${a.samples.map((v) => v.label + (v.added !== 'none' ? `(${v.added})` : '')).join(',')}`);
  }
  fs.writeFileSync(abs('.tmp/derive/qiita/verdicts.json'), JSON.stringify({ units, verds, bad }, null, 2), 'utf8');
  console.log(`\n次: この原稿を platforms/qiita/public に置いて npm run check と従来の4観点査読にかける。`);
};

run().catch((e) => { console.error('失敗:', e.message); process.exit(1); });
