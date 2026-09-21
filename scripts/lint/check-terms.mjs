// 用語統一(表記ゆれ)を検査する。
//
//   node scripts/lint/check-terms.mjs [--scope <id>] [--strict] [--fix] [--report out.json] [file ...]
//
// 題材ごとに語彙が違うため、辞書はスコープ(lint/terms/index.yaml)単位で当てます。
//
//   T1: 辞書違反。expected と違う表記(patterns)が本文にある
//   T2: 長音の表記ゆれ自動検出。同一スコープ内に「サーバ」と「サーバー」のように
//       長音の有無だけが違うカタカナ語が併存している
//   T3: 和欧間スペースの表記ゆれ自動検出。「生成AI」と「生成 AI」のように
//       漢字・カタカナ語と英字の間のスペースの有無が併存している
//   T4: 英字語の出自。固有名詞以外の英字語の出現比率が日本語 100 字あたりの閾値を超えたら報告する
//
// T2/T3 は辞書にない語も拾うための警告です(index.yaml の auto_variants で強度を変えられます)。
// 確定した表記は辞書へ rule として書き、以後は T1(エラー)で守ります。
//
// コード・URL・リンク先・frontmatter・HTML は検査前に伏せます。
// --fix は T1 のうち expected が固定文字列の違反だけを置換します(Markdown のみ)。

import fs from 'node:fs';
import { abs, readText, readYaml, listFiles, matchesAny, isLegacyQiita, maskMarkdown, splitFrontmatter, lineOf, restrictTo, Report, parseArgs, finish, isMain } from './lib.mjs';
import { collectSocialTexts } from './run-textlint.mjs';

const INDEX = 'lint/terms/index.yaml';

export function loadScopes(indexPath = INDEX) {
  const index = readYaml(indexPath);
  return (index.scopes || []).map((s) => {
    const dictionaries = (s.dictionaries || []).map((d) => ({ path: d, ...readYaml(d) }));
    const rules = [];
    const allow = new Set();
    let latin_policy = null;
    for (const d of dictionaries) {
      for (const r of d.rules || []) {
        rules.push({
          expected: r.expected,
          reason: r.reason || '',
          dictionary: d.path,
          fix: r.fix !== false, // fix: false の規則は --fix で置換しない(expected が説明文のもの)
          replacement: r.replacement ?? r.expected, // 一致部分の置換文字列(語幹だけに一致する規則は replacement で指定)
          patterns: (r.patterns || []).map((p) => new RegExp(p, 'g')),
        });
      }
      for (const a of d.allow_variants || []) allow.add(a);
      if (d.latin_policy) {
        if (!latin_policy) {
          latin_policy = {
            threshold: d.latin_policy.threshold ?? 1.0,
            allow: new Set(),
            allow_patterns: [],
            severity: d.latin_policy.severity ?? 'warning',
            ignore_table_columns: []
          };
        } else if (d.latin_policy.threshold !== undefined) {
          latin_policy.threshold = d.latin_policy.threshold;
        }
        if (d.latin_policy.severity) latin_policy.severity = d.latin_policy.severity;
        if (d.latin_policy.ignore_table_columns) {
          latin_policy.ignore_table_columns = latin_policy.ignore_table_columns.concat(d.latin_policy.ignore_table_columns);
        }
        if (d.latin_policy.allow) {
          for (const a of d.latin_policy.allow) {
            latin_policy.allow.add(a);
          }
        }
        if (d.latin_policy.allow_patterns) {
          latin_policy.allow_patterns = latin_policy.allow_patterns.concat(d.latin_policy.allow_patterns);
        }
      }
    }
    return { ...s, rules, allow, auto: s.auto_variants || 'off', latin_policy };
  });
}

/** SNS 本文にも URL・インラインコードが混ざるので、Markdown と同じように伏せる */
function maskSocial(text) {
  return maskMarkdown(text, { frontmatter: false, fenced: false, links: true, urls: true, inline: true, html: false });
}

