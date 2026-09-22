// 帰属先行の生成で note 版(意思決定のエッセイ)を 1 本作る。run-qiita.mjs の note 版。
// note はコード・表・脚注・実装の語を置かない。枠ごとに使ってよい正本の文だけを渡し、承認済みの平易な言い換え(lay_wording)を添える。

import fs from 'node:fs';
import { readText, splitFrontmatter, abs } from '../lint/lib.mjs';
import { callGeminiValidated } from './lib/gemini-cli.mjs';
import { judgeUnits, aggregate } from './lib/judge.mjs';

const decisions = JSON.parse(readText('lint/derive/decisions.json'));
const req = JSON.parse(readText('lint/derive/requirements/multi-platform-publishing-architecture.json')).channels.note;
const index = JSON.parse(readText('.tmp/derive/index.json'));
const headFm = splitFrontmatter(readText('platforms/note/public/multi-platform-publishing-architecture.md')).frontmatter;
const CANON_URL = 'https://zenn.dev/takenori_kusaka/articles/multi-platform-publishing-architecture';
const sourceFull = index.sentences.map((s) => `${s.id}: ${s.text}`).join('\n');
const quotesFor = (secs) => index.sentences.filter((s) => secs.includes(s.section));
const draftPrompt = readText('lint/derive/prompts/draft.md');
const layText = req.lay_wording.map((w) => `${w.jargon}→${w.lay}`).join('、');

const slots = [
  { id: 'open', heading: '記事を書き終えたあとに、もう1つの仕事がある', secs: ['1'], intent: '一人称の導入。記事を書いたあと、同じ原稿を媒体ごとに手で貼り直していて、修正の反映が追いつかなくなった。媒体ごとに読者の目的も違う。3〜5 文。', min: 3 },
  { id: 'fear', heading: '自動化に感じた、ためらい', secs: ['1'], intent: '投稿を自動化した瞬間に、誤って本番に流す不安と、認証情報を漏らす不安が生じた。一人称。2〜4 文。', min: 2 },
  { id: 'decide', heading: '複製をやめて、切り出すと決めた', secs: ['4.1'], intent: '迷った末に、同じ本文を複製するのではなく、同じテーマから媒体別に別の成果物を切り出すと決めた。正本は Zenn の 1 つに置く。3〜5 文。', min: 3 },
  { id: 'switch', heading: '公開の前に、必ず私の操作を1つ置く', secs: ['7.1', '7.4'], intent: '公開のスイッチは媒体ごとに1つで、生成AIを含め誰が立ててもよい。変更は本流とは別の枝に置き、公開の処理が動くのは、自分が本流へ取り込んだ(マージした)ときか、自分が本流から手で起動したとき。枝からの起動は公開の処理の最初の段で止める(この段を持たない古い枝から起動しても、noteとSNSの投稿は、本流からしか許さないGitHubの設定で止まる。止まらないのはQiitaの同期と、本流へ直接送った変更)。note は、取り込んだ変更に含まれる原稿のうち、印が ready か published のものが自動で反映される。どの原稿がどの記事になったかの記録があれば同じ記事を書き換え、記録が無ければ ready は新しく投稿し、published は投稿しない。一人称、平易な言葉で。4〜6 文。', min: 3 },
  { id: 'ai', heading: 'AIとの線引き', secs: ['7.1'], intent: '生成AIには公開の印を立てるところまで任せる。以前は、公開の手前に人の確認を重ねても公開は最後の門で止まるので、守りは増えず人の操作だけが増えている、と考えた（当時の理由）。そこで、確認の記録を本流への取り込み（マージ）の1つだけに残すと決めた。公開の処理は本流以外からの起動を止めるので、公開の前には、人の取り込み(マージ)が入る(止まらない経路は正本の 9 章)。2〜4 文。', min: 2 },
  { id: 'learned', heading: '学んだこと', secs: ['4.1', '7.1'], intent: '一人称の締め。誰に何をどの粒度で渡すか、どこまでを機械に任せるかを決める作業だった。正本を1つに置き、派生物は別に書く。2〜4 文。', min: 2 },
];

