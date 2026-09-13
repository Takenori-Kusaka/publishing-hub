// SNS 原稿(YAML)の編集規則。docs/social-editorial-guide.md と AGENTS.md 2 章の
// ハウスルールを機械化したもの。validate.mjs から呼ばれ、social:validate の結果に合流する。
//
// LinkedIn(専門家向けの短論考)
//   LI_LENGTH_*        推奨 600〜1,600 字(レンダリング後)。2,400 で警告、3,000 超はエラー(validate.mjs)
//   LI_HOOK_*          冒頭 140 字は「記事を書きました」型の告知や URL ではなく、論点で始める
//   LI_PARAGRAPH_*     1〜3 文で 1 段落、空行で区切る
//   LI_BULLETS         箇条書きは 3〜5 項目
//   LI_URL_COUNT       本文中の URL は 1 つまで(出口を 1 つに絞る)
//   LI_HASHTAG_IN_TEXT ハッシュタグは hashtags フィールドへ(本文に # を書かない)
//   LI_STRUCTURE       フック ➔ 主張 ➔ 根拠 ➔ 含意 ➔ 出口 の 5 ブロック(段落数と出口で近似)
//   LI_HYPE            煽り・セールストーク
//
// Bluesky(返信可能な 1 つの発見)
//   BS_FIRST_POST      1 投稿目だけで主張が成立する(「スレッドを開始します」だけの投稿は禁止)
//   BS_LENGTH_SHORT    推奨 180〜260 grapheme(上限は validate.mjs)
//   BS_HASHTAGS        1 投稿 0〜2 個
//   BS_LANGS_JA        日本語の投稿には langs: [ja]
//   BS_URL_PER_POST    1 投稿 1 URL
//   BS_EXTERNAL_MAX    外部カードは 1 スレッド 1 件
//   BS_ONE_POINT       1 投稿 1 論点(文の数で近似)
//   BS_HYPE            煽り・セールストーク
//
// 共通
//   SOCIAL_CANONICAL   有効な媒体ごとに正本(source.canonical_url)への導線がある
//   SOCIAL_UTM_PRESENT canonical_url に utm_ が入っていない(レンダラーが付与する)
//   SOCIAL_EXCLAMATION 「！」の多用(警告)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { countGraphemes } from './graphemes.mjs';
import { URL_RE as SHARED_URL_RE } from '../lint/lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

export function loadSocialPolicy() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'lint/policies/social.json'), 'utf8'));
}

export function loadExpressions() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'lint/policies/expressions.json'), 'utf8'));
}

// lib.mjs と同じ URL の定義(日本語の直後の助詞や句点で切る)
const URL_RE = new RegExp(SHARED_URL_RE.source, 'g');
const HASHTAG_RE = /(^|\s)#[^\s#]+/g;

function countUrls(text) {
  return (text.match(URL_RE) || []).length;
}

function countSentences(text) {
  return (text.replace(URL_RE, '').match(/[^。！？!?\n]+[。！？!?]/g) || []).length;
}

function hasJapanese(text) {
  return /[぀-ヿ㐀-鿿]/.test(text);
}

function hypeHits(text, expressions) {
  const hits = [];
  for (const p of expressions.hype.patterns) {
    const re = new RegExp(p.pattern, 'g');
    let m;
    while ((m = re.exec(text))) hits.push({ found: m[0], label: p.label });
  }
  return hits;
}

function stripUrls(text) {
  return text.replace(URL_RE, '');
}

/**
 * @param {object} data      投稿 YAML(スキーマ検証済み)
 * @param {object|null} rendered renderPost(data) の結果(UTM 付与済み)。失敗時は null
 */
