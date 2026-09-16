---
title: "第Ⅰ部-2　滞在時間を価値毀損と数える ― anti-engagement 原則と「卒業」"
---

> リポジトリ: [Takenori-Kusaka/ganbari-quest](https://github.com/Takenori-Kusaka/ganbari-quest)

がんばりクエストの設計を最も強く縛っている原則は、機能の一覧やアーキテクチャ図には現れません。それは「子供がアプリの中にいる時間は短いほどよい」という、通常のサービス設計とは逆向きの評価軸です。意思決定記録（ADR）の 12 番、通称 anti-engagement 原則がそれを定義しています[^adr12]。この章では、この原則がなぜ必要になり、どこまで機械的に守らせているかを扱います。

## 通常のアプリと逆の KPI

子供向けアプリ、ソーシャルゲーム、動画サービスの多くは、日次アクティブユーザー数と滞在時間の積を KPI にした設計を共有しています。ランダム報酬を引き続けられる UI、無限に続くスクロール、通知による再入店誘導、動画の自動再生などがその道具です。ADR-0012 はこの設計哲学を次のように整理しています。

> この設計哲学は子供が アプリと現実活動のどちらに時間を使うか のトレードオフで現実活動を減らす方向に働く。親が購入を判断するプロダクトにおいて、子供の現実時間を奪う設計は親の購入動機と反する。[^adr12]

がんばりクエストの購入者は親で、利用者は子供です。親がこの製品に払う理由は「子供が歯みがきや宿題や手伝いを自分からするようになること」であって、「子供がアプリを長く使うこと」ではありません。むしろアプリの中で過ごす時間は、親が増やしたい現実の活動時間を削ります。ここから、ADR は決定の第 1 項をこう置きます。

> 子供側 UI は「記録する → 数秒で閉じる」を最短経路として設計する。セッション長を延ばす動機設計は採用しない。[^adr12]

KPI の設計方針も明文化されています。家族内の日次起動率は追い、セッション長は追わず、むしろ短くなる方向を善とします。現実活動の記録数とチェックリスト達成率はアプリ外時間の産物なので追います[^adr12]。親の管理画面は情報把握が目的なので、この制約の対象外です。

## なぜ ADR にしたのか

この原則は最初から明文化されていたわけではありません。ADR のコンテキスト節には、明示的な記録がなかったために起きた事故が書かれています。LP（ランディングページ）には「シールガチャ」という文言が混入したまま、実装は 1 日 1 回に制限されたおみくじだった、という食い違いです[^adr12]。「毎日引ける」を暗示する販促文言が、「1 日 1 回、数秒で終わる」実装を裏切っていました。

この事故は 2 つの ADR を生みました。1 つは本章の ADR-0012 です。哲学レベルの判断原則を永続化し、将来の機能追加や販促文言の提案を即座に審査できる状態を作りました。もう 1 つは「LP の文言は実装の事実から作る」という ADR-0013 で、こちらはインフラ編の LP 配信の章で扱います。

## 禁止と許容の境界

原則だけでは、個々の機能の境界が曖昧になります。そこで ADR-0012 は 6 節で「機能別 許容/禁止 UX 細則」を持ち、主要な機能ごとに許容する UX と禁止する UX を表にしています。判定の物差しは 1 つです。

> 判定原則: 「1 日 1 タップ記録 → 数秒で完結 → 即離脱」動線に沿うか。[^adr12]

表から代表的な行を引きます。

| 機能 | 許容する UX | 禁止する UX |
| --- | --- | --- |
| スタンプカード | 1 日 1 回のサプライズ獲得 → 結果提示 → 即閉じ | コレクション閲覧ページで滞在、未取得枠を強調して取得欲を煽る UI |
| おみくじ | 1 タップ → 即結果 → 数秒で閉じる | 演出の長時間化、2 回目以降のドロー動線 |
| バトル | 現実活動の記録完了への一回性の報酬 | ステージ周回、デイリーダンジョン型の反復戦闘、スタミナ回復の待機 UI |
| ごほうびショップ | 交換動線のみ、必要時のみ入る | ウィンドウショッピング滞在、おすすめ表示による回遊 |
| Web Push 通知 | 親端末のみ、1 日 3 通まで、21 時から翌 7 時は送らない | 子端末への送信、再入店を誘導する目的の連打 |

注目すべきは最後の行です。子端末への通知は「送らない運用」ではなく「送れない構造」になっています。購読 API が子供ロールの購読を 403 で拒否し、送信側でも二重に防いでいます[^adr12]。運用ルールは破られますが、コードに埋め込んだ制約は破るのに意図的な変更を要します。この「原則を構造に落とす」姿勢は、本書の後半で繰り返し出てきます。

減点やペナルティに関するルールも同じ扱いです。マーケットプレイスの取込対象として「penalty」型のルールが設計上は存在しますが、取込んでも no-op の警告になるだけで、子供の画面に到達する経路がありません。将来採用する場合の条件として、親の明示的な ON 操作、子供 UI への文言非露出、累積禁止、兄弟比較の無条件却下、警告モーダルの必須化、24 時間の待機期間が列挙されています[^adr12]。子供の失敗体験を強化する機能は、作れるかどうかではなく、作ってよいかどうかの審査を先に通します。

## 原則が退けた案

この原則は、何度も「もっと遊べる機能」を退けてきました。コアループの設計理由を記録した文書は、L1/L2/L3 の 3 層モデルを採用するにあたって「ガチャ中心」の案を次の理由で棄却しています。

> 案 C（ガチャ中心）棄却理由: ADR-0012（Anti-engagement 原則）に直接抵触する。「連続ガチャ / 射幸心訴求」は子供側 UI の滞在時間を増やす設計であり、親の購入動機（現実活動の充実）と反する。LP と実装の乖離を生んだ直接原因でもあった[^rationale02]

シーズンイベントの機構（イベントバナー、シーズンパス、月替わりのプレゼント）は、自動配信による煽りと不確実な体験が ADR-0012 と ADR-0013 の二重違反であると判定されました。結果として完全に撤去されました。代替の価値は、後述するチャレンジ機能が能動的に提供します[^ui06]。応援の完了画面は「もう 1 回応援」という誘導を意図的に持ちません[^ui06]。0〜2 歳向けのゲーミフィケーション UI は、現実の利用がない以上「コア哲学に反する」として廃止されました。代わりに親の準備モードが置かれています[^adr11]。

削るだけではありません。ごほうびショップの特権交換では、以前は 1 回の申請で 1 個しか交換できず、「ゲーム時間 30 分」を 4 個使って 2 時間遊ぶには、子供の 4 回の交換と親の 4 回の承認が必要でした。個数指定を入れて 1 回のタップと 1 回の承認に減らしたのは、滞在時間を削るための機能追加です[^ui06]。

## 発達心理学の裏づけ

この原則は好みではなく、子供の動機づけに関する研究の読み込みに支えられています。参考文献の一覧には 3 種類の研究が並びます[^psych]。有形報酬が内発的動機を有意に低下させ、言語的報酬は肯定的な効果を持つとする 128 研究のメタ分析（Deci, Koestner & Ryan, 1999）。報酬の予告で幼稚園児が自発的に活動する時間が減った実験（Lepper, Greene & Nisbett, 1973）。5 歳未満は社会的比較をほとんど行わず、幼児に比較情報を与えることは発達的に不適切とする研究（Butler, 1998）です。

これらは製品の具体的な判断に落ちています。兄弟の競争モードは削除され、協力型だけが残りました。ランキングは親が明示的に ON にしない限り表示されません。褒めるときは結果ではなく努力を、という Dweck らの知見は、親向けの応援メッセージの文言設計に入っています。

## 原則を機械で守る

「原則を書いた」だけでは、原則は守られません。がんばりクエストはこの原則を 3 つの層で機械的に検査しています。

1 つ目は LP の語彙です。LP の寸法を測る CI スクリプトが禁止語の一覧を持ち、「ガチャ」「抽選」「コンプリート」のような射幸性を暗示する語や「ゲーミフィケーション全開」のような逆メッセージの語を検出すると CI を落とします[^measure]。本書の原稿もこの語を本文に書けないよう、同じ規則を publishing-hub 側の検査に足しました。

2 つ目は UI の構造です。子供のホーム画面には注意を奪う横長のバナーを置かないという原則がありました。しかし守る手段が人の注意だったため、バナーが 2 度撤去されたあとで 3 つ目が残り、ホーム画面を開くたび全員が常時目にする状態まで悪化しました。対策として、ホーム画面の markup を静的に解析し、禁止リストのコンポーネントが import も mount もされていないことを単体テストで守っています[^banner]。

```ts
// tests/unit/architecture/child-home-no-fullwidth-banner.test.ts
const CHILD_HOME_MARKUP = [
	'src/routes/(child)/[uiMode=uiMode]/home/+page.svelte',
	'src/lib/features/child-home/components/ProdDashboardSections.svelte',
];

const DENYLISTED_BANNER_COMPONENTS = ['ChallengeBanner', 'MustProgressBar', 'MilestoneBanner'];

describe('child home fitness function — 独立横長 banner 残置禁止 (#3333 / ADR-0061)', () => {
	for (const rel of CHILD_HOME_MARKUP) {
		it(`${rel} は denylist の横長 banner を import / mount しない`, () => {
			const source = stripComments(readFileSync(resolve(REPO_ROOT, rel), 'utf-8'));
			for (const comp of DENYLISTED_BANNER_COMPONENTS) {
				// import 文 (`import X from ...`) と element mount (`<X`) の双方を禁止。
				const importRe = new RegExp(`import\\s+${comp}\\s+from`);
				const mountRe = new RegExp(`<${comp}[\\s/>]`);
				// ...
			}
		});
	}
});
```

このテストは、通常のユニットテストとは性格が違います。振る舞いではなく「構造がこうなっている」ことを検査し、原則からの逸脱をプルリクエストの時点で落とします。Neal Ford らが *Building Evolutionary Architecture* で architecture fitness function と呼んだ手法で、本書では品質ゲート編の fitness function の章で体系的に扱います。

3 つ目は端末側の時間です。UI設計書には、子供の画面を 15 分連続で使うと自動でスリープに入る仕組みが記されています[^ui06]。記録して閉じる用途なら 15 分は使いません。開いたまま放置された端末が、遊び場に変わることを防ぐ最後の壁です。

## 「卒業」を成功と呼ぶ

この原則を最後まで突き詰めると、製品の成功の定義が変わります。LP には「卒業」というページがあり、こう書かれています。

> アプリを開かなくなった日 — それは家族の卒業式
> 「使わなくなる」ことががんばりクエストの成功。記録はいつでも書き出してご家族の手元に残せます[^graduation]

解約の理由に「卒業」を選ぶと、専用のページに遷移します。そこでは残ポイントを現金や物品や体験に換算して親に還元する提案をし、ブランドキャラクターが祝福します。同意があれば、実名を禁じたニックネームと卒業メッセージを事例として公開できます[^ui06]。解約画面は通常、引き止めの場です。がんばりクエストではそれを、製品が役目を終えたことを祝う場にしました。

継続率を最大化する設計と、卒業を祝う設計は両立しません。この製品は後者を選び、その選択を ADR、CI の禁止語、単体テストの構造検査、自動スリープという 4 つの層で固定しています。次の章では、この原則の下で年齢ごとに画面をどう変えているかを見ます。

[^adr12]: ADR-0012「Anti-engagement 原則（滞在時間 = 価値毀損）」。コンテキスト、決定 1〜5、6 節の機能別 許容/禁止 UX 細則、rule-preset (penalty) の採用条件を引用。出典: [docs/decisions/0012-anti-engagement-principle.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0012-anti-engagement-principle.md)

[^rationale02]: コアループの設計理由。L1/L2/L3 の 3 層モデルの採用理由と、案 C（ガチャ中心）の棄却理由。出典: [docs/rationale/02-core-loop-rationale.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/rationale/02-core-loop-rationale.md)

[^ui06]: UI設計書。シーズンイベント機構の撤去、応援完了画面に「もう 1 回応援」を置かない判断、特権交換の個数指定、15 分の自動スリープ、卒業フロー専用ページの目的と入力項目。出典: [docs/design/06-UI設計書.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/design/06-UI%E8%A8%AD%E8%A8%88%E6%9B%B8.md)

[^adr11]: ADR-0011「0-2 歳 baby モードは『親の準備モード』」。「現実利用ないゲーミフィケーション UI を残すのはコア哲学 (Anti-engagement / ADR-0012) と矛盾する」という判断。出典: [docs/decisions/0011-baby-mode-as-parent-preparation.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/decisions/0011-baby-mode-as-parent-preparation.md)

[^psych]: 子供の動機づけに関する参考文献一覧。Deci, Koestner & Ryan (1999) のメタ分析、Lepper, Greene & Nisbett (1973)、Butler (1998)、Dweck (2006)、Mueller & Dweck (1998) などの知見を要約している。出典: [docs/reference/child-psychology-ux-research.md](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/docs/reference/child-psychology-ux-research.md)

[^measure]: LP の寸法と語彙を測る CI スクリプト。禁止語の一覧（射幸性語彙・逆メッセージ語彙・個別マネージドサービス名）と、モバイル 15,000px / デスクトップ 8,000px の高さ上限。出典: [scripts/measure-lp-dimensions.mjs](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/scripts/measure-lp-dimensions.mjs)

[^banner]: 子供ホーム画面に独立横長バナーを残置・新設できないことを守る architecture fitness function。背景（2 度撤去されたあとに ChallengeBanner が残り常時表示へ悪化した経緯）と denylist。出典: [tests/unit/architecture/child-home-no-fullwidth-banner.test.ts](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/tests/unit/architecture/child-home-no-fullwidth-banner.test.ts)

[^graduation]: LP の「卒業」ページ。出典: [site/graduation.html](https://github.com/Takenori-Kusaka/ganbari-quest/blob/3af6c2ed9fd4fe5766fc80c255656e940f8ec8f0/site/graduation.html)
