// S1: 正本の文に ID を振った索引を作る(派生物パイプラインの最初の段)。
//
//   node scripts/derive/index.mjs [--source articles/<id>.md] [--out .tmp/derive/index.json]
//
// 派生物の事実の文は、この索引の ID(S-<節>-<連番>)に帰属させてから書く(Attribute First, then Generate)。
// ID は正本の節番号と節の中の出現順から決まるので、同じ正本からは何度作っても同じ索引になる。
// 生成AIの開示(冒頭の告知と末尾の宣言)は事実の根拠にしないので含めない。コードブロックは文ではなく、
// 実装の抜粋として組み立ての段がリポジトリのファイルから逐語で取る。

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { readText, splitFrontmatter, abs, parseArgs, isMain } from '../lint/lib.mjs';
import { stripDisclosure } from '../lint/disclosure.mjs';

export function blobSha(text) {
  const buf = Buffer.from(text, 'utf8');
  return crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
}

function sectionOf(headingText) {
  const m = /^(\d+(?:\.\d+)*)\.?\s/.exec(headingText.trim());
  return m ? m[1] : null;
}

/** 正本の本文を、文(表の行は 1 行を 1 単位)に分けて ID を振る */
export function buildIndex(sourcePath, text) {
  const { body, bodyLine } = splitFrontmatter(text);
  const kept = stripDisclosure(body);
  const keptLines = new Set(kept.split('\n'));
  const lines = body.split('\n');
  const sentences = [];
  const headings = [];
  const counters = new Map();
  let section = '0';
  let inFence = false;
  const next = (sec) => {
    const n = (counters.get(sec) || 0) + 1;
    counters.set(sec, n);
    return `S-${sec}-${String(n).padStart(2, '0')}`;
  };
  // 開示の節(末尾の宣言)に入ったら打ち切る
  const declIndex = lines.findIndex((l) => /^#{1,6}\s+生成AIの利用について\s*$/.test(l));
  lines.forEach((raw, i) => {
    if (declIndex >= 0 && i >= declIndex) return;
    const line = raw.replace(/\s+$/, '');
    if (/^(```|~~~)/.test(line.trim())) {
      inFence = !inFence;
      return;
    }
    if (inFence || !line.trim()) return;
    if (/^:::/.test(line) || !keptLines.has(raw)) return;
    const h = /^(#{1,6})\s+(.+)$/.exec(line);
    if (h) {
      section = sectionOf(h[2]) || section;
      headings.push({ level: h[1].length, text: h[2].trim(), section, line: bodyLine + i });
      return;
    }
    if (/^\|?\s*:?-{3,}/.test(line)) return; // 表の区切り行
    if (/^\s*\|/.test(line)) {
      sentences.push({ id: next(section), section, line: bodyLine + i, kind: 'table-row', text: line.trim() });
      return;
    }
    const content = line.replace(/^\s*(?:[-*]|\d+\.)\s+/, '');
    for (const s of content.split(/(?<=[。！？])/)) {
      const t = s.trim();
      if (t) sentences.push({ id: next(section), section, line: bodyLine + i, kind: /^\s*(?:[-*]|\d+\.)\s+/.test(line) ? 'list-item' : 'prose', text: t });
    }
  });
  return { source: sourcePath, blob_sha: blobSha(text), sentences, headings };
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  const source = args.values.get('source') || 'articles/multi-platform-publishing-architecture.md';
  const out = args.values.get('out') || '.tmp/derive/index.json';
  const index = buildIndex(source, readText(source));
  fs.mkdirSync(path.dirname(abs(out)), { recursive: true });
  fs.writeFileSync(abs(out), JSON.stringify(index, null, 2), 'utf8');
  console.log(`index: ${index.sentences.length} units, ${index.headings.length} headings, blob ${index.blob_sha.slice(0, 7)} -> ${out}`);
}
