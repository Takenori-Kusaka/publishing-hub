---
title: "pixelmatch の baseline を git で追跡して見た目の回帰を CI で止める：LP・子供ホーム・管理画面の 3 層と、寸法・語彙の ratchet"
tags:
  - Playwright
  - CI
  - pixelmatch
  - SvelteKit
  - VisualRegression
private: true
updated_at: ''
---

:::note info
この記事は、生成AIを使って作成し、筆者が内容を確認・修正したうえで公開しています。使ったツールと用途は、末尾の「生成AIの利用について」に書いています。
:::

# はじめに

UI の壊れ方には、テストが緑のまま起きるものがあります。レイアウトの崩れ、デモ固有の表示の本番画面への混入、勝手に開いたダイアログによるスクリーンショットの遮蔽。LP に載せる製品スクリーンショットがデモの経路で撮られて本番と乖離する事故は、指摘で 8 回再発しました。

この記事は、その再発を止めた仕組みを、コピーして組める形でまとめたものです。pixelmatch の baseline を git で追跡し CI で比較する構成、それを LP からアプリ本体の 3 層に広げた運用、そして LP の寸法と語彙を数値で刻む ratchet です。道具の選定理由と事故の詳細は正本に書きました。

- 正本（Zenn Books『生成AIに実装を任せて商用サービスを作る』）: [見た目の回帰の章](https://zenn.dev/takenori_kusaka/books/ganbari-quest-design/viewer/visual-regression)
- 実装: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)
- pixelmatch: [npm](https://www.npmjs.com/package/pixelmatch)

# 技術選定: なぜ pixelmatch か

候補は 6 つありました。採ったのは `pixelmatch` で、PNG の pixel 単位比較の定番、依存は `pngjs` だけ、コアは短い実装です。退けた候補の理由は短く書けます。jest-image-snapshot は vitest のリポジトリには合わず、内部は pixelmatch なので抽象化が厚いだけ。Playwright の `toHaveScreenshot()` は撮影の戦略が fixture に固定され、preview server と cookie 注入と scroll の撮影 setup を再実装することになる。SaaS の visual regression は baseline が cloud 管理になり、git で追跡する SSOT と矛盾する。BackstopJS は runner が二重化する。独自実装は短い OSS を再実装する意味がない。

デメリットも把握して選んでいます。高解像度の per-pixel 比較は CPU bound で画像あたり約 100ms かかり、SSIM ではないので anti-aliasing の微差を誤検知しえます。閾値で吸収する判断です。

# 比較の実体

比較スクリプトは、CI が撮影した現状と git の baseline を pixelmatch で比べ、画像ごとの diff PNG と JSON report を artifact に出します。解像度が違えば baseline 側に揃え、WebP は PNG に decode します。

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

画像あたりの diff が 10% を超えたら fail です。スクリプトは `--baseline-dir` と `--current-dir` を取る汎用の作りなので、LP 以外の層も同じスクリプトを再利用します。

# GitHub Actions で撮って比べる

workflow は、アプリを build して preview server を demo のデータで起動し、LP 用のスクリーンショットを撮り、比較スクリプトを走らせます。

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

撮影のポイントは、デモ用の route ではなく本番の route を、`AUTH_MODE=anonymous` と `DATA_SOURCE=demo` の環境変数で demo のデータを描画して撮ることです。かつてはデモ専用の route を撮っていたため、デモにしか無いセクションが映り込み、本番のダッシュボードから乖離していました。

```javascript
// 出典: https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/capture-hp-screenshots.mjs
//   本リファクタでは Multi-Lambda demo deployment (ADR-0048) と同型の env (AUTH_MODE=anonymous +
//   DATA_SOURCE=demo) で preview server を起動し、本番ルート `/(child)/[uiMode]/home` 等を
//   demo fixture data で描画した状態を撮影する。`selectedChildId` cookie を `?screenshot=all` と
//   合わせて pre-set することで `/(child)/+layout.server.ts` の `/switch` redirect をバイパスする。
```

`?screenshot=all` は、本番の利用者が見る演出を撮影時に強制表示する mode です。撮影用の cookie と query を pre-set して、子供切替への redirect を避けています。

# baseline は git で追跡する

「screenshot」という語の指す実体が 3 つあり、混同すると誤った更新操作につながります。

| 何を指すか | git で追跡するか | 用途 |
|---|---|---|
| baseline | する（SSOT） | 比較の正解で、PR に同梱して更新する |
| current | しない | CI が撮影した現状で、commit しない |
| PR の証跡 | 別 branch | レビュー用の Before / After で、baseline とは無関係 |

意図的な LP の変更のたびに gate は必ず fail します。それは設計どおりの挙動で、決めるべきは baseline を更新するかどうかです。分岐は 3 つだけに絞っています。意図的な変更なら baseline を更新して PR に同梱する。フォントの rendering や撮影タイミングによる偶発的な差分なら更新せず原因を調べる。意図しない回帰なら実装を直す。`--threshold` の一時上書きや baseline の上書きで fail を隠すことは禁じ、baseline にあって current に無い画像も「撮影漏れ」として fail にします。

# 3 層に広げる

pixelmatch の適用は LP から始まり、アプリ本体の critical な画面に広がりました。

| 層 | 対象 | 扱い |
|---|---|---|
| LP | LP 全スクリーンショット（mobile と desktop） | hard-fail（diff > 10%） |
| 子供ホーム | 4 つの年齢モードのホームとバトル | warn |
| アプリ | baby ホーム、admin の活動とチェックリスト、ページガイド open 状態 | warn |

3 層とも比較スクリプトは同じ 1 本で、baseline のディレクトリだけが違います。アプリ層の撮影も、本番の route へ demo のデータを流し込んだ決定的な環境で行います。

正直に書くと、子供ホームとアプリの 2 層は「初回は warn、安定後に hard-fail へ昇格判断」と workflow に書かれたまま昇格していません。warn の gate は落ちても誰も見ないので、昇格するか消すかを決めるべきでした。LP の gate も main 向けの PR だけで発火する重量レーンで、develop 向けの通常の PR では走りません。

# 寸法と語彙を刻む

pixel の比較だけでは足りない回帰もあります。LP は、圧縮しても次の PR でまた伸びる問題を抱えていました。Playwright で LP を描画し、寸法と語彙を数値で刻みます。

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

禁止語は 2 系統です。開発者語彙はトップページだけで検査し、射幸性の語彙は法務文書を含む全ページで検査します。プリセット活動数の訴求値は、延べ件数ではなく活動名のユニーク数で裏取りします。性別の variant が同名の活動を重複して持つため、延べで数えると選べる種類を 2 倍以上に見せる訴求が CI 緑で通ります。内部リンクの dead anchor も検査します。静的 HTML は id を消してもリンクが 200 を返すので、HTTP の到達性では捕まらないからです。

# PR の証跡と、証跡の偽装

見た目の変更を含む PR には、Before / After のスクリーンショットを添える規律があります。証跡を要求すると、証跡を偽装する経路が生まれます。rebase 後にスクリーンショット用の branch を更新し忘れ、Before と After が完全に同一の画像のまま 3 ラウンド続いた PR がありました。対策として、PR 本文に埋め込まれた画像の Blob SHA が Before と After で一致していれば偽装として落とす gate が入りました。

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

この gate にも穴がありました。ペアが 0 件だと skip で通していたため、ファイルの命名を変えるだけで検査が黙って消えました。現在は、スクリーンショットを埋め込んでいるのにペアが 0 件なら fail にしています。同一なのが正しい場合は 12 文字以上の理由を宣言し、表示条件が環境に依存して撮れない場合は実在する Storybook story のパスを本文に書きます。「原理的に撮れない」を「見た目を確認しなくてよい」にしない設計です。

# まとめ

- baseline は git で追跡し、CI が撮った current と pixelmatch で比べます。diff PNG と JSON を artifact に残します
- 撮影は本番の route へ demo のデータを流し込んだ決定的な環境で行い、デモ専用の route は撮りません
- 比較スクリプトは汎用にして、LP・子供ホーム・アプリの 3 層で同じ 1 本を使います。warn の層は昇格か撤去を決めます
- 寸法と語彙は数値で刻み、訴求値は延べではなくユニーク数で裏取りします
- 証跡の gate は偽装と検査漏れの往復です。ペア 0 件を skip にせず、例外には実体のある理由を要求します

# 生成AIの利用について

この記事の作成には、生成AIの Claude（Anthropic の Claude Fable 5.1）を使いました。正本の該当章からの構成の検討、本文の下書きと改稿、コードの抜粋の照合、校正に使っています。筆者が内容を確認し、必要に応じて修正しました。公開した内容の責任は筆者が負います。
