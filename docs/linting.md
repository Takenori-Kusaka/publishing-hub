# 媒体別 linter と検査機構の設計

このリポジトリは、同じテーマから媒体ごとに「非対称な派生物」を切り出して配信します（[publishing-model.md](publishing-model.md)）。Zenn は知識の正本、Qiita は課題解決のレシピ、note は意思決定の物語、SNS は正本への導線です。読者も、求められる粒度も、許される表現も違います。

検査機構はこの非対称を守るために、媒体ごと・題材ごとに別々の規則を持ちます。1本の `.textlintrc` を全ファイルに当てる設計では、Qiita に前置きが長すぎることも、note にコードが紛れ込んだことも、SNS の煽り文句も検出できないからです。

## 1. 全体像

`npm run check`（[scripts/lint/check-all.mjs](../scripts/lint/check-all.mjs)）が 11 の段階を順に実行し、途中で失敗しても最後まで走って全体像を 1 回で見せます。結果は `.tmp/lint/report.md` にまとまり、CI の Step Summary に貼られます。

| 段階 | 何を見るか | 実装 | 規則の置き場 |
| --- | --- | --- | --- |
| `textlint` | 媒体別プロファイルによる校正 | `scripts/lint/run-textlint.mjs` | `lint/textlint/*.json` |
| `books` | 本の章構成と Zenn の制限（100 章、画像、Mermaid 長） | `scripts/check-books.mjs` | スクリプト内 |
| `figures` | Mermaid 図の可読性（TD、ノード 8、ラベル 12 字） | `scripts/check-figures.mjs` | スクリプト内 |
| `japanese` | JIS X 0208 外の漢字、図中の第 2 水準、複数称・組織称 | `scripts/check-japanese.mjs` | スクリプト内 |
| `links` | 章ラベルがリンクになっているか | `scripts/check-links.mjs` | スクリプト内 |
| `terms` | 用語統一（題材別辞書、表記ゆれ自動検出） | `scripts/lint/check-terms.mjs` | `lint/terms/*.yaml` |
| `zenn` | 正本の構造（genre が要求する要素、作品固有の記述規範） | `scripts/lint/check-zenn.mjs` | `lint/policies/zenn.json` |
| `qiita` | Qiita バリアントの構造（レシピの要件、正本への導線） | `scripts/lint/check-qiita.mjs` | `lint/policies/qiita.json` |
| `note` | note バリアントの構造（生コード禁止、物語の要素） | `scripts/lint/check-note.mjs` | `lint/policies/note.json` |
| `variants` | 媒体間の非対称（重複率、節構成、タイトル、導線） | `scripts/lint/check-variants.mjs` | `lint/policies/variants.json` |
| `social` | SNS 原稿のスキーマ・意味検査・編集規則 | `scripts/social/validate.mjs` + `editorial.mjs` | `social/schema/`, `lint/policies/social.json` |

媒体と対象ファイルの対応は [lint/channels.json](../lint/channels.json) にあります。

```text
lint/
├── channels.json        媒体の台帳（対象 glob、プロファイル、ポリシー）
├── textlint/            媒体別の校正プロファイル（zenn / qiita / note / social / docs）
├── policies/            構造ポリシー（zenn / qiita / note / social / variants / expressions）
└── terms/               用語辞書（index.yaml がスコープを定義）
```

エラーと警告を区別します。エラーは `npm run check` を失敗させ、CI を赤にします。警告は判断を人に委ねる助言で、検査は通ります。警告も失敗にしたいときは各スクリプトに `--strict` を渡します。派生物の段階（`qiita`・`note`・`variants`）は、`npm run check` と公開の門で `--strict` を付けて実行し、警告も失敗にします。派生物の警告は正本との照合で直せる指摘であり、人の判断を待たずに解消すべきものだからです（生成AIが警告を「許容範囲」と報告して残した例がありました）。

## 2. 層 1: 校正プロファイル（textlint）

同じ `preset-ja-technical-writing` を土台にしながら、媒体ごとに規則を変えます。

