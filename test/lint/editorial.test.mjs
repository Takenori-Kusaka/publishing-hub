import { test } from 'node:test';
import assert from 'node:assert';
import { checkEditorial } from '../../scripts/social/editorial.mjs';

const CANON = 'https://zenn.dev/takenori_kusaka/books/pit-in-process/viewer/the-structure';

function post(overrides = {}) {
  return {
    id: 'x',
    status: 'draft',
    source: { canonical_url: CANON, subject_terms: ['ピットイン方式'] },
    linkedin: {
      enabled: true,
      actor: 'member',
      text: [
        'AIで実装が速くなっても、開発全体が速くなるとは限りません。人間のレビューと意思決定が詰まります。',
        '',
        'ピットイン方式は、既存の稟議を壊さず内側のループだけを高速化する二層の境界線設計です。',
        '',
        '- 外殻: 投資決裁やステージ変更を温存する',
        '- 内側: 仕様定義、AI実装、自動テスト、独立レビューを回す',
        '- 判断の質は検証した観点の数で保証する',
        '',
        '詳細は意思決定プロセスを含めてこちらに整理しました。',
        '',
      ].join('\n'),
      article: { url: CANON, title: 't', description: 'd' },
      hashtags: ['AI開発'],
    },
    bluesky: {
      enabled: true,
      langs: ['ja'],
      posts: [
        { text: `ピットイン方式の話です。AIで実装が高速化すると、ボトルネックは人間の検証と意思決定に移ります。境界線をコード差分から不変条件へ引き上げるのが対策です。\n${CANON}`, external: { url: CANON, title: 't', description: 'd' } },
      ],
    },
    ...overrides,
  };
}

const codes = (r) => ({ e: r.errors.map((x) => x.code), w: r.warnings.map((x) => x.code) });

test('a post following the editorial guide produces no errors', () => {
  const r = checkEditorial(post(), null);
  assert.deepStrictEqual(r.errors, [], JSON.stringify(r.errors));
});

test('LinkedIn: announcement hook, hype, multiple URLs, inline hashtags and missing canonical link are errors', () => {
  const p = post();
  p.linkedin.text = '新しい記事を書きました！絶対に読んでください！革命です。\nhttps://a.example/1 と https://a.example/2 #tag';
  p.linkedin.article = undefined;
  const { e, w } = codes(checkEditorial(p, null));
  for (const c of ['LI_HOOK_ANNOUNCEMENT', 'LI_HYPE', 'LI_URL_COUNT', 'LI_HASHTAG_IN_TEXT', 'SOCIAL_CANONICAL']) assert.ok(e.includes(c), `${c} expected in ${e}`);
  assert.ok(w.includes('SOCIAL_EXCLAMATION'), `exclamation warning expected in ${w}`);
  const q = post();
  q.linkedin.hashtags = ['a', 'b', 'c', 'd'];
  assert.ok(codes(checkEditorial(q, null)).e.includes('LI_HASHTAGS_MAX'));
});

test('LinkedIn: an explanation that merely mentions writing is not an announcement hook; hype patterns spare technical usage', () => {
  const p = post();
  p.linkedin.text = '前回の記事で書きましたが、レビューの詰まりは構造の問題です。\n\n' + p.linkedin.text;
  assert.ok(!codes(checkEditorial(p, null)).e.includes('LI_HOOK_ANNOUNCEMENT'));
  const q = post();
  q.bluesky.posts[0].text = `GPU 使用率が 100% に張り付き、絶対 URL で参照し、産業革命と十月革命を比較しました。\n${CANON}`;
  assert.ok(!codes(checkEditorial(q, null)).e.includes('BS_HYPE'));
  const r = post();
  r.bluesky.posts[0].text = `100%安全で最強のツールです。ぜひご覧ください。\n${CANON}`;
  assert.ok(codes(checkEditorial(r, null)).e.includes('BS_HYPE'));
});

test('LinkedIn: no blank lines in a long text is an error; too few bullets is a warning', () => {
  const p = post();
  p.linkedin.text = 'あ。'.repeat(200);
  const { e } = codes(checkEditorial(p, null));
  assert.ok(e.includes('LI_PARAGRAPH_NO_BREAKS'));
  const q = post();
  q.linkedin.text = '短い主張です。\n\n- 一つ\n- 二つ\n\n出口はこちら。';
  const { w } = codes(checkEditorial(q, null));
  assert.ok(!w.includes('LI_LENGTH_SHORT'), '長さの下限は 2026-09-16 に外した');
  assert.ok(w.includes('LI_BULLETS'));
});

