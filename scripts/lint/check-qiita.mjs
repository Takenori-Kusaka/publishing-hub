// Qiita(技術課題解決バリアント)の構造を検査する。
//
//   node scripts/lint/check-qiita.mjs [--strict] [--report out.json] [file ...]
//
// Qiita の読者は「目の前の課題を解く」ためにやって来ます。前提を長々と語らず、
// 技術選定の理由、コアロジックのハイライト、そして正本(Zenn)と GitHub への導線を
// 1 分で拾える粒度に削ぎ落とした記事であることを、次の規則で機械的に確認します。
// 閾値は lint/policies/qiita.json にあります。
//
//   Q1  散文の文字数(コード・URL を除いて 1,500 字以上。技術的背景・選定理由・設計詳細を欠いていない。上限は設けない)
//   Q2  設計・選定理由の見出し(## 技術選定理由 / ## アーキテクチャ など。見出しレベル 2 まで)
//   Q3  GitHub リポジトリへのリンク(成果物のオープン性)
//   Q4  採用技術の公式ドキュメント・仕様への外部リンクが 2 ホスト以上(画像・バッジ・自分の媒体は数えない)
//   Q5  コードブロック 3 箇所以上(言語名のないもの・text・出力は数えない。Q5b: 80 行を超える塊は「全体は GitHub 参照」に切り出す)
//   Q6  冒頭 40 行以内に正本(Zenn)または GitHub への導線(SEO 評価を正本へ集中させる)
//   Q7  frontmatter(title / tags 1〜5 件 / private)。title の「！」と煽りは警告
//   Q8  煽り表現(警告。lint/policies/expressions.json)
//   Q9  Zenn 固有記法(:::message, @[card] など)と /images/ 相対画像(Qiita では表示されない。コードブロック内の例示は除く)
//   Q10 未同期(id なし)の記事は private: true か ignorePublish: true(AI が置いた記事が人の確認なしに公開されない)
//
// Qiita CLI が同期した過去記事(ファイル名が 20 桁 hex)は歴史的な投稿として対象外です。

import { readText, readJson, listFiles, isLegacyQiita, splitFrontmatter, fencedBlocks, headings, extractLinks, hostOf, maskMarkdown, countProseChars, restrictTo, Report, parseArgs, finish, isMain } from './lib.mjs';

const POLICY = 'lint/policies/qiita.json';
const EXPRESSIONS = 'lint/policies/expressions.json';
const CHANNEL_INCLUDE = ['platforms/qiita/public/*.md'];
const NON_CODE_LANGS = new Set(['', 'text', 'plaintext', 'txt', 'console', 'output', 'log', 'mermaid', 'md', 'markdown']);

function hostExcluded(host, excluded) {
  const h = host.replace(/^www\./, '');
  return excluded.some((x) => {
    const e = x.toLowerCase();
    return e.startsWith('*.') ? h.endsWith(e.slice(1)) || h === e.slice(2) : h === e;
  });
}

