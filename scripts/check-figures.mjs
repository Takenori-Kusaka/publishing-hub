// Mermaid 図の可読性を検証する。
//
//   node scripts/check-figures.mjs [--render] [books/<book>]
//
// Zenn は本文幅(約 700px)より広い図を縮小して表示します。横に 3 つ以上の
// ノードが並ぶ図は文字が読めなくなるため、静的な規則で幅が広がる書き方を
// 禁止し、--render 指定時はローカルの Chrome と mermaid で実寸幅を測ります。
//
// 規則(図の品質規範):
//   R1 flowchart TD のみ(LR / graph LR は禁止)
//   R2 ノード数は 8 以下(subgraph の枠は数えない)
//   R3 1 ノードから出る可視の矢印は 2 本以下(3 つ以上の並列項目は subgraph +
//      direction TB + 不可視リンク ~~~ で縦に積む)
//   R4 ノードのラベルは 1 行 12 文字以下、3 行以下(<br> 区切り)
//   R5 矢印のラベルは 14 文字以下
//   R6 ブロック全体は 2000 文字以下(Zenn の制限)
//   R7 (--render) 実寸幅 700px 以下
//
// 依存: --render 時のみ node_modules/mermaid と Google Chrome。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const RENDER = args.includes('--render');
const targets = args.filter((a) => !a.startsWith('--'));
const MAX_WIDTH = 900;
const MAX_NODES = 8;
const MAX_FANOUT = 2;
const MAX_LABEL_LINE = 12;
const MAX_LABEL_LINES = 3;
const MAX_EDGE_LABEL = 14;
const MAX_CHARS = 2000;

function listMarkdown(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listMarkdown(p));
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

const files = targets.length
  ? targets.flatMap((t) => (fs.statSync(t).isDirectory() ? listMarkdown(t) : [t]))
  : listMarkdown(path.join(ROOT, 'books'));

const figures = [];
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  const re = /```mermaid\r?\n([\s\S]*?)```/g;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    const line = text.slice(0, m.index).split(/\r?\n/).length;
    const code = m[1].replace(/\r/g, '');
    const isClassDiagram = /^classDiagram\b/.test(code.trim());
    const hasSubgraph = code.includes('subgraph');
    figures.push({ file: path.relative(ROOT, f), index: i++, line, code, isClassDiagram, hasSubgraph });
  }
}

const problems = [];
function fail(fig, rule, msg) {
  problems.push(`${fig.file}:${fig.line} [${rule}] ${msg}`);
}

// 全角を 1、半角を 0.5 として数える
function width(s) {
  let w = 0;
  for (const ch of s) w += ch.charCodeAt(0) > 0xff ? 1 : 0.5;
  return w;
}

