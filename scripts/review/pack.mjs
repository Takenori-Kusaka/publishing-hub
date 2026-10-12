// レビュー担当へ渡す入力を作る。読者役(cold)には原稿の題名と本文だけを 1 ファイルに書き出し、
// 事実の査読(fact)には原稿・正本・直前の版のパスを列挙する。どちらも .tmp/review/<id>/ に置く。
//
//   node scripts/review/pack.mjs <原稿のパス>
//
// 読者役に渡すのはこのファイルだけ。frontmatter・脚注・リポジトリの情報は入れない。SNS は 1 投稿目を明記する
// (docs/records/editorial-review.md 3 章の手順の機械化)。読者役のセッションは、このファイル以外を開かない。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readText, readYaml, splitFrontmatter } from '../lint/lib.mjs';
import { hashOf } from '../lint/check-review.mjs';
import { previousVersion } from '../lint/git-baseline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function coldText(file) {
  if (/\.ya?ml$/i.test(file)) {
    const y = readYaml(file);
    const parts = [];
    if (y.linkedin?.enabled) {
      parts.push('【LinkedIn の投稿(タイムラインに流れる本文)】', y.linkedin.text || '', '', `リンクカード: ${y.linkedin.article?.title || ''}`, y.linkedin.article?.description || '');
    }
    if (y.bluesky?.enabled) {
      (y.bluesky.posts || []).forEach((p, i) => {
        parts.push('', `【Bluesky ${i + 1} 投稿目${i === 0 ? '(タイムラインに流れるのはこれだけ)' : ''}】`, p.text || '');
        if (p.external) parts.push(`リンクカード: ${p.external.title || ''}`, p.external.description || '');
        if (p.images) for (const img of p.images) parts.push(`[画像: ${img.alt}]`);
      });
    }
    return parts.join('\n');
  }
  const { frontmatter, body } = splitFrontmatter(readText(file));
  const title = frontmatter?.title || path.basename(file);
  // 脚注の定義と Zenn の告知の枠は読者役に渡さない(読者に見える本文だけ)
  const text = body.replace(/^\[\^[^\]]+\]:.*$/gm, '').replace(/^:::message\n[\s\S]*?\n:::$/m, '').trim();
  return `# ${title}\n\n${text}\n`;
}

/** 作業ディレクトリの名前。同じ id の派生物が媒体をまたいで衝突しないよう、媒体を前置する */
export function reviewId(file) {
  const f = String(file).replace(/\\/g, '/');
  const medium = f.startsWith('articles/') ? 'zenn' : f.startsWith('books/') ? 'book' : f.startsWith('platforms/qiita/') ? 'qiita' : f.startsWith('platforms/note/') ? 'note' : f.startsWith('social/') ? 'social' : 'other';
  return `${medium}--${path.basename(f).replace(/\.(md|ya?ml)$/i, '')}`;
}

export function canonicalOf(file) {
  if (/\.ya?ml$/i.test(file)) return readYaml(file)?.source?.path || null;
  const { frontmatter, body } = splitFrontmatter(readText(file));
  if (frontmatter?.source) return frontmatter.source;
  const m = /zenn\.dev\/takenori_kusaka\/articles\/([a-z0-9_-]+)/.exec(body);
  if (m && fs.existsSync(path.join(ROOT, 'articles', `${m[1]}.md`))) return `articles/${m[1]}.md`;
  return null;
}

function main() {
  const file = process.argv[2];
  if (!file) { console.error('使い方: node scripts/review/pack.mjs <原稿のパス>'); process.exit(2); }
  const id = reviewId(file);
  const dir = path.join(ROOT, '.tmp/review', id);
  fs.mkdirSync(dir, { recursive: true });
  const cold = path.join(dir, 'cold.txt');
  const text = coldText(file);
  fs.writeFileSync(cold, text);
  // 査読が読んだ版の本文の写しをリポジトリに残す(docs/records/reviews/)。引用の実在(R3)は、直した後の原稿だけでなくこの写しとも照合する
  const sha = hashOf(readText(file), file);
  const snapDir = path.join(ROOT, 'docs/records/reviews', id);
  fs.mkdirSync(snapDir, { recursive: true });
  const snapshot = `docs/records/reviews/${id}/${sha.slice(0, 7)}.txt`;
  fs.writeFileSync(path.join(ROOT, snapshot), text);
  fs.writeFileSync(path.join(ROOT, `${snapshot.replace(/\.txt$/, '.json')}`), `${JSON.stringify({ manuscript: file, manuscript_sha256: sha, packed_at: new Date().toISOString() }, null, 2)}\n`);
  const canonical = canonicalOf(file);
  let prev = null;
  let pv = null;
  try { pv = previousVersion(file); prev = pv?.text || null; } catch { prev = null; }
  if (prev) fs.writeFileSync(path.join(dir, 'previous.md'), prev);
  // 原稿が HEAD と同じ(下書きをコミット済み)なら、査読が読む版のコミットを記録する。R3 がこの版とも引用を照合する
  const reviewedCommit = pv?.committed ? pv.commit?.sha || null : null;
  const brief = {
    manuscript: file,
    manuscript_sha256: sha,
    reviewed_commit: reviewedCommit,
    reviewed_snapshot: snapshot,
    canonical,
    canonical_sha256: canonical && fs.existsSync(path.join(ROOT, canonical)) ? hashOf(readText(canonical), canonical) : null,
    previous_version: prev ? `.tmp/review/${id}/previous.md` : null,
    cold_input: `.tmp/review/${id}/cold.txt`,
    work_dir: `.tmp/review/${id}`,
    record: file.replace(/\.(md|ya?ml)$/i, '.review.yaml'),
  };
  fs.writeFileSync(path.join(dir, 'brief.json'), `${JSON.stringify(brief, null, 2)}\n`);
  console.log(JSON.stringify(brief, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
