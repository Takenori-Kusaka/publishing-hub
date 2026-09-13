// S3: 判定器の較正(selftest)。過去のラウンドで出た誤りの文(bad)と、正本に支えられた文(good)を判定器にかけ、
// bad を不合格、good を合格にできるかを測る。ここを通らなければ、生成の評価に判定器を使わない(ponytail の selftest)。
//
//   node scripts/derive/calibrate.mjs [--index .tmp/derive/index.json] [--repeats 3] [--rule R1]
//
// 見逃し(bad を合格にした数)は 0 を目標にし、3 の法則で見逃し率の 95% 上限を報告する。
// good の誤判定率(good を不合格にした率)も報告する。陽性・陰性を分けて出す(Hamel)。

import fs from 'node:fs';
import { readText, abs, parseArgs } from '../lint/lib.mjs';
import { judgeUnits, aggregate } from './lib/judge.mjs';

const args = parseArgs();
const indexPath = args.values.get('index') || '.tmp/derive/index.json';
const repeats = Number(args.values.get('repeats') || 3);
const rule = args.values.get('rule') || 'R1';
const decisions = JSON.parse(readText('lint/derive/decisions.json'));
if (args.values.get('judge')) decisions.judge_model = args.values.get('judge');
const index = JSON.parse(readText(indexPath));
const sourceText = index.sentences.map((s) => `${s.id}: ${s.text}`).join('\n');

const rows = readText('test/derive/calibration/multi-platform-publishing-architecture.test.jsonl')
  .split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));

const units = rows.map((r, i) => ({ n: i, text: r.text }));
const batches = [];
for (let i = 0; i < units.length; i += 5) batches.push(units.slice(i, i + 5));

console.log(`判定器: ${decisions.judge_model} / 単位 ${units.length}(bad ${rows.filter((r) => r.expected === 'bad').length}, good ${rows.filter((r) => r.expected === 'good').length})/ ${repeats} 回 / ルール ${rule}`);
let cost = 0;
const rounds = [];
for (let rep = 0; rep < repeats; rep++) {
  const verdicts = [];
  for (const batch of batches) {
    const r = judgeUnits(batch, sourceText, { judgeModel: decisions.judge_model, logPath: `.tmp/derive/calibration/rep${rep}-b${batch[0].n}.json` });
    verdicts.push(...r.verdicts);
    cost += r.cost;
    if (cost > decisions.judge_budget_usd) throw new Error(`予算 $${decisions.judge_budget_usd} を超えました`);
  }
  rounds.push(verdicts);
  process.stdout.write(`  rep ${rep + 1}/${repeats} done ($${cost.toFixed(3)})\n`);
}

const agg = aggregate(rounds, rule);
let missed = [];
let falsePos = [];
for (const a of agg) {
  const row = rows[a.n];
  const caught = !a.pass; // bad should be caught (not pass)
  if (row.expected === 'bad' && a.pass) missed.push(row);
  if (row.expected === 'good' && !a.pass) falsePos.push({ row, a });
}
const nBad = rows.filter((r) => r.expected === 'bad').length;
const nGood = rows.filter((r) => r.expected === 'good').length;
const tpr = (nBad - missed.length) / nBad;
const tnr = (nGood - falsePos.length) / nGood;
const ruleOf3 = missed.length === 0 ? (3 / nBad) : null;

console.log(`\n=== 較正の結果 ($${cost.toFixed(3)})`);
console.log(`真陽性率(bad を捕まえた): ${(tpr * 100).toFixed(0)}%  (${nBad - missed.length}/${nBad})`);
console.log(`真陰性率(good を通した): ${(tnr * 100).toFixed(0)}%  (${nGood - falsePos.length}/${nGood})`);
if (ruleOf3 != null) console.log(`見逃し 0 件 → 見逃し率の 95% 上限(3 の法則): ${(ruleOf3 * 100).toFixed(1)}%`);
console.log(`good の誤判定率: ${((falsePos.length / nGood) * 100).toFixed(1)}%`);
if (missed.length) {
  console.log(`\n見逃した bad(${missed.length}):`);
  for (const m of missed) console.log(`  [${m.category}] ${m.text.slice(0, 60)}`);
}
if (falsePos.length) {
  console.log(`\n誤って落とした good(${falsePos.length}):`);
  for (const f of falsePos) console.log(`  [${f.row.category}] ${f.row.text.slice(0, 50)} → ${f.a.labels.join(',')}`);
}
fs.writeFileSync(abs('.tmp/derive/calibration-summary.json'), JSON.stringify({ judge_model: decisions.judge_model, repeats, rule, cost, tpr, tnr, ruleOf3, missed, falsePos: falsePos.map((f) => ({ ...f.row, labels: f.a.labels })) }, null, 2), 'utf8');
console.log(`\n合否: ${missed.length === 0 && falsePos.length / nGood <= 0.1 ? '✅ 判定器は使える(見逃し 0、good の誤判定 10% 以下)' : '❌ まだ使えない'}`);
