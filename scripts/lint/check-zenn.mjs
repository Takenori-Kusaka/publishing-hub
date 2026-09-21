// Zenn(正本)の構造を検査する。
//
//   node scripts/lint/check-zenn.mjs [--strict] [--report out.json]
//
// 正本の題材はシステムに限らず、広義の技術すべてです。ソフトウェアの設計書と、
// 一次資料に基づく歴史・社会科学の推論とでは「完全な正本」の要件が違います。
// そこで作品(本・記事)ごとに genre を割り当て(lint/policies/zenn.json)、
// genre が要求する要素と、作品が自ら宣言した記述規範を検査します。
//
//   Z1  記事の slug と frontmatter(title / emoji / type / topics / published)
//   Z2  Markdown の描画事故(画像の絶対パスと実在、Mermaid 2000 字、段落直後の --- は見出しに化ける、言語名のないフェンス)
//   Z3  genre が要求する要素が作品にある(コード・図・リポジトリ導線・出典リンク・本編への導線)
//   Z4  作品固有の記述規範(conventions)。正規表現のほか、見出し番号の連番・脚注の対応を検査できる
//   Z5  genre が未設定の本(新しい本を追加したら policy に登録する)
//   Z6  本の章ラベルへの参照(付録・記事から [第Ⅴ部-8](…/viewer/slug) の形で参照するとき、ラベルと章が一致し実在する)
//   Z7  閉じない強調(**文。 **次** のように空白の位置が違うと太字にならずアスタリスクが表示される)
//   Z8  生成AIの利用の開示(記事と本の最初の章に、冒頭の :::message。末尾の宣言は置かない。docs/ai-disclosure.md)
//   Z9  作業環境のパス(C:\Users\…、/home/…)を書かない(コードブロックの中も見る)
//   Z10 原稿を LF の改行でコミットする(git の index を見る)
//   Z13 メタ談話(読者や本文について語る文。書くときに念頭に置くことであって本文に出さない。問いは疑問文でそのまま置く)
//
// 本の章構成(config.yaml との突合)は check-books.mjs、図の可読性は check-figures.mjs、
// 本の中の章ラベルのリンクは check-links.mjs が担います。

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, abs, readText, readJson, listFiles, exists, matchesAny, readYaml, splitFrontmatter, fencedBlocks, extractLinks, maskMarkdown, findUnclosedStrong, Report, parseArgs, finish, isMain } from './lib.mjs';
// path は画像の実在確認に使う

import { checkManuscriptDisclosure } from './disclosure.mjs';
import { checkLocalPaths } from './local-paths.mjs';
import { checkIndexEol } from './git-eol.mjs';

const POLICY = 'lint/policies/zenn.json';
const EXPRESSIONS = 'lint/policies/expressions.json';
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const IMAGE_MAX_BYTES = 3 * 1024 * 1024;
const MERMAID_MAX_CHARS = 2000;
const LABEL_RE = /第[ⅠⅡⅢⅣⅤ]部[A-D]?-\d+/g;

