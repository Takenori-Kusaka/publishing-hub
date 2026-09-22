// 生成AIの利用を読者に明示する規則(開示)。各チェッカーから呼ばれる共通部品です。
//
// 置き場所と文言の根拠は docs/ai-disclosure.md にあります。今の規則は次のとおりです。
//
//   冒頭の告知  本文の最初の数行に、生成AIを使ったことと人が確認したことを 1 文で書く。ツール名・モデル名は書かない。
//               Zenn は :::message、Qiita は :::note、note は引用(>)で囲む。本は最初の章に置く。
//               検査が見るのは告知の有無と位置で、文の数とツール名の有無は見ない。
//   末尾の宣言  置かない。検査も求めない(lint/policies/disclosure.json の channels で declaration.required が false)。
//               宣言の見出し(declaration.headings)の節が残っていればエラー。本は告知と同じく最初の章だけを見る。
//   SNS         本文には開示を書かない。書いてあればエラー(SOCIAL_AI_DISCLOSURE_UNNEEDED)。
//
// 宣言節と、宣言と共著記録(Co-Authored-By)の突合を検査するコードは残してあり、
// declaration.required を false にしていない媒体でだけ動きます(今はありません)。ただし SNS の本文に
// 開示の文が残っているときは、その文にも共著記録にある生成AIの名前を求めます(SOCIAL_AI_DISCLOSURE)。
// 規則の値は lint/policies/disclosure.json にあります。報告の規則コードはチェッカーごとの Z8 / Q11 / N9 です。
// 書かれたことが事実どおりかは、機械では判定できないため人が確認します。

import { readJson, readText, matchesAny, maskMarkdown, headings, exists, splitFrontmatter, fencedBlocks } from './lib.mjs';
import { hasFullHistory, git, trailerNames, showAt, previousVersion } from './git-baseline.mjs';

const POLICY = 'lint/policies/disclosure.json';

/** 文の区切り(句点・感嘆符・疑問符の後ろ、または改行) */
const SENTENCE_SPLIT = new RegExp('(?<=[。！？!?])|' + String.fromCharCode(10));
let cached = null;

export function loadDisclosurePolicy() {
  if (!cached) cached = readJson(POLICY);
  return cached;
}

const toolRules = (policy) => policy.declaration.trailer_tools?.tools || [];

/** 共著者名が生成AIか(trailer_tools の trailer に当たるか) */
export function isAiAuthor(name, policy = loadDisclosurePolicy()) {
  return toolRules(policy).some((t) => new RegExp(t.trailer, 'i').test(name));
}

function ruleFor(name, policy) {
  return toolRules(policy).find((t) => new RegExp(t.trailer, 'i').test(name));
}

/**
 * 共著者名から、宣言に求めるモデル名(数字を含む語)。
 * 「Claude Opus 5 (1M context)」→ ["Opus 5"]、「Gemini CLI (gemini-3.7-flash)」→ ["gemini-3.7-flash"]、「Gemini CLI」→ []
 */
export function modelTokens(name, rule, policy = loadDisclosurePolicy()) {
  const a = policy.declaration.attribution || {};
  const ignore = a.ignore_parentheticals ? new RegExp(a.ignore_parentheticals, 'i') : null;
  const extras = [...String(name).matchAll(/\(([^)]*)\)/g)].map((m) => m[1].trim()).filter((x) => /\d/.test(x) && !(ignore && ignore.test(x)));
  const plain = String(name).replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  let base = rule ? plain.replace(new RegExp(rule.trailer, 'ig'), '').replace(/\b(CLI|Code)\b/g, '').replace(/\s+/g, ' ').trim() : plain;
  if (/\d/.test(base) && !/[A-Za-z]/.test(base)) base = plain; // 「GPT-5」は「-5」ではなく名前ごと求める
  return [...(/\d/.test(base) ? [base] : []), ...extras];
}

