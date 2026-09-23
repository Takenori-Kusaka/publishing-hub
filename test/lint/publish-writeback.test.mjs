import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { ROOT } from '../../scripts/lint/lib.mjs';

// 公開の結果の書き戻し(Qiita の id と、SNS の台帳)を、一時の origin(bare)とクローンで動かす。
// どちらも scripts/git-writeback.mjs を使い、最新の上に載せ直して push し、拒まれたらやり直す。

// クローンに持ち込んだ実装を動かす(台帳のパスはスクリプトの位置から決まるので、本物の作業ツリーを書かない)
const QIITA_SYNC = 'scripts/qiita-commit-sync.mjs';
const SOCIAL_RESTORE = 'scripts/social-restore-ledger.mjs';
const SOCIAL_COMMIT = 'scripts/social-commit-ledger.mjs';
const ARTICLE = 'platforms/qiita/public/sample.md';

/** 台帳の 1 行(実際の記録と同じ形) */
const record = (platform, postId, status, sha = 'a'.repeat(40)) =>
  JSON.stringify({ schema_version: 1, platform, key: `${platform}:${postId}:${sha}`, post_id: postId, source_sha: sha, status, timestamp: `2026-09-2${status.length % 9}T00:00:00.000Z` });

function sandbox({ branch = 'main' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-writeback-'));
  const run = (cwd, ...args) =>
    execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', '-c', 'core.autocrlf=false', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const origin = path.join(dir, 'origin.git');
  run(dir, 'init', '-q', '--bare', '-b', branch, origin);
  const clone = (name) => {
    const d = path.join(dir, name);
    run(dir, 'clone', '-q', origin, d);
    // 台帳のパスは scripts/ の位置から決まるので、実装をクローンの中に持ち込む。
    // git には見せない(この複製をコミットしない)
    fs.cpSync(path.join(ROOT, 'scripts'), path.join(d, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(d, '.git/info/exclude'), 'scripts/\n', 'utf8');
    return d;
  };
  const write = (cwd, file, text) => {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    fs.writeFileSync(path.join(cwd, file), text, 'utf8');
  };
  const commitAndPush = (cwd, message) => {
    run(cwd, 'add', '-A');
    run(cwd, 'commit', '-q', '-m', message);
    run(cwd, 'push', '-q', 'origin', `HEAD:${branch}`);
  };
  const seed = clone('seed');
  write(seed, ARTICLE, '---\ntitle: "見本"\nid: null\nupdated_at: ""\n---\n\n本文\n');
  write(seed, 'README.md', 'seed\n');
  commitAndPush(seed, 'seed');
  const sha = () => run(origin, 'rev-parse', branch);
  const show = (file, ref = branch) => run(origin, 'show', `${ref}:${file}`);
  const changedOnOrigin = (from, to) => run(origin, 'diff', '--name-only', from, to).split('\n').filter(Boolean);
  const script = (cwd, file) => spawnSync(process.execPath, [path.join(cwd, file)], { cwd, encoding: 'utf8' });
  return { dir, run, clone, write, commitAndPush, sha, show, changedOnOrigin, script, origin };
}

const SYNCED = '---\ntitle: "見本"\nid: "abc123"\nupdated_at: "2026-09-23T00:00:00+09:00"\n---\n\n本文\n';

// ---- A: Qiita の id の書き戻し

test('qiita-commit-sync: puts the synced ids on top of the main that moved meanwhile, and leaves the working tree alone', () => {
  const s = sandbox();
  const runner = s.clone('runner');
  // 同期のあいだに、別のマージ(note の台帳の書き戻しなど)で main が進んだ
  const other = s.clone('other');
  s.write(other, 'docs.md', 'merged meanwhile\n');
  s.commitAndPush(other, 'meanwhile');
  const before = s.sha();

  s.write(runner, ARTICLE, SYNCED); // Qiita CLI が id と updated_at を書いた
  const r = s.script(runner, QIITA_SYNC);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /書き戻しました/);
  const after = s.sha();
  assert.strictEqual(s.run(s.origin, 'rev-parse', `${after}~1`), before, '今の main の上に 1 コミットだけ載る');
  assert.deepStrictEqual(s.changedOnOrigin(before, after), [ARTICLE], 'main に入るのは Qiita の記事の変更だけ');
  assert.match(s.show(ARTICLE), /id: "abc123"/);
  assert.strictEqual(s.run(runner, 'status', '--porcelain', '--', ARTICLE), `M ${ARTICLE}`, '作業ツリーも HEAD も動かさない');
  assert.strictEqual(s.run(runner, 'log', '-1', '--format=%s'), 'seed', 'HEAD は動かさない');
});

test('qiita-commit-sync: when the push is rejected, it fetches again and both runs keep their ids', async () => {
  const s = sandbox();
  const jobs = ['x', 'y', 'z'].map((name) => {
    const dir = s.clone(`job-${name}`);
    s.write(dir, `platforms/qiita/public/${name}.md`, `---\ntitle: "${name}"\nid: "id-${name}"\nupdated_at: ""\n---\n\n本文\n`);
    return dir;
  });
  const results = await Promise.all(
    jobs.map(
      (cwd) =>
        new Promise((resolve) => {
          const p = spawn(process.execPath, [path.join(cwd, QIITA_SYNC)], { cwd });
          let out = '';
          p.stdout.on('data', (d) => (out += d));
          p.stderr.on('data', (d) => (out += d));
          p.on('close', (status) => resolve({ status, out }));
        }),
    ),
  );
  for (const r of results) {
    assert.strictEqual(r.status, 0, r.out);
    assert.match(r.out, /書き戻しました/, r.out);
  }
  assert.ok(
    results.some((r) => /載せ直します/.test(r.out)),
    `push が拒まれてやり直した実行が 1 つ以上ある: ${results.map((r) => r.out).join('\n')}`,
  );
  for (const name of ['x', 'y', 'z']) assert.match(s.show(`platforms/qiita/public/${name}.md`), new RegExp(`id: "id-${name}"`), `${name} の id が main に残る`);
});

test('qiita-commit-sync: the copies Qiita CLI writes under public/.remote do not reach main', () => {
  const s = sandbox();
  const runner = s.clone('runner');
  const before = s.sha();
  s.write(runner, ARTICLE, SYNCED); // Qiita CLI が id と updated_at を書いた
  // 同じ同期で、Qiita 上の記事の写しが public/.remote に書かれる(@qiita/qiita-cli の FileSystemRepo)
  s.write(runner, 'platforms/qiita/public/.remote/abc123.md', SYNCED);

  const r = s.script(runner, QIITA_SYNC);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.deepStrictEqual(s.changedOnOrigin(before, s.sha()), [ARTICLE], 'main に入るのは記事だけで、リモートの写しは入らない');
  assert.strictEqual(s.run(runner, 'status', '--porcelain', '--untracked-files=all', '--', 'platforms/qiita/public/.remote'), '?? platforms/qiita/public/.remote/abc123.md', '写しは作業ツリーに残したまま(消しも足しもしない)');
});

test('qiita-commit-sync: refuses when the working tree has changes outside platforms/qiita', () => {
  const s = sandbox();
  const runner = s.clone('runner');
  const before = s.sha();
  s.write(runner, ARTICLE, SYNCED);
  s.write(runner, 'README.md', 'someone changed this too\n');

  const r = s.script(runner, QIITA_SYNC);
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /の外に変更があります/);
  assert.match(r.stdout, /README\.md/);
  assert.match(r.stdout, /id="abc123"/, '書き戻せなかった id をログに出す');
  assert.strictEqual(s.sha(), before, 'main は変わらない');
});

