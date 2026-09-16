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
import { spawnSync, execFileSync } from 'node:child_process';
import { ROOT, abs, parseArgs, isMain } from './lib.mjs';

/**
 * Node の版を先に確かめる。古い Node では、検査の中身ではなく構文解析で落ちるため、
 * 「errors 0 なのに失敗」という読み解けない結果になる。実際に踏んだ例:
 *   - check-zenn.mjs の /\p{RGI_Emoji}/v  → SyntaxError: Invalid regular expression flags(Node 18)
 *   - @atproto/api の import ... with {}  → SyntaxError: Unexpected token 'with'(Node 18)
 * どちらも Node 20 以降の構文で、CI は 22 で動かしている。
 */
const MIN_NODE_MAJOR = 20;
export function assertNodeVersion(version = process.versions.node) {
  const major = Number(version.split('.')[0]);
  if (major >= MIN_NODE_MAJOR) return null;
  return [
    `Node ${version} では検査を実行できません（Node ${MIN_NODE_MAJOR} 以降が必要です。CI は 22 で動かしています）。`,
    '古い Node では、検査の中身ではなく構文解析の段階で落ちるため、「errors 0 なのに失敗」と表示されます。',
    '新しい Node に切り替えてから、もう一度実行してください（例: nvm install 22 && nvm use 22）。',
  ].join('\n');
}

/**
 * 検査した状態(HEAD、index の tree、未コミットの変更の件数)。git が使えなければ null。
 * エージェントの完了報告にこの行を貼らせると、報告のあとに原稿やコミットが変わっていないかを人が突き合わせられる。
 */
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
  { id: 'note', title: 'note バリアントの構造(エッセイの要件)', cmd: ['scripts/lint/check-note.mjs', '--strict'], report: true },
  { id: 'variants', title: '媒体間の非対称(重複率・正本への導線)', cmd: ['scripts/lint/check-variants.mjs', '--strict'], report: true },
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
  const state = gitState();
  const md = renderMarkdown(results).replace(/^# 検査レポート\n/, `# 検査レポート\n\n${stateLine(state)}\n`);
  fs.writeFileSync(path.join(dir, 'report.md'), md, 'utf8');
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(results.map(({ out, details, ...rest }) => rest), null, 2), 'utf8');
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(state, null, 2), 'utf8');
  console.log('\n=== まとめ');
  for (const r of results) console.log(`  ${r.ok ? '✅' : '❌'} ${r.id.padEnd(9)} errors ${String(r.counts.errors).padStart(3)}  warnings ${String(r.counts.warnings).padStart(3)}  ${r.title}`);
  console.log(`  ${stateLine(state)}(完了報告にはこの行を貼ります)`);
  console.log(`  レポート: ${path.join(reportDir, 'report.md')}`);
  return results;
}

if (isMain(import.meta.url)) {
  const tooOld = assertNodeVersion();
  if (tooOld) {
    console.error(tooOld);
    process.exit(1);
  }
  const args = parseArgs();
  const only = args.values.has('only') ? args.values.get('only').split(',') : null;
  const results = checkAll({ only, reportDir: args.values.get('report-dir') || '.tmp/lint', quiet: args.flags.has('quiet') });
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}
