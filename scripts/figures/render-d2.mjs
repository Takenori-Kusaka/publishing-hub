// D2 + TALA のソースから、掲載用の PNG と再現用のメタ情報を作る。
//
//   node scripts/figures/render-d2.mjs                      # 変更/欠落しているものだけ描き直す
//   node scripts/figures/render-d2.mjs --all                # 全部描き直す
//   node scripts/figures/render-d2.mjs images/c4/foo.d2 ...  # 指定したものだけ
//   node scripts/figures/render-d2.mjs --check              # 書かずに、描き直しが要るかだけ報告する
//
// なぜ D2 + TALA か。Zenn は本文幅(PC で約700px、電話で約360px)より広い画像を縮小して表示するので、横長の図は
// 文字が潰れて読めません。mermaid はソフトウェアのコンポーネント図やコンテナ図の表現に向きません。
// TALA はソフトウェアアーキテクチャ図のために作られた直交レイアウトエンジンで、D2 v0.9.0 から
// MPL-2.0 で同梱されています(ライセンスキーも別途インストールも不要)。
//
// TALA はレイアウトに乱数性があると公式に明記されているため、ソースだけでは同じ絵に戻せません。
// そこで PNG の隣に <name>.png.json を置き、生成時の版・オプション・ソースのハッシュ・出力の
// 寸法とハッシュを記録します。検査(scripts/lint/check-diagrams.mjs)はこの記録を突き合わせます。
//
// 規則の値は lint/policies/diagrams.json にあります。手順は docs/diagrams.md。

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const POLICY = path.join(ROOT, 'lint/policies/diagrams.json');

export function loadPolicy() {
  return JSON.parse(fs.readFileSync(POLICY, 'utf8'));
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

/** 図のソース(.d2)を列挙する */
export function listSources(policy) {
  const out = [];
  for (const dir of policy.diagram_dirs) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) {
      if (f.endsWith('.d2')) out.push(path.join(abs, f));
    }
  }
  return out.sort();
}

export function outputPathsFor(srcAbs, policy) {
  const base = srcAbs.replace(/\.d2$/, '');
  return { png: `${base}.png`, meta: `${base}${policy.metadata.suffix}` };
}

/** SVG の自然サイズ(width/height 属性、無ければ viewBox) */
export function naturalSize(svg) {
  const wh = /<svg[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"/.exec(svg);
  if (wh) return { width: Math.round(+wh[1]), height: Math.round(+wh[2]) };
  const vb = /viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/.exec(svg);
  return vb ? { width: Math.round(+vb[1]), height: Math.round(+vb[2]) } : { width: 0, height: 0 };
}

/** PNG の IHDR から寸法を読む(依存なし) */
export function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function pkgVersion(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', name, 'package.json'), 'utf8')).version;
  } catch {
    return 'unknown';
  }
}

/** この図のレイアウトエンジン。d2 ソースが vars.d2-config.layout-engine で上書きしていれば従う */
export function layoutFor(src, policy) {
  const m = /layout-engine\s*:\s*(dagre|elk|tala)/.exec(src);
  return m ? m[1] : policy.layout;
}

export function buildMetadata({ srcRel, srcText, layout, policy, natural, png, fontFamily }) {
  return {
    '//': 'この画像の再現情報。手で編集しない。scripts/figures/render-d2.mjs が生成する',
    source: srcRel,
    sourceSha256: sha256(srcText),
    layout,
    renderer: {
      d2js: `@d2lang/d2@${pkgVersion('@d2lang/d2')}`,
      rasterizer: `@resvg/resvg-js@${pkgVersion('@resvg/resvg-js')}`,
    },
    renderOptions: { ...policy.render },
    raster: { scale: policy.raster.scale },
    fonts: { loadSystemFonts: policy.fonts.load_system_fonts, defaultFontFamily: fontFamily },
    natural,
    output: { width: png.width, height: png.height, sha256: png.sha256 },
    note: 'TALA はレイアウトに乱数性があるため、描き直すと配置が変わることがある。ソースが変わっていなければ描き直さない',
  };
}

