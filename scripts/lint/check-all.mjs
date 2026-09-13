// すべての検査を順に実行し、結果を 1 つのレポートにまとめる(npm run check)。
//
//   node scripts/lint/check-all.mjs [--only textlint,terms,...] [--report-dir .tmp/lint] [--quiet]
//
// 途中で失敗しても最後まで実行し、全体像を 1 回で見せます。
// 各段階の JSON レポートと、CI の Step Summary に貼れる Markdown(report.md)を
// --report-dir(既定 .tmp/lint)へ書き出します。終了コードは 1 段階でも失敗すれば 1 です。
//
// 段階の一覧と役割は docs/linting.md を参照してください。

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, abs, parseArgs, isMain } from './lib.mjs';

export const STAGES = [
  { id: 'textlint', title: '校正(媒体別 textlint プロファイル)', cmd: ['scripts/lint/run-textlint.mjs'], report: true },
  { id: 'books', title: '本の構成(config.yaml 突合・Zenn の制限)', cmd: ['scripts/check-books.mjs'] },
  { id: 'figures', title: '図の可読性(Mermaid の規範)', cmd: ['scripts/check-figures.mjs'] },
  { id: 'japanese', title: '日本語の文字集合・複数称の排除', cmd: ['scripts/check-japanese.mjs'] },
  { id: 'links', title: '章ラベルのリンク', cmd: ['scripts/check-links.mjs'] },
  { id: 'terms', title: '用語統一(題材別辞書・表記ゆれ検出)', cmd: ['scripts/lint/check-terms.mjs'], report: true },
  { id: 'zenn', title: 'Zenn 正本の構造(genre・記述規範)', cmd: ['scripts/lint/check-zenn.mjs'], report: true },
  { id: 'qiita', title: 'Qiita バリアントの構造(レシピの要件)', cmd: ['scripts/lint/check-qiita.mjs'], report: true },
  { id: 'note', title: 'note バリアントの構造(エッセイの要件)', cmd: ['scripts/lint/check-note.mjs'], report: true },
  { id: 'variants', title: '媒体間の非対称(重複率・正本への導線)', cmd: ['scripts/lint/check-variants.mjs'], report: true },
  { id: 'social', title: 'SNS 原稿(スキーマ・意味検査・編集規則)', cmd: ['scripts/social/cli.mjs', 'validate'] },
];

function countFromOutput(out) {
  const m = /errors (\d+), warnings (\d+)/.exec(out);
  if (m) return { errors: Number(m[1]), warnings: Number(m[2]) };
  const p = /problems: (\d+)/.exec(out);
  if (p) return { errors: Number(p[1]), warnings: 0 };
  const e = /(\d+) 件の問題があります/.exec(out);
  if (e) return { errors: Number(e[1]), warnings: 0 };
  const errLines = (out.match(/^\s*(❌|✖|エラー:)/gm) || []).length;
  const warnLines = (out.match(/^\s*(⚠|注意:)/gm) || []).length;
  return { errors: errLines, warnings: warnLines };
}

export function runStage(stage, reportDir) {
  const args = [...stage.cmd];
  const reportPath = stage.report ? path.join(reportDir, `${stage.id}.json`) : null;
  if (reportPath) {
    args.push('--report', reportPath);
    fs.rmSync(reportPath, { force: true }); // 前回の結果を段階のクラッシュ時に読まないよう消しておく
  }
  const started = Date.now();
  const r = spawnSync(process.execPath, args.map((a) => (a.startsWith('scripts/') ? abs(a) : a)), { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  let counts = countFromOutput(out);
  let details = null;
  if (reportPath && fs.existsSync(reportPath)) {
    details = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    counts = { errors: details.errors.length, warnings: details.warnings.length };
  }
  return { id: stage.id, title: stage.title, ok: r.status === 0, status: r.status, ms: Date.now() - started, out, counts, details };
}

export function renderMarkdown(results) {
  const lines = ['# 検査レポート', '', '| 段階 | 結果 | エラー | 警告 | 役割 |', '| --- | --- | ---: | ---: | --- |'];
  for (const r of results) lines.push(`| ${r.id} | ${r.ok ? '✅' : '❌'} | ${r.counts.errors} | ${r.counts.warnings} | ${r.title} |`);
  const failed = results.filter((r) => !r.ok);
  lines.push('', failed.length ? `**${failed.length} 段階が失敗**: ${failed.map((r) => r.id).join(', ')}` : '**すべての段階に合格**');
  for (const r of results) {
    const items = r.details ? [...r.details.errors, ...r.details.warnings] : [];
    if (!items.length && r.ok) continue;
    lines.push('', `## ${r.id} — ${r.title}`, '');
    if (items.length) {
      for (const i of items.slice(0, 200)) lines.push(`- ${i.severity === 'error' ? '✖' : '⚠'} \`${i.file}${i.line ? ':' + i.line : ''}\` [${i.code}] ${i.message.replace(/\n/g, ' ')}`);
      if (items.length > 200) lines.push(`- … ほか ${items.length - 200} 件`);
    } else {
      lines.push('```text', r.out.trim().split('\n').slice(-40).join('\n'), '```');
    }
  }
  return lines.join('\n') + '\n';
}

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
  const md = renderMarkdown(results);
  fs.writeFileSync(path.join(dir, 'report.md'), md, 'utf8');
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(results.map(({ out, details, ...rest }) => rest), null, 2), 'utf8');
  console.log('\n=== まとめ');
  for (const r of results) console.log(`  ${r.ok ? '✅' : '❌'} ${r.id.padEnd(9)} errors ${String(r.counts.errors).padStart(3)}  warnings ${String(r.counts.warnings).padStart(3)}  ${r.title}`);
  console.log(`  レポート: ${path.join(reportDir, 'report.md')}`);
  return results;
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  const only = args.values.has('only') ? args.values.get('only').split(',') : null;
  const results = checkAll({ only, reportDir: args.values.get('report-dir') || '.tmp/lint', quiet: args.flags.has('quiet') });
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}