| 規則 | `zenn`（正本） | `qiita`（レシピ） | `note`（物語） | `social`（導線） | `docs` |
| --- | --- | --- | --- | --- | --- |
| 一文の長さ | 150 | 120 | 120 | 100 | 200 |
| 読点（max-ten） | 3 | 3 | 3 | 3 | 4 |
| ですます統一 | 本文 | 本文 | 本文 | 本文 | 見ない |
| 「！」 | 許可 | エラー | エラー | 警告 | 許可 |
| 留保表現（かもしれません） | 許可 | 警告 | 許可 | 許可 | 許可 |
| 学術調の語彙制限（確信・唯一の・罠） | あり | なし | なし | なし | なし |
| 謙譲語（いたします・申し上げます） | エラー | エラー | エラー | エラー | 見ない |
| 漢字連続（固有名詞の許可リスト） | 6（長い許可リスト） | 6 | 6 | 6 | 見ない |

- `zenn` は商業出版の水準と、正本としての客観性を要求します。歴史・社会科学の本では固有名詞の漢字が長く連なるため、許可リストを持ちます。
- `qiita` は短く断定的に書きます。「！」と留保を抑え、レシピとして読める文にします。
- `note` はエッセイなので留保や問いは許しますが、煽りの「！」は抑えます。
- `social` は YAML から本文（`linkedin.text`、`bluesky.posts[].text`、カードの説明）だけを取り出して校正します。
- `docs` は配信対象ではないので最低限です。

エディタ連携用の既定は `.textlintrc.js` で、Zenn プロファイルを指します。CI と `npm run lint` は `lint/channels.json` に従って媒体別に切り替えます。

```bash
npm run lint              # 全媒体
npm run lint:qiita        # 1 媒体だけ
node scripts/lint/run-textlint.mjs --channel zenn books/pit-in-process/summary.md   # 1 ファイルだけ
```

## 3. 層 2: 構造ポリシー

校正は文の形しか見ません。「正本として完全か」「レシピとして使えるか」「物語になっているか」は、媒体ごとの構造ポリシーで見ます。

### 3.1 Zenn（正本）: genre と記述規範

正本の題材はシステムに限らず、広義の技術すべてです。ソフトウェアの設計書に「動くコード」を求める規則を、一次資料に基づく歴史の推論に当てるのは筋違いです。そこで作品（本・記事）ごとに genre を割り当てます（[lint/policies/zenn.json](../lint/policies/zenn.json)）。

| genre | 正本に求める要素 | 例 |
| --- | --- | --- |
| engineering | コードブロック、図、GitHub リポジトリへの導線 | QuickScribe の設計、tech 記事（既定） |
| technical | 図 | ソフトウェア以外の技術（電気・機械・測定など）。`genre_overrides` で割り当てる |
| process | 図 | ピットイン方式 |
| research | 出典のインラインリンク `[ [ n ] ](URL)` | 未来予測の設計図 |
| companion | 本編（Zenn Book）への導線 | 付録 A/B/C |
| essay | なし | idea 記事 |

記事は frontmatter の `type`（tech → engineering、idea → essay）から genre を決め、`genre_overrides` で上書きします。本は `books` に登録します。未登録の本は警告になるので、新しい本を作ったら genre を決めてください。

作品が自ら宣言した記述規範は `conventions` に書きます。『未来予測の設計図』は「はじめに」で 3 つの規範を宣言しており、それを機械化しています。

| id | 規範 | 強度 |
| --- | --- | --- |
| srb-title-format | 章題は「第Ⅰ部A-2　題名」（ローマ数字、全角スペース） | エラー |
| srb-intro-section | 各章は「### 序論：本章が扱う範囲」で始める | エラー |
| srb-interpretation-section | 第Ⅰ部は解釈を「現代社会構造への射程と本質」に隔離する（規範 1） | エラー |
| srb-citation-format | 出典は `[ [ n ] ](URL)` の形で、番号だけの出典は不可（規範 2） | エラー |
| srb-citation-present | 第Ⅰ部・第Ⅱ部の章には出典が 1 つ以上ある（規範 3） | 警告 |
| srb-hierarchy-markers | シナリオ章は【階層n】で確度を示す | エラー |
| srb-summary-section / srb-interpretation-disclaimer | 章末の解釈・位置づけの節と、その冒頭の免責の定型文 | エラー |
| srb-numbered-sections | 本文の節は「### N.」で 1 からの連番 | エラー |
| srb-title-dash / srb-citation-spacing / srb-h4-only-for-figures / srb-no-bullets | 副題の区切り、出典の間隔、#### の用途、箇条書きを使わない | エラー / 警告 |

