// 媒体間の非対称(Asymmetry)を検査する。
//
//   node scripts/lint/check-variants.mjs [--strict] [--report out.json] [--channel qiita|note]
//
// 同じテーマから切り出した派生物(Qiita / note / SNS)が、正本(Zenn)の
// 「複製」ではなく「別の読者に向けた別の成果物」になっていることを確かめます。
// 同じ文章を複数媒体に流すと、読者の文脈に合わないだけでなく、検索エンジンに
// 重複コンテンツと見なされ正本の評価が下がります(docs/publishing-model.md 2 章)。
//
// テーマの対応づけ(どの派生物がどの正本から出たか)は次の順で決めます:
//   1. lint/policies/variants.json の sources(id → 正本のパス)
//   2. social/posts/<id>.yaml の source.path / platforms/note/public/<id>.md の frontmatter source
//   3. Qiita 本文の正本リンク(zenn.dev/<user>/articles/<slug> または /books/<book>/viewer/<slug>)
//   4. platforms/qiita/public/<id>.md と articles/<id>.md の id の一致
//
//   V1  派生物(Qiita / note)の本文に正本または GitHub への導線がある
//   V2  派生物の文のうち正本と同一の文の割合(重複率)。10% で警告、30% でエラー
//   V2b 文字 8-gram の Jaccard 係数が高い(言い換えただけの複製)
//   V3  派生物のタイトルが正本と同一でない
//   V5  対応する正本が存在する
//   V6  公開状態の派生物(Qiita の private: false、note の ready 以降)が指す正本が未公開(警告)
//   V7  派生物の見出しが正本の見出しと大半で一致する(節構成の写し。粒度や観点が同じ疑い)
//   V8  派生物が正本の限界・但し書きと矛盾する記述をしている(lint/claims/<id>.json と文単位で照合。エラー)
//   V9  正本にない断定(外部サービスの仕様、他製品との比較、検知の回避、完全性。lint/policies/expressions.json の unverified_claims。警告)
//   V10 正本の統計(2 桁以上の数と助数詞)をそのまま持ち込んでいる(警告)
//   V11 正本へのリンクで正本の題名を引用するなら、書き換えずに引用する。正本の「」の引用に似た「」を書き換えて引用しない
//   V12 リポジトリのファイルを抜粋した節に、その部品について正本が書く限界を載せる(lint/claims/<id>.json の required_caveats)
//   V13 削った文や書き換えた文を受けていた接続の語(同じ理由で・しかし など)を残さない(git の直前の版と比べる)
//
// 長さは評価しません。派生物が正本と同じ長さでも、粒度や観点が違えば価値があります。
// 問題は「内容が同じ」ことなので、文の同一性(V2)・文字 n-gram(V2b)・節構成(V7)で見ます。
// 生成AIの開示(冒頭の告知。古い原稿では末尾の宣言も)はどの媒体にも同じ文言で入るため、測る前に取り除きます。
// 閾値は lint/policies/variants.json にあります。

import path from 'node:path';
import { readText, readJson, readYaml, listFiles, isLegacyQiita, exists, splitFrontmatter, sentences, extractLinks, headings, maskMarkdown, fencedBlocks, normalizeUrl, Report, parseArgs, finish, isMain } from './lib.mjs';
import { stripDisclosure } from './disclosure.mjs';
import { previousVersion } from './git-baseline.mjs';

const POLICY = 'lint/policies/variants.json';

const short = (s, n = 30) => {
  const c = [...String(s)];
  return c.length > n ? `${c.slice(0, n).join('')}…` : c.join('');
};

