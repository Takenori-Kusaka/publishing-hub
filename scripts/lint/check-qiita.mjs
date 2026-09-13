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
//   Q11 生成AIの利用の開示(冒頭の :::note と末尾の「生成AIの利用について」。docs/ai-disclosure.md)
//   Q12 コードの抜粋は出典のファイル(先頭 3 行のコメントに書いたパス)と一致する。出典のないコードは警告
//   Q13 作業環境のパス(C:\Users\…、/home/…)を書かない(コードブロックの中も見る)
//   Q14 原稿を LF の改行でコミットする(git の index を見る)
//   Q15 見出しは 1 段ずつ下げる(h1 の次に h3 を置かない)。警告
//   Q16 ディレクトリ構成図(├── / └──)のパスが git で追跡されている。警告
//   Q17 題名かタグに掲げた技術(GitHub Actions など)の設定かコードを 1 つ以上抜粋している。GitHub Actions なら手順(run: など)を含む。警告
//   Q18 「測っていません」「主張しません」のような但し書きの定型文を繰り返さない。警告
//   H1  (注意だけ)公開中の記事の本文を最後に変えたコミット以降に、人の確認の記録がない。publish-qiita が同期しない
//
// Qiita CLI が同期した過去記事(ファイル名が 20 桁 hex)は歴史的な投稿として対象外です。

import { readText, readJson, listFiles, exists, isLegacyQiita, splitFrontmatter, fencedBlocks, headings, extractLinks, hostOf, maskMarkdown, countProseChars, restrictTo, Report, parseArgs, finish, isMain } from './lib.mjs';

import { checkManuscriptDisclosure } from './disclosure.mjs';
import { checkLocalPaths } from './local-paths.mjs';
import { checkIndexEol } from './git-eol.mjs';
import { reviewStatus, commitsFor } from './check-human-review.mjs';
import { git, hasFullHistory } from './git-baseline.mjs';

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