/** 正本に求める要素の検出 */
export function countElements(text) {
  const { body } = splitFrontmatter(text);
  const blocks = fencedBlocks(body);
  const links = extractLinks(body);
  return {
    code_block: blocks.filter((b) => b.lang !== 'mermaid' && b.lang !== 'text' && b.lang !== '').length,
    figure: blocks.filter((b) => b.lang === 'mermaid').length + (body.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length,
    repo_link: links.filter((l) => /^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/.test(l.url)).length,
    citation_link: (body.match(/\[\s*\[\s*\d+\s*\]\s*\]\(https?:\/\//g) || []).length,
    external_link: links.filter((l) => /^https?:\/\//.test(l.url) && !/zenn\.dev/.test(l.url)).length,
    book_link: links.filter((l) => /^https?:\/\/zenn\.dev\/[^/]+\/books\//.test(l.url)).length,
  };
}

const ELEMENT_LABEL = {
  code_block: 'コードブロック(動作するコード)',
  figure: '図(Mermaid または画像)',
  repo_link: 'GitHub リポジトリへの導線',
  citation_link: '出典のインラインリンク [ [ n ] ](URL)',
  external_link: '外部の一次資料へのリンク',
  book_link: '本編(Zenn Book)への導線',
};

function checkRequires(report, file, genreId, genre, counts) {
  for (const [el, min] of Object.entries(genre.work_requires || {})) {
    if ((counts[el] || 0) < min) {
      report.error(file, 'Z3', `genre "${genreId}" の正本には ${ELEMENT_LABEL[el] || el} が ${min} 件以上必要です(現在 ${counts[el] || 0} 件)。${genre.description}`);
    }
  }
}

/** 本の章ラベル(title の先頭)→ slug。付録や記事からの参照の検査に使う */
const labelCache = new Map();
export function bookLabelMap(book) {
  if (labelCache.has(book)) return labelCache.get(book);
  const map = new Map();
  const slugs = new Set();
  const dir = abs(`books/${book}`);
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const slug = f.replace(/\.md$/, '');
      slugs.add(slug);
      const title = String(splitFrontmatter(readText(`books/${book}/${f}`)).frontmatter?.title ?? '');
      const m = /^(第[ⅠⅡⅢⅣⅤ]部[A-D]?-\d+|第0章|総括|はじめに)/.exec(title);
      if (m) map.set(slug, m[1]);
    }
  }
  const result = { slugs, labelOf: map, slugOf: new Map([...map].map(([s, l]) => [l, s])) };
  labelCache.set(book, result);
  return result;
}

/** Z6: 本の章への参照(リンクと裸のラベル) */
export function checkChapterRefs(report, file, body, bodyLine = 1) {
  const linkRe = /\[([^\]]*)\]\(https?:\/\/zenn\.dev\/[^/]+\/books\/([a-z0-9_-]+)\/viewer\/([a-z0-9_-]+)\)/g;
  const books = new Set();
  let m;
  while ((m = linkRe.exec(body))) {
    const [, text, book, slug] = m;
    const info = bookLabelMap(book);
    if (!info.slugs.size) continue; // このリポジトリにない本
    books.add(book);
    const line = bodyLine + body.slice(0, m.index).split('\n').length - 1;
    if (!info.slugs.has(slug)) {
      report.error(file, 'Z6', `本 "${book}" に章 "${slug}" がありません(リンク "${text}")`, line);
      continue;
    }
    const label = /^(第[ⅠⅡⅢⅣⅤ]部[A-D]?-\d+)/.exec(text.trim());
    if (label && info.labelOf.get(slug) && info.labelOf.get(slug) !== label[1]) {
      report.error(file, 'Z6', `リンク "${label[1]}" の先 ${slug} は「${info.labelOf.get(slug)}」です。章の統合・並べ替えでラベルが古くなっています(正しい章は ${info.slugOf.get(label[1]) || '不明'})`, line);
    }
  }
  // 裸のラベル(本を 1 冊でも参照している記事に限る)
  if (books.size !== 1) return;
  const info = bookLabelMap([...books][0]);
  const prose = maskMarkdown(body);
  for (const mm of prose.matchAll(LABEL_RE)) {
    if (!info.slugOf.has(mm[0])) {
      report.error(file, 'Z6', `章ラベル "${mm[0]}" は本に存在しません(章の統合・並べ替えで番号が変わっています)`, bodyLine + prose.slice(0, mm.index).split('\n').length - 1);
    }
  }
}

/** Z13: メタ談話(読者や本文について語る文) */
export function checkMetadiscourse(report, file, body, bodyLine, expressions, optInSeverity = null) {
  if (optInSeverity === 'off') return;
  const sev = optInSeverity || expressions.metadiscourse?.severity?.zenn;
  if (!sev || sev === 'off') return;

  const lines = body.split('\n');
  const maskedLines = lines.map((l) => (/^\s*>/.test(l) ? ' '.repeat(l.length) : l));
  const maskedBody = maskedLines.join('\n');
  const prose = maskMarkdown(maskedBody);

  for (const p of expressions.metadiscourse.patterns) {
    if (!optInSeverity && p.default === 'off') continue;
    const re = new RegExp(p.pattern, 'g');
    let m;
    while ((m = re.exec(prose))) {
      const line = bodyLine + prose.slice(0, m.index).split('\n').length - 1;
      report.add(sev, file, 'Z13', `メタ談話「${m[0]}」（${p.label}）。読者や本文について語る文は本文に出さず、問いは疑問文でそのまま置いてください`, line);
    }
  }
}

/**
 * 作品固有の記述規範を 1 章に当てる。
 * target: raw(既定。frontmatter・コード込み) / body(コードだけ伏せる。リンク先は残す) / prose(コード・リンク先・URL を伏せる) / title
 */
export function checkConvention(report, file, text, fm, conv) {
  const title = String(fm?.title ?? '');
  if (conv.applies_to && !matchesAny(file, conv.applies_to)) return;
  if (conv.applies_to_title && !new RegExp(conv.applies_to_title).test(title)) return;
  if (conv.excludes && matchesAny(file, conv.excludes)) return;
  const sev = conv.severity || 'error';
  const subject =
    conv.target === 'title' ? title
    : conv.target === 'prose' ? maskMarkdown(text)
    : conv.target === 'body' ? maskMarkdown(text, { links: false, urls: false, html: false })
    : text;

  if (conv.kind === 'numbered-headings') {
    const level = conv.level || 3;
    const re = new RegExp(`^#{${level}} (\\d+)\\. `, 'gm');
    const nums = [...subject.matchAll(re)].map((x) => Number(x[1]));
    const expected = nums.map((_, i) => i + 1);
    if (nums.length && nums.some((n, i) => n !== expected[i])) {
      report.add(sev, file, 'Z4', `${conv.id}: ${conv.message}(現在 ${nums.join(', ')})`);
    }
    return;
  }
  if (conv.kind === 'footnotes-resolved') {
    const refs = new Set([...subject.matchAll(/\[\^([^\]\s]+)\](?!:)/g)].map((x) => x[1]));
    const defs = new Set([...subject.matchAll(/^\[\^([^\]\s]+)\]:/gm)].map((x) => x[1]));
    const missing = [...refs].filter((r) => !defs.has(r));
    const unused = [...defs].filter((d) => !refs.has(d));
    if (missing.length || unused.length) {
      report.add(sev, file, 'Z4', `${conv.id}: ${conv.message}(定義なし: ${missing.join(', ') || '-'} / 参照なし: ${unused.join(', ') || '-'})`);
    }
    return;
  }

  const flags = conv.flags || 'm';
  if (conv.must_match) {
    const re = new RegExp(conv.must_match, flags);
    const n = (subject.match(new RegExp(conv.must_match, flags.includes('g') ? flags : flags + 'g')) || []).length;
    if (!re.test(subject) || n < (conv.min_count || 1)) {
      report.add(sev, file, 'Z4', `${conv.id}: ${conv.message}`);
    }
  }
  if (conv.must_not_match) {
    const re = new RegExp(conv.must_not_match, flags.includes('g') ? flags : flags + 'g');
    let m;
    while ((m = re.exec(subject))) {
      const line = subject.slice(0, m.index).split('\n').length;
      report.add(sev, file, 'Z4', `${conv.id}: ${conv.message}(「${m[0].slice(0, 30)}」)`, conv.target === 'title' ? 1 : line);
      if (m[0] === '') re.lastIndex++;
    }
  }
}

function checkBody(report, file, body, bodyLine) {
  for (const m of body.matchAll(/```mermaid\r?\n([\s\S]*?)```/g)) {
    if (m[1].length > MERMAID_MAX_CHARS) report.error(file, 'Z2', `mermaid ブロックが ${m[1].length} 文字です(上限 ${MERMAID_MAX_CHARS})`, bodyLine + body.slice(0, m.index).split('\n').length - 1);
  }
  for (const m of body.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) {
    const url = m[1];
    const line = bodyLine + body.slice(0, m.index).split('\n').length - 1;
    if (/^https?:\/\//.test(url)) continue;
    if (!url.startsWith('/images/')) {
      report.error(file, 'Z2', `画像 "${url}" は /images/ から始まる絶対パスで書いてください`, line);
      continue;
    }
    const p = path.join(ROOT, url.replace(/^\//, ''));
    if (!fs.existsSync(p)) {
      report.error(file, 'Z2', `画像 "${url}" が見つかりません`, line);
      continue;
    }
    const ext = path.extname(p).toLowerCase();
    if (!IMAGE_EXT.has(ext)) report.error(file, 'Z2', `画像 "${url}" の拡張子 ${ext} は Zenn で扱えません`, line);
    const size = fs.statSync(p).size;
    if (size > IMAGE_MAX_BYTES) report.error(file, 'Z2', `画像 "${url}" が ${(size / 1024 / 1024).toFixed(1)}MB です(上限 3MB)`, line);
  }
  // 段落の直後の --- は CommonMark で setext 見出し(h2)になり、直前の段落が見出しとして描画される
  const masked = maskMarkdown(body, { inline: false, links: false, urls: false, html: false, frontmatter: false });
  const lines = masked.split('\n');
  for (let i = 1; i < lines.length; i++) {
    if (/^-{3,}\s*$/.test(lines[i]) && lines[i - 1].trim() !== '' && !/^\s*(\||#|-|\*|>|\d+\.)/.test(lines[i - 1]) && !/^\s*$/.test(lines[i - 1])) {
      report.error(file, 'Z2', `段落の直後に --- があります。空行を挟まないと直前の段落が見出し(h2)として描画されます`, bodyLine + i);
    }
  }
  for (const m of body.matchAll(/^(`{3,}|~{3,})[ \t]*$/gm)) {
    // 閉じフェンスと開きフェンスは交互に現れる。開き側(偶数番目)だけを見る
    const before = body.slice(0, m.index);
    const opens = (before.match(/^(`{3,}|~{3,})/gm) || []).length;
    if (opens % 2 === 0) report.warn(file, 'Z2', 'コードフェンスに言語名がありません(text / bash / javascript / mermaid など)', bodyLine + before.split('\n').length - 1);
  }
  for (const u of findUnclosedStrong(body, bodyLine)) {
    report.error(file, 'Z7', `閉じない強調(**)があります。「文。 **次」の空白は閉じ側の後ろ(「文。** 次」)に置いてください: ${u.text}`, u.line);
  }
}

export function checkArticle(file, text, policy, expressions = readJson(EXPRESSIONS)) {
  const report = new Report('zenn');
  report.file(file);
  const a = policy.articles;
  const slug = path.basename(file, '.md');
  if (!new RegExp(a.slug).test(slug)) report.error(file, 'Z1', `slug "${slug}" が Zenn の規則(${a.slug})に合いません`);
  const { frontmatter: fm, body, bodyLine, error } = splitFrontmatter(text);
  if (error || !fm) {
    report.error(file, 'Z1', error ? `frontmatter を YAML として読めません: ${error}` : 'frontmatter がありません', 1);
    return report;
  }
  for (const key of a.frontmatter.required) if (fm[key] === undefined) report.error(file, 'Z1', `frontmatter に ${key} がありません`, 1);
  if (fm.type !== undefined && !a.frontmatter.type_enum.includes(fm.type)) report.error(file, 'Z1', `type "${fm.type}" は ${a.frontmatter.type_enum.join(' | ')} のいずれかです`, 1);
  if (fm.topics !== undefined) {
    if (!Array.isArray(fm.topics)) report.error(file, 'Z1', 'topics は配列で書いてください', 1);
    else if (fm.topics.length < a.frontmatter.topics_min || fm.topics.length > a.frontmatter.topics_max) report.error(file, 'Z1', `topics が ${fm.topics.length} 件です(${a.frontmatter.topics_min}〜${a.frontmatter.topics_max} 件)`, 1);
  }
  if (fm.published !== undefined && typeof fm.published !== 'boolean') report.error(file, 'Z1', 'published は真偽値で書いてください', 1);
  if (typeof fm.title === 'string' && [...fm.title].length > a.frontmatter.title_max) report.error(file, 'Z1', `title が ${[...fm.title].length} 字です(Zenn の上限 ${a.frontmatter.title_max} 字)`, 1);
  if (typeof fm.emoji === 'string' && !/^\p{RGI_Emoji}$/v.test(fm.emoji)) report.error(file, 'Z1', `emoji "${fm.emoji}" は絵文字 1 文字にしてください`, 1);

  checkBody(report, file, body, bodyLine);
  checkChapterRefs(report, file, body, bodyLine);
  checkManuscriptDisclosure(report, file, body, bodyLine, 'zenn', 'Z8');
  checkLocalPaths(report, file, body, bodyLine, 'Z9');
  checkIndexEol(report, file, 'Z10');
  checkMetadiscourse(report, file, body, bodyLine, expressions);

  let genreId = a.genre_by_type[fm.type] || 'essay';
  for (const [glob, g] of Object.entries(a.genre_overrides || {})) if (matchesAny(file, [glob]) || matchesAny(slug + '.md', [glob])) genreId = g;
  const genre = policy.genres[genreId];
  if (!genre) report.error(file, 'Z5', `genre "${genreId}" が lint/policies/zenn.json に定義されていません`);
  else checkRequires(report, file, genreId, genre, countElements(text));
  return report;
}

/** 本の最初の章(config.yaml の chapters の先頭)。開示は序文にあたるこの章に置く */
export function firstChapterFile(dir) {
  const config = `${dir}/config.yaml`;
  if (!exists(config)) return null;
  const chapters = readYaml(config)?.chapters;
  const first = Array.isArray(chapters) && chapters.length ? `${dir}/${chapters[0]}.md` : null;
  return first && exists(first) ? first : null;
}

export function checkBook(slug, policy, expressions = readJson(EXPRESSIONS)) {
  const report = new Report('zenn');
  const dir = `books/${slug}`;
  const entry = policy.books[slug];
  const files = listFiles([`${dir}/*.md`]);
  for (const f of files) report.file(f);
  const first = firstChapterFile(dir);
  if (first) {
    const s = splitFrontmatter(readText(first));
    checkManuscriptDisclosure(report, first, s.body, s.bodyLine, 'zenn', 'Z8');
  }
  if (!entry) {
    report.warn(`${dir}/config.yaml`, 'Z5', `本 "${slug}" の genre が lint/policies/zenn.json に未登録です。engineering / process / research / essay のいずれかを割り当ててください`);
    return report;
  }
  const genre = policy.genres[entry.genre];
  if (!genre) {
    report.error(`${dir}/config.yaml`, 'Z5', `genre "${entry.genre}" が定義されていません`);
    return report;
  }
  const total = {};
  let convName = null;
  let optInSeverity = null;
  if (entry.conventions) {
    if (typeof entry.conventions === 'string') {
      convName = entry.conventions;
    } else if (typeof entry.conventions === 'object') {
      convName = entry.conventions.id || entry.conventions.name || entry.conventions.rules;
      optInSeverity = entry.conventions.metadiscourse;
    }
  }
  const conventions = convName ? policy.conventions[convName] || [] : [];
  for (const f of files) {
    const text = readText(f);
    const { frontmatter, body, bodyLine } = splitFrontmatter(text);
    checkBody(report, f, body, bodyLine);
    checkLocalPaths(report, f, body, bodyLine, 'Z9');
    checkIndexEol(report, f, 'Z10');
    checkMetadiscourse(report, f, body, bodyLine, expressions, optInSeverity);
    for (const [k, v] of Object.entries(countElements(text))) total[k] = (total[k] || 0) + v;
    for (const conv of conventions) checkConvention(report, f, text, frontmatter, conv);
  }
  checkRequires(report, `${dir}/config.yaml`, entry.genre, genre, total);
  return report;
}

export function checkZenn({ policy = readJson(POLICY), expressions = readJson(EXPRESSIONS) } = {}) {
  const total = new Report('zenn');
  for (const f of listFiles(['articles/*.md'], { exclude: ['articles/README.md'] })) total.merge(checkArticle(f, readText(f), policy, expressions));
  const bookDirs = exists('books') ? fs.readdirSync(abs('books'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : [];
  for (const slug of bookDirs) total.merge(checkBook(slug, policy, expressions));
  for (const slug of Object.keys(policy.books)) if (!bookDirs.includes(slug)) total.warn('lint/policies/zenn.json', 'Z5', `policy に登録された本 "${slug}" が books/ にありません`);
  return total;
}

if (isMain(import.meta.url)) {
  finish(checkZenn(), parseArgs());
}
