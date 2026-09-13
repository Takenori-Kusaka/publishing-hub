// 公開原稿を人が確認した記録があるかを、公開の直前に確かめる(publish-qiita / publish-note / social-publish の門)。
//
//   node scripts/lint/check-human-review.mjs --channel qiita [--before <sha> --after <sha>]
//   node scripts/lint/check-human-review.mjs --channel note --post-id <id>
//   node scripts/lint/check-human-review.mjs --channel social --post-id <id>
//
// 原稿の告知と宣言は「筆者が内容を確認・修正したうえで公開しています」と書きます。この文を事実にするため、
// 原稿の本文を変更した最新のコミットと同じか、それより新しいコミットに、人の Reviewed-by トレーラーがあることを求めます。
// 作者は問いません。共著記録(Co-Authored-By)を付けずに生成AIが改訂したコミットも、人の確認なしには通さないためです。
// 数えないのは、frontmatter だけを変えたコミット(Qiita CLI の同期など)と bot のコミットです。
// レビューを記録するコミットは、その原稿を変更するか、Reviewed-path トレーラーで原稿のパスを示します。
//
//   H1  公開原稿の最新の変更に、人の確認(Reviewed-by)の記録がない
//
// 人の確認を記録する例(内容を読んで問題がなければ):
//   git commit --allow-empty -m "review: Qiita 版を確認" \
//     --trailer "Reviewed-by: 名前 <メール>" --trailer "Reviewed-path: platforms/qiita/public/<id>.md"

import { readText, readJson, readYaml, listFiles, isLegacyQiita, splitFrontmatter, exists, Report, parseArgs, finish, isMain } from './lib.mjs';
import { loadDisclosurePolicy } from './disclosure.mjs';
import { git, showAt, hasFullHistory, trailerNames } from './git-baseline.mjs';

const REVIEW_POLICY = 'lint/derive/review-policy.json';

/** 公開前の人の確認の運用方針。既定は human(安全側)。lint/derive/review-policy.json の mode で切り替える */
export function reviewMode() {
  try {
    return exists(REVIEW_POLICY) && readJson(REVIEW_POLICY).mode === 'auto' ? 'auto' : 'human';
  } catch {
    return 'human';
  }
}

export function isAiName(name, policy = loadDisclosurePolicy()) {
  return (policy.declaration.trailer_tools?.tools || []).some((t) => new RegExp(t.trailer, 'i').test(name));
}

export function isBot(author) {
  return /\[bot\]$|^github-actions/i.test(String(author || '').trim());
}

/**
 * commits は新しい順の { sha, author, coAuthors, reviewers, reviewedPaths, touches, bodyChanged }。
 * 原稿の本文を変更した最新のコミット(bot と frontmatter だけの変更を除く)と同じか新しいコミットに、
 * 人の Reviewed-by(原稿を変更するか Reviewed-path で指す)があるか。
 */
export function reviewStatus(commits, file, policy = loadDisclosurePolicy()) {
  const base = commits.findIndex((c) => c.touches && c.bodyChanged !== false && !isBot(c.author));
  if (base < 0) return { needed: false, reviewed: true };
  const reviewed = commits
    .slice(0, base + 1)
    .some((c) => c.reviewers.some((r) => !isAiName(r, policy)) && (c.touches || c.reviewedPaths.includes(file)));
  const c = commits[base];
  return { needed: true, reviewed, commit: c.sha, ai: c.coAuthors.some((a) => isAiName(a, policy)) };
}

/** sha がこの原稿の本文を変えたか(Markdown は frontmatter を除いて比べる) */
export function bodyChangedAt(sha, file) {
  const after = showAt(sha, file);
  const before = showAt(`${sha}^`, file);
  if (after === null || before === null) return true;
  if (!/\.md$/i.test(file)) return before !== after;
  return splitFrontmatter(before).body.trim() !== splitFrontmatter(after).body.trim();
}

