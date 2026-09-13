// 媒体別 textlint ランナー。
//
//   node scripts/lint/run-textlint.mjs [--channel zenn|qiita|note|social|docs] [--strict] [--quiet] [--report out.json] [file ...]
//
// lint/channels.json に登録されたチャネルごとに、対応する textlint プロファイル
// (lint/textlint/<channel>.json)で校正します。同じ preset を使っていても、
// 媒体が違えば適切な規約が違うため、設定を 1 本に共有しません。
//
//   zenn   : 正本。商業技術出版レベル + 学術的な語調
//   qiita  : レシピ。短文・断定・「！」禁止
//   note   : エッセイ。留保は許すが煽りは抑える
//   social : YAML から本文だけを取り出して校正する(1文100字、読点3つまで)
//   docs   : 運用文書。最低限
//
// ファイルを引数に与えると、その中でチャネルに属するものだけを校正します(エディタ連携用)。

import { createLinter, loadTextlintrc } from 'textlint';
import { ROOT, abs, rel, readJson, readYaml, listFiles, isLegacyQiita, Report, parseArgs, finish, isMain } from './lib.mjs';

/** SNS 原稿(YAML)から校正対象の本文を取り出す。check-terms からも使う */
export function collectSocialTexts(data) {
  const out = [];
  if (data?.linkedin?.text) out.push({ label: 'linkedin.text', text: String(data.linkedin.text) });
  if (data?.linkedin?.article?.description) out.push({ label: 'linkedin.article.description', text: String(data.linkedin.article.description) });
  (data?.bluesky?.posts || []).forEach((p, i) => {
    if (p?.text) out.push({ label: `bluesky.posts[${i}].text`, text: String(p.text) });
    if (p?.external?.description) out.push({ label: `bluesky.posts[${i}].external.description`, text: String(p.external.description) });
  });
  return out;
}

export function loadChannels() {
  return readJson('lint/channels.json').channels;
}

/** チャネルの対象ファイル(リポジトリ相対) */
export function channelFiles(ch, only = []) {
  let files = listFiles(ch.include, { exclude: ch.exclude || [] });
  if (ch.skipLegacyQiita) files = files.filter((f) => !isLegacyQiita(f));
  if (only.length) {
    const wanted = new Set(only.map((p) => rel(abs(p))));
    files = files.filter((f) => wanted.has(f));
  }
  return files;
}

function push(report, file, messages, label) {
  for (const m of messages) {
    const sev = m.severity === 2 ? 'error' : 'warning';
    const where = label ? `${label} 行${m.line}` : null;
    report.add(sev, file, `textlint/${m.ruleId}`, where ? `(${where}) ${m.message}` : m.message, label ? null : m.line);
  }
}

export async function lintChannel(id, ch, only = []) {
  const report = new Report(`textlint:${id}`);
  const files = channelFiles(ch, only);
  if (!files.length) {
    report.note(`${id}: 対象ファイルがありません`);
    return report;
  }
  const descriptor = await loadTextlintrc({ configFilePath: abs(ch.textlint) });
  const linter = createLinter({ descriptor, ignoreFilePath: abs('.textlintignore') });

  if (ch.kind === 'markdown') {
    const results = await linter.lintFiles(files.map(abs));
    for (const f of files) report.file(f);
    for (const r of results) push(report, rel(r.filePath), r.messages, null);
    return report;
  }

  if (ch.kind === 'social-yaml') {
    for (const f of files) {
      report.file(f);
      let data;
      try {
        data = readYaml(f);
      } catch (e) {
        report.error(f, 'textlint/yaml', `YAML を読めません: ${e.message}`);
        continue;
      }
      for (const { label, text } of collectSocialTexts(data)) {
        const r = await linter.lintText(text, `${abs(f)}.${label.replace(/[^A-Za-z0-9]+/g, '_')}.md`);
        push(report, f, r.messages, label);
      }
    }
    return report;
  }

  report.error(ch.textlint, 'textlint/config', `未知の kind "${ch.kind}"`);
  return report;
}

export async function runTextlint({ channels = null, only = [] } = {}) {
  const all = loadChannels();
  const ids = channels && channels.length ? channels : Object.keys(all);
  const total = new Report('textlint');
  for (const id of ids) {
    const ch = all[id];
    if (!ch) {
      total.error('lint/channels.json', 'textlint/config', `未知のチャネル "${id}"`);
      continue;
    }
    if (!ch.textlint) continue;
    const r = await lintChannel(id, ch, only);
    console.log(`[${id}] ${ch.title}: ${r.files.size} files, errors ${r.errors.length}, warnings ${r.warnings.length}`);
    total.merge(r);
  }
  return total;
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  const channels = args.values.has('channel') ? args.values.get('channel').split(',') : null;
  runTextlint({ channels, only: args.positional })
    .then((report) => finish(report, args))
    .catch((e) => {
      console.error(e);
      process.exit(2);
    });
}