QuickScribe の本には「冒頭にリポジトリの引用ブロック」「脚注で ADR を示す」「脚注の参照と定義の対応」など、ピットイン方式の本には「末尾のナビリンク」「一人称は本書」などがあります。規範は `must_match` / `must_not_match` の正規表現と `applies_to`（glob）または `applies_to_title`（章題の正規表現）で書くほか、`kind: numbered-headings`（節番号の連番）と `kind: footnotes-resolved`（脚注の参照と定義の対応）を使えます。コードを書かずに増やせます。

正本の描画事故もここで見ます。

| 規則 | 内容 | 強度 |
| --- | --- | --- |
| Z1 | 記事の slug と frontmatter（title 70 字、emoji 1 文字、type、topics 1〜5、published） | エラー |
| Z2 | 画像の絶対パスと実在、Mermaid 2,000 字、段落直後の `---`（直前の段落が見出しに化ける）、言語名のないフェンス | エラー / 警告 |
| Z3 | genre が要求する要素 | エラー |
| Z4 | 作品固有の記述規範 | 規範ごと |
| Z5 | genre が未設定の本 | 警告 |
| Z6 | 付録・記事から本の章への参照。リンク先の章が実在し、ラベル（第Ⅴ部-8 など）が章題と一致する。裸のラベルも実在する | エラー |
| Z7 | 閉じない強調。`**文。 **次` のように閉じ側の前に空白があるとアスタリスクがそのまま表示される | エラー |
| Z10 | 原稿を LF の改行でコミットする（Q14 と同じ） | エラー |
| Z9 | 作業環境のパス（`C:\Users\…`、`/home/…`、作業用ディレクトリ名）を書かない。コードブロックの中も見る | エラー |
| Z8 | 生成AIの利用の開示。記事と本の最初の章に、冒頭の `:::message` と最後の見出し「生成AIの利用について」（ツール名・用途と範囲・人による確認・責任の所在）。宣言と git の共著記録（Co-Authored-By）の突合: 本文を変えたコミットの共著者をモデル名まで書く（開示の枠だけを変えたコミットは数えない）、開示の枠だけを変えた共著者を本文の作成に使ったと書かない、宣言に書いたツールが共著記録にある、直前の版の宣言に書き足したツールには用途と範囲（章・節・見出し・コードのパス）を書き総称（全体の改訂、本稿の各節）は不可、そのコミットで変えた抜粋の出典パスと題名の変更も書く、「」で引いた節の名前は見出しと一致させる（警告）、既存のツールの文の書き換えは警告、人による確認と責任の文はツールの文の後に置く（警告）（[ai-disclosure.md](ai-disclosure.md) 3 章） | エラー / 警告 |

Z6 と Z7 は導入時に実際の事故を見つけました。付録 B の用語集では存在しない章ラベルへの参照を 7 件検出し、見直しで 19 件の参照を修正しました（うち 12 件は番号が 1 つずれたリンクで、検査では捉えられません）。ピットイン方式の本では閉じない強調を 23 段落で検出しました。

### 3.2 Qiita（レシピ）: Q1〜Q17

[lint/policies/qiita.json](../lint/policies/qiita.json)。読者は目の前の課題を解くために来ます。

