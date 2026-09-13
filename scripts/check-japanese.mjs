// 日本語として書かれた原稿に、日本語以外の漢字や、個人発信にそぐわない主語が混入していないかを検査する。
//
//   node scripts/check-japanese.mjs [--qiita|--note] [books/<book> ...]
//
// 検査は3つあります。
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
//   J3: 複数称・組織称の排除(主語の単数個人化)
//       このリポジトリは個人発信専用です。「私たち」「弊社」などを検知します。
//       語の一覧は lint/policies/expressions.json の corporate_pronouns にあります。
//       コードブロック・引用ブロック(>)・「」『』の中(引用や語の言及)は対象外です。
//
// 水準の判定には、Node に組み込みの Shift_JIS デコーダを用いて
// 「Unicode の文字 → JIS の区点」の対応表を実行時に構築します。外部データは不要です。
//   第1水準: Shift_JIS 0x889F〜0x9872 / 第2水準: 0x989F〜0xEAA4
//
// 対象は books/ articles/ と派生物(platforms/qiita/public の新規記事、platforms/note/public)。
// --qiita / --note で派生物 1 種類だけに絞れます(配信前の gate 用)。

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

/** 派生物(Qiita / note)の原稿。Qiita CLI が同期した過去記事(20 桁 hex)と README は対象外 */
function listVariants({ qiita = true, note = true } = {}) {
  const out = [];
  const qiitaDir = path.join(ROOT, 'platforms', 'qiita', 'public');
  if (qiita && fs.existsSync(qiitaDir)) out.push(...listMarkdown(qiitaDir).filter((f) => !/^[0-9a-f]{20}\.md$/i.test(path.basename(f))));
  const noteDir = path.join(ROOT, 'platforms', 'note', 'public');
  if (note && fs.existsSync(noteDir)) out.push(...listMarkdown(noteDir).filter((f) => path.basename(f) !== 'README.md'));
  return out;
}

/** J3 の語一覧(正規表現)。lint/policies/expressions.json を正本にする */
function loadPronounPatterns() {
  const p = path.join(ROOT, 'lint', 'policies', 'expressions.json');
  const fallback = ['私たち', '我々', '弊社', '(?<![担該適相])当社', '当グループ', '当チーム', '我社'];
  try {
    const json = JSON.parse(fs.readFileSync(p, 'utf8'));
    return (json.corporate_pronouns?.patterns || json.corporate_pronouns?.words || fallback).map((s) => new RegExp(s, 'g'));
  } catch {
    return fallback.map((s) => new RegExp(s, 'g'));
  }
}

/** J3 で見ない領域を伏せる: コードブロック、引用ブロック行、「」『』の中(語の言及・引用) */
function maskForPronouns(lines) {
  const out = [];
  let inFence = false;
  for (const line of lines) {
    if (/^[ \t]{0,3}(`{3,}|~{3,})/.test(line)) {
      inFence = !inFence;
      out.push('');
      continue;
    }
    if (inFence || /^\s*>/.test(line)) {
      out.push('');
      continue;
    }
    out.push(line.replace(/`[^`]*`/g, (s) => ' '.repeat(s.length)).replace(/「[^「」]*」|『[^『』]*』/g, (s) => ' '.repeat(s.length)));
  }
  return out;
}

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const args = argv.filter((a) => !a.startsWith('--'));
const files = args.length
  ? args.flatMap((t) => (fs.statSync(t).isDirectory() ? listMarkdown(t) : [t]))
  : flags.has('--qiita')
    ? listVariants({ qiita: true, note: false })
    : flags.has('--note')
      ? listVariants({ qiita: false, note: true })
      : [...listMarkdown(path.join(ROOT, 'books')), ...listMarkdown(path.join(ROOT, 'articles')), ...listVariants()];

const pronounPatterns = loadPronounPatterns();
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

  // J3: 複数称・組織称の排除(主語の単数個人化)
  maskForPronouns(lines).forEach((line, i) => {
    for (const re3 of pronounPatterns) {
      re3.lastIndex = 0;
      const hit = re3.exec(line);
      if (hit) {
        problems.push(
          `${rel}:${i + 1} [J3] 複数称・組織称の "${hit[0]}" が検出されました。このリポジトリは個人執筆専用です。「私」「著者」「当方」などの単数個人称に書き換えてください: ${lines[i].trim().slice(0, 60)}`
        );
      }
    }
  });
}

console.log(`files: ${checked}, problems: ${problems.length}`);
for (const p of problems) console.log('  ' + p);
process.exit(problems.length ? 1 : 0);
