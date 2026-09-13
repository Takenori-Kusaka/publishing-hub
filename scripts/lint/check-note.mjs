// note(思想・ナラティブバリアント)の原稿を検査する。
//
//   node scripts/lint/check-note.mjs [--strict] [--report out.json] [file ...]
//
// note の読者は生コードや設定ファイルを見に来ません。求めているのは「なぜその技術を
// 選んだのか」「どんな摩擦があり、どう乗り越えたか」という物語と意思決定です。
// 原稿は platforms/note/public/<id>.md に、正本(Zenn)とは別の文章として書きます。
// scripts/build-note.mjs は、この検査に通った原稿だけをビルドします。
// 閾値は lint/policies/note.json にあります。
//
//   N1  frontmatter(title / status / source / canonical_url。status は draft|ready|published|retired)
//   N2  生コード禁止(コードブロック・インラインコード・Mermaid)
//   N3  note で描画されない記法の禁止(表・脚注・Zenn コンテナ・HTML・h2/h3 以外の見出し)。画像は警告(手動アップロード)
//   N4  本文に正本(canonical_url)への導線がある
//   N5  文字数(推奨 1,500〜6,000。800 未満・10,000 超はエラー)
//   N6  物語の要素(一人称と、なぜ・判断・葛藤などの意思決定語)。警告
//   N7  煽り表現(警告)
//   N8  タイトルが正本と同一でない
//   N9  生成AIの利用の開示(冒頭の引用と末尾の「生成AIの利用について」。docs/ai-disclosure.md)
//   N10 作業環境のパスを書かない
//   N11 実装の語(Environment、ワークフロー、CI など)。note の読者に通じる言葉にする(警告)
//   N12 原稿を LF の改行でコミットする(git の index を見る)

import path from 'node:path';
import { readText, readJson, listFiles, exists, splitFrontmatter, fencedBlocks, headings, extractLinks, maskMarkdown, countChars, normalizeUrl, restrictTo, Report, parseArgs, finish, isMain } from './lib.mjs';

import { checkManuscriptDisclosure } from './disclosure.mjs';
import { checkLocalPaths } from './local-paths.mjs';
import { checkIndexEol } from './git-eol.mjs';

const POLICY = 'lint/policies/note.json';
const EXPRESSIONS = 'lint/policies/expressions.json';
export const NOTE_INCLUDE = ['platforms/note/public/*.md'];
export const NOTE_EXCLUDE = ['platforms/note/public/README.md'];

/** build-note が変換しない単独の * / _ による強調 */
export function findSingleEmphasis(text) {
  const re = /(?<![*\\\w])\*(?![*\s])[^*\n]+?(?<![\s*\\])\*(?![*\w])|(?<![_\\\w])_(?![_\s])[^_\n]+?(?<![\s_\\])_(?![_\w])/g;
  return [...String(text).matchAll(re)].map((m) => ({ found: m[0], index: m.index }));
}