export function checkQiitaArticle(file, text, policy = readJson(POLICY), expressions = readJson(EXPRESSIONS)) {
  const report = new Report('qiita');
  report.file(file);
  const { frontmatter, body, bodyLine, error } = splitFrontmatter(text);
  if (error) {
    report.error(file, 'Q7', `frontmatter を YAML として読めません: ${error}`, 1);
    return report;
  }
  const fm = frontmatter || {};
  const prose = maskMarkdown(body);
  const proseLen = countProseChars(body);
  const blocks = fencedBlocks(body);
  const codeBlocks = blocks.filter((b) => !NON_CODE_LANGS.has(b.lang.toLowerCase()));
  const heads = headings(body);
  const links = extractLinks(body);
  const line = (offsetLine) => bodyLine + offsetLine - 1;
  const hypeOn = (subject, code, sev, where) => {
    for (const p of expressions.hype.patterns) {
      const re = new RegExp(p.pattern, 'g');
      let m;
      while ((m = re.exec(subject))) report.add(sev, file, code, `${where}煽り・セールストーク「${m[0]}」(${p.label})。読者が自分で判断できる客観的な表現にしてください`, typeof where === 'string' && where ? 1 : line(subject.slice(0, m.index).split('\n').length));
    }
  };

  // Q7 frontmatter
  for (const key of policy.frontmatter.required) {
    if (fm[key] === undefined) report.error(file, 'Q7', `frontmatter に ${key} がありません`, 1);
  }
  if (Array.isArray(fm.tags)) {
    if (fm.tags.length < policy.frontmatter.tags_min || fm.tags.length > policy.frontmatter.tags_max) {
      report.error(file, 'Q7', `tags が ${fm.tags.length} 件です(${policy.frontmatter.tags_min}〜${policy.frontmatter.tags_max} 件)`, 1);
    }
  } else if (fm.tags !== undefined) {
    report.error(file, 'Q7', 'tags は配列で書いてください', 1);
  }
  if (typeof fm.title === 'string') {
    if ([...fm.title].length > policy.frontmatter.title_max) report.warn(file, 'Q7', `title が ${[...fm.title].length} 字です(${policy.frontmatter.title_max} 字以内を推奨)`, 1);
    if (/[！!]/.test(fm.title)) report.warn(file, 'Q7', 'title に「！」があります。レシピの題名は事実を述べる形にしてください', 1);
    hypeOn(fm.title, 'Q7', 'warning', 'title: ');
  }
  if (fm.private !== undefined && typeof fm.private !== 'boolean') report.error(file, 'Q7', 'private は真偽値で書いてください', 1);

  // Q10 unsynced article must not be public
  if (policy.publish_gate?.unsynced_must_be_private && !fm.id && fm.private !== true && fm.ignorePublish !== true) {
    report.error(file, 'Q10', 'まだ Qiita に同期されていない記事(id なし)は private: true か ignorePublish: true にしてください。公開への切り替えは人が行います');
  }

  // Q1 length (prose only; a lower bound only — length is not a quality measure)
  if (proseLen < policy.chars.min) {
    report.error(file, 'Q1', `散文が ${proseLen} 文字です(コード・URL を除く)。技術的背景・選定理由・設計詳細を記述し ${policy.chars.min} 文字以上にしてください`);
  }

  // Q2 rationale heading
  const rationale = new RegExp(policy.headings.rationale_pattern);
  if (!heads.some((h) => h.level <= policy.headings.max_level && rationale.test(h.text))) {
    report.error(file, 'Q2', `技術選定理由・設計・アーキテクチャの見出し(${policy.headings.rationale_pattern}、レベル ${policy.headings.max_level} まで)がありません`);
  }

  // Q3 GitHub link
  if (!links.some((l) => !l.image && /^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/i.test(l.url))) {
    report.error(file, 'Q3', 'GitHub リポジトリ(github.com/<owner>/<repo>)へのリンクがありません。成果物のオープン性を担保してください');
  }

  // Q4 reference links
  const hosts = new Set(links.filter((l) => !l.image).map((l) => hostOf(l.url)).filter((h) => h && !hostExcluded(h, policy.reference_links.excluded_hosts)));
  if (hosts.size < policy.reference_links.min_distinct_hosts) {
    report.error(file, 'Q4', `採用技術の公式ドキュメント・仕様への外部リンクが ${hosts.size} ホストです(${policy.reference_links.min_distinct_hosts} ホスト以上。自分の媒体・GitHub・画像は数えません)`);
  }

  // Q5 code blocks
  if (codeBlocks.length < policy.code_blocks.min) {
    report.error(file, 'Q5', `コードブロックが ${codeBlocks.length} 箇所です(言語名付きのもの。text や出力は数えません)。コアロジックのハイライトを ${policy.code_blocks.min} 箇所以上載せてください`);
  }
  for (const b of codeBlocks) {
    const n = b.code.split('\n').length;
    if (n > policy.code_blocks.max_lines_per_block) {
      report.warn(file, 'Q5b', `${n} 行のコードブロックがあります。${policy.code_blocks.max_lines_per_block} 行を超える塊はハイライトに切り詰め、全体は GitHub を参照させてください`, line(b.line));
    }
  }

  // Q6 canonical link near the top
  const owner = policy.canonical.owner_patterns.map((p) => new RegExp(p, 'i'));
  const headLines = body.split('\n').slice(0, policy.canonical.within_lines).join('\n');
  if (!extractLinks(headLines).some((l) => owner.some((re) => re.test(l.url)))) {
    report.error(file, 'Q6', `冒頭 ${policy.canonical.within_lines} 行以内に正本(Zenn 記事)または GitHub リポジトリへのリンクがありません。派生物は正本への導線を最上部に置きます`);
  }

  // Q8 hype expressions
  const sev = expressions.hype.severity.qiita;
  if (sev && sev !== 'off') hypeOn(prose, 'Q8', sev, '');

  // Q9 Zenn-only syntax and relative images (outside code blocks)
  const noFence = maskMarkdown(body, { inline: false, links: false, urls: false, html: false, frontmatter: false });
  if (policy.forbid.zenn_containers) {
    const re = /^(:::(message|details|alert)|@\[(card|youtube|tweet|gist|codepen|slideshare|speakerdeck|jsfiddle|codesandbox|stackblitz|figma|docswell|blueprintue)\])/gm;
    let m;
    while ((m = re.exec(noFence))) report.error(file, 'Q9', `Zenn 固有の記法 "${m[1]}" は Qiita で描画されません`, line(noFence.slice(0, m.index).split('\n').length));
  }
  if (policy.forbid.relative_images) {
    const re = /!\[[^\]]*\]\((\/images\/[^)\s]+|\.{1,2}\/[^)\s]+)\)/g;
    let m;
    while ((m = re.exec(noFence))) report.error(file, 'Q9', `画像 "${m[1]}" は相対パスです。Qiita では表示されないため、Qiita にアップロードした URL か GitHub の raw URL にしてください`, line(noFence.slice(0, m.index).split('\n').length));
  }

  return report;
}

export function checkQiita({ only = [] } = {}) {
  const total = new Report('qiita');
  let files = listFiles(CHANNEL_INCLUDE);
  if (only.length) {
    const r = restrictTo(files, only);
    files = r.files;
    if (r.note) total.note(r.note);
  }
  const policy = readJson(POLICY);
  const expressions = readJson(EXPRESSIONS);
  let legacy = 0;
  for (const f of files) {
    if (isLegacyQiita(f)) {
      legacy++;
      continue;
    }
    total.merge(checkQiitaArticle(f, readText(f), policy, expressions));
  }
  if (legacy) total.note(`Qiita CLI が同期した過去記事 ${legacy} 件は対象外(ファイル名が 20 桁 hex)`);
  return total;
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  finish(checkQiita({ only: args.positional }), args);
}