for (const fig of figures) {
  const code = fig.code;
  const lines = code.split('\n').map((l) => l.trim()).filter(Boolean);
  const head = lines[0] || '';
  const isClassDiagram = /^classDiagram\b/.test(head);
  if (!isClassDiagram && !/^flowchart\s+TD\b/.test(head)) {
    fail(fig, 'R1', `先頭行が flowchart TD または classDiagram ではありません: ${head}`);
  }
  if (code.length > MAX_CHARS) fail(fig, 'R6', `ブロックが ${code.length} 文字(上限 ${MAX_CHARS})`);

  if (isClassDiagram) continue;

  const nodes = new Map();
  const nodeRe = /([A-Za-z][A-Za-z0-9_]*)\[("?)([^\]]*?)\2\]/g;
  let m;
  while ((m = nodeRe.exec(code))) nodes.set(m[1], m[3]);
  if (nodes.size > MAX_NODES) fail(fig, 'R2', `ノード数 ${nodes.size}(上限 ${MAX_NODES})`);

  for (const [id, label] of nodes) {
    const parts = label.split(/<br\s*\/?>/);
    if (parts.length > MAX_LABEL_LINES) fail(fig, 'R4', `${id} のラベルが ${parts.length} 行(上限 ${MAX_LABEL_LINES})`);
    for (const p of parts) {
      if (width(p) > MAX_LABEL_LINE) fail(fig, 'R4', `${id} のラベル行「${p}」が ${width(p)} 文字(上限 ${MAX_LABEL_LINE})`);
    }
  }

  const fanout = new Map();
  for (const l of lines) {
    if (/^(style|classDef|class|linkStyle|subgraph|end|direction|flowchart|%%)/.test(l)) continue;
    // A -->|label| B / A --> B / A --- B ; 不可視リンク ~~~ は数えない
    const edgeRe = /([A-Za-z][A-Za-z0-9_]*)(?:\[[^\]]*\])?\s*(-->|---|-\.->|==>)\s*(?:\|([^|]*)\|)?\s*([A-Za-z][A-Za-z0-9_]*)/g;
    let e;
    while ((e = edgeRe.exec(l))) {
      fanout.set(e[1], (fanout.get(e[1]) || 0) + 1);
      if (e[3]) {
        const lab = e[3].replace(/<br\s*\/?>/g, '');
        if (width(lab) > MAX_EDGE_LABEL) fail(fig, 'R5', `矢印ラベル「${lab}」が ${width(lab)} 文字(上限 ${MAX_EDGE_LABEL})`);
      }
    }
  }
  for (const [id, n] of fanout) {
    if (n > MAX_FANOUT) fail(fig, 'R3', `${id} から可視の矢印が ${n} 本(上限 ${MAX_FANOUT}。3 つ以上は subgraph + ~~~ で縦に積む)`);
  }
}

if (RENDER && figures.length) {
  const mermaidJs = path.join(ROOT, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js');
  const chromeCandidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  const chrome = chromeCandidates.find((c) => fs.existsSync(c));
  if (!fs.existsSync(mermaidJs) || !chrome) {
    console.error('render check skipped: mermaid or Chrome not found');
  } else {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = [
      '<!doctype html><html><head><meta charset="utf-8"></head><body>',
      ...figures.map((f, i) => `<div class="box" data-id="${i}"><pre class="mermaid">${esc(f.code)}</pre></div>`),
      `<script src="file:///${mermaidJs.replace(/\\/g, '/')}"></script>`,
      '<script>mermaid.initialize({startOnLoad:true,theme:"default"});</script></body></html>',
    ].join('\n');
    const tmp = path.join(os.tmpdir(), `zenn-figures-${process.pid}.html`);
    fs.writeFileSync(tmp, html);
    const r = spawnSync(chrome, [
      '--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--window-size=1000,2000',
      '--virtual-time-budget=120000', '--timeout=120000', '--dump-dom', `file:///${tmp.replace(/\\/g, '/')}`,
    ], { encoding: 'utf8', maxBuffer: 1 << 28 });
    fs.unlinkSync(tmp);
    const dom = r.stdout || '';
    const boxes = dom.split('<div class="box"').slice(1);
    boxes.forEach((box) => {
      const id = Number(/data-id="(\d+)"/.exec(box)?.[1]);
      const fig = figures[id];
      const vb = /<svg[^>]*?viewBox="([^"]+)"/.exec(box);
      if (!fig) return;
      if (!vb) { fail(fig, 'R7', '描画に失敗しました(構文エラーの可能性)'); return; }
      if (fig.isClassDiagram || fig.hasSubgraph) return;
      const w = Number(vb[1].split(/\s+/)[2]);
      if (w > MAX_WIDTH) fail(fig, 'R7', `実寸幅 ${Math.round(w)}px(上限 ${MAX_WIDTH}px、Zenn では ${Math.round((MAX_WIDTH / w) * 100)}% に縮小)`);
    });
    if (!boxes.length) console.error('render check produced no output');
  }
}

console.log(`figures: ${figures.length}, problems: ${problems.length}`);
for (const p of problems) console.log('  ' + p);
process.exit(problems.length ? 1 : 0);