/** 履歴全体のコミット(新しい順)と、そのうち file を変更したもの。本文の変更の有無は、最新の本文の変更が見つかるまで調べる */
export function commitsFor(file) {
  const SEP = '\x1f';
  const REC = '\x1e';
  const out = git(['log', `--format=%H${SEP}%an${SEP}%(trailers:key=Co-Authored-By,valueonly,separator=%x1d)${SEP}%(trailers:key=Reviewed-by,valueonly,separator=%x1d)${SEP}%(trailers:key=Reviewed-path,valueonly,separator=%x1d)${REC}`, 'HEAD']);
  const touching = new Set(git(['log', '--format=%H', '--', file]).split(/\r?\n/).filter(Boolean));
  const commits = out
    .split(REC)
    .map((r) => r.replace(/^\s+/, ''))
    .filter(Boolean)
    .map((r) => {
      const [sha, author, co, rev, paths] = r.split(SEP);
      return { sha, author, coAuthors: trailerNames(co), reviewers: trailerNames(rev), reviewedPaths: trailerNames(paths), touches: touching.has(sha) };
    });
  for (const c of commits) {
    if (!c.touches || isBot(c.author)) continue;
    c.bodyChanged = bodyChangedAt(c.sha, file);
    if (c.bodyChanged) break;
  }
  return commits;
}

function changedFiles(before, after, dir) {
  if (!before || /^0+$/.test(before) || !after) return null;
  try {
    return git(['diff', '--name-only', before, after, '--', dir]).split(/\r?\n/).filter((f) => f.endsWith('.md') && !/README\.md$/.test(f));
  } catch {
    return null;
  }
}

export function targets({ channel, before, after, postId }) {
  if (channel === 'qiita') {
    const dir = 'platforms/qiita/public';
    const files = changedFiles(before, after, dir) ?? listFiles([`${dir}/*.md`]);
    return files.filter((f) => exists(f) && !isLegacyQiita(f)).filter((f) => {
      const fm = splitFrontmatter(readText(f)).frontmatter || {};
      return fm.private === false && fm.ignorePublish !== true;
    });
  }
  if (channel === 'note') {
    const dir = 'platforms/note/public';
    const files = postId ? [`${dir}/${postId}.md`] : changedFiles(before, after, dir) ?? listFiles([`${dir}/*.md`], { exclude: [`${dir}/README.md`] });
    return files.filter((f) => exists(f)).filter((f) => ['ready', 'published'].includes((splitFrontmatter(readText(f)).frontmatter || {}).status));
  }
  if (channel === 'social') {
    if (!postId) throw new Error('--channel social には --post-id が必要です');
    const f = [`social/posts/${postId}.yaml`, `social/posts/${postId}.yml`].find((p) => exists(p));
    return f && ['ready', 'published'].includes(readYaml(f)?.status) ? [f] : [];
  }
  throw new Error(`--channel は qiita か note か social です(${channel})`);
}

export function checkHumanReview(opts) {
  const report = new Report('human-review');
  if (!hasFullHistory()) {
    report.error('.git', 'H1', 'git の履歴が浅い(shallow)か git が使えないため、人の確認の記録を確かめられません。checkout に fetch-depth: 0 を指定してください');
    return report;
  }
  const policy = loadDisclosurePolicy();
  const mode = reviewMode();
  const files = targets(opts);
  if (!files.length) report.note('確認の対象になる公開原稿はありません');
  for (const f of files) {
    report.file(f);
    const s = reviewStatus(commitsFor(f), f, policy);
    if (s.needed && !s.reviewed) {
      if (mode === 'auto') {
        report.note(`${f}: 人の Reviewed-by はありませんが、方針が auto のため機械の検査(validate と帰属先行パイプラインの判定)を確認とみなします(lint/derive/review-policy.json)。微妙な事実の歪みは公開後に直す前提です`);
      } else {
        report.error(f, 'H1', `この公開原稿の本文を最後に変更したコミット ${s.commit.slice(0, 7)}${s.ai ? '(生成AIが共著)' : ''} 以降に、人の確認(Reviewed-by)の記録がありません。人が内容を確認してから、原稿を変更するコミットか空のコミットに "Reviewed-by: 名前 <メール>" と "Reviewed-path: ${f}" を付けてください`);
      }
    }
  }
  return report;
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  const channel = args.values.get('channel');
  finish(checkHumanReview({ channel, before: args.values.get('before'), after: args.values.get('after'), postId: args.values.get('post-id') || args.values.get('id') }), args);
}
