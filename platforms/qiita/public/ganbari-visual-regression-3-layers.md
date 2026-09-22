---
title: "pixelmatch の基準画像を git で追跡して見た目の回帰を自動検査で止める：紹介ページ・子供のホーム・管理画面の 3 層と、寸法・語彙の歯止め"
tags:
  - Playwright
  - CI
  - pixelmatch
  - SvelteKit
  - VisualRegression
private: false
updated_at: ''
id: null
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

:::note info
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。
:::

# はじめに

画面の壊れ方には、テストが緑のまま起きるものがあります。配置の崩れ、デモにしか無い表示の本番画面への映り込み、勝手に開いたダイアログによるスクリーンショットの遮蔽。紹介ページ（LP）に載せる製品のスクリーンショットがデモ専用の経路（`/demo/` 配下）で撮られて本番と乖離する事故は、指摘で 8 回再発しました。動いているのに崩れている画面を、どう機械で捕まえるのでしょうか。

git に置いた基準画像（baseline）と撮り直した画像を、画素の単位で比べます。構成は 3 つの部品からできています。pixelmatch の基準画像を git で追跡して自動検査（CI）で比較する仕組み、それを紹介ページからアプリ本体の 3 層に広げた運用、紹介ページの寸法と語彙を数値で刻む歯止め（ratchet）です。