/** 検査対象のテキスト断片。Markdown は本文(マスク済み)と frontmatter の title、YAML は本文フィールド */
export function textUnits(file) {
  if (/\.ya?ml$/.test(file)) {
    const data = readYaml(file);
    const units = collectSocialTexts(data).map((u) => ({ label: u.label, text: maskSocial(u.text), original: u.text, fixable: false, auto: true }));
    for (const [label, val] of [
      ['source.title', data?.source?.title],
      ['audience.primary', data?.audience?.primary],
      ['audience.problem', data?.audience?.problem],
      ['audience.takeaway', data?.audience?.takeaway],
      ['linkedin.article.title', data?.linkedin?.article?.title],
    ]) {
      // audience.* は配信されない内部メタデータなので、辞書(T1)だけ当てて表記ゆれの集計(T2/T3)には入れない
      if (val) units.push({ label, text: maskSocial(String(val)), original: String(val), fixable: false, auto: !label.startsWith('audience.') });
    }
    (data?.bluesky?.posts || []).forEach((p, i) => {
      if (p?.external?.title) units.push({ label: `bluesky.posts[${i}].external.title`, text: maskSocial(String(p.external.title)), original: String(p.external.title), fixable: false, auto: true });
    });
    return units;
  }
  const raw = readText(file);
  const { frontmatter } = splitFrontmatter(raw);
  const units = [{ label: null, text: maskMarkdown(raw), original: raw, fixable: true, auto: true }];
  if (frontmatter?.title) units.push({ label: 'title', text: String(frontmatter.title), original: String(frontmatter.title), fixable: false, auto: true });
  return units;
}

function katakanaTokens(text) {
  const out = [];
  const re = /[ァ-ヴー]{2,}/g;
  let m;
  while ((m = re.exec(text))) out.push({ token: m[0], index: m.index });
  return out;
}

/**
 * 漢字・カタカナ語と英字の隣接(スペースの有無を記録)。
 * キーは英字トークンと日本語側の先頭 2 文字にし、「DLL 同梱」「DLL 同梱不要」を同じゆれとして比べる。
 */
function alnumPairs(text) {
  const out = [];
  const re = /([一-龥ァ-ヶー]+)( ?)([A-Za-z][A-Za-z0-9]*)|([A-Za-z][A-Za-z0-9]*)( ?)([一-龥ァ-ヶー]+)/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[1] !== undefined) {
      const jp = [...m[1]].slice(-2).join('');
      out.push({ key: `${jp}|${m[3]}`, jp: m[1], en: m[3], spaced: m[2] === ' ', form: m[0], index: m.index });
    } else {
      const jp = [...m[6]].slice(0, 2).join('');
      out.push({ key: `${m[4]}|${jp}`, jp: m[6], en: m[4], spaced: m[5] === ' ', form: m[0], index: m.index });
    }
  }
  return out;
}

/** スコープの対象ファイル(リポジトリ相対) */
export function scopeFiles(scope) {
  let files = listFiles(scope.include || [], { exclude: scope.exclude || [] });
  if (scope.skipLegacyQiita) files = files.filter((f) => !isLegacyQiita(f));
  return files;
}

/**
 * 自動検出(T2/T3)をどのスコープで行うか。同じファイルが複数のスコープに属するとき、
 * index.yaml で後ろにある(より具体的な)スコープだけが担当する。二重報告を避けるため。
 */
export function autoOwners(scopes) {
  const owner = new Map();
  for (const s of scopes) {
    if (s.auto === 'off') continue;
    for (const f of scopeFiles(s)) owner.set(f, s.id);
  }
  return owner;
}

/**
 * T4: Markdown の表で、見出しが names に含まれる列のセルを空白で伏せる。
 * 「本書の呼び名」の対応表のように、リポジトリでの英字名を列挙する列を英字語の密度から外すため。
 */
export function maskTableColumns(text, names) {
  if (!names.length) return text;
  const lines = text.split('\n');
  let cols = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!/^\s*\|.*\|\s*$/.test(l)) { cols = null; continue; }
    const cells = l.split('|');
    if (cols === null) {
      cols = cells.map((c, idx) => (names.includes(c.trim()) ? idx : -1)).filter((idx) => idx >= 0);
      continue;
    }
    if (!cols.length) continue;
    for (const idx of cols) if (idx < cells.length) cells[idx] = ' '.repeat(cells[idx].length);
    lines[i] = cells.join('|');
  }
  return lines.join('\n');
}