async function draftSlot(slot) {
  const quotes = quotesFor(slot.secs);
  const input = `<canonical_sentences>\n${quotes.map((s) => `${s.id}: ${s.text}`).join('\n')}\n</canonical_sentences>\n\nこの枠で伝えたいこと: ${slot.intent}\n媒体: note(意思決定の物語。一人称「私」。コード・記号・専門用語を置かない)。実装の語は次の平易な言い換えを使う: ${layText}。1 文は 90 字以内。`;
  const r = callGeminiValidated({
    input, instruction: `${draftPrompt}\n\n上の canonical_sentences の命題だけを使い、note の読者(意思決定者)に向けて一人称の物語として書いてください。`,
    model: decisions.model_requested, expectModel: decisions.model_actual,
    logPath: abs(`.tmp/derive/note/draft-${slot.id}.json`),
    validate: (j) => {
      const e = [];
      if (!j.sentences || j.sentences.length < slot.min) e.push(`sentences が ${slot.min} 文未満`);
      for (const s of j.sentences || []) {
        if (!s.text || [...s.text].length > 90) e.push(`長すぎる文: ${String(s.text).slice(0, 20)}`);
        if (/[`|]|```/.test(s.text || '')) e.push(`記号(バッククォート/表)が混入: ${String(s.text).slice(0, 20)}`);
        for (const w of req.lay_wording) if (new RegExp(`(?<![A-Za-z])${w.jargon}(?![A-Za-z])`).test(s.text || '')) e.push(`実装の語「${w.jargon}」を平易にしてください`);
      }
      return e;
    },
  });
  return r.json.sentences.map((s) => s.text.trim());
}

const run = async () => {
  fs.mkdirSync(abs('.tmp/derive/note'), { recursive: true });
  const drafted = {};
  for (const slot of slots) {
    process.stdout.write(`draft ${slot.id}… `);
    drafted[slot.id] = await draftSlot(slot);
    process.stdout.write(`${drafted[slot.id].length} 文\n`);
  }
  const fm = ['---', `title: ${JSON.stringify(headFm.title)}`, 'status: draft', 'source: articles/multi-platform-publishing-architecture.md', `canonical_url: ${CANON_URL}`, `tags: ${JSON.stringify(headFm.tags)}`, `publish_after: ${JSON.stringify(headFm.publish_after)}`, '---'];
  const body = [
    `> この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。`,
    '',
  ];
  for (const slot of slots) {
    body.push(`## ${slot.heading}`, '', drafted[slot.id].join(''), '');
  }
  body.push(
    `技術的な設計と実装の詳細は、正本としてZennにまとめています。仕組みそのものに興味がある方は、そちらをご覧ください。`, '',
    `[Gitで管理し、CIで検証する「マルチプラットフォーム個人出版」の設計と実装](${CANON_URL})`, '',
  );
  const md = `${fm.join('\n')}\n\n${body.join('\n')}`;
  fs.writeFileSync(abs('.tmp/derive/note/multi-platform-publishing-architecture.md'), md, 'utf8');
  console.log(`\n原稿: .tmp/derive/note/…(${[...md].length} 字)`);

  const units = [];
  let n = 0;
  for (const slot of slots) for (const text of drafted[slot.id]) units.push({ n: n++, text, slot: slot.id });
  const batches = [];
  for (let i = 0; i < units.length; i += 5) batches.push(units.slice(i, i + 5));
  const verds = [];
  let cost = 0;
  for (const b of batches) {
    const r = judgeUnits(b, sourceFull, { judgeModel: decisions.judge_model, logPath: abs(`.tmp/derive/note/judge-b${b[0].n}.json`) });
    verds.push(...r.verdicts);
    cost += r.cost;
  }
  const agg = aggregate([verds], 'R3');
  const bad = agg.filter((a) => a.samples.some((v) => v.label === 'CONTRADICTED') || a.samples.filter((v) => v.label === 'NOT_IN_SOURCE').length >= 1);
  console.log(`\n=== 判定($${cost.toFixed(2)}、ゆるめの門): 生成 ${units.length} 文、矛盾・正本外の疑い ${bad.length} 件`);
  for (const a of bad) { const u = units.find((x) => x.n === a.n); console.log(`  [${u.slot}] ${u.text.slice(0, 50)} → ${a.samples.map((v) => v.label).join(',')}`); }
  fs.writeFileSync(abs('.tmp/derive/note/verdicts.json'), JSON.stringify({ units, verds, bad }, null, 2), 'utf8');
};

run().catch((e) => { console.error('失敗:', e.message); process.exit(1); });
