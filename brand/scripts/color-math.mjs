// 色の数学。sRGB ⇄ OKLab/OKLCH(Björn Ottosson 2020 の公開式)、WCAG 2.x のコントラスト比、ガマット内への彩度の切り詰め。
// 依存なし。値の検証は oklch.com・Leonardo で再確認する(research/02-color-research.md 4.5)。
//
// 出典: https://bottosson.github.io/posts/oklab/ 、https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
}

export function rgbToHex([r, g, b]) {
  const c = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function rgbToOklab([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map(toLinear);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

export function oklabToRgb([L, a, b]) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(fromLinear);
}

export function hexToOklch(hex) {
  const [L, a, b] = rgbToOklab(hexToRgb(hex));
  const C = Math.hypot(a, b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

export function oklchToRgb({ L, C, H }) {
  const h = (H * Math.PI) / 180;
  return oklabToRgb([L, C * Math.cos(h), C * Math.sin(h)]);
}

const inGamut = (rgb) => rgb.every((v) => v >= -1e-6 && v <= 1 + 1e-6);

/** 色相と明度を固定し、sRGB に入るまで彩度だけを二分探索で落とす(RGB クリップは色相が変わるため使わない) */
export function oklchToHex({ L, C, H }) {
  let rgb = oklchToRgb({ L, C, H });
  if (inGamut(rgb)) return rgbToHex(rgb);
  let lo = 0, hi = C;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    rgb = oklchToRgb({ L, C: mid, H });
    if (inGamut(rgb)) lo = mid; else hi = mid;
  }
  return rgbToHex(oklchToRgb({ L, C: lo, H }));
}

export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x のコントラスト比(1〜21) */
export function contrast(fg, bg) {
  const a = relativeLuminance(fg), b = relativeLuminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** 明度の段 50〜950 を OKLCH で生成する。彩度は基準色の付近で最大、両端で絞る */
export const RAMP_L = { 50: 0.975, 100: 0.945, 200: 0.89, 300: 0.81, 400: 0.72, 500: 0.62, 600: 0.53, 700: 0.45, 800: 0.37, 900: 0.29, 950: 0.22 };

export function ramp(baseHex, { chromaFloor = 0.12 } = {}) {
  const base = hexToOklch(baseHex);
  const out = {};
  for (const [step, L] of Object.entries(RAMP_L)) {
    const d = Math.abs(L - base.L);
    const factor = Math.max(chromaFloor, 1 - (d / 0.6) ** 1.2);
    out[step] = oklchToHex({ L, C: base.C * factor, H: base.H });
  }
  return out;
}

export const fmt = (hex) => {
  const { L, C, H } = hexToOklch(hex);
  return `${hex} oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(1)})`;
};