| 規則 | 内容 | 強度 |
| --- | --- | --- |
| Q1 | 散文（コード・URL を除く）1,500 字以上。上限は設けない（長さではなく内容の同一性を V2・V7 で見る） | エラー |
| Q2 | 技術選定理由・設計・アーキテクチャの見出し（レベル 2 まで） | エラー |
| Q3 | GitHub リポジトリへのリンク | エラー |
| Q4 | 採用技術の公式ドキュメントへの外部リンクが 2 ホスト以上（自分の媒体・GitHub・画像やバッジは数えない） | エラー |
| Q5 | 言語名付きのコードブロック 3 箇所以上（text や出力は数えない）。80 行超の塊は警告（全体は GitHub 参照） | エラー / 警告 |
| Q6 | 冒頭 40 行以内に正本（Zenn）または GitHub への導線 | エラー |
| Q7 | frontmatter（tags 1〜5、private、title 100 字）。title の「！」と煽りは警告 | エラー / 警告 |
| Q8 | 煽り・セールストーク | 警告 |
| Q9 | Zenn 固有の記法（`:::message`、`@[card]`）と `/images/` 相対画像（コードブロック内の例示は除く） | エラー |
| Q10 | 未同期（`id` なし）の記事は `private: true` か `ignorePublish: true`。公開への切り替えは人が行う | エラー |
| Q11 | 生成AIの利用の開示。冒頭の `:::note` と最後の見出し「生成AIの利用について」（Z8 と同じ 4 要素） | エラー |
| Q12 | コードの抜粋は、先頭 3 行のコメントに書いた出典のファイルと逐語で一致する（行末コメントとコメント行も比べ、除くのは省略記号 `// ...` の行だけ）。出典に `@gate` の印がある安全のための分岐は、それより後の処理を載せるなら省かない。続けて並べた 2 行のあいだで出典の行（空行とコメント以外）を飛ばすなら `// ...` を置く（警告）。出典のパスは言語のコメント記号で書く（YAML は `#`。警告）。出典のないコードは警告 | エラー / 警告 |
| Q14 | 原稿を LF の改行でコミットする（git の index を見る。CRLF だと差分が全行の書き換えに見え、人の査読を妨げる）。`.gitattributes` が原稿を LF に正規化するので、通常は自動で満たされる | エラー |
| Q15 | 見出しを 1 段ずつ下げる（h1 の次に h3 を置かない）。タグに媒体名 Qiita を置かない（Q7） | 警告 |
| Q13 | 作業環境のパスを書かない（Z9 と同じ） | エラー |
| Q16 | text のコードブロックにあるディレクトリ構成図（`├──` / `└──`）のパスが git で追跡されている（main にない置き場所を図に書くと読者が再現できない） | 警告 |
| Q17 | 題名かタグに掲げた技術（GitHub Actions など。`qiita.json` の `topic_code`）の設定かコードを、出典のパス付きで 1 つ以上抜粋している。GitHub Actions の抜粋は `run:` か `actions/checkout` 以外の `uses:` の手順を含む | 警告 |
| Q18 | 「測っていません」「主張しません」のような但し書きの定型文を 3 文以上繰り返さない（N13 と同じ趣旨） | 警告 |

Qiita CLI が同期した過去記事（ファイル名が 20 桁 hex）は歴史的な投稿として対象外です。

### 3.3 note（物語）: N1〜N13

[lint/policies/note.json](../lint/policies/note.json)。原稿は `platforms/note/public/<id>.md` に、正本とは別の文章として書きます（[platforms/note/public/README.md](../platforms/note/public/README.md)）。`scripts/build-note.mjs` は正本を自動変換しません。この検査に通った原稿だけをビルドします。

| 規則 | 内容 | 強度 |
| --- | --- | --- |
| N1 | frontmatter（title、status、source、canonical_url）。status は draft / ready / published / retired。tags 5 件超と title 100 字超は警告 | エラー / 警告 |
| N2 | コードブロック、インラインコード、Mermaid を含まない | エラー |
| N3 | 表、脚注、Zenn コンテナ、HTML、h2/h3 以外の見出しを含まない。画像は警告（手動アップロード） | エラー / 警告 |
| N4 | 本文に正本（canonical_url）への導線 | エラー |
| N5 | 1,500〜6,000 字（800 未満・10,000 超はエラー） | 警告 / エラー |
| N6 | 一人称と、意思決定を語る言葉（なぜ・判断・葛藤など） | 警告 |
| N7 | 煽り・セールストーク | 警告 |
| N8 | タイトルが正本と同一でない | エラー |
| N9 | 生成AIの利用の開示。冒頭の引用（`>`）と最後の見出し「生成AIの利用について」（Z8 と同じ 4 要素） | エラー |
| N10 | 作業環境のパスを書かない（Z9 と同じ） | エラー |
| N11 | 実装の語（Environment、ワークフロー、CI、YAML、書記素 など）。note の読者に通じる言葉にする。正本の題名の引用は数えない | 警告 |
| N3b | 単独の `*` / `_` による強調（note 用の HTML に変換されず記号のまま表示される） | エラー |
| N12 | 原稿を LF の改行でコミットする（Q14 と同じ） | エラー |
| N13 | 「測っていません」「主張しません」のような但し書きの定型文を 2 文以上繰り返さない（照合リストの但し書きの語を物語に詰めて規則をかわす書き方を止める） | 警告 |