test('qiita-commit-sync: off main it does not push, exits 1 and names the ids that were lost', () => {
  const s = sandbox();
  const runner = s.clone('runner');
  s.run(runner, 'switch', '-q', '-c', 'feature');
  s.write(runner, 'unmerged.md', 'not merged\n');
  s.run(runner, 'add', '-A');
  s.run(runner, 'commit', '-q', '-m', 'unmerged work');
  const before = s.sha();

  s.write(runner, ARTICLE, SYNCED);
  const r = s.script(runner, QIITA_SYNC);
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /main の履歴にありません/);
  assert.match(r.stdout, /id="abc123"/);
  assert.match(r.stdout, /もう一度 Qiita に作ります/);
  assert.strictEqual(s.sha(), before, 'main は変わらない(未マージのコミットも記事も入らない)');
});

test('qiita-commit-sync: nothing to write back is not a failure', () => {
  const s = sandbox();
  const runner = s.clone('runner');
  const before = s.sha();
  const r = s.script(runner, QIITA_SYNC);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /書き戻す変更はありません/);
  assert.strictEqual(s.sha(), before);
});

// ---- B: SNS の台帳の復元と追記

/** social-ledger のブランチを作り、与えた内容のコミットを順に積む */
function seedLedgerBranch(s, generations) {
  const dir = s.clone('ledger-seed');
  s.run(dir, 'switch', '-q', '--orphan', 'social-ledger');
  try {
    s.run(dir, 'rm', '-rqf', '--cached', '.');
  } catch {
    // git の版によっては --orphan で index が空になる
  }
  for (const f of fs.readdirSync(dir)) if (f !== '.git') fs.rmSync(path.join(dir, f), { recursive: true, force: true });
  for (const [i, gen] of generations.entries()) {
    for (const [platform, lines] of Object.entries(gen)) s.write(dir, `ledger/${platform}.jsonl`, lines.length ? `${lines.join('\n')}\n` : '');
    s.run(dir, 'add', '-A');
    s.run(dir, 'commit', '-q', '-m', `ledger ${i}`);
  }
  s.run(dir, 'push', '-q', 'origin', 'social-ledger');
  return dir;
}