async function renderOne(srcAbs, policy, D2, Resvg) {
  const srcText = fs.readFileSync(srcAbs, 'utf8');
  const layout = layoutFor(srcText, policy);
  const d2 = new D2();
  const compiled = await d2.compile(srcText, { layout, ...policy.render });
  const svg = await d2.render(compiled.diagram, compiled.renderOptions);
  await d2.dispose();

  const natural = naturalSize(svg);
  const fontFamily = policy.fonts.default_font_family;
  const buf = new Resvg(svg, {
    fitTo: { mode: 'width', value: Math.max(1, Math.round(natural.width * policy.raster.scale)) },
    font: { loadSystemFonts: policy.fonts.load_system_fonts, defaultFontFamily: fontFamily },
  })
    .render()
    .asPng();

  const size = pngSize(buf);
  return {
    srcText,
    layout,
    natural,
    fontFamily,
    png: buf,
    pngInfo: { ...size, sha256: sha256(buf) },
  };
}

function needsRender(srcAbs, policy) {
  const { png, meta } = outputPathsFor(srcAbs, policy);
  if (!fs.existsSync(png) || !fs.existsSync(meta)) return 'PNG かメタ情報がありません';
  let m;
  try {
    m = JSON.parse(fs.readFileSync(meta, 'utf8'));
  } catch {
    return 'メタ情報が JSON として読めません';
  }
  if (m.sourceSha256 !== sha256(fs.readFileSync(srcAbs, 'utf8'))) return 'ソース(.d2)が変わっています';
  if (m.output?.sha256 !== sha256(fs.readFileSync(png))) return 'PNG がメタ情報と一致しません';
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const checkOnly = args.includes('--check');
  const explicit = args.filter((a) => !a.startsWith('--')).map((a) => path.resolve(ROOT, a));
  const policy = loadPolicy();

  const sources = explicit.length ? explicit : listSources(policy);
  if (!sources.length) {
    console.log('図のソース(.d2)がありません');
    return 0;
  }

  const todo = [];
  for (const s of sources) {
    const reason = all && !checkOnly ? '--all 指定' : needsRender(s, policy);
    if (reason) todo.push({ src: s, reason });
  }

  if (checkOnly) {
    for (const t of todo) console.log(`  描き直しが必要: ${rel(t.src)} (${t.reason})`);
    console.log(`図の再現性: ソース ${sources.length} 件、描き直しが必要 ${todo.length} 件`);
    return todo.length ? 1 : 0;
  }

  if (!todo.length) {
    console.log(`図: ソース ${sources.length} 件、すべて最新です`);
    return 0;
  }

  const { D2 } = await import('@d2lang/d2');
  const { Resvg } = await import('@resvg/resvg-js');

  let wide = 0;
  for (const { src, reason } of todo) {
    const r = await renderOne(src, policy, D2, Resvg);
    const { png: pngPath, meta: metaPath } = outputPathsFor(src, policy);
    fs.writeFileSync(pngPath, r.png);
    const md = buildMetadata({
      srcRel: rel(src),
      srcText: r.srcText,
      layout: r.layout,
      policy,
      natural: r.natural,
      png: r.pngInfo,
      fontFamily: r.fontFamily,
    });
    fs.writeFileSync(metaPath, `${JSON.stringify(md, null, 2)}\n`);

    const over = r.natural.width > policy.zenn.max_natural_width;
    if (over) wide++;
    console.log(
      `  ${over ? '⚠' : '✓'} ${rel(pngPath)}  自然 ${r.natural.width}x${r.natural.height} / 出力 ${r.pngInfo.width}x${r.pngInfo.height}  layout=${r.layout}  (${reason})`
    );
    if (over) {
      console.log(
        `      自然幅が ${r.natural.width}px で Zenn の本文幅 ${policy.zenn.max_natural_width}px を超えます。Zenn 側で縮小され文字が潰れます`
      );
    }
  }
  console.log(`図: ${todo.length} 件を描き直しました${wide ? `（うち ${wide} 件が幅超過）` : ''}`);
  return wide ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().then((code) => process.exit(code));
}
