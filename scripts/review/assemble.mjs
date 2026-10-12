// 別々のセッションが書いた査読(fact.yaml)と読者役(cold.yaml)の出力を、取りまとめ役の meta.yaml と合わせて
// 記録(<原稿>.review.yaml)に組み立てる。取りまとめ役は fact_review / cold_read の中身を書き換えない(写すだけ)。
//
//   node scripts/review/assemble.mjs <原稿のパス>
//
// 読むもの: .tmp/review/<id>/fact.yaml(premortem, fact_review, fact_session_id)、.tmp/review/<id>/cold.yaml(cold_read, cold_session_id)、
//           .tmp/review/<id>/meta.yaml(subject.terms, medium, canonical, writer_session_id, allowed_inputs, persona_cold, adoption, summary)
// 書くもの: <原稿>.review.yaml。subject.sha256 と canonical[].sha256 は原稿と正本から計算する。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { readText } from '../lint/lib.mjs';
import { hashOf } from '../lint/check-review.mjs';
import { reviewId } from './pack.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readYamlFile(p) {
  return YAML.parse(fs.readFileSync(p, 'utf8'));
}

function main() {
  const file = process.argv[2];
  if (!file) { console.error('使い方: node scripts/review/assemble.mjs <原稿のパス>'); process.exit(2); }
  const id = reviewId(file);
  const dir = path.join(ROOT, '.tmp/review', id);
  const fact = readYamlFile(path.join(dir, 'fact.yaml'));
  const cold = readYamlFile(path.join(dir, 'cold.yaml'));
  const meta = readYamlFile(path.join(dir, 'meta.yaml'));
  // 査読が読んだ時点の原稿のハッシュは pack.mjs の brief.json にある(直した後の原稿は採否表の fixed_in_sha256 が指す)
  const briefPath = path.join(dir, 'brief.json');
  const brief = fs.existsSync(briefPath) ? JSON.parse(fs.readFileSync(briefPath, 'utf8')) : {};
  const record = {
    schema: 'review-record/1',
    subject: {
      path: file,
      sha256: meta.subject_sha256 || brief.manuscript_sha256 || hashOf(readText(file)),
      ...(meta.reviewed_commit || brief.reviewed_commit ? { reviewed_commit: meta.reviewed_commit || brief.reviewed_commit } : {}),
      ...(meta.reviewed_snapshot || brief.reviewed_snapshot ? { reviewed_snapshot: meta.reviewed_snapshot || brief.reviewed_snapshot } : {}),
      medium: meta.medium,
      terms: meta.terms,
    },
    canonical: (meta.canonical || []).map((c) => (typeof c === 'string' ? { path: c } : c)).map((c) => (
      /^https?:/.test(c.path) || !fs.existsSync(path.join(ROOT, c.path)) ? { path: c.path } : { path: c.path, sha256: hashOf(readText(c.path)) }
    )),
    reviewer: {
      kind: meta.kind || 'agent',
      fact_session_id: fact.fact_session_id,
      cold_session_id: cold.cold_session_id,
      writer_session_id: meta.writer_session_id,
      allowed_inputs: meta.allowed_inputs,
      persona_cold: meta.persona_cold,
    },
    premortem: fact.premortem,
    fact_review: fact.fact_review,
    cold_read: cold.cold_read,
    adoption: meta.adoption || [],
    summary: meta.summary,
  };
  const out = file.replace(/\.(md|ya?ml)$/i, '.review.yaml');
  const header = `# 公開前のセルフレビューの記録。fact_review と cold_read は執筆者と別のセッションの出力をそのまま写したもの(scripts/review/assemble.mjs)。\n# 検査は scripts/lint/check-review.mjs(R1〜R8)、手順は docs/self-review.md。手で編集するのは adoption と summary だけ。\n`;
  fs.writeFileSync(path.join(ROOT, out), header + YAML.stringify(record, { lineWidth: 0 }));
  console.log(`書きました: ${out}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
