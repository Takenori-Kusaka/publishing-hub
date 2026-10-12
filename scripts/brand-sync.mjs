// 個人ブランド基盤(kusaka-brand)の生成物を brand/ へ複製する。正本は kusaka-brand リポジトリ。
//
//   node scripts/brand-sync.mjs <kusaka-brand のパス>   # 複製して brand/manifest.json を書く
//   node scripts/brand-sync.mjs --check                  # 複製が manifest と一致するか(改ざん・手編集の検出)
//
// なぜ複製か。CI(GitHub Pages のビルド、Zenn の検査)が、別リポジトリの clone や npm の git 依存に頼らずに動くため。
// process-compass の template:kb と同じ考え方(正本 → 複製 → 乖離の検査)。
// 複製するもの: dist/(トークンの生成物)、fonts/(OFL のフォント)、scripts/{render-svg,fonts,color-math}.mjs(描画器)、
// tokens/tokens.json(参照用)、LICENSE.md、package.json(版)。

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEST = path.join(ROOT, 'brand');
const MANIFEST = path.join(DEST, 'manifest.json');
const INCLUDE = ['dist', 'fonts', 'scripts/render-svg.mjs', 'scripts/fonts.mjs', 'scripts/color-math.mjs', 'tokens/tokens.json', 'LICENSE.md', 'package.json'];

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out);
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

function copyInto(src, rel) {
  const from = path.join(src, rel);
  const to = path.join(DEST, rel);
  if (!fs.existsSync(from)) throw new Error(`正本に ${rel} がありません`);
  if (fs.statSync(from).isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const f of walk(from)) {
      fs.mkdirSync(path.dirname(path.join(to, f)), { recursive: true });
      fs.copyFileSync(path.join(from, f), path.join(to, f));
    }
  } else {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}

export function hashTree() {
  const files = {};
  for (const f of walk(DEST).filter((f) => f !== 'manifest.json').sort()) {
    files[f] = sha256(fs.readFileSync(path.join(DEST, f)));
  }
  return files;
}

export function check() {
  if (!fs.existsSync(MANIFEST)) return { ok: false, problems: ['brand/manifest.json がありません。node scripts/brand-sync.mjs <kusaka-brand のパス> で複製してください'] };
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const now = hashTree();
  const problems = [];
  for (const [f, h] of Object.entries(m.files)) {
    if (!(f in now)) problems.push(`brand/${f} が無い(manifest にはある)`);
    else if (now[f] !== h) problems.push(`brand/${f} が manifest と一致しない。複製を手で編集しないで、正本(kusaka-brand)を直して同期し直してください`);
  }
  for (const f of Object.keys(now)) if (!(f in m.files)) problems.push(`brand/${f} は manifest に無い(同期の外で足された)`);
  return { ok: problems.length === 0, problems, version: m.version };
}

function sync(src) {
  const abs = path.resolve(src);
  if (!fs.existsSync(path.join(abs, 'tokens/tokens.json'))) throw new Error(`${abs} は kusaka-brand のリポジトリに見えません(tokens/tokens.json が無い)`);
  // dist が正本の tokens.json と一致しているかを、正本側の --check で確かめてから複製する
  execFileSync(process.execPath, [path.join(abs, 'scripts/build-tokens.mjs'), '--check'], { stdio: 'inherit' });
  fs.rmSync(DEST, { recursive: true, force: true });
  for (const rel of INCLUDE) copyInto(abs, rel);
  let commit = null;
  try { commit = execFileSync('git', ['-C', abs, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* 未コミットでもよい */ }
  const version = JSON.parse(fs.readFileSync(path.join(abs, 'package.json'), 'utf8')).version;
  const manifest = {
    '//': '複製の台帳。手で編集しない。scripts/brand-sync.mjs が書く。正本は https://github.com/Takenori-Kusaka/kusaka-brand',
    version,
    sourceCommit: commit,
    syncedAt: new Date().toISOString(),
    files: hashTree(),
  };
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`brand: @kusaka/brand@${version}${commit ? ` (${commit.slice(0, 7)})` : ''} を ${Object.keys(manifest.files).length} ファイル複製しました`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--check')) {
    const r = check();
    for (const p of r.problems) console.error(`  ✖ ${p}`);
    console.log(r.ok ? `brand: 複製は manifest と一致(@kusaka/brand@${r.version})` : `brand: 複製が正本と食い違う(${r.problems.length} 件)`);
    process.exit(r.ok ? 0 : 1);
  }
  if (!args[0]) {
    console.error('使い方: node scripts/brand-sync.mjs <kusaka-brand のパス> | --check');
    process.exit(2);
  }
  sync(args[0]);
}