const SOURCE_PATH_RE = /(?:^|[\s(`'"])((?:scripts|lint|social|test|platforms|docs|books|articles|\.github)\/[\w./-]+\.(?:mjs|cjs|js|ts|json|ya?ml|py|md|sh))/;
const COMMENT_LINE_RE = /^\s*(\/\/|#|\/\*|\*\/?|<!--|-->)/;
const HASH_COMMENT_LANGS = new Set(['yaml', 'yml', 'sh', 'bash', 'shell', 'zsh', 'python', 'py', 'ruby', 'rb', 'toml', 'dockerfile', 'make', 'makefile', 'powershell', 'ps1']);
const SLASH_COMMENT_LANGS = new Set(['js', 'javascript', 'mjs', 'cjs', 'ts', 'typescript', 'jsx', 'tsx', 'java', 'go', 'rust', 'rs', 'c', 'cpp', 'csharp', 'cs', 'swift', 'kotlin']);

/** 出典のパスを書いたコメントの記号が、ブロックの言語のコメントと合っているか。合わなければ期待する記号を返す */
export function commentTokenMismatch(lang, code) {
  const header = String(code).split('\n').slice(0, 3).find((l) => SOURCE_PATH_RE.test(l)) || '';
  const token = /^\s*(\/\/|#|\/\*|<!--)/.exec(header)?.[1];
  const l = String(lang).toLowerCase();
  const expected = HASH_COMMENT_LANGS.has(l) ? '#' : SLASH_COMMENT_LANGS.has(l) ? '//' : null;
  if (!token || !expected) return null;
  if (token === expected || (expected === '//' && token === '/*')) return null;
  return { token, expected };
}
const ELLIPSIS_RE = /^\s*(\/\/|#|\/\*)?\s*(\.\.\.|…)/;

function normalizeLine(l) {
  return l.trim().replace(/\s+/g, ' ');
}

/**
 * 抜粋の各行が出典のファイルに逐語であるか。行末コメントとコメント行も比べる(空白の差だけ許す)。
 * 除くのは空行、省略記号の行(// ...)、先頭 3 行の出典のパスのコメントだけ。
 */
export function excerptFidelity(code, sourceText) {
  const src = String(sourceText).replace(/\r\n/g, '\n').split('\n').map(normalizeLine);
  const index = new Map();
  src.forEach((l, i) => {
    if (l && !index.has(l)) index.set(l, i);
  });
  const lines = String(code)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l, i) => l.trim() && !ELLIPSIS_RE.test(l) && !(i < 3 && COMMENT_LINE_RE.test(l) && SOURCE_PATH_RE.test(l)))
    .map(normalizeLine);
  if (!lines.length) return { ratio: 1, total: 0, missing: [], maxIndex: -1, present: new Set() };
  const found = lines.filter((l) => index.has(l));
  const missing = lines.filter((l) => !index.has(l));
  const maxIndex = found.length ? Math.max(...found.map((l) => index.get(l))) : -1;
  return { ratio: found.length / lines.length, total: lines.length, missing, maxIndex, present: new Set(found) };
}

/** 出典の @gate の印の直後にある分岐のうち、抜粋がそれより後の行を載せているのに省いたもの */
export function missingGates(code, sourceText) {
  const src = String(sourceText).replace(/\r\n/g, '\n').split('\n');
  const f = excerptFidelity(code, sourceText);
  const out = [];
  src.forEach((l, i) => {
    if (!/@gate\b/.test(l)) return;
    let j = i + 1;
    while (j < src.length && (!src[j].trim() || COMMENT_LINE_RE.test(src[j]))) j++;
    if (j < src.length && f.maxIndex > j && !f.present.has(normalizeLine(src[j]))) out.push(src[j].trim());
  });
  return out;
}

/** 抜粋で続けて並べた 2 行のあいだに、出典の行(空行とコメント以外)を省略記号なしに飛ばしている箇所 */
export function silentGaps(code, sourceText) {
  const src = String(sourceText).replace(/\r\n/g, '\n').split('\n').map(normalizeLine);
  const out = [];
  let last = -1;
  let ellipsis = false;
  String(code)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .forEach((raw, i) => {
      if (!raw.trim()) return;
      if (ELLIPSIS_RE.test(raw)) {
        ellipsis = true;
        return;
      }
      if (i < 3 && COMMENT_LINE_RE.test(raw) && SOURCE_PATH_RE.test(raw)) return;
      const n = normalizeLine(raw);
      let idx = src.indexOf(n, last + 1);
      if (idx < 0) {
        idx = src.indexOf(n);
        if (idx >= 0) {
          last = idx;
          ellipsis = false;
        }
        return;
      }
      if (last >= 0 && !ellipsis) {
        const skipped = src.slice(last + 1, idx).filter((l) => l && !COMMENT_LINE_RE.test(l));
        if (skipped.length) out.push({ after: src[last], before: n, skipped: skipped.length, line: i });
      }
      last = idx;
      ellipsis = false;
    });
  return out;
}

/** ディレクトリ構成図(├── / └──)のパス。root はリポジトリ内の構成図の起点(なければリポジトリの直下)。line はブロック内の 0 始まり */
export function treePaths(code) {
  const lines = String(code).replace(/\r\n/g, '\n').split('\n');
  const rootLine = lines.find((l) => l.trim() && !/[├└│]/.test(l));
  const root = rootLine && /^([\w.-]+(?:\/[\w.-]+)*)\/\s*(#.*)?$/.exec(rootLine.trim());
  const out = [];
  const stack = [];
  lines.forEach((raw, j) => {
    const m = /^([│\s]*)[├└]──\s*([^\s#]+)/.exec(raw);
    if (!m) return;
    const depth = Math.round([...m[1]].length / 4);
    const name = m[2].replace(/\/$/, '');
    stack.length = depth;
    stack[depth] = /[*…]|\.\.\./.test(name) ? null : name;
    if (stack.some((x) => !x)) return;
    out.push({ path: stack.join('/'), root: root ? root[1] : null, line: j });
  });
  return out;
}

let tracked = null;
/** git が追跡しているファイルとディレクトリ。git が使えなければ null */
function trackedPaths() {
  if (tracked === null) {
    tracked = new Set();
    try {
      if (!hasFullHistory()) throw new Error('no git');
      for (const f of git(['ls-files']).split(/\r?\n/).filter(Boolean)) {
        const parts = f.split('/');
        for (let i = 1; i <= parts.length; i++) tracked.add(parts.slice(0, i).join('/'));
      }
    } catch {
      tracked = false;
    }
  }
  return tracked || null;
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
    if (Array.isArray(fm.tags) && fm.tags.some((tag) => /^qiita$/i.test(String(tag).trim()))) report.warn(file, 'Q7', 'タグに媒体名「Qiita」があります。記事の主題(使った技術)をタグにしてください', 1);
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

  // Q15 heading steps
  for (let i = 1; i < heads.length; i++) {
    if (heads[i].level > heads[i - 1].level + 1) report.warn(file, 'Q15', `見出しが h${heads[i - 1].level} から h${heads[i].level} へ飛んでいます(「${heads[i].text}」)。1 段ずつ下げてください`, line(heads[i].line));
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

  // Q12 code excerpts must match their cited source file
  const ce = policy.code_excerpts;
  if (ce) {
    for (const b of codeBlocks) {
      const m = SOURCE_PATH_RE.exec(b.code.split('\n').slice(0, 3).join('\n'));
      if (!m) {
        if (ce.require_source && ce.require_source !== 'off') report.add(ce.require_source, file, 'Q12', 'コードブロックに出典のパスがありません。リポジトリのコードは先頭行に // <リポジトリ内のパス> を書き、実装から逐語で抜粋してください', line(b.line));
        continue;
      }
      const src = m[1];
      const mismatch = commentTokenMismatch(b.lang, b.code);
      if (mismatch) {
        report.add(ce.comment_severity || 'warning', file, 'Q12', `出典のパスを ${mismatch.token} のコメントで書いていますが、${b.lang} のコメントは ${mismatch.expected} です。読者がそのまま貼ると構文エラーになります`, line(b.line));
      }
      if (!exists(src)) {
        report.error(file, 'Q12', `出典 ${src} がリポジトリにありません`, line(b.line));
        continue;
      }
      const sourceText = readText(src);
      const f = excerptFidelity(b.code, sourceText);
      if (f.ratio < ce.min_match_ratio) {
        report.error(file, 'Q12', `出典 ${src} にない行が ${f.missing.length} 行あります(コメントも逐語で比べます)。抜粋は実装から逐語で取り、省略は // ... で示し、説明は本文に書いてください。一致しない行: 「${f.missing.slice(0, 2).join('」「')}」`, line(b.line));
      }
      const declared = [...b.code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_][\w]*)\s*=/g)].map((x) => x[1]);
      const unused = [...new Set(declared)].filter((name) => (b.code.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length < 2);
      if (unused.length) {
        report.warn(file, 'Q12', `抜粋の中で宣言した ${unused.join('、')} が抜粋の中で使われていません。本文が説明する処理の核を // ... で省いていないか確かめてください`, line(b.line));
      }
      const gates = missingGates(b.code, sourceText);
      if (gates.length) {
        report.error(file, 'Q12', `出典 ${src} の安全のための分岐(@gate)を省いたまま、その後の処理を載せています。省いた分岐: 「${gates.join('」「')}」`, line(b.line));
      }
      if (ce.gap_severity && ce.gap_severity !== 'off') {
        for (const g of silentGaps(b.code, sourceText)) {
          report.add(ce.gap_severity, file, 'Q12', `抜粋の「${g.after.slice(0, 40)}」と「${g.before.slice(0, 40)}」のあいだで、出典 ${src} の ${g.skipped} 行を省略記号なしに飛ばしています。飛ばした位置に // ... を置いてください`, line(b.line) + 1 + g.line);
        }
      }
    }
  }

  // Q16 directory trees must name paths the repository tracks
  const tree = policy.tree_diagrams;
  const known = tree ? trackedPaths() : null;
  if (tree && known) {
    for (const b of blocks.filter((x) => ['', 'text', 'plaintext', 'txt'].includes(x.lang.toLowerCase()) && /[├└]──/.test(x.code))) {
      for (const p of treePaths(b.code)) {
        const full = p.root && known.has(p.root) ? `${p.root}/${p.path}` : p.path;
        if (!known.has(full)) report.add(tree.severity, file, 'Q16', `構成図のパス ${full} はリポジトリで追跡されていません。main にある置き場所だけを書くか、図から外してください`, line(b.line) + 1 + p.line);
      }
    }
  }

  // Q17 technologies promised by the title or tags need an excerpt
  const tc = policy.topic_code;
  if (tc) {
    const subject = [fm.title, ...(Array.isArray(fm.tags) ? fm.tags : [])].filter(Boolean).join(' ');
    const cited = codeBlocks.map((b) => ({ path: SOURCE_PATH_RE.exec(b.code.split('\n').slice(0, 3).join('\n'))?.[1], code: b.code })).filter((x) => x.path);
    for (const r of tc.rules || []) {
      const m = new RegExp(r.pattern, 'i').exec(subject);
      if (!m) continue;
      const matching = cited.filter((x) => new RegExp(r.source).test(x.path));
      if (!matching.length) {
        report.add(tc.severity, file, 'Q17', `題名かタグに「${m[0]}」を掲げていますが、${r.label} の抜粋がありません。題名が約束した技術の設定かコードを、出典のパスを付けて実装から逐語で 1 つ以上載せるか、題名とタグを本文に合わせてください`, 1);
      } else if (r.must_match && !matching.some((x) => new RegExp(r.must_match).test(x.code))) {
        report.add(tc.severity, file, 'Q17', `${r.label} の抜粋に、${r.step_label || '中身の手順'}がありません。見出しや権限の設定だけでなく、読者が再現したい処理の手順を載せてください`, 1);
      }
    }
  }

  // Q18 repeated disclaimers used as boilerplate
  const dq = policy.disclaimers;
  if (dq) {
    const dre = new RegExp(dq.pattern);
    const dlines = [];
    prose.split('\n').forEach((l, i) => {
      for (const s of l.split(/(?<=[。！？!?])/)) if (dre.test(s)) dlines.push(i + 1);
    });
    if (dlines.length > dq.max) {
      report.add(dq.severity, file, 'Q18', `「測っていません」「主張しません」のような但し書きが ${dlines.length} 文あります(${dq.max} 文まで)。規則をかわすための定型文を繰り返さず、主張そのものを削ってください`, line(dlines[dq.max]));
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

  // Q13 local paths
  checkLocalPaths(report, file, body, bodyLine, 'Q13');

  // H1 (note only): a public article changed by an AI co-authored commit needs a human Reviewed-by before it syncs
  if (fm.private === false && fm.id) {
    try {
      const s = reviewStatus(commitsFor(file), file);
      if (s.needed && !s.reviewed) report.note(`${file}: 本文を最後に変更したコミット ${s.commit.slice(0, 7)}${s.ai ? '(生成AIが共著)' : ''} 以降に人の確認(Reviewed-by)の記録がありません。人が確認するまで publish-qiita はこの記事を同期しません(H1)`);
    } catch {
      // git が使えない環境では注意を出さない
    }
  }
  checkIndexEol(report, file, 'Q14');

  // Q11 AI disclosure
  checkManuscriptDisclosure(report, file, body, bodyLine, 'qiita', 'Q11');

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
