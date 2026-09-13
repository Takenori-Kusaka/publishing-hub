// エディタ連携用の既定プロファイル(Zenn 正本)。
// CI と npm run lint は lint/channels.json に従って媒体別のプロファイルを使います。
// 詳細は docs/linting.md
module.exports = require('./lint/textlint/zenn.json');
