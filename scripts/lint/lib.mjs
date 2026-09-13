// 媒体別 linter の共通基盤。
//
// 各チェッカー(scripts/lint/check-*.mjs)は、ここにある関数だけで
//   - 対象ファイルの列挙(glob)
//   - frontmatter の分離と Markdown のマスク(コード・URL・図を伏せる)
//   - 文・リンク・見出しの抽出
//   - 統一フォーマットでの報告(標準出力 + JSON レポート)
// を行います。方針は docs/linting.md を参照してください。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { marked } from 'marked';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** 走査から常に除外するディレクトリ */
const SKIP_DIRS = new Set(['node_modules', '.git', '.tmp', 'tmp', 'exports', 'screenshots']);

/**
 * 裸の URL。空白・閉じ括弧・全角約物・CJK 文字で終わる。
 * 日本語の散文では URL の直後に助詞や句点が続くので、そこで切る。
 */
export const URL_RE = /https?:\/\/[^\s)>\]」『』（）。、！？、,;぀-ヿ㐀-鿿]+/g;
/** 末尾に紛れ込みやすい記号を落として URL を比較する */
export function normalizeUrl(url) {
  return String(url)
    .replace(/[.,;:!?)]+$/g, '')
    .split('?')[0]
    .replace(/\/$/, '');
}

export function rel(p) {
  return path.relative(ROOT, path.isAbsolute(p) ? p : path.join(ROOT, p)).split(path.sep).join('/');
}

export function abs(p) {
  return path.isAbsolute(p) ? p : path.join(ROOT, p);
}

/** 原稿を読む。Windows の autocrlf で CRLF になっていても検査結果が変わらないよう LF に正規化する */
export function readText(p) {
  return fs.readFileSync(abs(p), 'utf8').replace(/\r\n/g, '\n');
}

export function readJson(p) {
  return JSON.parse(fs.readFileSync(abs(p), 'utf8'));
}

export function readYaml(p) {
  return YAML.parse(fs.readFileSync(abs(p), 'utf8'));
}

export function exists(p) {
  return fs.existsSync(abs(p));
}

// ---------------------------------------------------------------- glob

function escapeRe(s) {
  return s.replace(/[.+^$()|\\]/g, '\\$&');
}

/** glob(**, *, ?, {a,b}, [..]) を正規表現へ。パスは常に "/" 区切り */
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') {
          re += '(?:.*/)?';
          i += 2;
        } else {
          re += '.*';
          i += 1;
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if (c === '{') {
      const j = glob.indexOf('}', i);
      const alts = glob.slice(i + 1, j).split(',');
      re += '(?:' + alts.map(escapeRe).join('|') + ')';
      i = j;
    } else if (c === '[') {
      const j = glob.indexOf(']', i);
      re += glob.slice(i, j + 1);
      i = j;
    } else {
      re += escapeRe(c);
    }
  }
  return new RegExp('^' + re + '$');
}