const LN_OLD = record('linkedin', 'old-post', 'published');
const BS_OLD = record('bluesky', 'old-post', 'published');
const BS_LAST = record('bluesky', 'last-post', 'published');

test('social-restore-ledger: restores the lines that an earlier overwrite dropped from the branch tip', () => {
  const s = sandbox();
  // 1 世代目に old-post、2 世代目は「その実行の分だけ」で置き換えられ、old-post が消えている
  seedLedgerBranch(s, [
    { linkedin: [LN_OLD], bluesky: [BS_OLD] },
    { linkedin: [LN_OLD], bluesky: [BS_LAST] },
  ]);
  const runner = s.clone('runner');
  const r = s.script(runner, SOCIAL_RESTORE);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  const bluesky = fs.readFileSync(path.join(runner, 'social/ledger/bluesky.jsonl'), 'utf8').split('\n').filter(Boolean);
  assert.deepStrictEqual(bluesky, [BS_OLD, BS_LAST], '置き換えで消えた行も履歴から戻す(古い順)');
  assert.deepStrictEqual(fs.readFileSync(path.join(runner, 'social/ledger/linkedin.jsonl'), 'utf8').split('\n').filter(Boolean), [LN_OLD]);
});

test('social-restore-ledger: no ledger branch yet is not a failure', () => {
  const s = sandbox();
  const runner = s.clone('runner');
  const r = s.script(runner, SOCIAL_RESTORE);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /空の台帳から始めます/);
  assert.ok(!fs.existsSync(path.join(runner, 'social/ledger/bluesky.jsonl')));
});

test('social-commit-ledger: appends this run to the branch, keeps the earlier records and touches only ledger/', () => {
  const s = sandbox();
  seedLedgerBranch(s, [
    { linkedin: [LN_OLD], bluesky: [BS_OLD] },
    { linkedin: [LN_OLD], bluesky: [BS_LAST] },
  ]);
  const before = s.run(s.origin, 'rev-parse', 'social-ledger');
  const runner = s.clone('runner');
  // 投稿のジョブ: 復元してから投稿し、記録が 1 行増えた台帳を持ち出す
  assert.strictEqual(s.script(runner, SOCIAL_RESTORE).status, 0);
  const NEW = record('bluesky', 'new-post', 'published');
  fs.appendFileSync(path.join(runner, 'social/ledger/bluesky.jsonl'), `${NEW}\n`, 'utf8');

  const r = s.script(runner, SOCIAL_COMMIT);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /追記しました/);
  const after = s.run(s.origin, 'rev-parse', 'social-ledger');
  assert.deepStrictEqual(s.changedOnOrigin(before, after), ['ledger/bluesky.jsonl'], 'ledger/ の外は変えない');
  assert.deepStrictEqual(s.show('ledger/bluesky.jsonl', 'social-ledger').split('\n').filter(Boolean), [BS_OLD, BS_LAST, NEW], '消えていた行も戻り、この実行の記録が足される');
  assert.strictEqual(s.sha(), s.run(s.origin, 'rev-parse', 'main'), 'main には触らない');
});