`publish-note` ワークフローは、push ではそのコミット範囲で `status` が `ready` に変わった原稿だけを投稿し（`scripts/note-targets.mjs`）、手動実行では指定した原稿が `ready` なら投稿します。スクリプト側でも `status` と `publish_after` を確認します。`ready` にできるのは人間だけで、投稿後は `published` に変えます（AGENTS.md）。Environment `note-production` に Required reviewers を置くと投稿直前に承認を挟めます。

### 3.4 SNS（導線）: LinkedIn / Bluesky

[lint/policies/social.json](../lint/policies/social.json)。[social-editorial-guide.md](social-editorial-guide.md) と AGENTS.md 2 章の数値をそのまま機械化し、`npm run social:validate` の結果に合流させます。

| コード | 内容 | 強度 |
| --- | --- | --- |
| LI_LENGTH_* | 600〜1,600 字を推奨（2,400 以上と 3,000 超は `social:validate` の LINKEDIN_TEXT_* が警告・エラー） | 警告 |
| LI_HOOK_ANNOUNCEMENT | 冒頭 140 字に「記事を書きました」型の告知 | エラー |
| LI_HOOK_URL | 冒頭 140 字に URL | 警告 |
| LI_PARAGRAPH_* | 1〜3 文で 1 段落、300 字超で空行がなければエラー | エラー / 警告 |
| LI_BULLETS | 箇条書きは 3〜5 項目 | 警告 |
| LI_URL_COUNT | 本文の URL は 1 つまで | エラー |
| LI_HASHTAG_IN_TEXT / LI_HASHTAGS_MAX | 本文に `#`（hashtags フィールドへ）、hashtags は 3 個まで | エラー |
| LI_STRUCTURE | 段落 3 つ以上と末尾の出口（5 ブロックの近似） | 警告 |
| LI_HYPE / BS_HYPE | 煽り・セールストーク（絶対・革命・100%・行動の強要） | エラー |
| BS_FIRST_POST | 1 投稿目だけで主張が成立する（「スレッドで解説します」だけは不可） | エラー |
| BS_LENGTH_SHORT | 180〜260 grapheme を推奨 | 警告 |
| BS_HASHTAGS | 1 投稿 0〜2 個 | エラー |
| BS_LANGS_JA | 日本語なら `langs: [ja]` | エラー |
| BS_URL_PER_POST | 1 投稿 1 URL | エラー |
| BS_EXTERNAL_MAX | 外部カードは 1 スレッド 1 件 | エラー |
| BS_ONE_POINT | 1 投稿 4 文まで | 警告 |
| SOCIAL_CANONICAL | 有効な媒体ごとに正本への導線 | エラー |
| SOCIAL_UTM_PRESENT | canonical_url に utm_ を書かない（配信時に付与） | エラー |
| SOCIAL_EXCLAMATION / LI_URL_WITH_CARD | 「！」の多用、本文 URL とカードの二重の出口 | 警告 |
| SOCIAL_SOURCE_UNPUBLISHED | ready の原稿が指す正本が `published: false` | 警告 |
| SOCIAL_LOCAL_PATH | 作業環境のパスを書かない | エラー |
| SOCIAL_AI_DISCLOSURE | LinkedIn の本文と Bluesky のスレッドに、生成AIで下書きし人が確認した旨の 1 文。この 1 文は段落数・文数の計算から除く | エラー |

煽り表現の一覧は [lint/policies/expressions.json](../lint/policies/expressions.json) にあり、媒体ごとの強度（SNS はエラー、Qiita / note は警告、Zenn は対象外）もそこで決めます。正本で歴史用語の「産業革命」が引っかからないよう、除外を先読みで書いています。

### 3.5 媒体間の非対称: V1〜V13

