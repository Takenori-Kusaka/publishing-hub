// SVG テンプレート(ブランドトークンの占位子 {{color.ai.700}} を含む)を、同梱フォントで決定的に PNG へ描き出す。
//
//   node scripts/render-svg.mjs <template.svg> [<out.png>] [--scale 2]
//   import { renderSvg } from '@kusaka/brand/render';
//
// なぜ手書き SVG か。D2 や Mermaid は構成図には向くが、「一目でわかる」キービジュアル(ループ・レーン・大きな題)は
// 自由な配置を要する。SVG は決定的に描けるので、ソースと PNG のハッシュで手差し替えを検出できる(publishing-hub の D1〜D6 と同じ考え方)。
//
// 占位子:
//   {{color.ai.700}}     tokens.flat.json の値に置き換える(無ければエラー)
//   {{font.heading}}     フォント名(font.family.heading の先頭)
//
// 日本語は自動改行されない。行は <tspan> で手で分ける。これは制約であり、ラベルを短く保つ規律でもある。

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { fontFiles } from './fonts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

export function loadFlatTokens(p = path.join(ROOT, 'dist/tokens.flat.json')) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** 占位子を置き換える。未知の占位子はエラーにして、色の抜けを PNG で気づく前に止める */
export function substitute(svg, flat) {
  const missing = new Set();
  const out = svg.replace(/\{\{([a-z0-9_.-]+)\}\}/gi, (_, key) => {
    if (key.startsWith('font.')) {
      const fam = flat[`font.family.${key.slice(5)}`];
      if (!fam) { missing.add(key); return ''; }
      return Array.isArray(fam) ? fam[0] : fam;
    }
    if (!(key in flat)) { missing.add(key); return ''; }
    const v = flat[key];
    return Array.isArray(v) ? v[0] : String(v);
  });
  if (missing.size) throw new Error(`テンプレートの占位子がトークンにありません: ${[...missing].join(', ')}`);
  return out;
}

export function naturalSize(svg) {
  const w = /<svg[^>]*\swidth="([\d.]+)"/.exec(svg);
  const h = /<svg[^>]*\sheight="([\d.]+)"/.exec(svg);
  if (w && h) return { width: Math.round(+w[1]), height: Math.round(+h[1]) };
  const vb = /viewBox="[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)"/.exec(svg);
  return vb ? { width: Math.round(+vb[1]), height: Math.round(+vb[2]) } : { width: 0, height: 0 };
}

const SECONDARY_BLOCK = /<(text|tspan|g)\b[^>]*data-tier="secondary"[^>]*>[\s\S]*?<\/\1>/g;
const SECONDARY_EMPTY = /<(text|tspan)\b[^>]*data-tier="secondary"[^>]*\/>/g;

/**
 * ラベルの最小フォントサイズの規則: 自然幅 / 32 以上(電話での縮小に耐える。brand/05-figures.md)。
 * data-tier="secondary" を付けた text / tspan / g は補助ラベル(署名・目盛・添え書き)として規則から外す。
 * 補助ラベルは本文に同じ情報を書くことを条件にする(図だけに持たせない)
 */
export function smallestFontSize(svg) {
  const stripped = svg.replace(SECONDARY_BLOCK, '').replace(SECONDARY_EMPTY, '');
  const sizes = [...stripped.matchAll(/font-size="([\d.]+)"/g)].map((m) => +m[1]);
  return sizes.length ? Math.min(...sizes) : null;
}

function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/**
 * @returns {{ svg: string, png: Buffer, meta: object }}
 */
export async function renderSvg(templatePath, { flat = loadFlatTokens(), scale = 2, minFontRatio = 1 / 32 } = {}) {
  const { Resvg } = await import('@resvg/resvg-js');
  const template = fs.readFileSync(templatePath, 'utf8');
  const svg = substitute(template, flat);
  const natural = naturalSize(svg);
  const smallest = smallestFontSize(svg);
  const minFont = Math.ceil(natural.width * minFontRatio);
  const warnings = [];
  if (smallest !== null && smallest < minFont) {
    warnings.push(`主ラベルの最小フォントサイズ ${smallest}px が、自然幅 ${natural.width}px に対する下限 ${minFont}px を下回ります(電話で読めません)`);
  }
  const files = fontFiles().filter((f) => fs.existsSync(f));
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: Math.round(natural.width * scale) },
    font: { loadSystemFonts: false, fontFiles: files, defaultFontFamily: 'Noto Sans JP' },
  });
  const png = r.render().asPng();
  const meta = {
    '//': 'この画像の再現情報。手で編集しない。@kusaka/brand の scripts/render-svg.mjs が生成する',
    source: path.relative(process.cwd(), templatePath).split(path.sep).join('/'),
    sourceSha256: sha256(template),
    tokensSha256: sha256(JSON.stringify(flat)),
    renderer: { brand: pkgVersion(), rasterizer: `@resvg/resvg-js@${resvgVersion()}` },
    fonts: files.map((f) => path.basename(f)),
    raster: { scale },
    natural,
    smallestFontSize: smallest,
    output: { ...pngSize(png), sha256: sha256(png) },
    warnings,
  };
  return { svg, png, meta };
}

function pkgVersion() {
  try { return `@kusaka/brand@${JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version}`; } catch { return 'unknown'; }
}
function resvgVersion() {
  for (const p of [path.join(ROOT, 'node_modules/@resvg/resvg-js/package.json'), path.join(process.cwd(), 'node_modules/@resvg/resvg-js/package.json')]) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')).version; } catch { /* 次を試す */ }
  }
  return 'unknown';
}

async function main() {
  const args = process.argv.slice(2);
  const files = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--scale');
  const scale = args.includes('--scale') ? +args[args.indexOf('--scale') + 1] : 2;
  if (!files.length) {
    console.error('使い方: node scripts/render-svg.mjs <template.svg> [<out.png>] [--scale 2]');
    process.exit(2);
  }
  const [tpl, outArg] = files;
  const out = outArg || tpl.replace(/\.svg$/, '.png');
  const { png, meta } = await renderSvg(path.resolve(tpl), { scale });
  fs.writeFileSync(out, png);
  fs.writeFileSync(`${out}.json`, `${JSON.stringify(meta, null, 2)}\n`);
  for (const w of meta.warnings) console.log(`  ⚠ ${w}`);
  console.log(`  ✓ ${out}  自然 ${meta.natural.width}x${meta.natural.height} / 出力 ${meta.output.width}x${meta.output.height}  主ラベルの最小 ${meta.smallestFontSize}px`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
