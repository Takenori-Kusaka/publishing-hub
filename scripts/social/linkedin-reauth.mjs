// LinkedIn のアクセストークンを取り直し、GitHub の Secret と変数を更新する(docs/linkedin-setup.md 2〜3 章の自動化)。
//
// 使い方:
//   1. LinkedIn の開発者ポータルの [Auth] で Primary Client Secret をコピーし、環境変数 LINKEDIN_CLIENT_SECRET に入れる
//      (Client Secret の保管先は GitHub の Secret LINKEDIN_CLIENT_SECRET。GitHub の Secret は読み出せないので、
//       手元ではポータルからコピーして使う。ファイルには書かない)
//   2. node scripts/social/linkedin-reauth.mjs
//   3. 表示された URL をブラウザで開き、LinkedIn にログインして許可する
// Client ID は、環境変数 LINKEDIN_CLIENT_ID が無ければ GitHub の変数 LINKEDIN_CLIENT_ID から読む。
//
// localhost:8080 で認可コードを受け取り、トークンに交換する。トークンは画面にもファイルにも出さず、
// gh の標準入力へ直接渡して、リポジトリの Secret LINKEDIN_ACCESS_TOKEN を更新する。
// 期限は変数 LINKEDIN_TOKEN_EXPIRES_AT に書く(週次の social-token-check が見る)。
// LinkedIn がリフレッシュトークンを返したときだけ、それも Secret LINKEDIN_REFRESH_TOKEN に入れる
// (自己登録のアプリには通常返らない。返ったかどうかだけを表示する)。

import http from 'node:http';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const REDIRECT = 'http://localhost:8080/callback';
const SCOPE = 'w_member_social';

function readEnv() {
  let clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) {
    const r = spawnSync('gh', ['variable', 'get', 'LINKEDIN_CLIENT_ID'], { encoding: 'utf8', shell: process.platform === 'win32' });
    clientId = r.status === 0 ? r.stdout.trim() : '';
  }
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('❌ LINKEDIN_CLIENT_ID(GitHub の変数か環境変数)と、環境変数 LINKEDIN_CLIENT_SECRET の両方が要ります。');
    process.exit(1);
  }
  return { LINKEDIN_CLIENT_ID: clientId, LINKEDIN_CLIENT_SECRET: clientSecret };
}

function gh(args, input) {
  const r = spawnSync('gh', args, { input, encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`gh ${args.slice(0, 3).join(' ')} が失敗しました: ${r.stderr}`);
}

const toJst = (ms) => new Date(ms + 9 * 3600e3).toISOString().replace(/\.\d{3}Z$/, '+09:00');

const env = readEnv();
const state = crypto.randomBytes(16).toString('hex');
const authUrl =
  'https://www.linkedin.com/oauth/v2/authorization?' +
  new URLSearchParams({ response_type: 'code', client_id: env.LINKEDIN_CLIENT_ID, redirect_uri: REDIRECT, scope: SCOPE, state });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:8080');
  if (url.pathname !== '/callback') { res.writeHead(404).end(); return; }
  const finish = (code, msg) => { res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' }).end(msg); };
  try {
    if (url.searchParams.get('state') !== state) throw new Error('state が一致しません(別の認可の応答です)');
    if (url.searchParams.get('error')) throw new Error(`LinkedIn が拒否しました: ${url.searchParams.get('error_description') || url.searchParams.get('error')}`);
    const code = url.searchParams.get('code');
    const resp = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: env.LINKEDIN_CLIENT_ID, client_secret: env.LINKEDIN_CLIENT_SECRET }),
    });
    const body = await resp.json();
    if (!resp.ok || !body.access_token) throw new Error(`トークンの交換に失敗しました (${resp.status}): ${body.error_description || body.error || ''}`);
    const now = Date.now();
    const expiresAt = toJst(now + body.expires_in * 1000);
    gh(['secret', 'set', 'LINKEDIN_ACCESS_TOKEN'], body.access_token);
    gh(['variable', 'set', 'LINKEDIN_TOKEN_EXPIRES_AT', '--body', expiresAt]);
    console.log(`✅ LINKEDIN_ACCESS_TOKEN を更新しました。期限 ${expiresAt}(LINKEDIN_TOKEN_EXPIRES_AT に記録)`);
    if (body.refresh_token) {
      gh(['secret', 'set', 'LINKEDIN_REFRESH_TOKEN'], body.refresh_token);
      const rExp = body.refresh_token_expires_in ? toJst(now + body.refresh_token_expires_in * 1000) : '不明';
      gh(['variable', 'set', 'LINKEDIN_REFRESH_TOKEN_EXPIRES_AT', '--body', rExp]);
      console.log(`✅ リフレッシュトークンが返りました。LINKEDIN_REFRESH_TOKEN に保存(期限 ${rExp})`);
    } else {
      console.log('ℹ️ リフレッシュトークンは返りませんでした(このアプリでは自動更新できません)。');
    }
    console.log(`ℹ️ 許可したスコープ: ${body.scope || '(応答に無し)'}`);
    finish(200, '更新しました。このタブは閉じてかまいません。');
    server.close();
  } catch (err) {
    console.error(`❌ ${err.message}`);
    finish(500, `失敗しました: ${err.message}`);
    server.close();
    process.exitCode = 1;
  }
});

// localhost が ::1 と 127.0.0.1 のどちらに解決されても受けられるよう、ホストを指定しない
server.listen(8080, () => {
  console.log('localhost:8080 で LinkedIn の応答を待っています。次の URL をブラウザで開いてください:');
  console.log(authUrl);
});
setTimeout(() => { console.error('❌ 10 分以内に応答がありませんでした。'); server.close(); process.exit(1); }, 10 * 60e3).unref();