[lint/policies/variants.json](../lint/policies/variants.json)。**長さは評価しません。** 派生物が正本と同じ長さでも、粒度や観点が違えば十分に価値があり、長さだけで評価するとかえって「削るために削る」誘因になります。問題は内容が同じことなので、文の同一性（V2）、文字 n-gram の類似（V2b）、節構成の写し（V7）で見ます。どの媒体にも同じ文言で入る生成AIの開示（冒頭の告知と末尾の宣言）は、測る前に取り除きます。

V2 / V2b / V7 は文字列の同一性しか見ないため、言い換えただけの事実の歪み（正本の限界に反する書き方、根拠のない断定、統計の転記）は捉えられません。生成AIの派生物の査読でこれらが見つかったため、V8〜V10 を足しました。V8 は正本の但し書きを照合リストとして登録する方式で、正本自身に当てて 0 件であることをテストで確かめます。テーマの対応づけは、`lint/policies/variants.json` の `sources`、`social/posts/<id>.yaml` の `source.path`、note の frontmatter `source`、Qiita 本文の正本リンク（記事でも本の章でも可）、Qiita の `<id>` と `articles/<id>.md` の一致の順に発見します。

| 規則 | 内容 | 強度 |
| --- | --- | --- |
| V1 | Qiita / note の本文に正本（または GitHub）への導線。note は正本必須 | エラー / 警告 |
| V2 | 派生物の文のうち正本と同一の文の割合。10% で警告、30% でエラー | 警告 / エラー |
| V2b | 文字 8-gram の Jaccard 係数が 0.2 以上（言い換えだけの複製） | 警告 |
| V3 | タイトルが正本と同一 | エラー |
| V5 | 対応する正本が存在する | エラー |
| V6 | 公開状態の派生物（Qiita の `private: false`、note の ready 以降）が指す正本が `published: false` | 警告 |
| V7 | 派生物の見出しの 50% 以上が正本と同じ（節構成の写し。粒度や観点が同じ疑い。はじめに・まとめ等の一般的な見出しは除く。見出し 3 つ以上のとき） | 警告 |
| V8 | 派生物（Qiita / note / SNS）が正本の限界・但し書きと矛盾する記述をしている。テーマごとの照合リスト `lint/claims/<id>.json` と文単位で照合する（コードのコメント行も見る）。但し書きの語（unless）は、矛盾する語句の前後 30 字以内にあるときだけ効く（`unless_next` を持つ項目は直後の文にあっても効く。正本が限界を 2 文で書くため）。forbid ごとに unless を持てる。SNS 原稿は本文と記事カードの題名・説明を照合する。照合の前に漢数字と全角数字を算用数字にそろえ、派生物の title も照合する。`code: true` の項目はコードの行も見る | エラー |
| V9 | 正本にない断定（外部サービスの仕様、他製品との比較、外部製品の性質、検知の回避、完全性）。一致した語句が正本にもあれば数えない | 警告 |
| V10 | 正本の統計（2 桁以上の数と助数詞。漢数字と全角数字もそろえて数える）を Qiita で 5 個、note で 3 個以上そのまま使っている。開発の経緯の数値（コミットや共著の件数、日数）は 1 個でも警告 | 警告 |
| V11 | 正本へのリンクの文字列で正本の題名を引用する（「」を含むか 20 字以上）なら、題名と完全に一致する。派生物（SNS を含む）の「」内の 12 字以上の文字列が、正本の「」の引用か題名と文字 2-gram の Dice 係数 0.6 以上で似ているのに一致しなければ、書き換えた引用とみなす | エラー |
| V12 | リポジトリのファイルを抜粋した節に、その部品について正本が書く限界（照合リストの `required_caveats`）がある | エラー |
| V13 | 削った文や書き換えた文を受けていた接続の語（同じ理由で・そのため・しかし・ただし など）を残さない。原稿の直前の版（コミット前は HEAD、コミット後は原稿を最後に変えたコミットの親）と比べ、接続の語で始まる文が変わらないのに直前の文が変わっていれば報告する。git の履歴がなければ省く | エラー |

### 3.6 生成AIの利用の開示

