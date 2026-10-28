// 公開前のセルフレビューの記録(<原稿>.review.yaml)を検査する。公開のスイッチが立った原稿ごとに、記録が
// 「ある・新しい・引用が実在する・止める指摘が処理済み・読者役が主題を言えた・執筆者と別のセッションが書いた」ことを確かめる。
//
//   node scripts/lint/check-review.mjs [--strict] [--report out.json] [--channel zenn|qiita|note|social] [--post-id <id>]
//   node scripts/lint/check-review.mjs --hash <path>      # 原稿の正規化ハッシュを出す(記録の subject.sha256 に書く)
//
//   R1 公開のスイッチが立った原稿に記録がある(この仕組みより前に公開した原稿は policy の grandfathered。本文が変わったら記録が要る)
//   R2 記録が新しい。subject.sha256(か採否表の fixed_in_sha256)が現在の原稿の正規化ハッシュと一致し、canonical[].sha256 も一致する
//   R3 引用が実在する。claims[].quote / findings[].quote / cold_read の quote が原稿に、source_quote が正本(リポジトリ内)に逐語である
//   R4 未支持(unsupported / contradicts)の主張と「止める」の指摘に、採否表の行があり、決定が「保留」でない。「直す」「削る」は fixed_in_sha256 が現在の原稿と一致する
//   R5 読者役の実質。subject_identified が subject.terms のいずれかを含み、subject_is_named_in_first_lines が true。候補(分からなかった語・離脱点)が 1 件以上
//   R6 独立性。fact / cold のセッション ID が執筆者と異なる。cold の allowed_inputs が subject_body_only だけ。記録を最後に変えたコミットが原稿本体を変えていない(未コミットなら注意)
//   R7 判定。summary.verdict が go か go-with-fixes。no-go は失敗
//   R8 確認しなかったことの宣言(not_checked)がある。主張が min_claims 件以上ある
//
// 規則の値は lint/policies/review.json、記録の書式は lint/review/review-record.schema.json、手順は docs/self-review.md。
// 根拠: kusaka-brand/research/04-self-review-research.md(校閲の分業、PBR、LLM 審判の自己選好バイアス、claim→source span)。

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import { abs, readText, readJson, readYaml, listFiles, exists, isLegacyQiita, splitFrontmatter, Report, parseArgs, finish, isMain } from './lib.mjs';
import { git, showAt } from './git-baseline.mjs';
import { isPublishable } from '../note-ledger.mjs';

const POLICY = 'lint/policies/review.json';
const SCHEMA = 'lint/review/review-record.schema.json';

/**
 * Qiita CLI が同期のたびに書き戻す frontmatter を、同期前の形へそろえる。
 * 公開すると id と updated_at が入り、キャンペーンのキーが足され、title の引用符が外れる(長い題名は折り返し形式 >- になる)。
 * タグも Qiita 側の表記(vite、GithubPages のような大文字小文字)に書き換えられるが、元の表記は分からないので、そろえない。タグは最初から Qiita の表記で書く。
 * 人が書いた内容は変わらないので、ここをそろえないと、公開しただけで記録の照合(R2・R4)が落ちる。
 * title・tags・private など、人が決める欄はそのまま残す(変えれば照合は落ちる)。
 */
const QIITA_FILE = /^platforms\/qiita\/public\/[^/]+\.md$/;
const QIITA_SYNC_DROP = /^(posting_campaign_uuid|agreed_posting_campaign_term):/;
export function canonicalizeQiitaSync(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) return text;
  // 折り返し形式の title(title: >- と、それに続く字下げ行)を 1 行に戻す(折り返しは空白 1 つで結ぶ)
  const lines = [];
  const src = m[1].split('\n');
  for (let i = 0; i < src.length; i += 1) {
    const l = src[i];
    if (/^title: >-?\s*$/.test(l)) {
      const parts = [];
      while (i + 1 < src.length && /^\s+\S/.test(src[i + 1])) { i += 1; parts.push(src[i].trim()); }
      lines.push(`title: ${parts.join(' ')}`);
    } else lines.push(l);
  }
  const fm = lines
    .filter((l) => !QIITA_SYNC_DROP.test(l))
    .map((l) => {
      if (/^updated_at:/.test(l)) return "updated_at: ''";
      if (/^id:/.test(l)) return 'id: null';
      const t = /^title: (?!['"|>])(.+)$/.exec(l);
      return t ? `title: '${t[1].replace(/'/g, "''")}'` : l;
    })
    .join('\n');
  return `---\n${fm}\n---\n${text.slice(m[0].length)}`;
}

/**
 * note の原稿は、投稿のあとに status を ready から published に変える(投稿の結果の記録。AGENTS.md 1 章)。
 * 本文は変わらないので、ハッシュでは published を ready と同じに扱う。そうしないと、記録を直さずに status を変えられない(R2・R4)。
 */
const NOTE_FILE = /^platforms\/note\/public\/[^/]+\.md$/;
export function canonicalizeNoteStatus(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) return text;
  const fm = m[1].split('\n').map((l) => (/^status:\s*published\s*$/.test(l) ? 'status: ready' : l)).join('\n');
  return `---\n${fm}\n---\n${text.slice(m[0].length)}`;
}

