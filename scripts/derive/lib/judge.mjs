// 派生物の文を、生成側から切り離した判定器(別系統の LLM)で文単位に判定する部品。
//
// 判定器は正本の全文を持ち、下書きの過程・規則・生成側が選んだ根拠を見ずに判定する(factored verification)。
// claude -p を、個人設定と道具を外した空の作業ディレクトリで呼ぶので、~/.claude/CLAUDE.md の規則や MCP は文脈に入らない。
// 判定器の出力の evidence_quote が正本か実装の部分文字列でなければ、その判定は UNKNOWN として扱う(引用の捏造を弾く)。

import { spawnSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let claudeBin = null;
/** claude の実行ファイルの絶対パス(シェルを介さず直接起動して、引数の mangle を避ける) */
function resolveClaude() {
  if (claudeBin) return claudeBin;
  if (process.env.CLAUDE_BIN && fs.existsSync(process.env.CLAUDE_BIN)) return (claudeBin = process.env.CLAUDE_BIN);
  try {
    const cmd = process.platform === 'win32' ? 'where claude' : 'command -v claude';
    const out = execSync(cmd, { encoding: 'utf8' }).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const exe = out.find((p) => /\.exe$/i.test(p)) || out[0];
    claudeBin = exe;
  } catch {
    claudeBin = process.platform === 'win32' ? 'claude.exe' : 'claude';
  }
  return claudeBin;
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          n: { type: 'integer', description: '入力の単位の番号' },
          label: { type: 'string', enum: ['SUPPORTED', 'SUPPORTED_LOSSY', 'NOT_IN_SOURCE', 'CONTRADICTED', 'NO_CLAIM', 'UNKNOWN'] },
          added: { type: 'string', enum: ['none', 'reason', 'effect', 'trigger', 'status', 'external_property', 'scope'] },
          dropped_caveat: { type: 'boolean' },
          evidence_quote: { type: 'string', description: '正本か実装から逐語で引いた、判定の根拠になる一文。なければ空文字' },
          why: { type: 'string' },
        },
        required: ['n', 'label', 'added', 'dropped_caveat', 'evidence_quote', 'why'],
      },
    },
  },
  required: ['verdicts'],
};

const SYSTEM = `あなたは、技術記事の派生物が「正本」に忠実かを判定する、厳密で保守的な判定器です。日本語で判定します。
与えるのは正本の全文(ID 付き)と、派生物から取り出した文の一覧です。各文について、正本に直接書かれている事実だけに照らして、次のいずれか 1 つのラベルを付けます。
- SUPPORTED: 文の主張が正本(または渡された実装の抜粋)に直接支えられている。
- SUPPORTED_LOSSY: 主張は支えられているが、正本が添えている限定・但し書きを落としている。dropped_caveat を true にする。
- NOT_IN_SOURCE: 正本にも実装にもない主張(理由・効果・実績・外部製品の性質・起動条件など)。added にその種類を入れる。
- CONTRADICTED: 正本の記述と矛盾する。
- NO_CLAIM: 事実を主張していない接続・問いかけ・意見。
- UNKNOWN: 判定に足る情報がない。
判定の根拠にした正本(または実装)の一文を、evidence_quote に逐語でそのまま引きます(要約・改変をしない)。根拠がなければ空文字にします。
言い換え・婉曲・但し書きの語の追加は、元の主張が正本にあるかどうかで判定します。言い回しがやわらかくても、正本にない理由・効果・起動条件を述べていれば NOT_IN_SOURCE です。`;

/** 引用(NFKC・空白除去)が出典の部分文字列か */
function quoteInSource(quote, sourceNorm) {
  const q = String(quote || '').normalize('NFKC').replace(/\s+/g, '');
  if (q.length < 6) return false;
  return sourceNorm.includes(q);
}