test('Bluesky: thread opener, hashtags, langs, url per post, external per thread and hype are errors', () => {
  const p = post();
  p.bluesky.langs = ['en'];
  p.bluesky.posts = [
    { text: 'スレッドで解説します。(1/3)', external: { url: CANON, title: 't', description: 'd' } },
    { text: '爆速で最強です #a #b #c https://x.example/1 https://x.example/2', external: { url: 'https://x.example/3', title: 't', description: 'd' } },
  ];
  const { e } = codes(checkEditorial(p, null));
  for (const c of ['BS_FIRST_POST', 'BS_HASHTAGS', 'BS_LANGS_JA', 'BS_URL_PER_POST', 'BS_EXTERNAL_MAX', 'BS_HYPE']) assert.ok(e.includes(c), `${c} expected in ${e}`);
});

test('Bluesky: a numbered first post that states its claim is accepted; a URL-only or numbering-only first post is not', () => {
  const p = post();
  p.bluesky.posts[0].text = `AIで実装が高速化すると、ボトルネックは人間の検証と意思決定に移ります。(1/2)\n${CANON}`;
  assert.ok(!codes(checkEditorial(p, null)).e.includes('BS_FIRST_POST'));
  p.bluesky.posts[0].text = `AIで実装が高速化すると検証が詰まります。\n続きは記事で。\n${CANON}`;
  assert.ok(!codes(checkEditorial(p, null)).e.includes('BS_FIRST_POST'), 'a trailing 続きは記事で is a CTA, not a thread opener');
  p.bluesky.posts[0].text = CANON;
  assert.ok(codes(checkEditorial(p, null)).e.includes('BS_FIRST_POST'));
  p.bluesky.posts[0].text = `(1/3)\n${CANON}`;
  assert.ok(codes(checkEditorial(p, null)).e.includes('BS_FIRST_POST'));
  p.bluesky.posts[0].text = `スレッドで解説します。(1/3)\n${CANON}`;
  assert.ok(codes(checkEditorial(p, null)).e.includes('BS_FIRST_POST'));
});

test('canonical link may be satisfied by the card, the external embed or the text; UTM in canonical is rejected', () => {
  const p = post();
  p.bluesky.posts[0].external = undefined;
  assert.ok(!codes(checkEditorial(p, null)).e.includes('SOCIAL_CANONICAL'), 'text contains the URL');
  p.bluesky.posts[0].text = '本文だけで URL なし。';
  assert.ok(codes(checkEditorial(p, null)).e.includes('SOCIAL_CANONICAL'));
  const u = post({ source: { canonical_url: CANON + '?utm_source=x' } });
  assert.ok(codes(checkEditorial(u, null)).e.includes('SOCIAL_UTM_PRESENT'));
});

test('SNS: the opening must name what the post is about', () => {
  // 2026-09-16 に LinkedIn で実際に起きた失敗の回帰。何のアプリの話かを一度も書かない投稿を止める。
  const CANON2 = 'https://zenn.dev/takenori_kusaka/books/quickscribe-design/viewer/default-model-reversal';
  const base = {
    id: 'x',
    status: 'draft',
    source: { canonical_url: CANON2, subject_terms: ['QuickScribe'] },
    linkedin: { enabled: true, text: `公開した自分の設計判断が、録音1本で覆りました。\n\n${CANON2}` },
  };
  const bad = checkEditorial(base, null);
  assert.ok(bad.errors.some((e) => e.code === 'SOCIAL_CONTEXT_SUBJECT'), '対象を名乗らない冒頭はエラー');
  assert.ok(bad.errors.some((e) => e.code === 'SOCIAL_CONTEXT_SELF_REFERENCE'), '正本を読んでいる前提の書き出しはエラー');

  const good = { ...base, linkedin: { enabled: true, text: `自作の音声ジャーナルアプリ QuickScribe で、録音の末尾24秒が欠落しました。\n\n${CANON2}` } };
  const r = checkEditorial(good, null);
  assert.ok(!r.errors.some((e) => e.code.startsWith('SOCIAL_CONTEXT')));
});

test('SNS: subject_terms itself is required, in draft too', () => {
  const CANON2 = 'https://zenn.dev/takenori_kusaka/articles/x';
  const data = { id: 'x', status: 'draft', source: { canonical_url: CANON2 }, linkedin: { enabled: true, text: `本文です。\n\n${CANON2}` } };
  assert.ok(checkEditorial(data, null).errors.some((e) => e.code === 'SOCIAL_CONTEXT_SUBJECT'));
});

test('SNS: a demonstrative that resolves inside the same sentence is allowed', () => {
  // 規則を広げすぎると、正しい日本語まで止めて文章を悪くする。原稿の外を指す形だけを見る。
  const CANON2 = 'https://zenn.dev/takenori_kusaka/articles/x';
  const data = {
    id: 'x',
    status: 'draft',
    source: { canonical_url: CANON2, subject_terms: ['QuickScribe'] },
    linkedin: { enabled: true, text: `QuickScribe の文字起こしは、その上に載る整形すべてを支える床でした。\n\n${CANON2}` },
  };
  assert.ok(!checkEditorial(data, null).errors.some((e) => e.code === 'SOCIAL_CONTEXT_SELF_REFERENCE'));
});
