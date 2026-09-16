// アーキテクチャ図の再現性と、Zenn での可読性を検査する。
//
//   node scripts/lint/check-diagrams.mjs [--strict] [--report out.json]
//
//   D1 掲載用の PNG に D2 のソース(.d2)がある（ソースの無い画像は二度と更新できない）
//   D2 ソースに対応する PNG と再現用のメタ情報(.png.json)がある
//   D3 メタ情報のソースのハッシュが現在の .d2 と一致する（ソースを変えたら描き直す）
//   D4 メタ情報の出力のハッシュが現在の PNG と一致する（画像の手差し替えを止める）
//   D5 図の自然幅が Zenn の本文幅に収まる（超えると縮小され文字が潰れる）
//
// 規則の値は lint/policies/diagrams.json、生成は scripts/figures/render-d2.mjs、
// 手順と設計の理由は docs/diagrams.md にあります。

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, abs, exists, readJson, Report, parseArgs, finish, isMain } from './lib.mjs';

const POLICY = 'lint/policies/diagrams.json';
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

export function checkDiagrams({ policy = readJson(POLICY) } = {}) {
  const report = new Report('diagrams');
  const sev = policy.metadata?.severity || 'error';
  let pairs = 0;

  for (const dir of policy.diagram_dirs || []) {
    const dirAbs = abs(dir);
    if (!fs.existsSync(dirAbs)) continue;
    const files = fs.readdirSync(dirAbs);
    const exempt = new Set(policy.exempt || []);

    // D1: PNG に .d2 のソースがあるか
    for (const f of files.filter((x) => /\.(png|jpe?g|gif|webp)$/i.test(x))) {
      const relPng = `${dir}/${f}`;
      if (exempt.has(relPng)) continue;
      const src = `${dir}/${f.replace(/\.(png|jpe?g|gif|webp)$/i, '.d2')}`;
      if (!exists(src)) {
        report.add(sev, relPng, 'D1', `図のソース ${path.basename(src)} がありません。掲載する図は D2 で書き、scripts/figures/render-d2.mjs で描き出してください（ソースの無い画像は後から更新できません）。除外するなら lint/policies/diagrams.json の exempt に登録します`);
      }
    }

    for (const f of files.filter((x) => x.endsWith('.d2'))) {
      const base = f.replace(/\.d2$/, '');
      const relSrc = `${dir}/${f}`;
      const relPng = `${dir}/${base}.png`;
      const relMeta = `${dir}/${base}${policy.metadata.suffix}`;

      // D2: 出力とメタ情報の存在
      if (!exists(relPng)) {
        report.add(sev, relSrc, 'D2', `PNG ${base}.png がありません。npm run figures:render で描き出してください`);
        continue;
      }
      if (!exists(relMeta)) {
        report.add(sev, relSrc, 'D2', `再現用のメタ情報 ${path.basename(relMeta)} がありません。npm run figures:render で作られます`);
        continue;
      }

      let meta;
      try {
        meta = JSON.parse(fs.readFileSync(abs(relMeta), 'utf8'));
      } catch (e) {
        report.add(sev, relMeta, 'D2', `メタ情報を JSON として読めません: ${e.message}`);
        continue;
      }
      pairs++;

      // D3: ソースのハッシュ
      const srcHash = sha256(fs.readFileSync(abs(relSrc)));
      if (meta.sourceSha256 !== srcHash) {
        report.add(sev, relSrc, 'D3', `ソースを変えたのに PNG を描き直していません（メタ情報のハッシュと一致しません）。npm run figures:render で描き直してください`);
      }

      // D4: 出力のハッシュ
      const pngBuf = fs.readFileSync(abs(relPng));
      if (meta.output?.sha256 !== sha256(pngBuf)) {
        report.add(sev, relPng, 'D4', `PNG がメタ情報と一致しません。画像を手で差し替えず、ソース(.d2)を直して描き直してください`);
      }

      // D5: Zenn の本文幅
      const maxW = policy.zenn?.max_natural_width;
      if (maxW && meta.natural?.width > maxW) {
        report.error(relSrc, 'D5', `図の自然幅が ${meta.natural.width}px で、Zenn の本文幅 ${maxW}px を超えます。Zenn 側で縮小され文字が潰れます。direction: down にする・grid-rows で縦に積む・図を分割する・ラベルを短くする、のいずれかで幅を詰めてください`);
      }
      const maxH = policy.zenn?.max_natural_height;
      if (maxH && meta.natural?.height > maxH) {
        report.warn(relSrc, 'D5', `図の自然高さが ${meta.natural.height}px です（目安 ${maxH}px）。縦に長すぎる図は読み手が全体を把握しにくいので、分割を検討してください`);
      }
    }
  }

  report.note(`図: ソースと出力の対 ${pairs} 件を検査`);
  return report;
}

if (isMain(import.meta.url)) {
  finish(checkDiagrams(), parseArgs());
}
