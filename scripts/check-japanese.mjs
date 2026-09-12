// 日本語として書かれた原稿に、日本語以外の漢字が混入していないかを検査する。
//
//   node scripts/check-japanese.mjs [books/<book> ...]
//
// 検査は2つあります。
//
//   J1: 日本語の文字集合(JIS X 0208)に存在しない漢字
//       簡体字や中国語専用の字が混入すると、日本語のフォントでは表示できず、
//       閲覧環境によって字形が変わります。例: 经 済 规 划(簡体字)。
//
//   J2: Mermaid 図のラベルに含まれる JIS 第2水準の漢字
//       Zenn は図を SVG として描画します。SVG のフォント指定に日本語フォントが
//       解決されない場合、常用漢字の範囲を外れた字は他言語のフォントで代替表示され、
//       中国語の字形で表示されることがあります(例: 兌、閾、輻輳)。本文では起きにくく、
//       図のラベルでのみ観測されるため、図の中だけを対象とします。
//
// 水準の判定には、Node に組み込みの Shift_JIS デコーダを用いて
// 「Unicode の文字 → JIS の区点」の対応表を実行時に構築します。外部データは不要です。
//   第1水準: Shift_JIS 0x889F〜0x9872 / 第2水準: 0x989F〜0xEAA4

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 自動生成のため、収録した資料の原題(外国語)をそのまま含むファイル */
const J1_ALLOW_FILES = new Set(['srb-appendix-bibliography.md']);

/** Unicode の漢字 → JIS の水準(1 または 2) */
function buildJisLevelMap() {
  const decoder = new TextDecoder('shift_jis');
  const level = new Map();
  for (let hi = 0x81; hi <= 0xef; hi++) {
    for (let lo = 0x40; lo <= 0xfc; lo++) {
      if (lo === 0x7f) continue;
      const s = decoder.decode(new Uint8Array([hi, lo]));
      if (s.length !== 1 || s === '�') continue;
      const v = (hi << 8) | lo;
      const lv = v >= 0x889f && v <= 0x9872 ? 1 : v >= 0x989f && v <= 0xeaa4 ? 2 : 0;
      if (lv) level.set(s, lv);
    }
  }
  return level;
}

const JIS_LEVEL = buildJisLevelMap();

function isCjk(ch) {
  const o = ch.codePointAt(0);
  return (o >= 0x3400 && o <= 0x9fff) || (o >= 0xf900 && o <= 0xfaff) || (o >= 0x20000 && o <= 0x2fa1f);
}

function listMarkdown(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listMarkdown(p));
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const files = args.length
  ? args.flatMap((t) => (fs.statSync(t).isDirectory() ? listMarkdown(t) : [t]))
  : [...listMarkdown(path.join(ROOT, 'books')), ...listMarkdown(path.join(ROOT, 'articles'))];

const problems = [];
let checked = 0;

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const base = path.basename(file);
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  checked++;

  // J1: JIS X 0208 に存在しない漢字
  if (!J1_ALLOW_FILES.has(base)) {
    const seen = new Set();
    lines.forEach((line, i) => {
      for (const ch of line) {
        if (!isCjk(ch) || JIS_LEVEL.has(ch)) continue;
        const key = `${i}:${ch}`;
        if (seen.has(key)) continue;
        seen.add(key);
        problems.push(
          `${rel}:${i + 1} [J1] "${ch}"(U+${ch.codePointAt(0).toString(16).toUpperCase()}) は日本語の文字集合にない漢字です(簡体字などの混入): ${line.trim().slice(0, 60)}`
        );
      }
    });
  }

  // J2: Mermaid 図のラベルに含まれる第2水準漢字
  const re = /```mermaid\r?\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(text))) {
    const startLine = text.slice(0, m.index).split(/\r?\n/).length;
    const seen = new Set();
    for (const ch of m[1]) {
      if (!isCjk(ch)) continue;
      if (JIS_LEVEL.get(ch) === 2 && !seen.has(ch)) {
        seen.add(ch);
        problems.push(
          `${rel}:${startLine} [J2] 図のラベルの "${ch}" は JIS 第2水準です(SVG 描画で他言語の字形に置き換わることがあります)。常用漢字の範囲で言い換えてください`
        );
      }
    }
  }

  // J3: 複数称・組織称の排除（主語の単数個人化）
  const forbiddenPronouns = ['私たち', '我々', '弊社', '当社', '当グループ', '当チーム', '我社'];
  lines.forEach((line, i) => {
    forbiddenPronouns.forEach(word => {
      if (line.includes(word)) {
        problems.push(
          `${rel}:${i + 1} [J3] 複数称・組織称の "${word}" が検出されました。このリポジトリは個人執筆専用です。「私」「著者」「当方」などの単数個人称に書き換えてください: ${line.trim().slice(0, 60)}`
        );
      }
    });
  });
}

console.log(`files: ${checked}, problems: ${problems.length}`);
for (const p of problems) console.log('  ' + p);
process.exit(problems.length ? 1 : 0);
