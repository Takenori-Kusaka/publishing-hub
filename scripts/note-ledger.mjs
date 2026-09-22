// note の投稿台帳。どの原稿(platforms/note/public/<id>.md)が、note のどの投稿(URL・キー)に対応するかを記録する。
//
// note には「同じ投稿を更新する」API がなく、publish-note.mjs は毎回エディタで投稿を作ります。
// 台帳がないと、再実行のたびに新しい投稿が増えて重複します。台帳で次を担保します。
//   1. 同一性: 原稿 id → note の投稿(key/URL)の対応を残す。
//   2. 冪等性: 直前に投稿した内容の指紋(fingerprint)と今回の内容が同じなら、投稿しない(スキップ)。
//   3. 更新: 既に投稿がある原稿を再公開するときは、新規作成ではなく既存の投稿の編集に回す(publish-note.mjs)。
//
// 台帳は platforms/note/ledger.json に置き、CI が投稿後に main へ書き戻します(scripts/note-commit-ledger.mjs)。
// 投稿の判断には、作業ツリーの台帳ではなく main の最新の台帳を使います(readMainLedger)。

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** リポジトリの根からの台帳のパス(git の中のパスにも使う) */
export const LEDGER_FILE = 'platforms/note/ledger.json';
export const LEDGER_PATH = path.join(ROOT, LEDGER_FILE);

/**
 * publish-note.mjs が投稿のたびに台帳へ書く項目。書き戻しでは、この項目だけを main の台帳に重ねる(overlayRecord)。
 *   url          : note の公開ページの URL(https://note.com/<user>/n/<key>)。新規の投稿のときに note の公開 API から取る
 *   published_at : 初回の公開日時。新規の投稿のときに note の公開 API の publish_at から取る(取れなければ投稿の時刻)。同じ投稿の更新では変えない
 *   updated_at   : この投稿を最後に投稿・更新した日時
 */
export const RECORD_FIELDS = ['note_key', 'url', 'fingerprint', 'title', 'published_at', 'updated_at'];

/** note の公開 API。<key> を足すと、投稿の data.note_url(公開ページの URL)と data.publish_at(初回の公開日時)と data.status を返す */
export const NOTE_API = 'https://note.com/api/v3/notes/';

/**
 * 投稿の対象になる原稿の status。ready は新規の投稿か、台帳に記録のある投稿の更新になる。
 * published は台帳に記録のある投稿の更新だけになる(decidePublish)。draft と retired は投稿しない。
 */
export const PUBLISHABLE_STATUSES = new Set(['ready', 'published']);

export function isPublishable(status) {
  return PUBLISHABLE_STATUSES.has(status);
}

/** 投稿する内容の指紋(題名 + HTML 本文)。内容が変わったかの判定に使う */
export function fingerprint(title, html) {
  return crypto.createHash('sha256').update(`${title}\n\n${html}`, 'utf8').digest('hex');
}

/**
 * note の URL から投稿の key を取り出す。取れなければ null。次の 2 つの形を受け付ける。
 *   - 公開ページ: https://note.com/<user>/n/<key>
 *   - エディタ: https://editor.note.com/notes/<key>/...(投稿の後のページ .../publish/ や、編集のページ .../edit)
 */
export function noteKeyFromUrl(url) {
  const s = String(url || '');
  const m = /editor\.note\.com\/notes\/([A-Za-z0-9_-]+)/.exec(s) || /note\.com\/[^/]+\/n\/([A-Za-z0-9_-]+)/.exec(s);
  return m ? m[1] : null;
}

/**
 * url が key の投稿の公開ページ(https://<host>/<user>/n/<key>)なら url を、そうでなければ null を返す。
 * エディタの URL と、user の位置が notes のもの(https://note.com/notes/n/<key>。開けない。18c948d が台帳に書いた形)は除く。
 * note の公開 API の note_url を台帳に書く前に、別の投稿の URL や想定外の形を記録しないために確かめる。
 */
export function publicNoteUrl(url, key) {
  if (typeof url !== 'string' || !key) return null;
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.hostname === 'editor.note.com') return null;
  const tail = `/n/${key}`;
  if (!u.pathname.endsWith(tail)) return null;
  const user = u.pathname.slice(0, -tail.length).split('/').pop();
  return user === 'notes' ? null : url;
}