function normalizeForCompare(t) {
  return String(t)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 開示の枠(Markdown は冒頭の告知と末尾の宣言、SNS の YAML は開示の文)を除けば同じ原稿か */
export function sameExceptDisclosure(before, after, file, policy = loadDisclosurePolicy()) {
  const strip = /\.ya?ml$/i.test(String(file)) ? (t) => stripDisclosureSentences(t, policy) : (t) => stripDisclosure(t, policy);
  return normalizeForCompare(strip(before)) === normalizeForCompare(strip(after));
}

const recordsCache = new Map();

/**
 * この原稿を変更したコミット(新しい順)の { sha, parent, coAuthors, disclosureOnly }。
 * disclosureOnly は、生成AIが共著のコミットが開示の枠だけを変えたとき true。git が使えないか履歴が浅ければ null
 */
export function coAuthorRecords(file, policy = loadDisclosurePolicy()) {
  const f = String(file).replace(/\\/g, '/');
  if (recordsCache.has(f)) return recordsCache.get(f);
  let out = null;
  if (hasFullHistory()) {
    try {
      const raw = git(['log', '--format=%H%x1f%P%x1f%(trailers:key=Co-Authored-By,valueonly,separator=%x1d)%x1e', '--', f]);
      out = raw
        .split('\x1e')
        .map((r) => r.replace(/^\s+/, ''))
        .filter(Boolean)
        .map((r) => {
          const [sha, parents, co] = r.split('\x1f');
          return { sha, parent: String(parents || '').trim().split(' ')[0] || null, coAuthors: trailerNames(co), disclosureOnly: false };
        });
      for (const r of out) {
        if (!r.parent || !r.coAuthors.some((a) => isAiAuthor(a, policy))) continue;
        const before = showAt(r.parent, f);
        const after = showAt(r.sha, f);
        if (before !== null && after !== null) r.disclosureOnly = sameExceptDisclosure(before, after, f, policy);
      }
    } catch {
      out = null;
    }
  }
  recordsCache.set(f, out);
  return out;
}

/** このファイルを変更したコミットの共著者名(Co-Authored-By の名前部分)。git が使えないか履歴が浅ければ null */
export function coAuthors(file) {
  const r = coAuthorRecords(file);
  return r ? [...new Set(r.flatMap((x) => x.coAuthors))] : null;
}

/** 本文を変えたコミットの共著者(開示の枠だけを変えたコミットを除く)。records が null なら null */
export function bodyCoAuthors(records) {
  return records ? [...new Set(records.filter((r) => !r.disclosureOnly).flatMap((r) => r.coAuthors))] : null;
}

/** 共著記録にあるのに、宣言(text)に名前がない生成AI。model: true ならモデル名まで求める。検査できないときは null */
export function missingCoAuthorTools(file, text, policy = loadDisclosurePolicy(), authors = bodyCoAuthors(coAuthorRecords(file, policy)), { model = false } = {}) {
  const rules = policy.declaration.trailer_tools?.tools;
  if (!rules || !authors) return null;
  const said = String(text).replace(/\s+/g, ' ');
  const lower = said.toLowerCase();
  const missing = [];
  for (const r of rules) {
    for (const a of authors.filter((x) => new RegExp(r.trailer, 'i').test(x))) {
      const familyOk = new RegExp(r.require).test(said);
      const modelOk = !model || modelTokens(a, r, policy).every((t) => lower.includes(t.toLowerCase()));
      if (!familyOk || !modelOk) missing.push(a);
    }
  }
  return [...new Set(missing)];
}

/** 開示の対象外として登録された原稿なら理由を返す */
export function exemptReason(file, policy = loadDisclosurePolicy()) {
  for (const [glob, reason] of Object.entries(policy.exempt?.entries || {})) {
    if (matchesAny(String(file).replace(/\\/g, '/'), [glob])) return reason || '(理由なし)';
  }
  return null;
}

/** 1 文の中に「生成AI」と「確認/検証」がある = 開示の文 */
export function isDisclosureText(text, policy = loadDisclosurePolicy()) {
  return new RegExp(policy.notice.pattern).test(String(text || ''));
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function elementPattern(el, policy) {
  return el.pattern === '$TOOLS' ? `(${policy.tools.map(escapeRe).join('|')})` : el.pattern;
}

function blockAt(lines, i) {
  const block = [lines[i]];
  if (/^:::/.test(lines[i])) {
    for (let j = i + 1; j < lines.length; j++) {
      block.push(lines[j]);
      if (/^:::\s*$/.test(lines[j])) break;
    }
  } else if (/^>/.test(lines[i])) {
    for (let j = i + 1; j < lines.length && /^>/.test(lines[j]); j++) block.push(lines[j]);
  }
  return block;
}

/**
 * 冒頭の告知を探す。見つかれば { start, end, text }(本文の 0 始まりの行番号)。
 * 冒頭 within_lines 行以内に、媒体の書式(:::message など)で始まり開示の文を含むブロックがあること。
 */
export function findNotice(body, channel, policy = loadDisclosurePolicy()) {
  const lines = body.split('\n');
  const form = new RegExp(policy.notice.forms[channel]);
  const limit = Math.min(lines.length, policy.notice.within_lines);
  for (let i = 0; i < limit; i++) {
    if (!form.test(lines[i])) continue;
    const block = blockAt(lines, i);
    const text = block.join('\n');
    if (isDisclosureText(text, policy)) return { start: i, end: i + block.length - 1, text };
  }
  return null;
}

/** 冒頭以外も含めて、開示の文がある最初の行(0 始まり)。なければ -1 */
function firstDisclosureLine(body, policy) {
  const re = new RegExp(policy.notice.pattern);
  return body.split('\n').findIndex((l) => re.test(l));
}

function normalizeHeading(s) {
  return String(s).replace(/\s+#*\s*$/, '').trim();
}

/** 宣言の見出し(lint/policies/disclosure.json の declaration.headings。declaration のブロックごと無い場合も含め、定義がなければ「生成AIの利用について」) */
export function declarationHeadings(policy = loadDisclosurePolicy()) {
  const names = policy.declaration?.headings;
  return Array.isArray(names) && names.length ? names : ['生成AIの利用について'];
}

/**
 * 末尾の宣言節を探す。見つかれば { heading, levelOk, isLast, text, start, end }。
 * start / end は本文の 0 始まりの行番号。節は次の同じか上位の見出しの手前、なければ末尾まで。
 */
export function findDeclaration(body, channel, policy = loadDisclosurePolicy()) {
  const masked = maskMarkdown(body, { inline: false, links: false, urls: false, html: false, frontmatter: false });
  const hs = headings(masked);
  const names = declarationHeadings(policy);
  const idx = hs.findIndex((h) => names.includes(normalizeHeading(h.text)));
  if (idx < 0) return null;
  const h = hs[idx];
  const next = hs.slice(idx + 1).find((x) => x.level <= h.level);
  const lines = body.split('\n');
  const start = h.line - 1;
  const end = next ? next.line - 2 : lines.length - 1;
  // declaration のブロックが無い方針でも落ちない(宣言を求めない媒体でも毎回ここを通るため)
  const levels = policy.declaration?.heading_levels?.[channel] || [1, 2, 3];
  return {
    heading: h,
    levels,
    levelOk: levels.includes(h.level),
    isLast: idx === hs.length - 1,
    text: lines.slice(start, end + 1).join('\n'),
    start,
    end,
  };
}

/** 宣言の文(見出しの行を除き、。！？と改行で区切る。モデル名の「5.1」の . では区切らない) */
export function declarationSentences(text) {
  return String(text)
    .split(/(?<=[。！？])|\n/)
    .map((s) => s.trim())
    .filter((s) => s && !/^#{1,6}\s/.test(s));
}

function reviewOrResponsibility(policy) {
  const els = policy.declaration.elements.filter((e) => e.id === 'review' || e.id === 'responsibility');
  return els.length ? new RegExp(els.map((e) => `(?:${e.pattern})`).join('|')) : /(?!)/;
}

/**
 * 宣言で、ツールの規則 rule の名前を含む文と、それに続く文のまとまり。次にツール名を含む文か、
 * 確認や責任の文が来るまでを、同じツールの文として含める(「〜を使いました。本文の下書きに使っています。」の形)
 */
export function toolClauses(text, rule, policy = loadDisclosurePolicy()) {
  const ss = declarationSentences(text);
  const other = reviewOrResponsibility(policy);
  const named = (s) => toolRules(policy).some((r) => new RegExp(r.require).test(s));
  const own = new RegExp(rule.require);
  const out = [];
  for (let i = 0; i < ss.length; i++) {
    if (!own.test(ss[i])) continue;
    let clause = ss[i];
    let j = i + 1;
    while (j < ss.length && !named(ss[j]) && !other.test(ss[j])) clause += ss[j++];
    out.push(clause);
    i = j - 1;
  }
  return out;
}

/** いちばん外側の「」の中身と、閉じの直後の位置(入れ子の「」を含む見出しの引用を 1 つとして扱う) */
export function outerQuotes(s) {
  const out = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '「') {
      if (depth === 0) start = i;
      depth++;
    } else if (s[i] === '」' && depth > 0) {
      depth--;
      if (depth === 0) out.push({ text: s.slice(start + 1, i), end: i + 1 });
    }
  }
  return out;
}

const EXCERPT_SOURCE_RE = /((?:scripts|lint|social|test|platforms|docs|books|articles|\.github)\/[\w./-]+\.(?:mjs|cjs|js|ts|json|ya?ml|py|md|sh))/;

/** コードブロックの抜粋を、先頭 3 行に書いた出典のパスごとにまとめる(空白をそろえる) */
export function excerptsByPath(body) {
  const out = new Map();
  for (const b of fencedBlocks(String(body || ''))) {
    const p = EXCERPT_SOURCE_RE.exec(b.code.split('\n').slice(0, 3).join('\n'))?.[1];
    if (p) out.set(p, `${out.get(p) || ''}\n${b.code.replace(/\s+/g, ' ').trim()}`);
  }
  return out;
}

function toolLabel(text, rule) {
  const m = new RegExp(rule.require).exec(text);
  return m ? m[0] : rule.require;
}

/** 開示の枠だけを変えたコミットの共著者を、本文の作成・改訂に使ったと書いている文 */
export function misattributedAuthors(declText, records, policy = loadDisclosurePolicy()) {
  const a = policy.declaration.attribution;
  if (!a?.authoring_pattern || !records) return [];
  const body = new Set(bodyCoAuthors(records));
  const frameOnly = [...new Set(records.filter((r) => r.disclosureOnly).flatMap((r) => r.coAuthors))].filter((n) => !body.has(n) && isAiAuthor(n, policy));
  const authoring = new RegExp(a.authoring_pattern);
  const opener = a.opener_pattern ? new RegExp(a.opener_pattern, 'g') : null;
  const out = [];
  for (const n of frameOnly) {
    const rule = ruleFor(n, policy);
    const tokens = modelTokens(n, rule, policy).map((t) => t.toLowerCase());
    if (!tokens.length) continue;
    const clause = toolClauses(declText, rule, policy).find((c) => {
      const flat = c.replace(/\s+/g, ' ').toLowerCase();
      return tokens.every((t) => flat.includes(t)) && authoring.test(opener ? c.replace(opener, '') : c);
    });
    if (clause) out.push({ author: n, clause });
  }
  return out;
}

/**
 * 直前の版の宣言(baseDeclText)と比べた、ツールごとの文の変化。
 *   noPurpose  新しく書き足したツールの文に用途がない
 *   vague      新しく書き足したツールの範囲が総称(「全体の改訂」など)
 *   unscoped   新しく書き足したツールの文に、章・節・見出し・コードのパスなどの範囲がない
 *   rewritten  直前の版からあるツールの文が変わったのに、変えたコミットの共著者(committers)にそのツールがいない
 * headingTexts は原稿の見出し(見出しの語を範囲として認める)。
 */
export function declarationChanges(declText, baseDeclText, policy = loadDisclosurePolicy(), { headingTexts = [], committers = [], changedPaths = [], titleChanged = false } = {}) {
  const a = policy.declaration.attribution || {};
  const rules = toolRules(policy);
  const purpose = a.purpose_pattern ? new RegExp(a.purpose_pattern) : null;
  const scope = a.scope_pattern ? new RegExp(a.scope_pattern) : null;
  const vague = a.vague_pattern ? new RegExp(a.vague_pattern) : null;
  const flat = (s) => String(s).replace(/\s+/g, '');
  const key = (s) => String(s).replace(/^[\d０-９.．:：\s]+/, '').replace(/[「」『』"“”\s、。・]/g, '');
  const heads = headingTexts
    .map((h) => String(h).replace(/^[\d０-９.．:：\s]+/, '').trim())
    .filter((h) => [...h].length >= 4 && !policy.declaration.headings.includes(h));
  const headKeys = new Set(headingTexts.map(key));
  const out = { noPurpose: [], vague: [], unscoped: [], rewritten: [], missingPaths: [], missingTitle: [], unknownHeadings: [] };
  for (const r of rules.filter((x) => new RegExp(x.require).test(declText))) {
    const tool = toolLabel(declText, r);
    const clauses = toolClauses(declText, r, policy);
    if (!new RegExp(r.require).test(baseDeclText)) {
      if (purpose && !clauses.some((c) => purpose.test(c))) out.noPurpose.push(tool);
      const v = vague ? clauses.map((c) => vague.exec(c)).find(Boolean) : null;
      if (v) out.vague.push({ tool, found: v[0] });
      else if (scope && !clauses.some((c) => scope.test(c) || heads.some((h) => flat(c).includes(flat(h))))) out.unscoped.push(tool);
      const joined = clauses.join('');
      const paths = changedPaths.filter((p) => !joined.includes(p));
      if (paths.length) out.missingPaths.push({ tool, paths });
      if (titleChanged && !/題名|タイトル/.test(joined)) out.missingTitle.push(tool);
      for (const c of clauses) {
        for (const q of outerQuotes(c)) {
          if (/節|章|見出し/.test(c.slice(q.end, q.end + 6)) && !headKeys.has(key(q.text))) out.unknownHeadings.push({ tool, quote: q.text });
        }
      }
    } else {
      const before = toolClauses(baseDeclText, r, policy).map(flat).join('\n');
      const after = clauses.map(flat).join('\n');
      if (before !== after && !committers.some((n) => new RegExp(r.trailer, 'i').test(n))) out.rewritten.push(tool);
    }
  }
  return out;
}

/**
 * Markdown 原稿(Zenn の記事と本の最初の章、Qiita、note)の開示を検査して report に積む。
 * @param code チェッカーごとの規則コード(Z8 / Q11 / N9)
 */
export function checkManuscriptDisclosure(report, file, body, bodyLine, channel, code, policy = loadDisclosurePolicy()) {
  if (exemptReason(file, policy)) return;
  const at = (i) => bodyLine + i;
  const n = policy.notice.within_lines;

  if (!findNotice(body, channel, policy)) {
    const other = firstDisclosureLine(body, policy);
    if (other >= n) {
      report.error(file, code, `生成AIの告知が冒頭 ${n} 行より後にあります。読者が最初に目にする本文の冒頭に、${policy.notice.examples[channel]} の形で置いてください(docs/ai-disclosure.md)`, at(other));
    } else {
      report.error(file, code, `本文の冒頭 ${n} 行以内に生成AIの告知がありません。${policy.notice.examples[channel]} の形で、生成AIを使ったことと人が確認したことを書いてください(docs/ai-disclosure.md)`, bodyLine);
    }
  }

  // 媒体ごとの上書き。宣言節を求めない媒体(channels.<媒体>.declaration.required が false)は、
  // 冒頭の告知だけで足りるものとして、ここで終える。宣言は置かない決まりなので、見出しが残っていればエラーにする
  // (2026-09-21: 宣言をやめた後も、それより前に書いた原稿がツール名・モデル名入りの宣言を残したまま公開された)。
  if (policy.channels?.[channel]?.declaration?.required === false) {
    const left = findDeclaration(body, channel, policy);
    if (left) {
      report.error(file, code, `末尾の宣言「${normalizeHeading(left.heading.text)}」の節が残っています。この媒体では宣言を置きません。生成AIの開示は冒頭の告知で果たすので、見出しごと節を消してください。使ったツールの記録はコミットの共著記録(Co-Authored-By)に残します(docs/ai-disclosure.md 2.2)`, at(left.start));
    }
    return;
  }

  const decl = findDeclaration(body, channel, policy);
  const title = policy.declaration.headings[0];
  if (!decl) {
    report.error(file, code, `末尾に見出し「${title}」の宣言節がありません。使ったツール名・用途と範囲・人による確認・責任の所在を書いてください(要素は lint/policies/disclosure.json の declaration.elements。宣言を求めるかは同じファイルの channels で決まります)`);
    return;
  }
  const line = at(decl.start);
  if (!decl.levelOk) {
    report.error(file, code, `宣言節「${title}」の見出しレベル h${decl.heading.level} は使えません(h${decl.levels.join(' / h')})`, line);
  }
  if (policy.declaration.must_be_last_heading && !decl.isLast) {
    report.error(file, code, `宣言節「${title}」を最後の見出しにしてください。読者が本文を読み終えた位置に置きます`, line);
  }
  for (const el of policy.declaration.elements) {
    if (!new RegExp(elementPattern(el, policy)).test(decl.text)) {
      report.error(file, code, `宣言節「${title}」に「${el.label}」がありません。${el.hint}`, line);
    }
  }
  if (policy.declaration.attribution?.review_after_tools) {
    const ss = declarationSentences(decl.text);
    const other = reviewOrResponsibility(policy);
    const named = (s) => toolRules(policy).some((r) => new RegExp(r.require).test(s));
    const lastTool = ss.reduce((m, s, i) => (named(s) ? i : m), -1);
    const lastReview = ss.reduce((m, s, i) => (other.test(s) ? i : m), -1);
    if (lastTool >= 0 && lastReview >= 0 && lastReview < lastTool) {
      report.warn(file, code, `宣言節「${title}」で、人による確認と責任の文が、ツールの文より前にあります。確認と責任がすべてのツールの作業に掛かるよう、ツールの文をすべて書いた後に置いてください`, line);
    }
  }

  const records = coAuthorRecords(file, policy);
  const missing = missingCoAuthorTools(file, decl.text, policy, bodyCoAuthors(records), { model: true });
  if (missing && missing.length) {
    report.error(file, code, `宣言節「${title}」に、この原稿の本文を変えたコミットの共著記録(Co-Authored-By)にある生成AI(${missing.join('、')})の名前がありません。この原稿の作成・改訂に使ったツールを、共著記録にあるモデル名(例: Claude Opus 5、gemini-3.7-flash)まで含めてすべて書いてください`, line);
  }
  for (const m of misattributedAuthors(decl.text, records, policy)) {
    report.error(file, code, `宣言節「${title}」が、開示の枠(冒頭の告知と末尾の宣言)だけを変えたコミットの共著者 ${m.author} を、本文の作成・改訂に使ったと書いています(「${[...m.clause].slice(0, 50).join('')}…」)。そのモデルについては「生成AIの開示の追加に使いました」のように、実際に変えた範囲だけを書いてください`, line);
  }

  const prev = previousVersion(file);
  if (!prev) return;
  if (prev.committed && records) {
    const all = records.flatMap((r) => r.coAuthors);
    for (const r of toolRules(policy)) {
      if (!new RegExp(r.require).test(decl.text) || all.some((a) => new RegExp(r.trailer, 'i').test(a))) continue;
      report.error(file, code, `宣言節「${title}」にある ${toolLabel(decl.text, r)} が、この原稿を変更したコミットの共著記録(Co-Authored-By)にありません。改訂したコミットに "Co-Authored-By: <ツール名> (<モデル名>) <メール>" を付けてください。宣言から名前を消すのではなく、記録を残します`, line);
    }
  }
  const baseSplit = prev.text ? splitFrontmatter(prev.text) : null;
  const baseBody = baseSplit ? baseSplit.body ?? prev.text : '';
  const baseDecl = baseSplit ? findDeclaration(baseBody, channel, policy) : null;
  if (!baseDecl) return;
  const oldExcerpts = excerptsByPath(baseBody);
  const changedPaths = [...excerptsByPath(body)].filter(([p, c]) => oldExcerpts.get(p) !== c).map(([p]) => p);
  const currentTitle = exists(file) ? splitFrontmatter(readText(file)).frontmatter?.title : null;
  const baseTitle = baseSplit.frontmatter?.title;
  const ch = declarationChanges(decl.text, baseDecl.text, policy, {
    headingTexts: headings(body).map((h) => h.text),
    committers: prev.committed ? prev.commit?.coAuthors || [] : [],
    changedPaths,
    titleChanged: Boolean(currentTitle && baseTitle && String(currentTitle).trim() !== String(baseTitle).trim()),
  });
  for (const m of ch.missingPaths) {
    report.error(file, code, `宣言節「${title}」に新しく加えた ${m.tool} の文に、改訂したコードの抜粋の出典(${m.paths.join('、')})がありません。変えた抜粋のパスを範囲として書いてください`, line);
  }
  for (const t of ch.missingTitle) {
    report.error(file, code, `宣言節「${title}」に新しく加えた ${t} の文に、題名を変えたことが書かれていません。「題名」を範囲に含めてください`, line);
  }
  for (const u of ch.unknownHeadings) {
    report.warn(file, code, `宣言節「${title}」の ${u.tool} の文が引く「${u.quote}」は、原稿の見出しにありません。節の名前は見出しのとおりに引いてください`, line);
  }
  for (const t of ch.noPurpose) {
    report.error(file, code, `宣言節「${title}」に新しく加えた ${t} の文に用途がありません。「〜を改訂しました」「〜に使いました」の形で、何をしたかを書いてください`, line);
  }
  for (const v of ch.vague) {
    report.error(file, code, `宣言節「${title}」に新しく加えた ${v.tool} の範囲が「${v.found}」という総称です。改訂した章・節の見出しか番号、題名、コードのパスを具体的に書いてください`, line);
  }
  for (const t of ch.unscoped) {
    report.error(file, code, `宣言節「${title}」に新しく加えた ${t} の文に、改訂した範囲(章・節の見出しか番号、題名、コードのパス)がありません`, line);
  }
  for (const t of ch.rewritten) {
    report.warn(file, code, `宣言節「${title}」の既存のツール(${t})の文を書き換えています。そのツールの用途を確かめていないなら元の文のまま残し、自分の関与は別の文で書き足してください(書き換えたコミットの共著記録に ${t} がありません)`, line);
  }
}

/**
 * 開示のブロック(冒頭の告知と末尾の宣言節)を取り除いた本文を返す。
 * 媒体間の重複率(V2 / V2b / V7)を測るときに、どの媒体にも同じ文言で入る開示を数えないために使う。
 */
export function stripDisclosure(text, policy = loadDisclosurePolicy()) {
  const lines = String(text).split('\n');
  const drop = new Set();
  for (let i = 0; i < lines.length; i++) {
    // 閉じの「:::」を次のブロックの開始と読むと、そこから末尾までを 1 つのブロックとして消してしまう
    if (!/^(:::|>)/.test(lines[i]) || /^:::\s*$/.test(lines[i])) continue;
    const block = blockAt(lines, i);
    if (isDisclosureText(block.join('\n'), policy)) for (let j = i; j < i + block.length; j++) drop.add(j);
    i += block.length - 1;
  }
  const masked = maskMarkdown(text, { inline: false, links: false, urls: false, html: false, frontmatter: false }).split('\n');
  const headingRe = /^(#{1,6})\s+(.+?)\s*#*$/;
  for (let i = 0; i < masked.length; i++) {
    const m = headingRe.exec(masked[i]);
    if (!m || !policy.declaration.headings.includes(normalizeHeading(m[2]))) continue;
    const level = m[1].length;
    let j = i + 1;
    for (; j < masked.length; j++) {
      const n = headingRe.exec(masked[j]);
      if (n && n[1].length <= level) break;
    }
    for (let k = i; k < j; k++) drop.add(k);
  }
  return lines.filter((_, i) => !drop.has(i)).join('\n');
}

/** 開示の文(「生成AI … 確認」を含む文)を取り除く。SNS の文数や段落数を数えるときに使う */
export function stripDisclosureSentences(text, policy = loadDisclosurePolicy()) {
  const re = new RegExp(`[^。！？!?\\n]*(?:${policy.notice.pattern})[^。！？!?\\n]*[。！？!?]?`, 'g');
  return String(text || '').replace(re, '');
}

/** SNS 原稿の開示を検査し、[{ code, message }] を返す(editorial.mjs から呼ばれる) */
export function checkSocialDisclosure(data, policy = loadDisclosurePolicy()) {
  const out = [];
  if (exemptReason(`social/posts/${data.id}.yaml`, policy)) return out;
  const s = policy.social;

  // 開示を本文に書かない媒体では、書いてある文を見つけて外させる。文字数の枠を論点に使うため。
  const disclosureSentences = (text) => String(text || '').split(SENTENCE_SPLIT).map((x) => x.trim()).filter((x) => isDisclosureText(x, policy));
  if (data.linkedin?.enabled && s.linkedin?.forbidden) {
    for (const sent of disclosureSentences(data.linkedin.text)) {
      out.push({ code: 'SOCIAL_AI_DISCLOSURE_UNNEEDED', message: `linkedin.text に生成AIの開示の文「${sent.slice(0, 40)}」があります。SNS の本文には書かず、導線の先(正本・Qiita・note)の告知で果たしてください。末尾の宣言は置きません(docs/ai-disclosure.md)` });
    }
  }
  if (data.bluesky?.enabled && s.bluesky?.forbidden) {
    (data.bluesky.posts || []).forEach((post, i) => {
      for (const sent of disclosureSentences(post.text)) {
        out.push({ code: 'SOCIAL_AI_DISCLOSURE_UNNEEDED', message: `bluesky.posts[${i}] に生成AIの開示の文「${sent.slice(0, 40)}」があります。SNS の本文には書かず、導線の先(正本・Qiita・note)の告知で果たしてください。末尾の宣言は置きません(docs/ai-disclosure.md)` });
      }
    });
  }

  if (data.linkedin?.enabled && s.linkedin?.required && !isDisclosureText(data.linkedin.text, policy)) {
    out.push({ code: 'SOCIAL_AI_DISCLOSURE', message: `linkedin.text に生成AIの利用の明示がありません。「${s.linkedin.example}」のように 1 文で書いてください(docs/ai-disclosure.md)` });
  }
  const yamlPath = [`social/posts/${data.id}.yaml`, `social/posts/${data.id}.yml`].find((p) => exists(p));
  if (yamlPath) {
    const texts = [data.linkedin?.enabled ? data.linkedin.text : '', ...((data.bluesky?.enabled && data.bluesky.posts) || []).map((p) => p.text)].map((x) => String(x || ''));
    const sentences = texts.join('\n').split(/(?<=[。！？!?])|\n/).filter((x) => isDisclosureText(x, policy)).join('\n');
    const missing = sentences ? missingCoAuthorTools(yamlPath, sentences, policy, bodyCoAuthors(coAuthorRecords(yamlPath, policy))) : null;
    if (missing && missing.length) {
      out.push({ code: 'SOCIAL_AI_DISCLOSURE', message: `開示の文に、この原稿のコミットの共著記録(Co-Authored-By)にある生成AI(${missing.join('、')})の名前がありません` });
    }
  }
  if (data.bluesky?.enabled && s.bluesky?.required) {
    const posts = data.bluesky.posts || [];
    const targets = s.bluesky.scope === 'first' ? posts.slice(0, 1) : posts;
    if (posts.length && !targets.some((p) => isDisclosureText(p.text, policy))) {
      out.push({ code: 'SOCIAL_AI_DISCLOSURE', message: `bluesky の${s.bluesky.scope === 'first' ? '1 投稿目' : 'スレッド'}に生成AIの利用の明示がありません。「${s.bluesky.example}」のように書いてください(docs/ai-disclosure.md)` });
    }
  }
  return out;
}
