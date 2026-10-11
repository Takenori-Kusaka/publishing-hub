// ブランドが同梱するフォントの一覧。描画器(render-svg.mjs)と利用側が同じファイルを使うための単一の入口。
//
// フォントはすべて SIL Open Font License 1.1 で、画像への埋め込み・Web 配信・再配布ができる(各 fonts/<family>/LICENSE)。
// 役割の割り当て(見出し・本文・コード)は brand/02-typography.md が正本。ここはファイルの所在だけを持つ。

import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FONT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fonts');

/** family 名(SVG / CSS の font-family に書く名前)→ ファイル */
export const FONTS = {
  'BIZ UDPGothic': {
    role: 'heading-and-figure',
    license: 'OFL-1.1',
    source: 'https://github.com/googlefonts/morisawa-biz-ud-gothic (v1.051)',
    files: {
      400: 'biz-udpgothic/BIZUDPGothic-Regular.ttf',
      700: 'biz-udpgothic/BIZUDPGothic-Bold.ttf',
    },
  },
  'Noto Sans JP': {
    role: 'body',
    license: 'OFL-1.1',
    source: 'https://github.com/notofonts/noto-cjk (Sans 2.004, JP subset)',
    files: {
      400: 'noto-sans-jp/NotoSansJP-Regular.otf',
      700: 'noto-sans-jp/NotoSansJP-Bold.otf',
    },
  },
  'UDEV Gothic': {
    role: 'code',
    license: 'OFL-1.1',
    source: 'https://github.com/yuru7/udev-gothic (v2.2.0)',
    files: {
      400: 'udev-gothic/UDEVGothic-Regular.ttf',
      700: 'udev-gothic/UDEVGothic-Bold.ttf',
    },
  },
};

/** resvg の font.fontFiles に渡す絶対パスの一覧 */
export function fontFiles() {
  const out = [];
  for (const f of Object.values(FONTS)) for (const rel of Object.values(f.files)) out.push(path.join(FONT_DIR, rel));
  return out;
}