/**
 * units: [{n, text, prev, next}]。sourceText: ID 付きの正本の全文。implText: 実装の抜粋(任意)。
 * judgeModel, budget は decisions.json から。戻り値は [{n, label, ...}] と cost。
 */
export function judgeUnits(units, sourceText, { judgeModel, implText = '', logPath } = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'derive-judge-'));
  const sourceNorm = `${sourceText}\n${implText}`.normalize('NFKC').replace(/\s+/g, '');
  const list = units.map((u) => `#${u.n}${u.prev ? ` [前: ${u.prev}]` : ''} 「${u.text}」${u.next ? ` [次: ${u.next}]` : ''}`).join('\n');
  const prompt = `<canonical>\n${sourceText}\n</canonical>\n${implText ? `<implementation>\n${implText}\n</implementation>\n` : ''}\n上の正本に照らして、次の各文を判定してください。\n<units>\n${list}\n</units>`;
  // --setting-sources から user を外すと ~/.claude/CLAUDE.md の個人の規則が文脈に入らない(空の cwd で project/local も空)。
  const args = ['-p', '--model', judgeModel, '--setting-sources', 'project,local', '--strict-mcp-config', '--no-session-persistence', '--disallowed-tools', 'Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep', 'WebFetch', 'WebSearch', '--system-prompt', SYSTEM, '--json-schema', JSON.stringify(VERDICT_SCHEMA), '--output-format', 'json'];
  const r = spawnSync(resolveClaude(), args, { cwd, input: prompt, encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 26 });
  if (logPath) {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(logPath, `${r.stdout || ''}\n---STDERR---\n${r.stderr || ''}`, 'utf8');
  }
  if (r.status !== 0) throw new Error(`judge が終了コード ${r.status}: ${String(r.stderr).slice(0, 300)}`);
  const brace = r.stdout.indexOf('{');
  if (brace < 0) throw new Error(`judge の出力に JSON がありません: ${String(r.stderr || r.stdout).slice(0, 300)}`);
  const out = JSON.parse(r.stdout.slice(brace));
  const so = out.structured_output || {};
  const verdicts = (so.verdicts || []).map((v) => {
    if ((v.label === 'SUPPORTED' || v.label === 'SUPPORTED_LOSSY' || v.label === 'CONTRADICTED') && !quoteInSource(v.evidence_quote, sourceNorm)) {
      return { ...v, label: 'UNKNOWN', why: `${v.why}(引用が出典の部分文字列でないため無効化)` };
    }
    return v;
  });
  return { verdicts, cost: out.total_cost_usd || 0 };
}

/** 同じ単位を repeats 回判定し、集約する(R1: CONTRADICTED/NOT_IN_SOURCE/dropped_caveat が 1 回でも出たら不合格) */
export function aggregate(rounds, rule = 'R1') {
  const byN = new Map();
  for (const round of rounds) for (const v of round) {
    if (!byN.has(v.n)) byN.set(v.n, []);
    byN.get(v.n).push(v);
  }
  const out = [];
  for (const [n, vs] of byN) {
    const labels = vs.map((v) => v.label);
    const contradicted = labels.includes('CONTRADICTED');
    const notInSource = labels.filter((l) => l === 'NOT_IN_SOURCE').length;
    const dropped = vs.some((v) => v.dropped_caveat);
    const unknown = labels.filter((l) => l === 'UNKNOWN').length;
    let pass;
    if (rule === 'R2') {
      pass = !contradicted && !dropped && notInSource < 2 && labels.filter((l) => l === 'SUPPORTED' || l === 'SUPPORTED_LOSSY').length >= 2;
    } else {
      pass = !contradicted && notInSource === 0 && !dropped;
    }
    if (unknown > vs.length / 2) pass = false;
    out.push({ n, pass, labels, contradicted, notInSource, dropped, unknown, added: [...new Set(vs.map((v) => v.added).filter((a) => a && a !== 'none'))], samples: vs });
  }
  return out.sort((a, b) => a.n - b.n);
}