export function matchesAny(relPath, globs) {
  if (!globs || !globs.length) return false;
  const p = relPath.split(path.sep).join('/');
  return globs.some((g) => globToRegExp(g).test(p));
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name), out);
    } else {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

/** glob の先頭(ワイルドカードより前)のディレクトリだけを走査して列挙する */
export function listFiles(include, { exclude = [] } = {}) {
  const found = new Set();
  for (const g of include) {
    const wild = g.search(/[*?{[]/);
    const base = wild < 0 ? g : g.slice(0, g.lastIndexOf('/', wild) + 1);
    const baseAbs = abs(base || '.');
    if (wild < 0) {
      if (fs.existsSync(baseAbs) && fs.statSync(baseAbs).isFile()) found.add(rel(baseAbs));
      continue;
    }
    if (!fs.existsSync(baseAbs)) continue;
    for (const f of walk(baseAbs, [])) {
      const r = rel(f);
      if (globToRegExp(g).test(r)) found.add(r);
    }
  }
  return [...found].filter((f) => !matchesAny(f, exclude)).sort();
}

/**
 * 位置引数(エディタ連携などで渡されるファイル)で対象を絞る。
 * バックスラッシュ・./・絶対パスを正規化し、対象に 1 つも残らなければ理由を返す。
 */
export function restrictTo(files, only) {
  if (!only || !only.length) return { files, note: null };
  // Windows 形式(バックスラッシュ)の引数は Linux の CI でも同じ意味に解釈する
  const wanted = new Set(only.map((p) => rel(abs(String(p).replace(/\\/g, '/')))));
  const picked = files.filter((f) => wanted.has(f));
  if (!picked.length) {
    return { files: picked, note: `指定されたファイル(${[...wanted].join(', ')})はこのチェッカーの対象に含まれません` };
  }
  return { files: picked, note: null };
}

/** Qiita CLI が同期した過去記事(ファイル名が 20 桁の hex)。歴史的な投稿なので新基準の対象外 */
export function isLegacyQiita(file) {
  return /^[0-9a-f]{20}\.md$/i.test(path.basename(file));
}

// ---------------------------------------------------------------- markdown

/** frontmatter を分離する。body の行番号を保つため bodyLine(1-based) も返す */
export function splitFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!m) return { frontmatter: null, raw: '', body: text, bodyLine: 1, error: null };
  let frontmatter = null;
  let error = null;
  try {
    frontmatter = YAML.parse(m[1]) ?? {};
  } catch (e) {
    error = e.message;
  }
  const bodyLine = m[0].split(/\r?\n/).length;
  return { frontmatter, raw: m[1], body: text.slice(m[0].length), bodyLine, error };
}

/** 文字位置(0-based index)から行番号(1-based)へ */
export function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/** 同じ長さのまま伏せる(改行は保つ)。行番号がずれない */
function blank(s) {
  return s.replace(/[^\n]/g, ' ');
}

/**
 * フェンスコードブロックを CommonMark に近い規則で走査する。
 * 開きは 3 スペースまでのインデント(リスト内はさらに深くてもよい)、閉じは同じ記号で同数以上、
 * 閉じがなければファイル末尾まで。戻り値は { start, end, lang, code, line }(start/end は文字位置)。
 */
export function scanFences(text) {
  const out = [];
  const lines = text.split('\n');
  let pos = 0;
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!open) {
      const m = /^([ \t]{0,6})(`{3,}|~{3,})([^\n]*)$/.exec(line);
      if (m && !(m[2][0] === '`' && m[3].includes('`'))) {
        open = { start: pos, line: i + 1, fence: m[2], lang: m[3].trim().split(/\s+/)[0] || '', codeStart: pos + line.length + 1 };
      }
    } else {
      const m = /^[ \t]{0,6}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (m && m[1][0] === open.fence[0] && m[1].length >= open.fence.length) {
        out.push({ start: open.start, end: pos + line.length, lang: open.lang, code: text.slice(open.codeStart, pos), line: open.line });
        open = null;
      }
    }
    pos += line.length + 1;
  }
  if (open) out.push({ start: open.start, end: text.length, lang: open.lang, code: text.slice(Math.min(open.codeStart, text.length)), line: open.line, unclosed: true });
  return out;
}

/**
 * 検査の対象外(コード・URL・HTML・図)を伏せた本文を返す。
 * 長さと改行位置は元のまま。
 */
export function maskMarkdown(text, opts = {}) {
  const o = { frontmatter: true, fenced: true, inline: true, links: true, urls: true, html: true, ...opts };
  let t = text;
  if (o.frontmatter) t = t.replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, blank);
  if (o.fenced) {
    const fences = scanFences(t);
    if (fences.length) {
      let out = '';
      let cursor = 0;
      for (const f of fences) {
        out += t.slice(cursor, f.start) + blank(t.slice(f.start, f.end));
        cursor = f.end;
      }
      t = out + t.slice(cursor);
    }
  }
  if (o.inline) t = t.replace(/`[^`\n]*`/g, blank);
  if (o.links) t = t.replace(/\]\((?:[^()\s]|\([^()\s]*\))*\)/g, (s) => ']' + blank(s.slice(1)));
  if (o.urls) t = t.replace(URL_RE, blank);
  if (o.html) t = t.replace(/<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^>\n]*)?\/?>/g, blank);
  return t;
}