原稿は生成AIが作成・改訂するため、読者にその事実を示します。文言と置き場所は、学術出版・報道機関・EU AI Act などの一次資料に倣って決めました（[ai-disclosure.md](ai-disclosure.md)）。規則は [lint/policies/disclosure.json](../lint/policies/disclosure.json)、実装は `scripts/lint/disclosure.mjs` にあり、Z8・Q11・N9・SOCIAL_AI_DISCLOSURE として各チェッカーから呼ばれます。検査が見るのは「書いてあるか」「どこにあるか」と、宣言と共著記録の突合、書き足したツールの範囲の書き方です。書かれたツール名や用途が事実どおりかは人が確認します。

## 4. 層 3: 用語統一（terms）

[lint/terms/index.yaml](../lint/terms/index.yaml) がスコープを定義します。題材ごとに語彙が違うので、辞書を「全媒体共通」「ソフトウェア工学」「作品別」に分け、include / exclude で当てる範囲を限定します。

| 検査 | 内容 | 強度 |
| --- | --- | --- |
| T1 | 辞書違反。expected と違う表記（patterns）が本文にある | エラー |
| T2 | 同一スコープ内に`サーバ` と `サーバー` のように語末の長音の有無だけが違う語が併存 | スコープの設定 |
| T3 | 「生成AI」と「生成 AI」のように和欧間スペースの有無が併存 | スコープの設定 |

T2 / T3 は辞書にない語を拾うための自動検出です。確定した表記は辞書へ `rules` として書き、以後は T1 で守ります。同じファイルが複数のスコープに属するときは、index.yaml で後ろにある（より具体的な）スコープだけが自動検出を担当します。

辞書の書式は [lint/terms/common.yaml](../lint/terms/common.yaml) の冒頭にあります。パターンは誤った表記だけに一致させ、正しい表記そのものには一致させません（テストが検証します）。コード・URL・リンク先・frontmatter・HTML は検査前に伏せられます。SNS 原稿は本文フィールドとタイトル、対象読者の記述を見ます。

```bash
npm run check:terms                                  # 全スコープ
node scripts/lint/check-terms.mjs --scope common     # 1 スコープ
node scripts/lint/check-terms.mjs --fix              # T1 を置換（Markdown のみ）
```

## 5. 運用

### コマンド

```bash
npm run check          # 11 段階すべて。レポートは .tmp/lint/report.md（--only terms,zenn で段階を絞れる）
npm test               # SNS とlinter のユニットテスト
npm run lint           # 校正だけ（lint:zenn / lint:qiita / lint:note / lint:social / lint:docs）
npm run check:terms    # 用語統一
npm run check:zenn     # 正本の構造
npm run check:qiita    # Qiita バリアント
npm run check:note     # note バリアント
npm run check:variants # 媒体間の非対称
npm run social:validate
```

各スクリプトは `--report out.json` で JSON を書き、`--strict` で警告も失敗にします。

### CI

| ワークフロー | 契機 | 検査 |
| --- | --- | --- |
| `validate` | push / PR | `npm run check` と `npm test`。レポートを Step Summary と Artifact に出す |
| `social-check` | PR（social / lint / scripts 配下） | social:validate、lint:social、check:variants、ユニットテスト、墨消しプレビュー |
| `publish-qiita` | main の platforms/qiita 変更 | 同期の前に `lint:qiita`、`check:qiita`（Q10 の公開ゲートを含む）、`check-variants --channel qiita`、`check-japanese --qiita` を gate として通す（Qiita 以外の問題では止まらない） |
| `stage-note` | main の platforms/note/public 変更 | check:note と lint:note を通してから全原稿のパッケージを生成し、manifest を Summary に出す |
| `publish-note` | main の platforms/note/public 変更 / 手動 | status が ready に変わった原稿だけを対象に、check:note と lint:note → ビルド → status と publish_after の gate → 投稿（Environment `note-production`） |

Zenn の同期は GitHub 連携が直接行うため、validate の失敗は Zenn へのデプロイを止めません。Qiita と note は gate です。

### 人の確認（H1）