test('social-commit-ledger: creates the branch when it does not exist yet, and is a no-op the second time', () => {
  const s = sandbox();
  const runner = s.clone('runner');
  const NEW = record('linkedin', 'first-post', 'published');
  fs.mkdirSync(path.join(runner, 'social/ledger'), { recursive: true });
  fs.writeFileSync(path.join(runner, 'social/ledger/linkedin.jsonl'), `${NEW}\n`, 'utf8');

  assert.strictEqual(s.script(runner, SOCIAL_COMMIT).status, 0);
  assert.deepStrictEqual(s.show('ledger/linkedin.jsonl', 'social-ledger').split('\n').filter(Boolean), [NEW]);
  const created = s.run(s.origin, 'rev-parse', 'social-ledger');

  const again = s.script(runner, SOCIAL_COMMIT);
  assert.strictEqual(again.status, 0, again.stdout + again.stderr);
  assert.match(again.stdout, /すでにこの実行の記録が入っています/);
  assert.strictEqual(s.run(s.origin, 'rev-parse', 'social-ledger'), created, '同じ記録でコミットを増やさない');
});

test('social-commit-ledger: when the branch moved meanwhile, both runs keep their records', async () => {
  const s = sandbox();
  seedLedgerBranch(s, [{ linkedin: [LN_OLD], bluesky: [BS_OLD] }]);
  const runs = ['p', 'q'].map((name) => {
    const dir = s.clone(`run-${name}`);
    assert.strictEqual(s.script(dir, SOCIAL_RESTORE).status, 0);
    const line = record('bluesky', `post-${name}`, 'published');
    fs.appendFileSync(path.join(dir, 'social/ledger/bluesky.jsonl'), `${line}\n`, 'utf8');
    return { dir, line };
  });
  const results = await Promise.all(
    runs.map(
      ({ dir }) =>
        new Promise((resolve) => {
          const p = spawn(process.execPath, [path.join(dir, SOCIAL_COMMIT)], { cwd: dir });
          let out = '';
          p.stdout.on('data', (d) => (out += d));
          p.stderr.on('data', (d) => (out += d));
          p.on('close', (status) => resolve({ status, out }));
        }),
    ),
  );
  for (const r of results) assert.strictEqual(r.status, 0, r.out);
  const lines = s.show('ledger/bluesky.jsonl', 'social-ledger').split('\n').filter(Boolean);
  for (const { line } of runs) assert.ok(lines.includes(line), `どちらの記録も残る: ${lines.join(' | ')}`);
  assert.ok(lines.includes(BS_OLD), '前からある記録も残る');
});

test('social-commit-ledger: when it cannot push, it names the records that were lost and fails the job', () => {
  const s = sandbox();
  const runner = s.clone('runner');
  const NEW = record('bluesky', 'lost-post', 'published');
  fs.mkdirSync(path.join(runner, 'social/ledger'), { recursive: true });
  fs.writeFileSync(path.join(runner, 'social/ledger/bluesky.jsonl'), `${NEW}\n`, 'utf8');
  s.run(runner, 'remote', 'set-url', 'origin', path.join(s.dir, 'missing.git'));

  const r = s.script(runner, SOCIAL_COMMIT);
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /台帳を追記できませんでした/);
  assert.match(r.stdout, /lost-post status=published/);
  assert.match(r.stdout, /もう一度投稿します/);
});