/** ``` で囲まれたブロック */
export function fencedBlocks(text) {
  return scanFences(text).map((f) => ({ lang: f.lang, code: f.code, index: f.start, line: f.line, unclosed: Boolean(f.unclosed) }));
}

/** 見出し(# の数と本文) */
export function headings(text) {
  const masked = maskMarkdown(text, { inline: false, links: false, urls: false, html: false });
  const out = [];
  const re = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/gm;
  let m;
  while ((m = re.exec(masked))) {
    const start = m.index + m[1].length + (m[0].length - m[0].trimStart().length);
    const textStart = m.index + m[0].indexOf(m[2]);
    out.push({ level: m[1].length, text: text.slice(textStart, textStart + m[2].length).trim(), line: lineOf(text, m.index) });
    void start;
  }
  return out;
}

/** Markdown リンクと裸の URL */
export function extractLinks(text) {
  const out = [];
  const seen = new Set();
  const re = /(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m;
  while ((m = re.exec(text))) {
    out.push({ text: m[2], url: m[3], index: m.index, line: lineOf(text, m.index), image: m[1] === '!' });
    seen.add(m.index + m[0].indexOf(m[3]));
  }
  const bare = new RegExp(URL_RE.source, 'g');
  while ((m = bare.exec(text))) {
    if (seen.has(m.index)) continue;
    out.push({ text: '', url: m[0].replace(/[.,;:!?]+$/, ''), index: m.index, line: lineOf(text, m.index), image: false });
  }
  return out.sort((a, b) => a.index - b.index);
}

export function hostOf(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return '';
  }
}

export function hasJapanese(s) {
  return /[぀-ヿ㐀-鿿]/.test(s);
}

