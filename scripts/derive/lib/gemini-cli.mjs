// Gemini CLI を 1 段の仕事だけに使うための呼び出し部品。
//
// 1 回の呼び出しには 1 つの仕事だけを任せ(prompt chaining)、入力は標準入力で渡し、出力は JSON の応答だけを受け取る。
// ツールはポリシーですべて拒否し、作業ディレクトリは空の一時ディレクトリにする。リポジトリの GEMINI.md や旧稿を読ませないため。
// 応答を受け取ったら、実際に応答したモデル名とツールの呼び出し数を検証する。
//
// 目標の文言に合わせて `gemini --yolo --model <指定>` で呼ぶ。CLI 0.59.0 は flash 系の指定を gemini-3.5-flash に
// 置き換えるので、実体名は lint/derive/decisions.json の model_actual と照合する。

import { spawnSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT } from '../../lint/lib.mjs';

let bundle = null;
function geminiBundle() {
  if (!bundle) {
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    bundle = path.join(root, '@google', 'gemini-cli', 'bundle', 'gemini.js');
    if (!fs.existsSync(bundle)) throw new Error(`Gemini CLI が見つかりません: ${bundle}`);
  }
  return bundle;
}

/** 応答の文字列から JSON を取り出す(コードフェンスで囲まれていても受け付ける) */
export function parseJsonResponse(text) {
  const t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = t.search(/[[{]/);
  if (start < 0) throw new Error('応答に JSON がありません');
  return JSON.parse(t.slice(start));
}

/**
 * @param {object} o
 * @param {string} o.input      標準入力で渡す文脈(正本の抜粋、台帳など)
 * @param {string} o.instruction -p で渡す短い指示(文脈の後ろに置かれる)
 * @param {string} o.model      --model に渡す名前
 * @param {string} o.expectModel 実際に応答したモデル名の先頭(stats.models のキーと照合)
 * @param {string} o.logPath    生の出力を残すパス
 */
export function callGemini({ input, instruction, model, expectModel, logPath, timeoutMs = 600000 }) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'derive-gemini-'));
  const policy = path.join(ROOT, 'lint', 'derive', 'gemini-deny-all.toml');
  const args = [geminiBundle(), '--yolo', '--model', model, '--policy', policy, '-o', 'json', '-p', instruction];
  const r = spawnSync(process.execPath, args, { cwd, input, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 1 << 26 });
  if (logPath) {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(logPath, JSON.stringify({ args: args.slice(1), status: r.status, stdout: r.stdout, stderr: r.stderr }, null, 2), 'utf8');
  }
  if (r.status !== 0) throw new Error(`Gemini CLI が終了コード ${r.status} で終わりました: ${String(r.stderr).slice(0, 300)}`);
  if (/Policy file error/i.test(r.stderr || '')) throw new Error('ポリシーファイルが読み込めていません');
  const out = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
  const models = Object.keys(out.stats?.models || {});
  const toolCalls = out.stats?.tools?.totalCalls ?? 0;
  if (expectModel && !models.every((m) => m.startsWith(expectModel))) {
    throw new Error(`応答したモデル ${models.join(',')} が期待する ${expectModel} と違います`);
  }
  if (toolCalls !== 0) throw new Error(`ツールが ${toolCalls} 回呼ばれました(ポリシーで拒否しているはずです)`);
  return { json: parseJsonResponse(out.response), response: out.response, models, toolCalls };
}

/** スキーマ違反のときに、位置だけを返して再試行する */
export function callGeminiValidated({ validate, retries = 2, ...o }) {
  let last = null;
  let feedback = '';
  for (let i = 0; i <= retries; i++) {
    const r = callGemini({ ...o, instruction: feedback ? `${o.instruction}\n\n前回の出力は次の位置で形式に合いませんでした。形式どおりに出力し直してください:\n${feedback}` : o.instruction, logPath: o.logPath ? o.logPath.replace(/\.json$/, `.try${i}.json`) : undefined });
    const errors = validate(r.json);
    if (!errors.length) return { ...r, tries: i + 1 };
    last = errors;
    feedback = errors.slice(0, 10).join('\n');
  }
  throw new Error(`形式の検証に ${retries + 1} 回失敗しました: ${last.slice(0, 5).join(' / ')}`);
}