export function checkNoteManuscript(file, text, policy = readJson(POLICY), expressions = readJson(EXPRESSIONS)) {
  const report = new Report('note');
  report.file(file);
  const { frontmatter, body, bodyLine, error } = splitFrontmatter(text);
  if (error || !frontmatter) {
    report.error(file, 'N1', error ? `frontmatter を YAML として読めません: ${error}` : 'frontmatter がありません(title / status / source / canonical_url)', 1);
    return report;
  }
  const fm = frontmatter;
  const line = (offsetLine) => bodyLine + offsetLine - 1;

  // N1 frontmatter
  for (const key of policy.frontmatter.required) {
    if (fm[key] === undefined || fm[key] === null || fm[key] === '') report.error(file, 'N1', `frontmatter に ${key} がありません`, 1);
  }
  if (fm.status !== undefined && !policy.frontmatter.status_enum.includes(fm.status)) {
    report.error(file, 'N1', `status "${fm.status}" は ${policy.frontmatter.status_enum.join(' | ')} のいずれかにしてください`, 1);
  }
  if (Array.isArray(fm.tags) && fm.tags.length > policy.frontmatter.tags_max) report.warn(file, 'N1', `tags が ${fm.tags.length} 件です(${policy.frontmatter.tags_max} 件以内を推奨)`, 1);
  if (typeof fm.title === 'string' && [...fm.title].length > policy.frontmatter.title_max) report.warn(file, 'N1', `title が ${[...fm.title].length} 字です(${policy.frontmatter.title_max} 字以内を推奨)`, 1);
  let sourceTitle = null;
  if (typeof fm.source === 'string') {
    if (!/^(articles|books)\//.test(fm.source) || fm.source.includes('..')) {
      report.error(file, 'N1', `source "${fm.source}" は articles/ か books/ 配下の正本を指してください`, 1);
    } else if (!exists(fm.source)) {
      report.error(file, 'N1', `source "${fm.source}" が存在しません`, 1);
    } else {
      sourceTitle = splitFrontmatter(readText(fm.source)).frontmatter?.title ?? null;
    }
  }
  if (typeof fm.canonical_url === 'string') {
    let host = '';
    try {
      host = new URL(fm.canonical_url).host;
    } catch {
      report.error(file, 'N1', `canonical_url "${fm.canonical_url}" が URL ではありません`, 1);
    }
    if (host && !policy.canonical.hosts.some((h) => host === h || host.endsWith('.' + h))) {
      report.error(file, 'N1', `canonical_url のホスト ${host} は正本(${policy.canonical.hosts.join(' / ')})ではありません`, 1);
    }
    if (/[?&]utm_/.test(fm.canonical_url)) report.error(file, 'N1', 'canonical_url に utm_ が含まれています。UTM は配信時に付与します', 1);
  }

  // N2 raw code
  const blocks = fencedBlocks(body);
  for (const b of blocks) {
    const sev = b.lang === 'mermaid' ? policy.forbid.mermaid : policy.forbid.fenced_code;
    report.add(sev, file, 'N2', b.lang === 'mermaid' ? 'Mermaid 図があります。note は Mermaid を描画しません。図は画像にするか、文章で構造を語ってください' : `コードブロック(${b.lang || '言語指定なし'})があります。note の読者は生コードを求めていません。何を決めたかを文章で語り、コードは正本(Zenn)に置いてください`, line(b.line));
  }
  const noFence = maskMarkdown(body, { inline: false, links: false, urls: false, html: false });
  const inlineRe = /`[^`\n]+`/g;
  let m;
  while ((m = inlineRe.exec(noFence))) {
    report.add(policy.forbid.inline_code, file, 'N2', `インラインコード ${m[0]} があります。note では記号やコマンドをそのまま見せず、言葉で言い換えてください`, line(noFence.slice(0, m.index).split('\n').length));
  }

  // N3 syntax note does not render
  const forbid = policy.forbid;
  // 表: GFM の区切り行(| --- | --- | や --- | ---)で検出し、1 表につき 1 件報告する
  const tableRe = /^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*(\|[ \t]*:?-{3,}:?[ \t]*)+\|?[ \t]*$/gm;
  while ((m = tableRe.exec(noFence))) {
    const lineNo = noFence.slice(0, m.index).split('\n').length;
    const prev = noFence.split('\n')[lineNo - 2] || '';
    if (!prev.includes('|')) continue;
    report.add(forbid.tables, file, 'N3', '表(Markdown table)があります。note は表を描画しません。箇条書きか文章にしてください', line(lineNo - 1));
  }
  const footRe = /\[\^[^\]]+\]/g;
  if ((m = footRe.exec(noFence))) report.add(forbid.footnotes, file, 'N3', `脚注 ${m[0]} があります。note は脚注を描画しません。本文に溶かすか括弧書きにしてください`, line(noFence.slice(0, m.index).split('\n').length));
  const containerRe = /^(:::[a-z]+|@\[[a-z]+\])/gm;
  while ((m = containerRe.exec(noFence))) report.add(forbid.zenn_containers, file, 'N3', `Zenn 固有の記法 "${m[1]}" は note で描画されません`, line(noFence.slice(0, m.index).split('\n').length));
  // HTML タグ(自動リンク <https://…> は除く)
  const htmlRe = /<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^>\n]*)?\/?>/g;
  while ((m = htmlRe.exec(noFence))) report.add(forbid.html, file, 'N3', `HTML タグ ${m[0]} があります。note のエディタは HTML を受け付けません`, line(noFence.slice(0, m.index).split('\n').length));
  for (const h of headings(body)) {
    if (!policy.headings.allowed_levels.includes(h.level)) {
      report.error(file, 'N3', `見出しレベル h${h.level}「${h.text}」は note にありません。大見出し(##)と小見出し(###)だけを使ってください`, line(h.line));
    }
  }
  const imgRe = /!\[[^\]]*\]\([^)]*\)/g;
  while ((m = imgRe.exec(noFence))) report.add(forbid.images, file, 'N3', '画像があります。note には手動でアップロードし直す必要があります(manifest に記録されます)', line(noFence.slice(0, m.index).split('\n').length));

  // N4 canonical link in body
  if (policy.canonical.required && typeof fm.canonical_url === 'string') {
    const target = normalizeUrl(fm.canonical_url);
    const has = extractLinks(body).some((l) => normalizeUrl(l.url) === target);
    if (!has) report.error(file, 'N4', `本文に正本 ${fm.canonical_url} へのリンクがありません。技術的な詳細は正本へ、という導線を置いてください`);
  }

  // N5 length
  const chars = countChars(body);
  const c = policy.chars;
  if (chars < c.hard_min) report.error(file, 'N5', `本文が ${chars} 字です。物語として成立する分量(${c.hard_min} 字以上、推奨 ${c.min} 字以上)にしてください`);
  else if (chars < c.min) report.warn(file, 'N5', `本文が ${chars} 字です(推奨 ${c.min}〜${c.max} 字)`);
  else if (chars > c.hard_max) report.error(file, 'N5', `本文が ${chars} 字です。${c.hard_max} 字を超える網羅は正本に任せ、1 つの意思決定に絞ってください`);
  else if (chars > c.max) report.warn(file, 'N5', `本文が ${chars} 字です(推奨 ${c.min}〜${c.max} 字)`);

  // N6 narrative(一人称は「私は」「自分の」のように助詞を伴う形だけを数える。「私企業」「自分自身」は数えない)
  const prose = maskMarkdown(body);
  const n = policy.narrative;
  const firstPerson = n.first_person.some((w) => new RegExp(`(?<![一-龥])${w}(?=[はがのもにをと、。])`).test(prose));
  if (!firstPerson) report.add(n.severity, file, 'N6', `一人称(${n.first_person.join(' / ')})がありません。note は著者の視点で語るエッセイです`);
  const hits = n.decision_keywords.filter((w) => prose.includes(w));
  if (hits.length < n.min_decision_hits) report.add(n.severity, file, 'N6', `意思決定を語る言葉(${n.decision_keywords.join('・')})が ${hits.length} 種類です。なぜそう決めたか、何に迷ったかを書いてください`);

  // N7 hype
  const sev = expressions.hype.severity.note;
  if (sev && sev !== 'off') {
    for (const p of expressions.hype.patterns) {
      const re = new RegExp(p.pattern, 'g');
      while ((m = re.exec(prose))) report.add(sev, file, 'N7', `煽り・セールストーク「${m[0]}」(${p.label})`, line(prose.slice(0, m.index).split('\n').length));
    }
  }

  // N8 title differs from source
  if (policy.title_must_differ_from_source && sourceTitle && typeof fm.title === 'string' && fm.title.trim() === String(sourceTitle).trim()) {
    report.error(file, 'N8', 'タイトルが正本と同一です。note の読者(意思決定者・一般ビジネス層)に向けた別のタイトルにしてください', 1);
  }

  // N11 jargon (正本の題名の引用は言い換えられないので数えない)
  const jargonText = sourceTitle ? prose.split(String(sourceTitle)).join(' '.repeat([...String(sourceTitle)].length)) : prose;
  if (policy.jargon) {
    for (const p of policy.jargon.patterns) {
      const re = new RegExp(p, 'g');
      let jm;
      while ((jm = re.exec(jargonText))) report.add(policy.jargon.severity, file, 'N11', `実装の語「${jm[0]}」があります。note の読者に通じる言葉に言い換えてください(正本の題名を書き換えてはいけません)`, line(jargonText.slice(0, jm.index).split('\n').length));
    }
  }

  // N3 single-asterisk / underscore emphasis
  for (const e of findSingleEmphasis(maskMarkdown(body))) {
    report.error(file, 'N3', `単独の * か _ による強調「${e.found.slice(0, 20)}」は note 用の HTML に変換されず、記号のまま表示されます。強調は **…** にするか外してください`, line(maskMarkdown(body).slice(0, e.index).split('\n').length));
  }

  // N10 local paths
  checkLocalPaths(report, file, body, bodyLine, 'N10');
  checkIndexEol(report, file, 'N12');

  // N9 AI disclosure
  checkManuscriptDisclosure(report, file, body, bodyLine, 'note', 'N9');

  return report;
}

export function checkNote({ only = [] } = {}) {
  const total = new Report('note');
  let files = listFiles(NOTE_INCLUDE, { exclude: NOTE_EXCLUDE });
  if (only.length) {
    const r = restrictTo(files, only);
    files = r.files;
    if (r.note) total.note(r.note);
  }
  if (!files.length) {
    if (!only.length) total.note('note の原稿(platforms/note/public/*.md)がありません');
    return total;
  }
  const policy = readJson(POLICY);
  const expressions = readJson(EXPRESSIONS);
  for (const f of files) total.merge(checkNoteManuscript(f, readText(f), policy, expressions));
  return total;
}

/** build-note.mjs から: 1 原稿を検査して {ok, errors, warnings} を返す */
export function validateNoteFile(file) {
  const r = checkNoteManuscript(file, readText(file));
  return { ok: r.errors.length === 0, errors: r.errors, warnings: r.warnings, basename: path.basename(file, '.md') };
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  finish(checkNote({ only: args.positional }), args);
}
