// 生成AIの利用を読者に明示する規則(開示)。各チェッカーから呼ばれる共通部品です。
//
// 置き場所と文言の根拠は docs/ai-disclosure.md にあります。要点は次の 2 層です。
//
//   冒頭の告知  本文の最初の数行に、生成AIを使ったことと人が確認したことを 1〜2 文で書く。
//               Zenn は :::message、Qiita は :::note、note は引用(>)で囲む。
//   末尾の宣言  最後の見出し「生成AIの利用について」に、ツール名・用途と範囲・人による確認・
//               責任の所在の 4 要素を書く。
//
// 本は序文にあたる最初の章に置き、SNS は本文に 1 文で書きます。
// 規則の値は lint/policies/disclosure.json にあります。
//
// この検査が見るのは「書いてあるか」と「どこにあるか」だけです。書かれたツール名や用途が
// 事実どおりかは機械では判定できないため、人が確認します。

import { readJson, matchesAny, maskMarkdown, headings } from './lib.mjs';

const POLICY = 'lint/policies/disclosure.json';
let cached = null;

export function loadDisclosurePolicy() {
  if (!cached) cached = readJson(POLICY);
  return cached;
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

/**
 * 末尾の宣言節を探す。見つかれば { heading, levelOk, isLast, text, start, end }。
 * start / end は本文の 0 始まりの行番号。節は次の同じか上位の見出しの手前、なければ末尾まで。
 */
export function findDeclaration(body, channel, policy = loadDisclosurePolicy()) {
  const masked = maskMarkdown(body, { inline: false, links: false, urls: false, html: false, frontmatter: false });
  const hs = headings(masked);
  const names = policy.declaration.headings;
  const idx = hs.findIndex((h) => names.includes(normalizeHeading(h.text)));
  if (idx < 0) return null;
  const h = hs[idx];
  const next = hs.slice(idx + 1).find((x) => x.level <= h.level);
  const lines = body.split('\n');
  const start = h.line - 1;
  const end = next ? next.line - 2 : lines.length - 1;
  const levels = policy.declaration.heading_levels[channel] || [1, 2, 3];
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

  const decl = findDeclaration(body, channel, policy);
  const title = policy.declaration.headings[0];
  if (!decl) {
    report.error(file, code, `末尾に見出し「${title}」の宣言節がありません。使ったツール名・用途と範囲・人による確認・責任の所在を書いてください(docs/ai-disclosure.md)`);
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
}

/**
 * 開示のブロック(冒頭の告知と末尾の宣言節)を取り除いた本文を返す。
 * 媒体間の重複率(V2 / V2b / V7)を測るときに、どの媒体にも同じ文言で入る開示を数えないために使う。
 */
export function stripDisclosure(text, policy = loadDisclosurePolicy()) {
  const lines = String(text).split('\n');
  const drop = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (!/^(:::|>)/.test(lines[i])) continue;
    const block = blockAt(lines, i);
    if (isDisclosureText(block.join('\n'), policy)) for (let j = i; j < i + block.length; j++) drop.add(j);
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
  if (data.linkedin?.enabled && s.linkedin?.required && !isDisclosureText(data.linkedin.text, policy)) {
    out.push({ code: 'SOCIAL_AI_DISCLOSURE', message: `linkedin.text に生成AIの利用の明示がありません。「${s.linkedin.example}」のように 1 文で書いてください(docs/ai-disclosure.md)` });
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