- 正本（Zenn の本『生成AIに実装を任せて商用サービスを作る』）: [見た目の回帰検査の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/visual-regression)
- 実装: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)
- pixelmatch: [npm](https://www.npmjs.com/package/pixelmatch)

# 技術選定理由: なぜ pixelmatch か

候補は 6 つありました。採ったのは pixelmatch で、PNG 画像を画素の単位で比べる定番、依存は `pngjs` だけ、中核は短い実装です。退けた候補の理由は短く書けます。`jest-image-snapshot` は Vitest のリポジトリには合わず、内部は pixelmatch なので抽象化が厚いだけ。Playwright の `toHaveScreenshot()` は撮影の手順が固定で、プレビューサーバの起動とクッキーの注入とスクロールという撮影の準備を再実装することになる。Percy や Chromatic のような外部サービスは基準画像が外部のサーバに置かれ、git で追跡する正本と矛盾する。BackstopJS は実行環境が二重になる。独自実装は短い既存の道具を再実装する意味がない。

欠点も把握して選んでいます。高解像度の画素ごとの比較は CPU の負荷が高く画像あたり約 100 ミリ秒かかり、構造の類似度（SSIM）ではないので縁のぼかし（anti-aliasing）の微差を誤検知しえます。閾値で吸収する判断です。

# 比較の実体

比較スクリプトの入力は 2 つで、git に入っている基準画像と、自動検査がその場で撮った現状の画像（current）です。pixelmatch で画像ごとに比べ、差分を可視化した PNG 画像と JSON の報告を自動検査の成果物に残します。解像度が違うときは現状の側を基準画像の寸法に揃え、WebP 形式は比較の前に PNG 画像へ変換します。

```javascript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/check-lp-visual-regression.mjs
// pixelmatch 内部 threshold (0-1)。色差感度。0.1 で「人間が知覚できる程度」(pixelmatch README 推奨)。
const PIXELMATCH_THRESHOLD = 0.1;
// ...
async function compareOne({ baselinePath, currentPath, diffPath }) {
	// baseline 寸法を先に取得し、current を baseline 寸法にリサイズする
	// (capture script の viewport は固定だが、playwright バージョン更新等で微差が出る可能性)
	const baselineMeta = await sharp(baselinePath).metadata();
	const baselineImg = await decodeImage(baselinePath);
	const currentImg = await decodeImage(currentPath, {
		targetWidth: baselineMeta.width,
		targetHeight: baselineMeta.height,
	});
	const { width, height } = baselineImg;
	const diff = new PNG({ width, height });
	const diffPixels = pixelmatch(baselineImg.data, currentImg.data, diff.data, width, height, {
		threshold: PIXELMATCH_THRESHOLD,
	});
	const totalPixels = width * height;
	const diffPct = (diffPixels / totalPixels) * 100;
	if (diffPath && diffPixels > 0) {
		fs.mkdirSync(path.dirname(diffPath), { recursive: true });
		fs.writeFileSync(diffPath, PNG.sync.write(diff));
	}
	return { diffPixels, totalPixels, diffPct, width, height };
}
```

画像あたりの差分が 10% を超えたら落ちます。スクリプトは `--baseline-dir` と `--current-dir` を取る汎用の作りなので、紹介ページ以外の層も同じスクリプトを再利用します。

引数の解釈、基準画像と現状の画像の突き合わせ、撮影漏れの判定を含む CLI の全体は [`scripts/check-lp-visual-regression.mjs`](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/check-lp-visual-regression.mjs#L276) の `main` にあります。撮影の手順は [`scripts/capture-hp-screenshots.mjs`](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/capture-hp-screenshots.mjs) にあります。

# GitHub Actions で撮って比べる

自動処理は、アプリをビルドしてプレビューサーバをデモのデータで起動し、紹介ページ用のスクリーンショットを撮り、比較スクリプトを走らせます。

```yaml
# 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/.github/workflows/lp-visual-regression.yml
      - name: Build app for preview
        # vite preview は NODE_ENV=production で起動するため build が必要
        run: npm run build

      - name: Start preview server
        # AUTH_MODE=anonymous + DATA_SOURCE=demo で起動 (Multi-Lambda demo Lambda 同型、ADR-0048)
        # capture-hp-screenshots.mjs が本番ルート `/(child)/[uiMode]/home` を demo fixture data で撮影できる
        env:
          AUTH_MODE: anonymous
          DATA_SOURCE: demo
        run: |
          # ...
          npm run preview -- --port 5173 --host 0.0.0.0 > /tmp/preview.log 2>&1 &
          echo "PREVIEW_PID=$!" >> $GITHUB_ENV
          for i in {1..120}; do
            if curl -sf http://localhost:5173 > /dev/null 2>&1; then
              echo "Preview server ready after ${i}s"
              exit 0
            fi
            sleep 1
          done
          echo "::error::Preview server failed to start within 120s"
          cat /tmp/preview.log
          exit 1

      - name: Capture LP screenshots (current state)
        env:
          BASE_URL: http://localhost:5173
        # ...
        continue-on-error: true
        run: node scripts/capture-hp-screenshots.mjs --webp

      - name: Stop preview server
        if: always()
        run: |
          if [ -n "$PREVIEW_PID" ]; then
            kill $PREVIEW_PID 2>/dev/null || true
          fi

      - name: Run visual regression check
        # diff > 10% で exit 1。baseline と current の image set 差異 (撮影漏れ) も検出。
        run: node scripts/check-lp-visual-regression.mjs
```

撮影の要点は、デモ用の経路ではなく本番の経路を、`AUTH_MODE=anonymous` と `DATA_SOURCE=demo` の環境変数でデモのデータを描画して撮ることです。かつてはデモ専用の経路を撮っていたため、デモにしか無い区画が映り込み、本番のダッシュボードから乖離していました。

```javascript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/capture-hp-screenshots.mjs
//   本リファクタでは Multi-Lambda demo deployment (ADR-0048) と同型の env (AUTH_MODE=anonymous +
//   DATA_SOURCE=demo) で preview server を起動し、本番ルート `/(child)/[uiMode]/home` 等を
//   demo fixture data で描画した状態を撮影する。`selectedChildId` cookie を `?screenshot=all` と
//   合わせて pre-set することで `/(child)/+layout.server.ts` の `/switch` redirect をバイパスする。
```

`?screenshot=all` は、本番の利用者が見る演出を撮影時に強制表示するモードです。撮影用のクッキーとクエリを事前に設定して、子供の切り替えへの転送を避けています。

# 基準画像は git で追跡する

「スクリーンショット」という語の指す実体が 3 つあり、混同すると誤った更新操作につながります。

| 何を指すか | git で追跡するか | 用途 |
|---|---|---|
| 基準画像 | する（正本） | 比較の正解で、プルリクエストに同梱して更新する |
| 現状の画像 | しない | 自動検査が撮影した現状で、コミットしない |
| プルリクエストの証跡 | 別のブランチ | レビュー用の修正前と修正後（Before / After）で、基準画像とは無関係 |

意図的に紹介ページを変えるたびに関門は必ず落ちます。それは設計どおりの挙動で、決めるべきは基準画像を更新するかどうかです。分岐は 3 つだけに絞っています。変更が意図したものなら、基準画像を更新して同じプルリクエストに入れる。フォントの描画や撮影のタイミングで偶然ずれたなら、基準画像は触らずに原因を調べる。意図していない回帰なら、基準画像ではなく実装を直す。`--threshold` の一時的な上書きや基準画像の上書きで失敗を隠すことは禁じ、基準画像にあって現状に無い画像も「撮影漏れ」として落とします。

# 3 層に広げる

pixelmatch の適用は紹介ページから始まり、アプリ本体の重要な画面に広がりました。

| 層 | 対象 | 扱い |
|---|---|---|
| 紹介ページ | 紹介ページの全スクリーンショット（携帯とデスクトップ） | 止める検査（hard-fail。差分 10% 超） |
| 子供のホーム | 4 つの年齢帯のホームとバトル | 警告 |
| アプリ | 準備モードのホーム、管理画面の活動とチェックリスト、ページガイドを開いた状態 | 警告 |

3 層とも比較スクリプトは同じ 1 本で、基準画像のディレクトリだけが違います。準備モードは 5 つ目の年齢帯なので、3 層を合わせると 5 つの年齢帯のホーム全部の見た目の回帰（visual regression）を機械で検出できます。アプリの層の撮影も、本番の経路へデモのデータを流し込んだ決定的な環境で行います。

子供のホームとアプリの 2 層は「初回は警告、安定後に止める検査へ昇格を判断」と自動処理に書かれたまま昇格していません。警告の関門は落ちても誰も見ないので、昇格するか消すかを決めるべきでした。紹介ページの関門も本番ブランチ向けのプルリクエストだけで発火する重い検査の列で、開発ブランチ向けの通常のプルリクエストでは走りません。

# 寸法と語彙を刻む

画素の比較だけでは足りない回帰もあります。紹介ページは、圧縮しても次のプルリクエストでまた伸びる問題を抱えていました。Playwright で紹介ページを描画し、寸法と語彙を数値で刻みます。

```javascript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/measure-lp-dimensions.mjs
const THRESHOLDS = {
	// ...
	mobileHeight: 15000,
	desktopHeight: 8000,
	ctaVariantsMax: 3,
	// ...
	desktopHeightWarn: 7800,
	// ...
	presetActivityCountClaimedMin: 120,
	// LP が訴求するセット (パック) 数の下限。実パック数がこれを下回れば LP 訴求が実装を上回る。
	presetActivityPackCountClaimedMin: 12,
};
```

```javascript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/measure-lp-dimensions.mjs
const STRICT_FORBIDDEN_TERMS = [
	// コンプガチャ連想（#1313）
	'ガチャ',
	'抽選',
	'コンプリート',
	// ...
];

const IT_JARGON_FORBIDDEN_TERMS = [
	'git clone',
	'docker compose',
	// ...
];
```

禁止語は 2 系統です。開発者の語彙はトップページだけで検査し、射幸性の語彙は法務文書を含む全ページで検査します。プリセットの活動数の訴求の値は、延べの件数ではなく活動名の種類の数で裏取りします。男の子向けと女の子向けのセットが同名の活動を重複して持つため、延べで数えると選べる種類を 2 倍以上に見せる訴求が自動検査を緑で通ります。内部リンクの行き先の実在も検査します。静的な HTML は `id` を消してもリンクが 200 を返すので、HTTP の到達性では捕まらないからです。

# プルリクエストの証跡と、証跡の偽装

見た目の変更を含むプルリクエストには、修正前と修正後のスクリーンショットを添える規律があります。証跡を要求すると、証跡を偽装する経路が生まれます。ブランチを作り直したあとスクリーンショット用のブランチを更新し忘れ、修正前と修正後が完全に同一の画像のまま 3 回続いたプルリクエストがありました。対策の関門は、本文に埋め込まれた修正前と修正後の画像について内容の指紋（GitHub の Blob SHA）を比べ、一致していれば偽装と判定して落とします。

```javascript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/check-ss-blob-sha-uniqueness.mjs
export function pairBeforeAfter(paths) {
	const beforeMap = new Map();
	const afterMap = new Map();

	for (const p of paths) {
		// 最後の `/` 以降が basename。`<dir>/before-<key>.png` から prefix と key を抽出
		const slash = p.lastIndexOf('/');
		const dir = slash >= 0 ? p.slice(0, slash + 1) : '';
		const basename = slash >= 0 ? p.slice(slash + 1) : p;

		const beforeMatch = basename.match(/^before-(.+)$/i);
		const afterMatch = basename.match(/^after-(.+)$/i);

		if (beforeMatch) {
			const key = `${dir}${beforeMatch[1]}`;
			beforeMap.set(key, p);
		} else if (afterMatch) {
			const key = `${dir}${afterMatch[1]}`;
			afterMap.set(key, p);
		}
	}

	const pairs = [];
	for (const [key, before] of beforeMap) {
		const after = afterMap.get(key);
		if (after) {
			pairs.push({ key, before, after });
		}
	}
	return pairs;
}
```

この関門にも穴がありました。組が 0 件だと見送りで通していたため、ファイルの命名を変えるだけで検査が黙って消えました。現在は、スクリーンショットを埋め込んでいるのに組が 0 件なら落とします。同一なのが正しい場合は 12 文字以上の理由を宣言し、表示の条件が環境に依存して撮れない場合は実在する Storybook の見本（story）のパスを本文に書きます。「原理的に撮れない」を「見た目を確認しなくてよい」にしない設計です。

# まとめ

- 基準画像は git で追跡し、自動検査が撮った現状と pixelmatch で比べます。差分の PNG 画像と JSON を成果物に残します
- 撮影は本番の経路へデモのデータを流し込んだ決定的な環境で行い、デモ専用の経路は撮りません
- 比較スクリプトは汎用にして、紹介ページ・子供のホーム・アプリの 3 層で同じ 1 本を使います。警告の層は昇格か撤去を決めます
- 寸法と語彙は数値で刻み、訴求の値は延べではなく種類の数で裏取りします
- 証跡の関門は偽装と検査漏れの往復です。組が 0 件を見送りにせず、例外には実体のある理由を要求します

同一の画像を 2 回貼れば証跡の要求は形式上満たされ、テストは緑のままでした。証跡が揃っていることは、画面を確かめたことの証明になりません。完了は、確認項目が埋まったかではなく、顧客に届く画面を本当に確かめたかで決めます。この考え方は、[Zenn の本の終盤の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/principles)にまとめました。

動いているサービス: [がんばりクエスト](https://www.ganbari-quest.com/)