/**
 * note の公開 API(NOTE_API + key)から、投稿の公開ページの URL(data.note_url)と、初回の公開日時(data.publish_at)と、状態(data.status)を取る。
 * getJson(apiUrl) は応答の JSON を返す関数(publish-note.mjs は Playwright のブラウザのコンテキストの request で呼ぶ)。
 * 戻り値は { url, publishedAt, status, reason }。取れなかった項目は null。例外にしない。
 *   url         : 公開ページの URL(publicNoteUrl で確かめる)。取れないとき(通信の失敗、HTTP のエラー、key の違う URL や公開ページでない URL)は null で、reason に理由
 *   publishedAt : data.publish_at を ISO 8601(UTC)にしたもの
 *   status      : data.status(公開済みなら published)
 */
export async function fetchNoteUrl(key, getJson) {
  try {
    const data = (await getJson(`${NOTE_API}${encodeURIComponent(key)}`))?.data;
    const got = data?.note_url;
    const url = publicNoteUrl(got, key);
    const at = typeof data?.publish_at === 'string' ? new Date(data.publish_at) : null;
    const publishedAt = at && !Number.isNaN(at.getTime()) ? at.toISOString() : null;
    const status = typeof data?.status === 'string' ? data.status : null;
    return { url, publishedAt, status, reason: url ? null : `data.note_url が投稿 ${key} の公開ページの URL ではありません(${got ?? 'なし'})` };
  } catch (e) {
    return { url: null, publishedAt: null, status: null, reason: String(e?.message || e).slice(0, 200) };
  }
}

/**
 * fetchNoteUrl の結果から、ログに出す警告(::warning:: に続ける本文)を作る。警告が無ければ空の配列。
 *   - URL を取れない: 台帳の url は空にする。note_key は記録するので、次の実行は同じ投稿の更新になる
 *   - status が published でない: 公開ボタンが効かず、下書きのままのおそれがある。記録は残す(残さないと、次のマージで同じ原稿をもう 1 本作る)
 */
export function noteApiWarnings(key, got) {
  const warnings = [];
  if (!got?.url) {
    warnings.push(`note の公開 API から投稿 ${key} の URL を取れませんでした(${got?.reason ?? '理由不明'})。台帳の url は空のままにします。note_key は記録するので、次の実行は同じ投稿の更新になります。url は ${NOTE_API}${key} の data.note_url で確かめて、台帳に記録してください。`);
  }
  if (got?.status && got.status !== 'published') {
    warnings.push(`note の公開 API で、投稿 ${key} の status が "${got.status}" です(published ではありません)。公開ボタンが効かず、下書きのままかもしれません。台帳には記録します(記録しないと、次のマージで同じ原稿をもう 1 本作るため)。note で投稿の状態を確かめ、公開してください。`);
  }
  return warnings;
}

/**
 * 投稿の後に台帳へ書く、この投稿の記録を作る。
 *   entry           : 投稿の判断に使った main の台帳の記録(decidePublish の entry)。note_key が noteKey と同じときだけ、同じ投稿の更新として扱う
 *   publicUrl       : note の公開 API から取った URL(fetchNoteUrl の url)。取れなければ null
 *   notePublishedAt : note の公開 API から取った初回の公開日時(fetchNoteUrl の publishedAt)。取れなければ null
 *   now             : この投稿の日時(ISO 8601)
 * 同じ投稿の更新: url と published_at は台帳の値を保つ(台帳に無ければ publicUrl と notePublishedAt で補う)。
 * 新規の投稿: url は publicUrl、published_at は notePublishedAt(取れなければ now)。
 * どちらも updated_at は now。url が無ければ url の項目を書かない(エディタの URL から組み立てない)。
 */
export function ledgerRecord({ entry = null, noteKey, fingerprint: fp, title, publicUrl = null, notePublishedAt = null, now }) {
  const same = entry && entry.note_key === noteKey ? entry : null;
  const url = same?.url || publicUrl || null;
  const publishedAt = same ? same.published_at || notePublishedAt || null : notePublishedAt || now;
  return {
    note_key: noteKey,
    ...(url ? { url } : {}),
    fingerprint: fp,
    title,
    ...(publishedAt ? { published_at: publishedAt } : {}),
    updated_at: now,
  };
}

/**
 * 記録(entry)に record を重ねるときの土台。record が別の投稿(note_key が違う)の記録なら、entry から RECORD_FIELDS を除く(人が書いた note などは残す)。
 * 除かないと、record に無い項目(公開 API から取れなかった url など)に、古い投稿の url や published_at が残る。
 */
