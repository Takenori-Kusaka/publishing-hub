// ブランドの SVG テンプレートから、掲載用の PNG と再現用のメタ情報を作る(キービジュアル・節図の層)。
//
//   node scripts/figures/render-svg.mjs                         # 変更/欠落しているものだけ描き直す
//   node scripts/figures/render-svg.mjs --all                   # 全部描き直す
//   node scripts/figures/render-svg.mjs images/pit-in-process/kv-overview.svg   # 指定したものだけ
//   node scripts/figures/render-svg.mjs --check                 # 書かずに、描き直しが要るかだけ報告する
//
// 描画器は brand/(kusaka-brand の複製)にあり、同梱フォントで決定的に描く。対象ディレクトリは
// lint/policies/diagrams.json の svg_dirs。検査は scripts/lint/check-diagrams.mjs の S1〜S6。
// 構成図(D2)は scripts/figures/render-d2.mjs が担う。使い分けは docs/diagrams.md。

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const POLICY = path.join(ROOT, 'lint/policies/diagrams.json');
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

export function loadPolicy() {
  return JSON.parse(fs.readFileSync(POLICY, 'utf8'));
}

export function listSources(policy) {
  const out = [];
  for (const dir of policy.svg_dirs || []) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) if (f.endsWith('.svg')) out.push(path.join(abs, f));
  }
  return out.sort();
}

export function outputPathsFor(srcAbs, policy) {
  const base = srcAbs.replace(/\.svg$/, '');
  return { png: `${base}.png`, meta: `${base}${policy.metadata.suffix}` };
}

function tokensHash() {
  const flat = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand/dist/tokens.flat.json'), 'utf8'));
  return sha256(JSON.stringify(flat));
}

function needsRender(srcAbs, policy, tokHash) {
  const { png, meta } = outputPathsFor(srcAbs, policy);
  if (!fs.existsSync(png) || !fs.existsSync(meta)) return 'PNG かメタ情報がありません';
  let m;
  try { m = JSON.parse(fs.readFileSync(meta, 'utf8')); } catch { return 'メタ情報が JSON として読めません'; }
  if (m.sourceSha256 !== sha256(fs.readFileSync(srcAbs, 'utf8'))) return 'ソース(.svg)が変わっています';
  if (m.tokensSha256 !== tokHash) return 'ブランドのトークンが変わっています';
  if (m.output?.sha256 !== sha256(fs.readFileSync(png))) return 'PNG がメタ情報と一致しません';
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const checkOnly = args.includes('--check');
  const explicit = args.filter((a) => !a.startsWith('--')).map((a) => path.resolve(ROOT, a));
  const policy = loadPolicy();
  const tokHash = tokensHash();
  const sources = explicit.length ? explicit : listSources(policy);
  if (!sources.length) { console.log('図のソース(.svg)がありません'); return 0; }

  const todo = [];
  for (const s of sources) {
    const reason = all && !checkOnly ? '--all 指定' : needsRender(s, policy, tokHash);
    if (reason) todo.push({ src: s, reason });
  }
  if (checkOnly) {
    for (const t of todo) console.log(`  描き直しが必要: ${rel(t.src)} (${t.reason})`);
    console.log(`図(SVG)の再現性: ソース ${sources.length} 件、描き直しが必要 ${todo.length} 件`);
    return todo.length ? 1 : 0;
  }
  if (!todo.length) { console.log(`図(SVG): ソース ${sources.length} 件、すべて最新です`); return 0; }

  const { renderSvg } = await import(path.join(ROOT, 'brand/scripts/render-svg.mjs').replace(/\\/g, '/').replace(/^([A-Za-z]):/, 'file:///$1:'));
  const flat = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand/dist/tokens.flat.json'), 'utf8'));
  let warned = 0;
  for (const { src, reason } of todo) {
    const { png, meta } = await renderSvg(src, { flat, scale: policy.raster.scale, minFontRatio: policy.svg.min_font_ratio });
    const { png: pngPath, meta: metaPath } = outputPathsFor(src, policy);
    fs.writeFileSync(pngPath, png);
    meta.source = rel(src);
    fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
    if (meta.warnings.length) warned++;
    console.log(`  ${meta.warnings.length ? '⚠' : '✓'} ${rel(pngPath)}  自然 ${meta.natural.width}x${meta.natural.height} / 出力 ${meta.output.width}x${meta.output.height}  主ラベルの最小 ${meta.smallestFontSize}px  (${reason})`);
    for (const w of meta.warnings) console.log(`      ${w}`);
  }
  console.log(`図(SVG): ${todo.length} 件を描き直しました${warned ? `(うち ${warned} 件に警告)` : ''}`);
  return warned ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().then((code) => process.exit(code)).catch((e) => { console.error(e.message); process.exit(1); });
}