/** 散文の文(見出しの行を除く)。key は空白と読点を除いた比較用の文字列、line は本文の 1 始まり */
export function proseSentences(body) {
  const out = [];
  maskMarkdown(body).split('\n').forEach((l, i) => {
    if (/^\s*#{1,6}\s/.test(l)) return;
    for (const s of l.split(/(?<=[。！？!?])/)) {
      const text = s.replace(/^\s*>\s?/, '').trim();
      if (text) out.push({ text, key: text.replace(/[\s、，,]/g, ''), line: i + 1 });
    }
  });
  return out;
}

/**
 * 直前の版(baseBody)にもある「接続の語で始まる文」のうち、直前の文が変わったもの(V13)。
 * 受けていた文を削るか書き換えたのに、接続の語だけが残っている疑い。
 */
export function findStaleConnectives(body, baseBody, pattern) {
  const re = new RegExp(pattern);
  const cur = proseSentences(body);
  const base = proseSentences(baseBody);
  const at = new Map();
  base.forEach((s, i) => {
    if (!at.has(s.key)) at.set(s.key, i);
  });
  const out = [];
  cur.forEach((s, i) => {
    if (i === 0 || !re.test(s.text)) return;
    const j = at.get(s.key);
    if (j === undefined || j === 0) return;
    if (base[j - 1].key !== cur[i - 1].key) out.push({ sentence: s, previous: cur[i - 1], removed: base[j - 1] });
  });
  return out;
}

/** 開発の経緯の数値(コミットや共著の件数など)。コードは見ない */
export function historyStatistics(units, pattern) {
  const out = [];
  for (const u of units) {
    if (u.kind && u.kind !== 'prose') continue;
    const re = new RegExp(pattern, 'g');
    const t = normalizeNumerals(u.text, NUMERAL_UNITS);
    let m;
    while ((m = re.exec(t))) {
      out.push({ found: m[0], unit: u });
      if (!m[0]) re.lastIndex++;
    }
  }
  return out;
}

/** 「」の中の文字列(強調記号と空白を除く)。line は 1 始まり */
export function quoteStrings(text, minChars) {
  const masked = maskMarkdown(String(text), { links: false });
  const out = [];
  for (const m of masked.matchAll(/「([^「」\n]+)」/g)) {
    const q = m[1].replace(/\*\*|__/g, '').replace(/\s+/g, '');
    if ([...q].length >= minChars) out.push({ q, line: masked.slice(0, m.index).split('\n').length });
  }
  return out;
}

/** 文字 2-gram の Dice 係数 */
export function dice(a, b) {
  const grams = (s) => {
    const c = [...s];
    const m = new Map();
    for (let i = 0; i + 1 < c.length; i++) m.set(c[i] + c[i + 1], (m.get(c[i] + c[i + 1]) || 0) + 1);
    return m;
  };
  const x = grams(a);
  const y = grams(b);
  let inter = 0;
  let total = 0;
  for (const [k, v] of x) {
    inter += Math.min(v, y.get(k) || 0);
    total += v;
  }
  for (const v of y.values()) total += v;
  return total ? (2 * inter) / total : 0;
}

/** 正本の「」の引用(と題名)に似ているのに一致しない「」(V11) */
export function findAlteredQuotes(text, sourceText, { min_chars = 12, threshold = 0.6 } = {}, extra = []) {
  const src = [...new Set([...quoteStrings(sourceText, min_chars).map((x) => x.q), ...extra.map((x) => String(x).replace(/\s+/g, '')).filter((x) => [...x].length >= min_chars)])];
  if (!src.length) return [];
  const out = [];
  for (const v of quoteStrings(text, min_chars)) {
    if (src.includes(v.q) || src.some((s) => s.includes(v.q))) continue;
    let best = null;
    let score = 0;
    for (const s of src) {
      const d = dice(v.q, s);
      if (d > score) {
        score = d;
        best = s;
      }
    }
    if (score >= threshold) out.push({ found: v.q, canonical: best, score, line: v.line });
  }
  return out;
}

function normalizeSentence(s) {
  return s.replace(/\s+/g, '').replace(/[「」『』（）()【】\[\]"'“”‘’]/g, '').replace(/[。．.!！?？:：、,，]+$/g, '');
}

export function sentenceSet(text, minChars) {
  const out = new Set();
  for (const s of sentences(text, { joinSoftBreaks: true })) {
    const n = normalizeSentence(s.text);
    if ([...n].length >= minChars) out.add(n);
  }
  return out;
}

export function shingles(text, k) {
  const prose = maskMarkdown(text).replace(/\s+/g, '');
  const chars = [...prose];
  const out = new Set();
  for (let i = 0; i + k <= chars.length; i++) out.add(chars.slice(i, i + k).join(''));
  return out;
}

export function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** 照合の対象にする単位: 散文の文(コードとリンク先を伏せる)と、コードブロックのコメント行・text ブロックの行。line は本文の 1 始まり */
export function claimUnits(body) {
  const prose = maskMarkdown(body, { inline: false });
  const units = [];
  prose.split('\n').forEach((l, i) => {
    for (const s of l.split(/(?<=[。！？!?])/)) if (s.trim()) units.push({ text: s, line: i + 1, kind: 'prose' });
  });
  for (const b of fencedBlocks(body)) {
    const plainText = ['', 'text', 'plaintext', 'txt'].includes(b.lang.toLowerCase());
    b.code.split('\n').forEach((l, j) => {
      if (!l.trim()) return;
      const comment = plainText || /^\s*(\/\/|#|\/\*|\*)/.test(l) || /\s\/\/\s/.test(l);
      units.push({ text: l, line: b.line + 1 + j, kind: comment ? 'comment' : 'code' });
    });
  }
  return units;
}

/** テーマの照合リストにある、抜粋したファイルごとの必須の但し書き */
export function loadCaveats(id, dir = 'lint/claims') {
  const p = `${dir}/${id}.json`;
  return exists(p) ? readJson(p).required_caveats || [] : [];
}

/** テーマの照合リスト(lint/claims/<id>.json)。なければ空 */
export function loadClaims(id, source, report = null, dir = 'lint/claims') {
  const p = `${dir}/${id}.json`;
  if (!exists(p)) return [];
  const j = readJson(p);
  if (report && j.source && j.source !== source) report.warn(p, 'V8', `照合リストの source (${j.source}) がテーマの正本 (${source}) と一致しません`);
  return j.claims || [];
}

/**
 * 正本の限界と矛盾する文。forbid に当たり、その一致の前後 unless_window 字(既定 30)以内に unless が無いもの。
 * 但し書きの語を文の遠くに足しただけでは許さない。unless_next: n なら、直後の n 文(同じ種類の単位)にあっても許す。
 */
export function findClaimViolations(units, claims, defaultWindow = 30) {
  const out = [];
  for (const c of claims) {
    const rules = (c.forbid || []).map((f) => (typeof f === 'string' ? { pattern: f } : f));
    for (const [idx, u] of units.entries()) {
      if (u.kind === 'code' && !c.code) continue;
      const text = normalizeNumerals(u.text, NUMERAL_UNITS);
      let reported = false;
      for (const r of rules) {
        const re = new RegExp(r.pattern, 'g');
        const unless = r.unless ?? c.unless;
        const win = r.unless_window ?? c.unless_window ?? defaultWindow;
        let m;
        while (!reported && (m = re.exec(text))) {
          const start = m.index;
          const end = m.index + m[0].length;
          let near = false;
          if (unless) {
            const ure = new RegExp(unless, 'g');
            let x;
            while ((x = ure.exec(text))) {
              if (x.index + x[0].length >= start - win && x.index <= end + win) {
                near = true;
                break;
              }
              if (!x[0]) ure.lastIndex++;
            }
            const nextN = r.unless_next ?? c.unless_next ?? 0;
            for (let k = 1; !near && k <= nextN; k++) {
              const nu = units[idx + k];
              if (!nu || (nu.kind === 'prose') !== (u.kind === 'prose')) break;
              if (new RegExp(unless).test(normalizeNumerals(nu.text, NUMERAL_UNITS))) near = true;
            }
          }
          if (!near) {
            out.push({ claim: c, unit: u, found: m[0] });
            reported = true;
          }
          if (!m[0]) re.lastIndex++;
        }
        if (reported) break;
      }
    }
  }
  return out;
}

/** 正本の題名を引用しているのに書き換えたリンク(「」を含むか 20 字以上の文字列で、題名と一致しない) */
export function findTitleMisquotes(links, canonical, title) {
  if (!canonical || !title) return [];
  return links.filter((l) => {
    if (normalizeUrl(l.url) !== normalizeUrl(canonical)) return false;
    const text = String(l.text || '').trim();
    return (text.includes('「') || [...text].length >= 20) && text !== String(title).trim();
  });
}

const CITED_SOURCE_RE = /((?:scripts|lint|social|test|platforms|docs|books|articles|\.github)\/[\w./-]+\.(?:mjs|cjs|js|ts|json|ya?ml|py|md|sh))/;

/** 抜粋したファイルごとに、その節(抜粋を含む見出しの範囲)に正本の限界の但し書きがあるか。欠けたものを返す */
export function findMissingCaveats(body, caveats) {
  if (!caveats?.length) return [];
  const lines = body.split('\n');
  const heads = headings(body);
  const out = [];
  for (const b of fencedBlocks(body)) {
    const m = CITED_SOURCE_RE.exec(b.code.split('\n').slice(0, 3).join('\n'));
    if (!m) continue;
    const prev = [...heads].reverse().find((h) => h.line <= b.line);
    const next = heads.find((h) => h.line > b.line && (!prev || h.level <= prev.level));
    const section = maskMarkdown(lines.slice(prev ? prev.line - 1 : 0, next ? next.line - 1 : lines.length).join('\n'));
    for (const cv of caveats.filter((x) => x.source === m[1])) {
      if (!new RegExp(cv.pattern).test(section)) out.push({ caveat: cv, line: b.line });
    }
  }
  return out;
}

/** 正本にない断定。一致した語句が正本の本文にもあれば数えない。code: true のパターンだけがコードの行を見る */
export function findUnverifiedClaims(units, patterns, sourceText) {
  const out = [];
  for (const p of patterns || []) {
    const re = new RegExp(p.pattern, 'g');
    for (const u of units) {
      if (u.kind === 'code' && !p.code) continue;
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(u.text))) {
        if (!String(sourceText).includes(m[0])) out.push({ label: p.label, found: m[0], unit: u, severity: p.severity });
        if (!m[0]) re.lastIndex++;
      }
    }
  }
  return out;
}

const NUMERAL_UNITS = ['字', '文字', '件', '行', 'ファイル', '本', '章', '図', '箇所', 'コミット', 'テスト', '日間', '段階', '規則', 'ワークフロー', '書記素', 'ホスト'];
const KANJI_DIGITS = { 〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const KANJI_UNITS = { 十: 10, 百: 100, 千: 1000 };

/** 「四千九百十七」→ 4917 */
export function kanjiToNumber(s) {
  let total = 0;
  let section = 0;
  let num = 0;
  for (const ch of s) {
    if (ch in KANJI_DIGITS) num = KANJI_DIGITS[ch];
    else if (ch in KANJI_UNITS) {
      section += (num || 1) * KANJI_UNITS[ch];
      num = 0;
    } else if (ch === '万') {
      total += (section + num || 1) * 10000;
      section = 0;
      num = 0;
    }
  }
  return total + section + num;
}

/** 全角数字(NFKC)と、助数詞の直前の漢数字を算用数字にそろえる */
export function normalizeNumerals(text, units) {
  const re = new RegExp(`[〇零一二三四五六七八九十百千万]+(?=\\s*(${units.join('|')}))`, 'g');
  return String(text).normalize('NFKC').replace(re, (m) => String(kanjiToNumber(m)));
}

/** 2 桁以上の数と助数詞の組(「108件」「4917行」)。漢数字と全角数字もそろえて数える */
export function statisticTokens(text, st) {
  text = normalizeNumerals(text, st.units);
  const digits = st.min_digits || 2;
  const re = new RegExp(`(\\d[\\d,]{${digits - 1},}(?:\\.\\d+)?)\\s*(${st.units.join('|')})`, 'g');
  const set = new Set();
  let m;
  while ((m = re.exec(text))) set.add(`${m[1].replace(/,/g, '')}${m[2]}`);
  return set;
}

/** 節見出し(レベル 2 以上)を比較用に正規化する(番号・括弧・記号を落とす)。文書題名(H1)と一般的な見出し(はじめに等)は除く */
export function headingKeys(text, generic = []) {
  const out = new Set();
  for (const h of headings(text)) {
    if (h.level < 2) continue;
    const key = h.text
      .replace(/^[\d０-９.．:：、\s]+/, '')
      .replace(/[（(][^)）]*[)）]/g, '')
      .replace(/[\s：:。、！？!?・「」『』*_`]/g, '');
    if (key && !generic.includes(key)) out.add(key);
  }
  return out;
}

/** 派生物の見出しのうち、正本にも同じ見出しがあるものの割合 */
export function sharedHeadingRatio(variantText, sourceText, generic = []) {
  const v = headingKeys(variantText, generic);
  const s = headingKeys(sourceText, generic);
  if (!v.size) return { ratio: 0, shared: [], total: 0 };
  const shared = [...v].filter((x) => s.has(x));
  return { ratio: shared.length / v.size, shared, total: v.size };
}

/** 派生物の文のうち、正本にも同じ文があるものの割合 */
export function duplicateRatio(variantText, sourceText, minChars) {
  const v = sentenceSet(variantText, minChars);
  const s = sentenceSet(sourceText, minChars);
  if (!v.size) return { ratio: 0, shared: [], total: 0 };
  const shared = [...v].filter((x) => s.has(x));
  return { ratio: shared.length / v.size, shared, total: v.size };
}

function canonicalUrlFor(sourcePath, policy) {
  const m = /^articles\/([a-z0-9_-]+)\.md$/.exec(sourcePath);
  if (m) return `${policy.canonical.zenn_base}/articles/${m[1]}`;
  const b = /^books\/([a-z0-9_-]+)\/([a-z0-9_-]+)\.md$/.exec(sourcePath);
  if (b) return `${policy.canonical.zenn_base}/books/${b[1]}/viewer/${b[2]}`;
  return null;
}

/** 本文中の正本リンクから正本のパスを逆引きする */
export function sourceFromLinks(body, policy) {
  const base = policy.canonical.zenn_base.replace(/\/$/, '');
  for (const l of extractLinks(body)) {
    const u = normalizeUrl(l.url);
    if (!u.startsWith(base + '/')) continue;
    const a = /\/articles\/([a-z0-9_-]+)$/.exec(u);
    if (a && exists(`articles/${a[1]}.md`)) return { source: `articles/${a[1]}.md`, canonical: u };
    const b = /\/books\/([a-z0-9_-]+)\/viewer\/([a-z0-9_-]+)$/.exec(u);
    if (b && exists(`books/${b[1]}/${b[2]}.md`)) return { source: `books/${b[1]}/${b[2]}.md`, canonical: u };
  }
  return null;
}

/** テーマ(正本 + 派生物の組)を発見する */
export function discoverThemes(policy = readJson(POLICY)) {
  const themes = new Map();
  const theme = (id) => {
    if (!themes.has(id)) themes.set(id, { id, source: null, canonical: null, qiita: null, note: null, social: null, qiitaPublic: false, noteStatus: null, socialStatus: null });
    return themes.get(id);
  };
  for (const [id, src] of Object.entries(policy.sources || {})) theme(id).source = src;
  for (const f of listFiles(['social/posts/*.yaml', 'social/posts/*.yml'])) {
    const data = readYaml(f);
    const t = theme(data?.id || path.basename(f).replace(/\.ya?ml$/, ''));
    t.social = f;
    t.socialStatus = data?.status || null;
    if (data?.source?.path && !t.source) t.source = data.source.path;
    if (data?.source?.canonical_url && !t.canonical) t.canonical = data.source.canonical_url;
  }
  for (const f of listFiles(['platforms/note/public/*.md'], { exclude: ['platforms/note/public/README.md'] })) {
    const id = path.basename(f, '.md');
    const { frontmatter } = splitFrontmatter(readText(f));
    const t = theme(id);
    t.note = f;
    t.noteStatus = frontmatter?.status || null;
    if (frontmatter?.source && !t.source) t.source = frontmatter.source;
    if (frontmatter?.canonical_url && !t.canonical) t.canonical = frontmatter.canonical_url;
  }
  for (const f of listFiles(['platforms/qiita/public/*.md'])) {
    if (isLegacyQiita(f)) continue;
    const id = path.basename(f, '.md');
    const text = readText(f);
    const { frontmatter, body } = splitFrontmatter(text);
    const t = theme(id);
    t.qiita = f;
    t.qiitaPublic = Boolean(frontmatter?.id) && frontmatter?.private === false && frontmatter?.ignorePublish !== true;
    if (!t.source) {
      const fromLink = sourceFromLinks(body, policy);
      if (fromLink) {
        t.source = fromLink.source;
        if (!t.canonical) t.canonical = fromLink.canonical;
      } else if (exists(`articles/${id}.md`)) {
        t.source = `articles/${id}.md`;
      }
    }
  }
  return [...themes.values()];
}

export function checkVariants({ policy = readJson(POLICY), channel = null } = {}) {
  const report = new Report('variants');
  const themes = discoverThemes(policy);
  if (!themes.length) {
    report.note('派生物(Qiita / note / SNS)がありません');
    return report;
  }
  const rows = [];
  for (const t of themes) {
    let variants = [t.qiita, t.note].filter(Boolean);
    if (channel === 'qiita') variants = variants.filter((v) => v === t.qiita);
    if (channel === 'note') variants = variants.filter((v) => v === t.note);
    for (const v of variants) report.file(v);
    if (t.social && !channel) report.file(t.social);
    if (!variants.length) continue;

    // V5 source
    if (!t.source) {
      for (const v of variants) report.error(v, 'V5', `テーマ "${t.id}" の正本(Zenn)が見つかりません。本文に正本(zenn.dev)へのリンクを置くか、lint/policies/variants.json の sources、social/posts/${t.id}.yaml の source.path、note の frontmatter source で正本を示してください`);
      continue;
    }
    if (!exists(t.source)) {
      for (const v of variants) report.error(v, 'V5', `正本 "${t.source}" が存在しません`);
      continue;
    }
    const sourceText = stripDisclosure(readText(t.source));
    const sourceSplit = splitFrontmatter(sourceText);
    const sourceFm = sourceSplit.frontmatter || {};
    const canonical = t.canonical || canonicalUrlFor(t.source, policy);
    const sourceShingles = shingles(sourceText, policy.duplicate.shingle_size);
    const sourceUnpublished = sourceFm.published === false;
    const structure = policy.structure || { min_headings: 3, shared_heading_warn_ratio: 0.5, generic_headings: [] };
    const sourceRaw = readText(t.source);
    const claims = loadClaims(t.id, t.source, report, policy.claims?.dir);
    const caveats = loadCaveats(t.id, policy.claims?.dir);
    const expressions = readJson('lint/policies/expressions.json');
    const sourceStats = policy.statistics ? statisticTokens(maskMarkdown(sourceText), policy.statistics) : new Set();

    for (const v of variants) {
      const text = readText(v);
      const { frontmatter, body, bodyLine } = splitFrontmatter(text);
      const kind = v.startsWith('platforms/qiita/') ? 'qiita' : 'note';

      // V1 canonical link
      const links = extractLinks(body).filter((l) => !l.image);
      const toCanonical = canonical && links.some((l) => normalizeUrl(l.url) === normalizeUrl(canonical));
      const toGithub = links.some((l) => l.url.startsWith(policy.canonical.github_owner));
      if (kind === 'note' && !toCanonical) {
        report.error(v, 'V1', `正本 ${canonical} へのリンクがありません。note は正本への導線(SEO 評価の集中)が必須です`);
      } else if (kind === 'qiita' && !toCanonical && !toGithub) {
        report.error(v, 'V1', `正本 ${canonical} または ${policy.canonical.github_owner}/... へのリンクがありません`);
      } else if (kind === 'qiita' && !toCanonical) {
        report.warn(v, 'V1', `GitHub への導線はありますが、正本 ${canonical} へのリンクがありません。両方あると SEO 評価が正本に集まります`);
      }

      // V11 the canonical title, when quoted, must be quoted exactly
      for (const l of findTitleMisquotes(links, canonical, sourceFm.title)) {
        report.error(v, 'V11', `正本へのリンクの文字列「${l.text}」が正本の題名「${sourceFm.title}」と違います。題名を引用するなら書き換えずに引用してください`, bodyLine + l.line - 1);
      }
      if (policy.quotes) {
        for (const q of findAlteredQuotes(stripDisclosure(body), sourceText, policy.quotes, [sourceFm.title].filter(Boolean))) {
          report.error(v, 'V11', `「${short(q.found, 40)}」は正本の「${short(q.canonical, 40)}」を書き換えた引用に見えます(類似度 ${q.score.toFixed(2)})。かぎ括弧で引用するなら正本のとおりに書き、言い換えるならかぎ括弧を外してください`);
        }
      }

      // V13 connectives left behind after the sentence they referred to was removed or rewritten
      const prev = policy.connectives ? previousVersion(v) : null;
      if (prev && prev.text) {
        for (const s of findStaleConnectives(body, splitFrontmatter(prev.text).body ?? prev.text, policy.connectives.pattern)) {
          report.add(policy.connectives.severity || 'error', v, 'V13', `「${short(s.sentence.text)}」は、直前の版では「${short(s.removed.text)}」を受けていましたが、直前の文が「${short(s.previous.text)}」に変わりました。接続の語を消すか、前の文とつながるように書き直してください`, bodyLine + s.sentence.line - 1);
        }
      }

      // V12 caveats the canonical states for an excerpted part
      for (const miss of findMissingCaveats(body, caveats)) {
        report.error(v, 'V12', `${miss.caveat.source} を抜粋した節に、正本が書く限界「${miss.caveat.label}」がありません`, bodyLine + miss.line - 1);
      }

      // V2 duplicate sentences
      const plain = stripDisclosure(body);
      const dup = duplicateRatio(plain, sourceText, policy.duplicate.sentence_min_chars);
      const pct = Math.round(dup.ratio * 100);
      const sample = dup.shared.slice(0, 3).map((s) => `「${[...s].slice(0, 40).join('')}…」`).join(' ');
      if (dup.ratio >= policy.duplicate.error_ratio) {
        report.error(v, 'V2', `正本 ${t.source} と同一の文が ${dup.shared.length}/${dup.total} 文(${pct}%)あります。複製ではなく媒体別の成果物に書き直してください ${sample}`);
      } else if (dup.ratio >= policy.duplicate.warn_ratio) {
        report.warn(v, 'V2', `正本 ${t.source} と同一の文が ${dup.shared.length}/${dup.total} 文(${pct}%)あります ${sample}`);
      }
      const jac = jaccard(shingles(plain, policy.duplicate.shingle_size), sourceShingles);
      if (jac >= policy.duplicate.shingle_warn_jaccard) {
        report.warn(v, 'V2b', `正本との文字 ${policy.duplicate.shingle_size}-gram 類似度が ${jac.toFixed(2)} です(言い換えだけの複製の疑い)`);
      }

      // V3 title
      if (policy.titles.must_differ && frontmatter?.title && sourceFm.title && String(frontmatter.title).trim() === String(sourceFm.title).trim()) {
        report.error(v, 'V3', `タイトルが正本と同一です。媒体の読者に向けたタイトルにしてください`);
      }

      // V6 published variant whose source is unpublished
      const variantPublic = kind === 'qiita' ? t.qiitaPublic : ['ready', 'published'].includes(t.noteStatus);
      if (sourceUnpublished && variantPublic) {
        report.warn(v, 'V6', `派生物は公開状態ですが、正本 ${t.source} は published: false です。正本を先に公開しないと導線が死にます`);
      }

      // V7 shared section structure (same granularity / same viewpoint)
      const sh = sharedHeadingRatio(plain, sourceText, structure.generic_headings || []);
      if (sh.total >= (structure.min_headings || 3) && sh.ratio >= structure.shared_heading_warn_ratio) {
        report.warn(v, 'V7', `見出しの ${sh.shared.length}/${sh.total}(${Math.round(sh.ratio * 100)}%)が正本と同じです。節構成の写しではなく、媒体の読者に合わせた粒度と観点で組み直してください(${sh.shared.slice(0, 3).join('、')})`);
      }

      // V8 contradictions with the canonical's stated limits
      const units = claimUnits(body);
      if (frontmatter?.title) units.unshift({ text: String(frontmatter.title), line: 1, kind: 'prose', abs: true });
      for (const hit of findClaimViolations(units, claims)) {
        report.error(v, 'V8', `正本と矛盾する記述「${hit.found}」(${hit.claim.id}: ${hit.claim.canonical})。言い換えや漢数字でかわさず、正本の限界どおりに書き直すか削ってください`, hit.unit.abs ? 1 : bodyLine + hit.unit.line - 1);
      }

      // V9 assertions the canonical does not make
      const sev9 = expressions.unverified_claims?.severity?.[kind];
      if (sev9 && sev9 !== 'off') {
        for (const u of findUnverifiedClaims(units, expressions.unverified_claims.patterns, sourceRaw)) {
          report.add(u.severity?.[kind] || sev9, v, 'V9', `正本にない断定「${u.found}」(${u.label})。正本か実装で裏付けられないなら削ってください`, u.unit.abs ? 1 : bodyLine + u.unit.line - 1);
        }
      }

      // V10 statistics copied from the canonical
      if (policy.statistics) {
        const shared = [...statisticTokens(maskMarkdown(plain), policy.statistics)].filter((x) => sourceStats.has(x));
        const limit = policy.statistics.warn_shared?.[kind];
        if (limit && shared.length >= limit) {
          report.warn(v, 'V10', `正本の数値を ${shared.length} 個そのまま使っています(${shared.slice(0, 6).join('、')})。規模や経緯の統計は正本に任せ、媒体の読者に要る数値だけにしてください`);
        }
        const hist = policy.statistics.history;
        if (hist && (hist.channels || []).includes(kind)) {
          for (const h of historyStatistics(units.filter((u) => !u.abs), hist.pattern)) {
            report.warn(v, 'V10', `開発の経緯の数値「${h.found}」があります。コミットや共著の件数は時点とともに古くなり、媒体の読者の課題にも関係しません。正本に任せて削ってください`, bodyLine + h.unit.line - 1);
          }
        }
      }

      rows.push({ theme: t.id, variant: v, source: t.source, dup: `${pct}%`, jaccard: jac.toFixed(2), headings: `${sh.shared.length}/${sh.total}` });
    }

    // V8 / V9 on the SNS draft of the same theme
    if (t.social && !channel && exists(t.social)) {
      const data = readYaml(t.social) || {};
      const fields = [];
      const card = (kind, prefix, obj) => {
        for (const k of ['title', 'description']) if (obj?.[k]) fields.push({ kind, label: `${prefix}.${k}`, text: String(obj[k]) });
      };
      if (data.linkedin?.enabled) {
        fields.push({ kind: 'linkedin', label: 'linkedin.text', text: String(data.linkedin.text || '') });
        card('linkedin', 'linkedin.article', data.linkedin.article);
      }
      if (data.bluesky?.enabled) {
        (data.bluesky.posts || []).forEach((p, i) => {
          fields.push({ kind: 'bluesky', label: `bluesky.posts[${i}].text`, text: String(p.text || '') });
          card('bluesky', `bluesky.posts[${i}].external`, p.external);
        });
      }
      for (const f of fields) {
        const units = f.text.split(/(?<=[。！？!?])|\n/).filter((s) => s && s.trim()).map((s) => ({ text: s, line: null }));
        for (const hit of findClaimViolations(units, claims)) {
          report.error(t.social, 'V8', `${f.label}: 正本と矛盾する記述「${hit.found}」(${hit.claim.id}: ${hit.claim.canonical})`);
        }
        if (policy.quotes) {
          for (const q of findAlteredQuotes(f.text, sourceText, policy.quotes, [sourceFm.title].filter(Boolean))) {
            report.error(t.social, 'V11', `${f.label}: 「${short(q.found, 40)}」は正本の「${short(q.canonical, 40)}」を書き換えた引用に見えます(類似度 ${q.score.toFixed(2)})`);
          }
        }
        const sev = expressions.unverified_claims?.severity?.[f.kind];
        if (sev && sev !== 'off') {
          for (const u of findUnverifiedClaims(units, expressions.unverified_claims.patterns, sourceRaw)) {
            report.add(u.severity?.[f.kind] || sev, t.social, 'V9', `${f.label}: 正本にない断定「${u.found}」(${u.label})`);
          }
        }
      }
    }

    // SNS: source.path と canonical の整合(validate.mjs が存在確認をするので、ここでは正本の同一性だけ)
    if (t.social && !channel && t.canonical) {
      const expected = canonicalUrlFor(t.source, policy);
      if (expected && normalizeUrl(t.canonical) !== expected) {
        report.warn(t.social, 'V1', `source.canonical_url (${t.canonical}) が source.path から導かれる URL (${expected}) と一致しません`);
      }
    }
  }
  for (const r of rows) report.note(`${r.theme}: ${r.variant} ← ${r.source} 同一文 ${r.dup}, 8-gram ${r.jaccard}, 同じ見出し ${r.headings}`);
  return report;
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  finish(checkVariants({ channel: args.values.get('channel') || null }), args);
}
