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
//
// 長さは評価しません。派生物が正本と同じ長さでも、粒度や観点が違えば価値があります。
// 問題は「内容が同じ」ことなので、文の同一性(V2)・文字 n-gram(V2b)・節構成(V7)で見ます。
// 閾値は lint/policies/variants.json にあります。

import path from 'node:path';
import { readText, readJson, readYaml, listFiles, isLegacyQiita, exists, splitFrontmatter, sentences, extractLinks, headings, maskMarkdown, normalizeUrl, Report, parseArgs, finish, isMain } from './lib.mjs';

const POLICY = 'lint/policies/variants.json';

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
    const sourceText = readText(t.source);
    const sourceSplit = splitFrontmatter(sourceText);
    const sourceFm = sourceSplit.frontmatter || {};
    const canonical = t.canonical || canonicalUrlFor(t.source, policy);
    const sourceShingles = shingles(sourceText, policy.duplicate.shingle_size);
    const sourceUnpublished = sourceFm.published === false;
    const structure = policy.structure || { min_headings: 3, shared_heading_warn_ratio: 0.5, generic_headings: [] };

    for (const v of variants) {
      const text = readText(v);
      const { frontmatter, body } = splitFrontmatter(text);
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

      // V2 duplicate sentences
      const dup = duplicateRatio(body, sourceText, policy.duplicate.sentence_min_chars);
      const pct = Math.round(dup.ratio * 100);
      const sample = dup.shared.slice(0, 3).map((s) => `「${[...s].slice(0, 40).join('')}…」`).join(' ');
      if (dup.ratio >= policy.duplicate.error_ratio) {
        report.error(v, 'V2', `正本 ${t.source} と同一の文が ${dup.shared.length}/${dup.total} 文(${pct}%)あります。複製ではなく媒体別の成果物に書き直してください ${sample}`);
      } else if (dup.ratio >= policy.duplicate.warn_ratio) {
        report.warn(v, 'V2', `正本 ${t.source} と同一の文が ${dup.shared.length}/${dup.total} 文(${pct}%)あります ${sample}`);
      }
      const jac = jaccard(shingles(body, policy.duplicate.shingle_size), sourceShingles);
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
      const sh = sharedHeadingRatio(body, sourceText, structure.generic_headings || []);
      if (sh.total >= (structure.min_headings || 3) && sh.ratio >= structure.shared_heading_warn_ratio) {
        report.warn(v, 'V7', `見出しの ${sh.shared.length}/${sh.total}(${Math.round(sh.ratio * 100)}%)が正本と同じです。節構成の写しではなく、媒体の読者に合わせた粒度と観点で組み直してください(${sh.shared.slice(0, 3).join('、')})`);
      }

      rows.push({ theme: t.id, variant: v, source: t.source, dup: `${pct}%`, jaccard: jac.toFixed(2), headings: `${sh.shared.length}/${sh.total}` });
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