/** 原稿の正規化(LF、行末の空白を除く、末尾の改行を 1 つ)とハッシュ。frontmatter を含む。file を渡すと、Qiita の原稿は同期で書き戻される欄をそろえ、note の原稿は status: published を ready にそろえる */
export function normalize(text, file) {
  const lf = `${text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/[ \t]+$/, '')).join('\n').replace(/\n+$/, '')}\n`;
  const f = file ? String(file).replace(/\\/g, '/') : '';
  if (QIITA_FILE.test(f)) return canonicalizeQiitaSync(lf);
  if (NOTE_FILE.test(f)) return canonicalizeNoteStatus(lf);
  return lf;
}
export const hashOf = (text, file) => crypto.createHash('sha256').update(normalize(text, file)).digest('hex');

/** 引用の照合用に空白・改行と Markdown の強調記号(** _ `)を除く(引用は逐語だが、原稿側の折り返しと装飾は許す) */
const squash = (s) => String(s).replace(/[\s*_`]+/g, '');
export function quoteExists(haystack, quote) {
  return squash(haystack).includes(squash(quote));
}

/**
 * 採否表の finding の参照が、指摘の参照を含むか。"C01" は同じ id、"cold.unintelligible[0..7]" は 0〜7 の範囲、
 * "cold.bounce_points[2]" は単一、"cold.ending_note" は同名
 */
export function refCovers(adoptionRef, ref) {
  if (adoptionRef === ref) return true;
  const m = /^(.+)\[(\d+)\.\.(\d+)\]$/.exec(adoptionRef);
  if (!m) return false;
  const n = new RegExp(`^${m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\[(\\d+)\\]$`).exec(ref);
  return Boolean(n) && +n[1] >= +m[2] && +n[1] <= +m[3];
}

/** 査読が読んだ版の本文。reviewed_commit(git)か reviewed_snapshot(docs/records/reviews の写し)。無ければ null */
export function reviewedTextOf(subject, file) {
  if (subject.reviewed_commit) {
    const t = showAt(subject.reviewed_commit, file);
    if (t !== null) return t;
  }
  if (subject.reviewed_snapshot && exists(subject.reviewed_snapshot)) return readText(subject.reviewed_snapshot);
  return null;
}

/** 外部の正本の URL を、手元の checkout のパスへ写す(policy.external_roots)。checkout が無ければ null */
export function externalLocalPath(url, policy) {
  for (const [prefix, roots] of Object.entries(policy.external_roots || {})) {
    if (!url.startsWith(prefix)) continue;
    const rest = decodeURIComponent(url.slice(prefix.length).split('#')[0]);
    for (const root of roots) {
      const p = path.resolve(abs('.'), root, rest);
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    }
  }
  return null;
}

let snapshotCache = null;
/** docs/records/reviews/<id>/<sha7>.json が指す原稿のパス → その写しの本文の一覧。正本が査読の後に変わったときの source_quote の照合に使う */
export function snapshotIndex() {
  if (snapshotCache) return snapshotCache;
  const map = new Map();
  for (const j of listFiles(['docs/records/reviews/*/*.json'])) {
    try {
      const b = JSON.parse(readText(j));
      const txt = j.replace(/\.json$/, '.txt');
      if (b.manuscript && exists(txt)) map.set(b.manuscript, [...(map.get(b.manuscript) || []), readText(txt)]);
    } catch { /* 壊れた写しは無視 */ }
  }
  snapshotCache = map;
  return map;
}

export function recordPathFor(file, policy) {
  return file.replace(/\.(md|ya?ml)$/i, policy.record_suffix);
}

/** 公開のスイッチが立った原稿(媒体ごと) */
export function targets(policy, { channel = null, postId = null } = {}) {
  const out = [];
  const want = (c) => !channel || channel === c;
  if (want('zenn')) {
    for (const f of listFiles(policy.targets.zenn.include, { exclude: ['articles/README.md'] })) {
      const fm = splitFrontmatter(readText(f)).frontmatter || {};
      if (fm.published === true) out.push({ file: f, medium: 'zenn' });
    }
  }
  if (want('qiita')) {
    for (const f of listFiles(policy.targets.qiita.include)) {
      if (isLegacyQiita(f)) continue;
      const fm = splitFrontmatter(readText(f)).frontmatter || {};
      if (fm.private === false && fm.ignorePublish !== true) out.push({ file: f, medium: 'qiita' });
    }
  }
  if (want('note')) {
    for (const f of listFiles(policy.targets.note.include, { exclude: ['platforms/note/public/README.md'] })) {
      const fm = splitFrontmatter(readText(f)).frontmatter || {};
      if (isPublishable(fm.status)) out.push({ file: f, medium: 'note' });
    }
  }
  if (want('social')) {
    for (const f of listFiles(policy.targets.social.include)) {
      const y = readYaml(f);
      if (y?.status === 'ready') out.push({ file: f, medium: 'social', terms: y.source?.subject_terms || [] });
    }
  }
  return postId ? out.filter((t) => path.basename(t.file).replace(/\.(md|ya?ml)$/i, '') === postId) : out;
}

/** 記録を最後に変えたコミットが原稿本体も変えているか。未コミットなら null */
export function sameCommitTouches(recordFile, manuscript) {
  try {
    const sha = git(['log', '-1', '--format=%H', '--', recordFile]).trim();
    if (!sha) return null;
    const dirty = git(['status', '--porcelain', '--', recordFile]).trim();
    if (dirty) return null;
    const files = git(['show', '--name-only', '--format=', sha]).split(/\r?\n/).filter(Boolean);
    return { sha, touches: files.includes(manuscript) };
  } catch {
    return null;
  }
}

export function checkReview({ policy = readJson(POLICY), schema = readJson(SCHEMA), channel = null, postId = null } = {}) {
  const report = new Report('review');
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const grandfathered = policy.grandfathered?.files || {};
  const list = targets(policy, { channel, postId });
  if (!list.length) report.note('公開のスイッチが立った原稿はありません');

  for (const t of list) {
    const text = readText(t.file);
    const current = hashOf(text, t.file);
    const rec = recordPathFor(t.file, policy);
    report.file(t.file);

    // R1
    if (!exists(rec)) {
      if (t.file in grandfathered) {
        report.note(`${t.file}: この仕組みより前に公開した原稿(${grandfathered[t.file]})。本文を改訂したら記録が要ります`);
        continue;
      }
      report.error(t.file, 'R1', `公開のスイッチが立っていますが、レビュー記録 ${rec} がありません。docs/self-review.md の手順で、執筆者と別のセッションに事実の査読と文脈ゼロの読みをさせ、記録を書いてください`);
      continue;
    }
    let r;
    try {
      r = readYaml(rec);
    } catch (e) {
      report.error(rec, 'R1', `記録を YAML として読めません: ${e.message}`);
      continue;
    }
    if (!validate(r)) {
      for (const e of validate.errors.slice(0, 10)) report.error(rec, 'R1', `記録が書式に合いません: ${e.instancePath || '/'} ${e.message}`);
      continue;
    }

    // R2 鮮度
    const fixedHashes = (r.adoption || []).map((a) => a.fixed_in_sha256).filter(Boolean);
    const fresh = r.subject.sha256 === current || (policy.freshness.accept_fixed_in && fixedHashes.includes(current));
    if (r.subject.path !== t.file) report.error(rec, 'R2', `記録の subject.path(${r.subject.path})が原稿(${t.file})と違います`);
    if (!fresh) report.error(rec, 'R2', `記録の後に原稿が変わっています(記録 ${r.subject.sha256.slice(0, 7)}、現在 ${current.slice(0, 7)})。直した結果なら採否表の fixed_in_sha256 に現在のハッシュを書き、ほかの変更なら査読をやり直してください。現在のハッシュは node scripts/lint/check-review.mjs --hash ${t.file}`);
    for (const c of r.canonical || []) {
      if (!/^https?:/.test(c.path) && c.sha256) {
        if (!exists(c.path)) report.error(rec, 'R2', `正本 ${c.path} がありません`);
        else if (hashOf(readText(c.path), c.path) !== c.sha256) report.error(rec, 'R2', `正本 ${c.path} が、記録の後に変わっています。派生物の主張を照合し直してください`);
      }
    }

    // R3 引用の実在。現在の原稿か、査読が読んだ版(subject.reviewed_commit のコミット、または reviewed_snapshot の写し)のどちらかに逐語であること。
    // 読んだ版が残っていない記録では、採否表で「直す」「削る」にした指摘の引用だけは、消えていても通す(直した結果として消える)
    const reviewedText = reviewedTextOf(r.subject, t.file);
    const inEither = (q) => quoteExists(text, q) || (reviewedText !== null && quoteExists(reviewedText, q));
    const snapshots = snapshotIndex();
    const inSource = (src, q) => {
      if (exists(src) && quoteExists(readText(src), q)) return true;
      return (snapshots.get(src) || []).some((snap) => quoteExists(snap, q));
    };
    const adoptedChange = (ref) => (r.adoption || []).some((a) => refCovers(a.finding, ref) && ['直す', '削る'].includes(a.decision));
    const quoteCheck = (ref, q, label) => {
      if (inEither(q)) return;
      if (reviewedText === null && adoptedChange(ref)) {
        report.note(`${rec}: ${label} の引用は現在の原稿に無いが、採否表で「直す/削る」にした指摘なので通す(査読が読んだ版はコミットされていない。下書きを先にコミットすれば reviewed_commit で照合できる)`);
        return;
      }
      report.error(rec, 'R3', `${label} の引用「${q}」が原稿に逐語でありません。引用の無い指摘は検証できません(捏造か、原稿が変わった)。直した結果なら採否表に「直す」の行を、査読が読んだ版がコミット済みなら subject.reviewed_commit を書いてください`);
    };
    for (const c of r.fact_review.claims || []) {
      quoteCheck(c.id, c.quote, c.id);
      if (c.status === 'supported') {
        if (!c.source_quote || !c.source) report.error(rec, 'R3', `${c.id} は supported ですが、source と source_quote がありません。裏付けの逐語引用を書くか、unsupported にしてください`);
        else if (!/^https?:/.test(c.source)) {
          if (!exists(c.source)) report.error(rec, 'R3', `${c.id} の source ${c.source} がありません`);
          else if (!inSource(c.source, c.source_quote)) report.error(rec, 'R3', `${c.id} の source_quote「${c.source_quote}」が ${c.source}(とその査読時の写し)に逐語でありません`);
        } else {
          // 外部の正本(標準本文など)。手元に checkout があるときだけ照合する(policy.external_roots)。CI には checkout が無いので照合しない
          const local = externalLocalPath(c.source, policy);
          if (local && !quoteExists(fs.readFileSync(local, 'utf8'), c.source_quote)) {
            report.warn(rec, 'R3', `${c.id} の source_quote「${c.source_quote}」が、手元の ${c.source} に逐語でありません。正本が査読の後に変わったか、引用が誤っています。照合し直してください`);
          }
        }
      }
    }
    for (const f of r.fact_review.findings || []) quoteCheck(f.id, f.quote, f.id);
    for (const [i, u] of (r.cold_read.unintelligible || []).entries()) quoteCheck(`cold.unintelligible[${i}]`, u.quote, `cold.unintelligible[${i}]`);
    for (const [i, b] of (r.cold_read.bounce_points || []).entries()) quoteCheck(`cold.bounce_points[${i}]`, b.quote, `cold.bounce_points[${i}]`);

    // R4 未処理の指摘
    const adoption = r.adoption || [];
    const needs = [];
    for (const c of r.fact_review.claims || []) {
      if (policy.fact_review.unresolved_statuses.includes(c.status) || c.severity === policy.fact_review.blocking_severity) needs.push(c.id);
    }
    for (const f of r.fact_review.findings || []) if (f.severity === policy.fact_review.blocking_severity) needs.push(f.id);
    for (const id of needs) {
      const row = adoption.find((a) => refCovers(a.finding, id));
      if (!row) report.error(rec, 'R4', `${id} は未支持か「止める」ですが、採否表に行がありません。直す・削る・不採用(理由と規則)・正本へ追記のどれかに決めてください`);
      else if (['直す', '削る'].includes(row.decision) && row.fixed_in_sha256 !== current) report.error(rec, 'R4', `${id} は「${row.decision}」ですが、直した後の原稿のハッシュ(fixed_in_sha256)が現在の原稿と一致しません。直してから node scripts/lint/check-review.mjs --hash ${t.file} の値を書いてください(赤字照合)`);
      else if (row.decision === '不採用' && !row.fix) report.error(rec, 'R4', `${id} を不採用にした理由(fix 欄に「不採用: …」)がありません`);
    }
    if (policy.adoption.require_rule) for (const a of adoption) if (!a.rule) report.error(rec, 'R4', `採否 ${a.finding} に根拠の規則(rule)がありません`);

    // R5 読者役
    const terms = (t.terms && t.terms.length ? t.terms : r.subject.terms) || [];
    if (!terms.some((w) => r.cold_read.subject_identified.includes(w))) report.error(rec, 'R5', `読者役が答えた主題「${r.cold_read.subject_identified}」に、subject.terms(${terms.join(' / ')})のどれも含まれません。冒頭で何の話かを名乗っていない疑いがあります`);
    if (policy.cold_read.require_subject_named_in_first_lines && r.cold_read.subject_is_named_in_first_lines !== true) report.error(rec, 'R5', '読者役が「冒頭だけでは何の話か分からない」と答えています。冒頭で対象を名乗ってください(2026-09-16 に LinkedIn で起きた失敗の再発防止)');
    const candidates = (r.cold_read.unintelligible || []).length + (r.cold_read.bounce_points || []).length;
    if (candidates < policy.cold_read.min_candidates) report.error(rec, 'R5', `読者役の候補(分からなかった語・離脱点)が ${candidates} 件です。候補が無い読者役は、読んでいない読者役と区別できません。退けた候補は採否表で不採用にしてください`);

    // R6 独立性
    const { fact_session_id: fs_, cold_session_id: cs, writer_session_id: ws } = r.reviewer;
    if (policy.independence.require_distinct_sessions && (fs_ === ws || cs === ws)) report.error(rec, 'R6', '査読か読者役のセッション ID が執筆者と同じです。自分の文章を自分で評価すると甘くなります(自己選好バイアス)。別のセッションで読ませてください');
    const coldInputs = r.reviewer.allowed_inputs.cold || [];
    if (JSON.stringify([...coldInputs].sort()) !== JSON.stringify([...policy.cold_read.allowed_inputs_exact].sort())) report.error(rec, 'R6', `読者役に渡してよいのは原稿の本文だけです(allowed_inputs.cold = ${JSON.stringify(policy.cold_read.allowed_inputs_exact)})。正本や前版を渡すと文脈ゼロでなくなります`);
    const sc = sameCommitTouches(rec, t.file);
    if (sc === null) report.note(`${rec}: 未コミットのため、記録と原稿が別のコミットかは確かめていません`);
    else if (sc.touches) report.add(policy.independence.require_separate_commits === 'error' ? 'error' : 'warning', rec, 'R6', `記録を最後に変えたコミット ${sc.sha.slice(0, 7)} が原稿本体も変えています。記録と原稿は別のコミットにしてください(執筆者が記録を書き換えたことと区別できないため)`);

    // R7 判定
    if (policy.verdicts.fail.includes(r.summary.verdict)) report.error(rec, 'R7', `判定が ${r.summary.verdict} です。公開のスイッチを下ろすか、直して判定を更新してください`);

    // R8 確認しなかったことと、主張の数
    if (policy.fact_review.require_not_checked && !(r.fact_review.not_checked || []).length) report.error(rec, 'R8', '確認しなかった範囲(not_checked)がありません。全部を確認したという記録は、優先づけをしていない記録です');
    if ((r.fact_review.claims || []).length < policy.fact_review.min_claims) report.error(rec, 'R8', `主張の照合が ${(r.fact_review.claims || []).length} 件です(最低 ${policy.fact_review.min_claims} 件)。数値・固有名詞・年・比較・因果・引用を主張の単位で拾ってください`);
  }
  report.note(`レビュー記録: 公開のスイッチが立った原稿 ${list.length} 件を検査`);
  return report;
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  const hashTarget = args.values.get('hash');
  if (hashTarget) {
    console.log(hashOf(readText(hashTarget), hashTarget));
    process.exit(0);
  }
  finish(checkReview({ channel: args.values.get('channel') || null, postId: args.values.get('post-id') || args.values.get('id') || null }), args);
}