export function checkEditorial(data, rendered, policy = loadSocialPolicy(), expressions = loadExpressions()) {
  const errors = [];
  const warnings = [];
  const err = (code, message) => errors.push({ code, message });
  const warn = (code, message) => warnings.push({ code, message });
  const canonical = data.source?.canonical_url || '';

  if (canonical && /[?&]utm_/.test(canonical)) {
    err('SOCIAL_UTM_PRESENT', 'source.canonical_url に utm_ パラメータが含まれています。UTM はレンダラーが付与するので原稿には書きません');
  }

  // ready の原稿が指す正本が未公開だと、配信時に導線が死ぬ(公開の順序は人が決めるので警告)
  if (data.status === 'ready' && data.source?.path && /^(articles|books)\//.test(data.source.path)) {
    try {
      const src = fs.readFileSync(path.join(ROOT, data.source.path), 'utf8');
      const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(src);
      if (fm && /^published:\s*false\s*$/m.test(fm[1])) {
        warn('SOCIAL_SOURCE_UNPUBLISHED', `status が ready ですが正本 ${data.source.path} は published: false です。正本を公開してから配信してください`);
      }
    } catch {
      // 存在確認は validate.mjs が行う
    }
  }

  // ---------------------------------------------------------------- LinkedIn
  if (data.linkedin?.enabled) {
    const li = data.linkedin;
    const p = policy.linkedin;
    const raw = String(li.text || '');
    const renderedText = rendered?.linkedin?.text ?? raw;
    const len = renderedText.length;

    if (len && len < p.chars.recommended_min) warn('LI_LENGTH_SHORT', `linkedin.text は ${len} 字です。推奨は ${p.chars.recommended_min}〜${p.chars.recommended_max} 字(根拠と含意を足してください)`);
    else if (len > p.chars.recommended_max && len < p.chars.warn) warn('LI_LENGTH_LONG', `linkedin.text は ${len} 字です。推奨は ${p.chars.recommended_min}〜${p.chars.recommended_max} 字(1 論点に絞ってください)`);

    const head = raw.slice(0, p.hook.first_chars);
    for (const pat of expressions.announcement_openers.patterns) {
      const m = new RegExp(pat).exec(head);
      if (m) {
        err('LI_HOOK_ANNOUNCEMENT', `冒頭 ${p.hook.first_chars} 字に告知型の表現「${m[0]}」があります。「もっと見る」で隠れない範囲に論点や意外な変化を置いてください`);
        break;
      }
    }
    if (URL_RE.test(head)) warn('LI_HOOK_URL', `冒頭 ${p.hook.first_chars} 字に URL があります。出口(URL)は末尾に置き、冒頭は論点にしてください`);
    URL_RE.lastIndex = 0;

    const paragraphs = raw.split(/\n[ \t]*\n/).map((s) => s.trim()).filter(Boolean);
    if (raw.length > p.paragraph.require_blank_lines_over_chars && paragraphs.length < 2) {
      err('LI_PARAGRAPH_NO_BREAKS', `linkedin.text が ${raw.length} 字で段落の区切り(空行)がありません。1〜3 文ごとに空行で区切ってください`);
    }
    paragraphs.forEach((para, i) => {
      if (/^(?:[-*・•]|\d+[.)])\s/m.test(para)) return; // 箇条書きの段落は文数で見ない
      const n = countSentences(para);
      if (n > p.paragraph.max_sentences) warn('LI_PARAGRAPH_LONG', `第 ${i + 1} 段落が ${n} 文あります。1 段落は ${p.paragraph.max_sentences} 文までにして空行で区切ってください`);
    });

    const bullets = (raw.match(/^[ \t]*(?:[-*・•]|\d+[.)])[ \t]+\S/gm) || []).length;
    if (bullets > 0 && (bullets < p.bullets.min || bullets > p.bullets.max)) {
      warn('LI_BULLETS', `箇条書きが ${bullets} 項目です。${p.bullets.min}〜${p.bullets.max} 項目に整えてください`);
    }

    const urls = countUrls(raw);
    if (urls > p.urls.max_in_text) err('LI_URL_COUNT', `linkedin.text に URL が ${urls} 個あります。出口は ${p.urls.max_in_text} つに絞ってください`);
    if (urls === 1 && li.article?.url) warn('LI_URL_WITH_CARD', '本文の URL と article(共有カード)の両方があります。出口が 2 つになるので、どちらかに絞ることを検討してください');

    if (HASHTAG_RE.test(stripUrls(raw))) err('LI_HASHTAG_IN_TEXT', 'linkedin.text にハッシュタグ(#)があります。hashtags フィールドに書き、本文には書きません');
    HASHTAG_RE.lastIndex = 0;
    if (Array.isArray(li.hashtags) && li.hashtags.length > p.hashtags.max) err('LI_HASHTAGS_MAX', `hashtags が ${li.hashtags.length} 個です(${p.hashtags.max} 個まで)`);

    if (paragraphs.length < 3) warn('LI_STRUCTURE', `段落が ${paragraphs.length} つです。フック ➔ 主張 ➔ 根拠 ➔ 含意 ➔ 出口 の流れが作れる段落数(3 以上)にしてください`);
    const last = paragraphs[paragraphs.length - 1] || '';
    const hasExit = URL_RE.test(last) || /[？?]$/.test(last) || /(詳細|こちら|まとめ|整理しました|参照)/.test(last) || Boolean(li.article?.url);
    URL_RE.lastIndex = 0;
    if (!hasExit) warn('LI_STRUCTURE', '末尾に出口(URL・問い・次の行動)がありません');

    const sev = expressions.hype.severity.linkedin;
    for (const h of hypeHits(stripUrls(raw), expressions)) {
      (sev === 'error' ? err : warn)('LI_HYPE', `煽り・セールストーク「${h.found}」(${h.label})は禁止です(AGENTS.md 2.1)`);
    }

    const bangs = (raw.match(/[！!]/g) || []).length;
    if (bangs > policy.common.exclamation_warn_over) warn('SOCIAL_EXCLAMATION', `linkedin.text に「！」が ${bangs} 個あります。専門家向けの論考では抑えてください`);

    if (policy.common.require_canonical_link && canonical) {
      const has = raw.includes(canonical) || li.article?.url === canonical;
      if (!has) err('SOCIAL_CANONICAL', `LinkedIn に正本(${canonical})への導線がありません。article.url か本文にその URL を置いてください`);
    }
  }

  // ---------------------------------------------------------------- Bluesky
  if (data.bluesky?.enabled) {
    const bs = data.bluesky;
    const p = policy.bluesky;
    const posts = bs.posts || [];
    const langs = bs.langs || [];
    let externals = 0;
    let canonicalSeen = false;

    posts.forEach((post, i) => {
      const text = String(post.text || '');
      const g = countGraphemes(text);
      if (g && g < p.graphemes.recommended_min) warn('BS_LENGTH_SHORT', `bluesky.posts[${i}] は ${g} grapheme です。推奨は ${p.graphemes.recommended_min}〜${p.graphemes.recommended_max}(1 つの観察を具体的に書いてください)`);

      if (i === 0) {
        const stripped = stripUrls(text).trim();
        if (!stripped) err('BS_FIRST_POST', '1 投稿目が URL だけです。1 投稿目だけで主張が成立する文にしてください');
        // 番号(1/3 など)と CTA ラベルを除いて何も残らない投稿は主張がない
        const withoutNumbering = stripped.replace(/(【?\d+\/\d+】?|\(\d+\/\d+\))/g, '').replace(/(詳細|詳しく)は?こちら[：:]?/g, '').trim();
        if (stripped && !withoutNumbering) err('BS_FIRST_POST', '1 投稿目が番号や導線だけです。1 投稿目だけで主張が成立する文にしてください');
        for (const pat of p.first_post_thread_markers) {
          // マーカーは投稿の冒頭(1 文目)にだけ当てる。末尾の「続きは記事で」などは導線なので許す
          if (new RegExp(pat).test(stripped)) {
            err('BS_FIRST_POST', `1 投稿目に「${pat}」型のスレッド開始表現があります。1 投稿目だけで主張が成立する文にしてください`);
            break;
          }
        }
      }

      const tags = (stripUrls(text).match(HASHTAG_RE) || []).length;
      if (tags > p.hashtags.max_per_post) err('BS_HASHTAGS', `bluesky.posts[${i}] のハッシュタグが ${tags} 個です(${p.hashtags.max_per_post} 個まで)`);

      const urls = countUrls(text);
      if (urls > p.urls.max_per_post) err('BS_URL_PER_POST', `bluesky.posts[${i}] に URL が ${urls} 個あります(1 投稿 ${p.urls.max_per_post} URL)`);

      const n = countSentences(text);
      if (n > p.sentences.max_per_post) warn('BS_ONE_POINT', `bluesky.posts[${i}] が ${n} 文あります。1 投稿 1 論点(${p.sentences.max_per_post} 文まで)に絞ってください`);

      if (hasJapanese(text) && !langs.includes('ja')) err('BS_LANGS_JA', '日本語の投稿には langs に ja を含めてください');

      if (post.external) {
        externals++;
        if (post.external.url === canonical) canonicalSeen = true;
      }
      if (canonical && text.includes(canonical)) canonicalSeen = true;

      const sev = expressions.hype.severity.bluesky;
      for (const h of hypeHits(stripUrls(text), expressions)) {
        (sev === 'error' ? err : warn)('BS_HYPE', `bluesky.posts[${i}] の煽り・セールストーク「${h.found}」(${h.label})は禁止です(AGENTS.md 2.2)`);
      }
      const bangs = (text.match(/[！!]/g) || []).length;
      if (bangs > policy.common.exclamation_warn_over) warn('SOCIAL_EXCLAMATION', `bluesky.posts[${i}] に「！」が ${bangs} 個あります`);
    });

    if (externals > p.thread.max_external) err('BS_EXTERNAL_MAX', `外部カード(external)が ${externals} 件あります。1 スレッド ${p.thread.max_external} 件までです`);
    if (policy.common.require_canonical_link && canonical && posts.length && !canonicalSeen) {
      err('SOCIAL_CANONICAL', `Bluesky に正本(${canonical})への導線がありません。external.url か本文にその URL を置いてください`);
    }
  }

  return { errors, warnings };
}
