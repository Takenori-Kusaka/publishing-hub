// 生成AIが変更した公開原稿を、人が確認した記録があるかを公開の直前に確かめる(publish-qiita / publish-note の門)。
//
//   node scripts/lint/check-human-review.mjs --channel qiita [--before <sha> --after <sha>]
//   node scripts/lint/check-human-review.mjs --channel note --post-id <id>
//
// 原稿の告知と宣言は「筆者が内容を確認・修正したうえで公開しています」と書きます。この文を事実にするため、
// 原稿を変更した最新の「生成AIが共著のコミット」(Co-Authored-By が lint/policies/disclosure.json の
// trailer_tools に当たる)と同じか、それより新しいコミットに、人の Reviewed-by トレーラーがあることを求めます。
// レビューを記録するコミットは、その原稿を変更するか、Reviewed-path トレーラーで原稿のパスを示します。
//
//   H1  生成AIが変更した公開原稿に、人の確認(Reviewed-by)の記録がない
//
// 人の確認を記録する例(内容を読んで問題がなければ):
//   git commit --allow-empty -m "review: Qiita 版を確認" \
//     --trailer "Reviewed-by: 名前 <メール>" --trailer "Reviewed-path: platforms/qiita/public/<id>.md"

import { execFileSync } from 'node:child_process';
import { ROOT, readText, listFiles, isLegacyQiita, splitFrontmatter, exists, Report, parseArgs, finish, isMain } from './lib.mjs';
import { loadDisclosurePolicy } from './disclosure.mjs';

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

export function isAiName(name, policy = loadDisclosurePolicy()) {
  return (policy.declaration.trailer_tools?.tools || []).some((t) => new RegExp(t.trailer, 'i').test(name));
}

/**
 * commits は新しい順の { sha, coAuthors, reviewers, reviewedPaths, touches }。
 * 原稿を変更した最新の AI 共著コミットと同じか新しいコミットに、人の Reviewed-by(原稿を変更するか Reviewed-path で指す)があるか。
 */
export function reviewStatus(commits, file, policy = loadDisclosurePolicy()) {
  const ai = commits.findIndex((c) => c.touches && c.coAuthors.some((a) => isAiName(a, policy)));
  if (ai < 0) return { needed: false, reviewed: true };
  const reviewed = commits
    .slice(0, ai + 1)
    .some((c) => c.reviewers.some((r) => !isAiName(r, policy)) && (c.touches || c.reviewedPaths.includes(file)));
  return { needed: true, reviewed, aiCommit: commits[ai].sha };
}

function names(s) {
  return String(s || '').split(/[\x1d\r\n]+/).map((x) => x.replace(/<[^>]*>/g, '').trim()).filter(Boolean);
}

/** 履歴全体のコミット(新しい順)と、そのうち file を変更したもの */
export function commitsFor(file) {
  const SEP = '\x1f';
  const REC = '\x1e';
  const out = git(['log', `--format=%H${SEP}%(trailers:key=Co-Authored-By,valueonly,separator=%x1d)${SEP}%(trailers:key=Reviewed-by,valueonly,separator=%x1d)${SEP}%(trailers:key=Reviewed-path,valueonly,separator=%x1d)${REC}`, 'HEAD']);
  const touching = new Set(git(['log', '--format=%H', '--', file]).split(/\r?\n/).filter(Boolean));
  return out
    .split(REC)
    .map((r) => r.replace(/^\s+/, ''))
    .filter(Boolean)
    .map((r) => {
      const [sha, co, rev, paths] = r.split(SEP);
      return { sha, coAuthors: names(co), reviewers: names(rev), reviewedPaths: names(paths), touches: touching.has(sha) };
    });
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
  throw new Error(`--channel は qiita か note です(${channel})`);
}

export function checkHumanReview(opts) {
  const report = new Report('human-review');
  let shallow = true;
  try {
    shallow = git(['rev-parse', '--is-shallow-repository']).trim() !== 'false';
  } catch {
    // git が使えない
  }
  if (shallow) {
    report.error('.git', 'H1', 'git の履歴が浅い(shallow)ため、人の確認の記録を確かめられません。checkout に fetch-depth: 0 を指定してください');
    return report;
  }
  const policy = loadDisclosurePolicy();
  const files = targets(opts);
  if (!files.length) report.note('確認の対象になる公開原稿はありません');
  for (const f of files) {
    report.file(f);
    const s = reviewStatus(commitsFor(f), f, policy);
    if (s.needed && !s.reviewed) {
      report.error(f, 'H1', `生成AIが共著のコミット ${s.aiCommit.slice(0, 7)} がこの公開原稿を変更していますが、それ以降に人の確認(Reviewed-by)の記録がありません。人が内容を確認してから、原稿を変更するコミットか空のコミットに "Reviewed-by: 名前 <メール>" と "Reviewed-path: ${f}" を付けてください`);
    }
  }
  return report;
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  const channel = args.values.get('channel');
  finish(checkHumanReview({ channel, before: args.values.get('before'), after: args.values.get('after'), postId: args.values.get('post-id') || args.values.get('id') }), args);
}