function overlayBase(entry, record) {
  if (!entry) return {};
  if (!record.note_key || entry.note_key === record.note_key) return entry;
  return Object.fromEntries(Object.entries(entry).filter(([k]) => !RECORD_FIELDS.includes(k)));
}

/**
 * main の台帳の記録(mainEntry)に、この実行の記録(record)を重ねる(note-commit-ledger.mjs の書き戻し)。
 * record の項目で上書きし、record に無い項目(人が書いた note など)は main の値を残す。
 * 同じ投稿(note_key が同じ)なら、main にある url と published_at(初回の公開日時)は変えない。
 * 別の投稿(note_key が違う)なら、main の記録の RECORD_FIELDS は引き継がない(overlayBase)。
 */
export function overlayRecord(mainEntry, record) {
  const merged = { ...overlayBase(mainEntry, record), ...record };
  if (mainEntry && mainEntry.note_key === record.note_key) {
    for (const k of ['url', 'published_at']) {
      if (mainEntry[k]) merged[k] = mainEntry[k];
    }
  }
  return merged;
}

export function readLedger(ledgerPath = LEDGER_PATH) {
  try {
    return fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) : { posts: {} };
  } catch {
    return { posts: {} };
  }
}

/**
 * main の最新の台帳を読む(git fetch のうえで origin/main の platforms/note/ledger.json)。
 * 投稿の判断はこれで行う。待っていた実行の作業ツリー(起動したコミット)の台帳には、先の実行が書き戻した記録が無く、
 * それで判断すると同じ原稿を note にもう 1 本作る。main に台帳が無ければ空の台帳。fetch や読み取りに失敗したら例外。
 */
export function readMainLedger({ cwd = ROOT } = {}) {
  const run = (args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  run(['fetch', '--quiet', 'origin', '+refs/heads/main:refs/remotes/origin/main']);
  const spec = `refs/remotes/origin/main:${LEDGER_FILE}`;
  try {
    run(['cat-file', '-e', spec]);
  } catch {
    return { posts: {} };
  }
  const ledger = JSON.parse(run(['show', spec]));
  return { ...ledger, posts: ledger.posts || {} };
}

export function getEntry(postId, ledgerPath = LEDGER_PATH) {
  return readLedger(ledgerPath).posts?.[postId] || null;
}

/**
 * 台帳の記録に entry を重ねて書く。entry が別の投稿(note_key が違う)の記録なら、今の記録の RECORD_FIELDS は引き継がない(overlayBase)。
 */
export function writeEntry(postId, entry, ledgerPath = LEDGER_PATH) {
  const ledger = readLedger(ledgerPath);
  ledger.posts = ledger.posts || {};
  ledger.posts[postId] = { ...overlayBase(ledger.posts[postId], entry), ...entry };
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  return ledger.posts[postId];
}

/**
 * 再公開の判断。戻り値の action は 'skip' | 'update' | 'create' | 'refuse'。
 *   - 既存の投稿があり、内容の指紋が前回と同じ → skip(重複投稿を防ぐ)
 *   - 既存の投稿があり、内容が変わった → update(既存の note.com の投稿を編集)
 *   - 既存の投稿がなく、原稿の status が published → refuse(投稿しない。published は投稿済みの記録なので、
 *     台帳に無いのは台帳の外で投稿されたもの。新規に作ると note 上で重複する)
 *   - 既存の投稿がない → create(新規に投稿し、台帳に記録)
 * force が真なら skip しない(refuse は force でも変えない)。
 * 判断に使うのは記録の note_key と fingerprint だけ。url や日時が無い記録(公開 API から URL を取れなかった新規の投稿など)も、
 * note_key があれば同じ投稿として扱う。
 * ledger を渡せばそれで判断する(publish-note.mjs は readMainLedger の結果を渡す)。無ければ ledgerPath のファイルを読む。
 */
export function decidePublish(postId, fp, { force = false, ledgerPath = LEDGER_PATH, status = null, ledger = null } = {}) {
  const entry = (ledger ?? readLedger(ledgerPath)).posts?.[postId] || null;
  if (!entry || !entry.note_key) return { action: status === 'published' ? 'refuse' : 'create', entry };
  if (!force && entry.fingerprint === fp) return { action: 'skip', entry };
  return { action: 'update', entry };
}