/** 本文(マスク済み)を文に分ける。見出し記号・箇条書き記号・強調記号は落とす */
export function sentences(text, { joinSoftBreaks = false } = {}) {
  let cleaned = maskMarkdown(text)
    .replace(/^[ \t]*#{1,6}[ \t]+.*$/gm, '') // 見出しは文ではない
    .replace(/^[ \t]*\|.*$/gm, '');
  // 段落内の折り返し(ソフト改行)を連結する。箇条書き・引用・見出しの行頭は連結しない
  if (joinSoftBreaks) cleaned = cleaned.replace(/([^\n])\n(?!\n|[ \t]*(?:[-*+]|\d+[.)])[ \t]|[ \t]*[#>|])/g, '$1');
  cleaned = cleaned
    .replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/gm, '')
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .replace(/[*_~]+/g, '');
  const out = [];
  const re = /[^。．！？!?\n]+[。．！？!?]?/g;
  let m;
  while ((m = re.exec(cleaned))) {
    const s = m[0].trim();
    if (s) out.push({ text: s, line: lineOf(cleaned, m.index) });
  }
  return out;
}

/** 空白を除いた文字数(本文の実質量。コードは含み、URL とリンク先は除く) */
export function countChars(text) {
  return maskMarkdown(text, { fenced: false, inline: false }).replace(/\s+/g, '').length;
}

/** 散文だけの文字数(コード・URL・HTML を除く) */
export function countProseChars(text) {
  return maskMarkdown(text).replace(/\s+/g, '').length;
}

/** 正規表現の配列をコンパイルする(policy の JSON から) */
export function compilePatterns(list, flags = 'g') {
  return (list || []).map((p) => (p instanceof RegExp ? p : new RegExp(p, flags)));
}

/**
 * CommonMark で閉じない強調(**)を見つける。
 * 「**文。 **次の文**」のように閉じ側の ** の前に空白があると、閉じられずに
 * アスタリスクがそのまま表示される。段落ごとに描画して残った ** を検出し、
 * 段落内では ** の数が奇数の行(閉じられない行)を報告する。
 * 戻り値: [{ line, text }]
 */
export function findUnclosedStrong(body, bodyLine = 1) {
  const out = [];
  const masked = maskMarkdown(body.replace(/\r\n/g, '\n'), { inline: false, links: false, urls: false, html: false, frontmatter: false });
  const parts = masked.split(/(\n[ \t]*\n+)/);
  let offset = 0;
  for (const part of parts) {
    if (!/^\n[ \t]*\n+$/.test(part) && part.includes('**')) {
      const html = marked.parse(part, { gfm: true, breaks: false });
      if (/\*\*/.test(html.replace(/<code>[\s\S]*?<\/code>/g, ''))) {
        const lines = part.split('\n');
        // 行単位でも描画し、単独で ** が残る行(壊れている行)を特定する
        let idx = lines.findIndex((l) => l.includes('**') && /\*\*/.test(marked.parse(l, { gfm: true }).replace(/<code>[\s\S]*?<\/code>/g, '')));
        if (idx < 0) idx = lines.findIndex((l) => l.includes('**'));
        const line = bodyLine + masked.slice(0, offset).split('\n').length - 1 + Math.max(idx, 0);
        out.push({ line, text: (lines[Math.max(idx, 0)] || part).trim().slice(0, 60) });
      }
    }
    offset += part.length;
  }
  return out;
}

// ---------------------------------------------------------------- report

export class Report {
  constructor(name) {
    this.name = name;
    this.items = [];
    this.files = new Set();
    this.notes = [];
  }

  file(f) {
    this.files.add(f);
  }

  add(severity, file, code, message, line) {
    this.items.push({ severity, file, code, message, line: line ?? null });
  }

  error(file, code, message, line) {
    this.add('error', file, code, message, line);
  }

  warn(file, code, message, line) {
    this.add('warning', file, code, message, line);
  }

  note(message) {
    this.notes.push(message);
  }

  get errors() {
    return this.items.filter((i) => i.severity === 'error');
  }

  get warnings() {
    return this.items.filter((i) => i.severity === 'warning');
  }

  merge(other) {
    for (const f of other.files) this.files.add(f);
    this.items.push(...other.items);
    this.notes.push(...other.notes);
    return this;
  }

  summary() {
    return `${this.name}: files ${this.files.size}, errors ${this.errors.length}, warnings ${this.warnings.length}`;
  }

  print({ quiet = false } = {}) {
    for (const n of this.notes) console.log(`  注意: ${n}`);
    const items = quiet ? this.errors : this.items;
    const sorted = [...items].sort((a, b) => (a.file === b.file ? (a.line ?? 0) - (b.line ?? 0) : a.file < b.file ? -1 : 1));
    for (const i of sorted) {
      const mark = i.severity === 'error' ? '✖' : '⚠';
      const loc = i.line ? `${i.file}:${i.line}` : i.file;
      console.log(`  ${mark} ${loc} [${i.code}] ${i.message}`);
    }
    console.log(this.summary());
  }

  toJSON() {
    return { name: this.name, files: [...this.files], errors: this.errors, warnings: this.warnings, notes: this.notes };
  }

  write(file) {
    const p = abs(file);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(this.toJSON(), null, 2), 'utf8');
  }

  exitCode({ strict = false } = {}) {
    if (this.errors.length) return 1;
    if (strict && this.warnings.length) return 1;
    return 0;
  }
}

// ---------------------------------------------------------------- cli

const VALUE_KEYS = /^(report|channel|scope|id|out|output|book|only|report-dir|before|after|post-id)$/;

export function parseArgs(argv = process.argv.slice(2)) {
  const flags = new Set();
  const values = new Map();
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const eq = key.indexOf('=');
      if (eq >= 0) values.set(key.slice(0, eq), key.slice(eq + 1));
      else if (VALUE_KEYS.test(key) && i + 1 < argv.length && !argv[i + 1].startsWith('--')) values.set(key, argv[++i]);
      else flags.add(key);
    } else {
      positional.push(a);
    }
  }
  return { flags, values, positional };
}

export function isMain(importMetaUrl) {
  return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(importMetaUrl));
}

/** 各チェッカーの main の定型: 実行 → 表示 → レポート → 終了コード */
export function finish(report, args) {
  report.print({ quiet: args.flags.has('quiet') });
  const out = args.values.get('report');
  if (out) report.write(out);
  process.exit(report.exitCode({ strict: args.flags.has('strict') }));
}