export function checkScope(scope, { only = [], fix = false, owners = null, strict = false } = {}) {
  const report = new Report(`terms:${scope.id}`);
  let files = scopeFiles(scope);
  if (only.length) {
    const r = restrictTo(files, only);
    files = r.files;
    if (r.note) report.note(`[${scope.id}] ${r.note}`);
  }
  const autoHere = (file) => scope.auto !== 'off' && (!owners || owners.get(file) === scope.id);

  const sev = scope.auto === 'error' ? 'error' : 'warning';
  const t4Sev = strict ? 'error' : (scope.latin_policy?.severity || 'warning');

  // T2/T3 の集計はスコープ全体で行う
  const longVowel = new Map(); // key(長音除去) -> Map(token -> [{file,line}])
  const spacing = new Map(); // key -> { spaced: [...], unspaced: [...] }

  for (const file of files) {
    report.file(file);
    let units;
    try {
      units = textUnits(file);
    } catch (e) {
      report.error(file, 'T0', `読み込みに失敗: ${e.message}`);
      continue;
    }
    let fixed = null;
    for (const u of units) {
      const where = (idx) => (u.label ? `${u.label}` : lineOf(u.text, idx));
      // T1
      for (const rule of scope.rules) {
        for (const re of rule.patterns) {
          re.lastIndex = 0;
          let m;
          while ((m = re.exec(u.text))) {
            if (m[0] === '') {
              re.lastIndex++;
              continue;
            }
            const loc = where(m.index);
            const line = typeof loc === 'number' ? loc : null;
            const label = typeof loc === 'string' ? `(${loc}) ` : '';
            report.error(file, 'T1', `${label}"${m[0]}" は「${rule.expected}」に統一してください(${rule.reason || rule.dictionary})`, line);
            if (fix && u.fixable && rule.fix) {
              fixed = fixed ?? u.original;
              fixed = fixed.slice(0, m.index) + rule.replacement + fixed.slice(m.index + m[0].length);
              // 置換で長さが変わるとオフセットがずれるため、この単位では 1 件ずつ再走査する
              u.text = maskMarkdown(fixed);
              re.lastIndex = m.index + rule.replacement.length;
            }
          }
        }
      }
      if (!autoHere(file) || u.auto === false) continue;
      for (const { token, index } of katakanaTokens(u.text)) {
        if (scope.allow.has(token)) continue;
        // 語末の長音の有無だけを見る(サーバ/サーバー)。語中の差(パス/パース)は別語なので辞書に任せる
        const key = token.replace(/ー+$/, '');
        if ([...key].length < 2 || /ー/.test(key) === false && key === token && !/ー$/.test(token) && false) continue;
        if (!longVowel.has(key)) longVowel.set(key, new Map());
        const byToken = longVowel.get(key);
        if (!byToken.has(token)) byToken.set(token, []);
        byToken.get(token).push({ file, line: u.label ? null : lineOf(u.text, index), label: u.label });
      }
      for (const p of alnumPairs(u.text)) {
        if (p.en.length < 2 || [...p.jp].length < 2) continue; // 「n 個」のような変数・助数詞は見ない
        if (!spacing.has(p.key)) spacing.set(p.key, { spaced: [], unspaced: [] });
        spacing.get(p.key)[p.spaced ? 'spaced' : 'unspaced'].push({ file, line: u.label ? null : lineOf(u.text, p.index), label: u.label, form: p.form });
      }
    }
    if (fixed !== null && fixed !== readText(file)) {
      // 元のファイルが CRLF ならそのまま保つ(readText は LF に正規化して返す)
      const crlf = fs.readFileSync(abs(file), 'utf8').includes('\r\n');
      fs.writeFileSync(abs(file), crlf ? fixed.replace(/\n/g, '\r\n') : fixed, 'utf8');
      report.note(`${file}: --fix で用語を置換しました`);
    }

    // T4 check(scope.latin_include があれば、その glob に合うファイルだけ)
    if (scope.latin_policy && /\.md$/.test(file) && (!scope.latin_include || matchesAny(file, scope.latin_include))) {
      const raw = readText(file);
      let text = maskMarkdown(raw);
      text = text.replace(/\r\n/g, '\n');
      text = text.replace(/^\[\^[^\]]+\]:.*$/gm, '');
      text = text.replace(/\[\^[^\]]+\]/g, '');
      text = text.replace(/^!\[.*$/gm, '');
      text = text.replace(/^> リポジトリ:.*$/gm, '');
      text = maskTableColumns(text, scope.latin_policy.ignore_table_columns || []);
      text = text.replace(/^\|[\s:|-]+\|$/gm, '');

      const allowArr = Array.from(scope.latin_policy.allow);
      const multiWordAllows = allowArr.filter(item => /\s/.test(item));
      const sortedMultiWordAllows = [...multiWordAllows].sort((a, b) => b.length - a.length);

      for (const item of sortedMultiWordAllows) {
        text = text.split(item).join(' '.repeat(item.length));
      }

      const LATIN_WORD_RE = /(?<![A-Za-z0-9_./-])[A-Za-z][A-Za-z0-9_\-]*(?![A-Za-z0-9_./-])/g;
      const matches = text.match(LATIN_WORD_RE) || [];

      const unallowedWords = [];
      const compiledPatterns = (scope.latin_policy.allow_patterns || []).map(p => new RegExp(p));

      for (const word of matches) {
        if (word.length === 1 && /^[a-z]$/.test(word)) {
          continue;
        }
        if (scope.latin_policy.allow.has(word)) {
          continue;
        }
        let isAllowedPattern = false;
        for (const pat of compiledPatterns) {
          if (pat.test(word)) {
            isAllowedPattern = true;
            break;
          }
        }
        if (isAllowedPattern) {
          continue;
        }
        unallowedWords.push(word);
      }

      const jpMatches = text.match(/[぀-ヿ一-鿿]/g) || [];
      const jpCount = jpMatches.length;

      if (jpCount > 0) {
        const threshold = scope.latin_policy.threshold ?? 1.0;
        const density = unallowedWords.length / (jpCount / 100);

        if (density > threshold) {
          const freq = {};
          for (const w of unallowedWords) {
            freq[w] = (freq[w] || 0) + 1;
          }
          const sortedFreq = Object.entries(freq).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
          let wordListStr = sortedFreq.slice(0, 10).map(([w, count]) => `${w} ${count}`).join(', ');
          if (sortedFreq.length > 10) {
            wordListStr += ', … （上位 10 語）';
          }

          const msg = `T4 英字語の出自: 日本語 100 字あたり ${density.toFixed(1)} 語（上限 ${threshold.toFixed(1)}）。` +
            `固有名詞でない英字語 ${unallowedWords.length} 語: ${wordListStr}。` +
            `固有名詞は辞書の latin_policy.allow に、一般語は日本語に、本書の呼び名は初出で宣言してください`;

          report.add(t4Sev, file, 'T4', msg);
        }
      }
    }
  }

  const fmtLoc = (o) => `${o.file}${o.line ? ':' + o.line : o.label ? ' (' + o.label + ')' : ''}`;
  for (const [, byToken] of longVowel) {
    if (byToken.size < 2) continue;
    const variants = [...byToken.entries()].sort((a, b) => b[1].length - a[1].length);
    // 辞書で既に扱っている語は T1 が報告するので重複させない
    if (variants.some(([tok]) => scope.rules.some((r) => r.expected === tok))) continue;
    const [major] = variants[0];
    for (const [tok, occ] of variants.slice(1)) {
      const first = occ[0];
      report.add(sev, first.file, 'T2', `長音の表記ゆれ: "${tok}"(${occ.length}件) と "${major}"(${variants[0][1].length}件) が併存しています。${fmtLoc(first)} ほか。辞書(lint/terms/*.yaml)で統一してください`, first.line);
    }
  }
  for (const [, forms] of spacing) {
    if (!forms.spaced.length || !forms.unspaced.length) continue;
    const sample = forms.spaced[0].form.replace(/ /g, '');
    if ([...scope.allow].some((a) => sample.includes(a.replace(/ /g, '')))) continue;
    if (scope.rules.some((r) => sample.includes(r.expected.replace(/ /g, '')) || r.expected.replace(/ /g, '').includes(sample))) continue;
    const minor = forms.spaced.length <= forms.unspaced.length ? forms.spaced : forms.unspaced;
    const major = minor === forms.spaced ? forms.unspaced : forms.spaced;
    const first = minor[0];
    report.add(sev, first.file, 'T3', `和欧間スペースの表記ゆれ: "${first.form}"(${minor.length}件) と "${major[0].form}"(${major.length}件) が併存しています。${fmtLoc(first)} ほか。辞書で統一してください`, first.line);
  }
  return report;
}

export function checkTerms({ scopes = null, only = [], fix = false, indexPath = INDEX, strict = false } = {}) {
  const total = new Report('terms');
  const all = loadScopes(indexPath);
  const owners = autoOwners(all);
  for (const scope of all) {
    if (scopes && !scopes.includes(scope.id)) continue;
    const r = checkScope(scope, { only, fix, owners, strict });
    console.log(`[${scope.id}] ${scope.title}: ${r.files.size} files, errors ${r.errors.length}, warnings ${r.warnings.length}`);
    total.merge(r);
  }
  return total;
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  const scopes = args.values.has('scope') ? args.values.get('scope').split(',') : null;
  const report = checkTerms({ scopes, only: args.positional, fix: args.flags.has('fix'), strict: args.flags.has('strict') });
  finish(report, args);
}