原稿の告知と宣言は「筆者が内容を確認・修正したうえで公開しています」と書きます。この文を事実にするため、publish-qiita・publish-note・social-publish は公開の直前に `scripts/lint/check-human-review.mjs` を実行します。公開原稿の本文を最後に変更したコミット（bot と frontmatter だけの変更を除く）と同じか新しいコミットに、人の `Reviewed-by` トレーラー（原稿を変更するか `Reviewed-path` で原稿を指す）がなければ、Qiita への同期、note と SNS への投稿を止めます。作者は問いません。共著記録を付けずに生成AIが改訂したコミットも通さないためです。`npm run check` には含めません（人の確認は公開の直前に要るものだからです）。

`npm run check` はまとめに「検査した状態」（HEAD、index の tree、未コミットの変更の件数）を出し、`.tmp/lint/state.json` にも書きます。エージェントの完了報告にこの行を貼らせると、報告のあとに状態が変わっていないかを人が突き合わせられます。

```bash
git commit --allow-empty -m "review: Qiita 版を確認" \
  --trailer "Reviewed-by: 名前 <メール>" \
  --trailer "Reviewed-path: platforms/qiita/public/<id>.md"
```

### 新しいものを追加したとき

- **本を追加した**: `lint/policies/zenn.json` の `books` に genre を登録する。作品が記述規範を宣言するなら `conventions` に書く。固有の造語は `lint/terms/<book>.yaml` を作り、`index.yaml` にスコープを足す。長い固有名詞は `lint/textlint/zenn.json` の漢字連続の許可リストへ。
- **記事を追加した**: `type` で genre が決まる。付録なら `genre_overrides`。
- **Qiita 派生物を追加した**: `platforms/qiita/public/<id>.md`。`<id>` を正本 `articles/<id>.md` か SNS 原稿の id に揃えると variants が対応づける。
- **note 派生物を追加した**: `platforms/note/public/<id>.md` に frontmatter（source、canonical_url、status: draft）を書く。
- **SNS 原稿を追加した**: `status: draft` で作り、`npm run social:validate` を通す。
- **表記を決めた**: 該当スコープの辞書に `rules` を足す。T2 / T3 の警告が消える。

### 例外

- `.textlintignore`: `articles/srb-appendix-bibliography.md`（外国語の書誌が並ぶため校正から除外。用語統一と Zenn 構造の検査は受ける）
- Qiita CLI が同期した過去記事（20 桁 hex）: 歴史的な投稿として校正・構造・用語の検査から除外
- `platforms/note/public/README.md`、`articles/README.md`: 説明用の占位

## 6. 既知の限界

- 「物語になっているか」「1 投稿目だけで主張が成立するか」は語彙と構造の近似です。最終判断は人がします。
- 重複率は文単位の同一性です。段落を丸ごと言い換えた複製は 8-gram の警告でしか捉えられません。
- 自動検出（T2 / T3）は同一スコープ内の併存しか見ません。スコープをまたぐ不統一は共通辞書で扱います。
- textlint の `preset-ja-technical-writing` は形態素解析に依存するため、固有名詞の切り方によっては誤検出が起きます。その場合は辞書ではなくプロファイルの `allow` に足します。
- 照合リスト（`lint/claims/<id>.json`、V8）は、そのテーマ専用の防御です。禁止パターンの多くは、評価で生成AIが実際に使った言い回しを写したもので、別の言い回しでかわされ得ます。ほかのテーマには効かないため、テーマごとに正本の限界を登録します。
- テーマに依らず効くのは、正本の文と照合しない構造の規則です。引用の書き換え（V11）、削った文を受ける接続の語（V13）、但し書きの繰り返し（N13）、コードの逐語・安全の分岐・省略記号・コメント記号（Q12）、構成図のパス（Q16）、題名の技術の抜粋（Q17）、宣言と共著記録の突合（Z8 / Q11 / N9）、人の確認（H1）がこれにあたります。
- 生成AIが作った派生物の合格は、検査だけでは決まりません。2026-09-13 の評価では、次の基準を先に決めて判定しました。厳格モードの検査がエラー 0・警告 0 であること。敵対的な査読で、正本の限界と矛盾する事実、開示の誤り、逐語でないコードが 0 件であること。読者にとっての価値、体験談の真偽、選定理由の中身は機械で判定できないため、公開前の人の確認（H1）に任せます。
