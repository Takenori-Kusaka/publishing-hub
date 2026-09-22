import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { readYaml, ROOT } from '../../scripts/lint/lib.mjs';
import { readMainLedger, decidePublish } from '../../scripts/note-ledger.mjs';

// 公開は main からだけ行う(AGENTS.md 1 章)。公開のワークフローは main 以外の起動を最初のジョブで止め、
// SNS は source_sha が main に含まれることを確かめ、note の台帳の書き戻しは main に台帳の変更しか入れない。

const workflow = (name) => readYaml(`.github/workflows/${name}.yml`);
const GITHUB_REF = '$' + '{{ github.ref }}';
const SOURCE_SHA_INPUT = '$' + '{{ github.event.inputs.source_sha }}';
const isRefGuard = (step) => /refs\/heads\/main/.test(step?.run || '') && step?.env?.REF === GITHUB_REF && /exit 1/.test(step.run);
const checkoutIndex = (steps) => steps.findIndex((s) => String(s.uses || '').startsWith('actions/checkout'));
// 公開のジョブは、止める段が失敗したら動かない(if に always() や failure() を入れると、needs の失敗でも動く)
const assertRunsOnlyAfterSuccess = (wf, job) => assert.ok(!/always\(\)|failure\(\)|cancelled\(\)/.test(String(wf.jobs[job].if || '')), `${job} の if は、止める段が失敗したら動かない形にする`);

test('publish-note and publish-qiita refuse to run from a branch other than main before checkout, and the publishing job depends on it', () => {
  for (const [name, gateJob, publishJob] of [['publish-note', 'targets', 'publish-note'], ['publish-qiita', 'check', 'publish']]) {
    const wf = workflow(name);
    assert.deepStrictEqual(wf.on.push.branches, ['main'], `${name}: push は main だけ`);
    const steps = wf.jobs[gateJob].steps;
    assert.ok(isRefGuard(steps[0]), `${name}: ${gateJob} の最初の段が main 以外の起動を止める`);
    assert.strictEqual(wf.jobs[publishJob].needs, gateJob, `${name}: 公開のジョブは ${gateJob} を待つ`);
    assertRunsOnlyAfterSuccess(wf, publishJob);
    assert.strictEqual(wf.concurrency.queue, 'max', `${name}: 待っている実行を取り消さない`);
    assert.strictEqual(wf.concurrency['cancel-in-progress'], false);
  }
});

test('social-publish refuses a branch other than main, a source_sha that is not a full SHA, and one that is not on main', () => {
  const wf = workflow('social-publish');
  const steps = wf.jobs.prepare.steps;
  const guard = steps.findIndex(isRefGuard);
  const checkout = checkoutIndex(steps);
  const format = steps.findIndex((s) => (s.run || '').includes('[[ ! "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]'));
  const onMain = steps.findIndex((s) => (s.run || '').includes('merge-base --is-ancestor "$SOURCE_SHA" refs/remotes/origin/main'));
  assert.ok(guard >= 0 && guard < checkout, 'main 以外の起動を、コミットを取り出す前に止める');
  assert.ok(format >= 0 && format < checkout, 'source_sha が 40 桁の SHA かを、取り出す前に確かめる(ブランチの名前だと、確かめた時と使う時がずれる)');
  assert.strictEqual(steps[format].env.SOURCE_SHA, SOURCE_SHA_INPUT);
  assert.ok(onMain > checkout, 'source_sha が main に含まれることを、取り出した後に確かめる');
  assert.strictEqual(steps[onMain].env.SOURCE_SHA, SOURCE_SHA_INPUT);
  assert.strictEqual(wf.jobs.publish.needs, 'prepare');
  assertRunsOnlyAfterSuccess(wf, 'publish');
});

test('publish-qiita checks the latest main and syncs only when the Qiita content is still what was checked', () => {
  const wf = workflow('publish-qiita');
  const checkSteps = wf.jobs.check.steps;
  assert.strictEqual(checkSteps[checkoutIndex(checkSteps)].with.ref, 'main', '検査は、その時点の最新の main に対して行う');
  assert.ok(wf.jobs.check.outputs.sha, '検査した main のコミットを公開のジョブへ渡す');
  const steps = wf.jobs.publish.steps;
  assert.strictEqual(steps[checkoutIndex(steps)].with.ref, 'main', 'Qiita CLI が id を書き戻す git push のため、ブランチ main を取り出す');
  const same = steps.find((s) => (s.run || '').includes('git diff --quiet "$CHECKED" HEAD -- platforms/qiita'));
  assert.ok(same, '検査した後に platforms/qiita が変わっていないかを確かめる');
  const sync = steps.find((s) => String(s.uses || '').startsWith('increments/qiita-cli/actions/publish'));
  assert.strictEqual(sync.if, `steps.${same.id}.outputs.ok == 'true'`, '変わっていたら同期しない(検査していない内容を同期しない)');
});

// ---- scripts/note-commit-ledger.mjs と台帳の判断を、一時の origin(bare)とクローンで動かす

const LEDGER = 'platforms/note/ledger.json';
const SCRIPT = path.join(ROOT, 'scripts/note-commit-ledger.mjs');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'note-ledger-push-'));
  const run = (cwd, ...args) =>
    execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', '-c', 'core.autocrlf=false', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const origin = path.join(dir, 'origin.git');
  run(dir, 'init', '-q', '--bare', '-b', 'main', origin);
  const clone = (name) => {
    const d = path.join(dir, name);
    run(dir, 'clone', '-q', origin, d);
    return d;
  };
  const write = (cwd, file, text) => {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    fs.writeFileSync(path.join(cwd, file), text, 'utf8');
  };
  const ledger = (posts) => `${JSON.stringify({ posts }, null, 2)}\n`;
  const commitAndPush = (cwd, message) => {
    run(cwd, 'add', '-A');
    run(cwd, 'commit', '-q', '-m', message);
    run(cwd, 'push', '-q', 'origin', 'HEAD:main');
  };
  const seed = clone('seed');
  write(seed, LEDGER, ledger({}));
  write(seed, 'README.md', 'seed\n');
  commitAndPush(seed, 'seed');
  const mainSha = () => run(origin, 'rev-parse', 'main');
  const changedOnMain = (from, to) => run(origin, 'diff', '--name-only', from, to);
  const mainLedger = () => JSON.parse(run(origin, 'show', `main:${LEDGER}`));
  const runScript = (cwd) => spawnSync(process.execPath, [SCRIPT], { cwd, encoding: 'utf8' });
  return { run, clone, write, ledger, commitAndPush, mainSha, changedOnMain, mainLedger, runScript, origin };
}

const ENTRY = { note_key: 'nNEW', url: 'https://note.com/u/n/nNEW', fingerprint: 'f1' };

test('note-commit-ledger on main: puts exactly one ledger commit on top of the current main', () => {
  const s = sandbox();
  const runner = s.clone('runner');
  // 投稿の実行中に、別のマージで main が進んだ
  const other = s.clone('other');
  s.write(other, 'docs.md', 'merged meanwhile\n');
  s.commitAndPush(other, 'meanwhile');
  const before = s.mainSha();

  s.write(runner, LEDGER, s.ledger({ post: ENTRY }));
  const r = s.runScript(runner);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /committed and pushed/);
  const after = s.mainSha();
  assert.strictEqual(s.run(s.origin, 'rev-parse', `${after}~1`), before, '今の main の上に 1 コミットだけ載る');
  assert.strictEqual(s.changedOnMain(before, after), LEDGER, 'main に入るのは台帳の変更だけ');
  assert.strictEqual(s.run(runner, 'status', '--porcelain', '--', LEDGER), `M ${LEDGER}`, '作業ツリーも HEAD も動かさない');
});

test('note-commit-ledger off main: does not push, exits 1 and names the unrecorded post', () => {
  const s = sandbox();
  const runner = s.clone('runner');
  s.run(runner, 'switch', '-q', '-c', 'feature');
  s.write(runner, 'unmerged.md', 'not reviewed\n');
  s.run(runner, 'add', '-A');
  s.run(runner, 'commit', '-q', '-m', 'unmerged work');
  const before = s.mainSha();

  s.write(runner, LEDGER, s.ledger({ post: ENTRY }));
  const r = s.runScript(runner);
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /main の履歴にありません/);
  assert.match(r.stdout, /post: note_key=nNEW/);
  assert.match(r.stdout, /ready なら新しく投稿されて note の上で重複し、published なら投稿せずに止まります/);
  assert.strictEqual(s.mainSha(), before, 'main は変わらない(未マージのコミットも台帳も入らない)');
  assert.strictEqual(s.run(runner, 'log', '-1', '--format=%s'), 'unmerged work', '台帳のコミットも作らない');
});

test("note-commit-ledger: when main's ledger changed meanwhile, the record is added by key and the other record stays", () => {
  const s = sandbox();
  const runner = s.clone('runner');
  const other = s.clone('other');
  const OTHER = { note_key: 'nOTHER', url: 'https://note.com/u/n/nOTHER', fingerprint: 'f0' };
  s.write(other, LEDGER, s.ledger({ other: OTHER }));
  s.commitAndPush(other, 'ledger changed meanwhile');
  const before = s.mainSha();

  s.write(runner, LEDGER, s.ledger({ post: ENTRY }));
  const r = s.runScript(runner);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /committed and pushed/);
  const posts = s.mainLedger().posts;
  assert.deepStrictEqual(posts.other, OTHER, '先に書き戻されたほかの投稿の記録を消さない');
  assert.strictEqual(posts.post.note_key, 'nNEW');
  assert.strictEqual(s.changedOnMain(before, s.mainSha()), LEDGER);
});

test('note-commit-ledger: an update keeps the url and published_at on main and writes updated_at; a new post writes both dates', () => {
  const s = sandbox();
  const runner = s.clone('runner'); // 起動したコミットの台帳には、下の kept の記録が無い
  const other = s.clone('other');
  const KEPT = { note_key: 'nKEPT', url: 'https://note.com/u/n/nKEPT', note: '手で書いた説明', fingerprint: 'f0', title: '題', published_at: '2026-09-13T11:18:59.000Z' };
  const OLD = { note_key: 'nOLD', url: 'https://note.com/u/n/nOLD', note: '古い投稿の説明', fingerprint: 'f0', title: '旧', published_at: '2026-01-01T00:00:00.000Z' };
  s.write(other, LEDGER, s.ledger({ kept: KEPT, replaced: OLD }));
  s.commitAndPush(other, 'ledger on main');

  const now = '2026-09-22T13:02:04.765Z';
  // kept は 18c948d が書いた形(開けない url と、更新の時刻の published_at)。fresh は新規の投稿。
  // replaced は、main の記録と key の違う新しい投稿で、公開 API から url を取れなかったもの
  const staleKept = { note_key: 'nKEPT', url: 'https://note.com/notes/n/nKEPT', fingerprint: 'f1', title: '題', published_at: now, updated_at: now };
  const fresh = { note_key: 'nFRESH', url: 'https://note.com/u/n/nFRESH', fingerprint: 'f2', title: '新', published_at: now, updated_at: now };
  const replaced = { note_key: 'nNEW', fingerprint: 'f3', title: '新', published_at: now, updated_at: now };
  s.write(runner, LEDGER, s.ledger({ kept: staleKept, fresh, replaced }));
  const r = s.runScript(runner);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /committed and pushed/);
  const posts = s.mainLedger().posts;
  assert.deepStrictEqual(posts.kept, { ...KEPT, fingerprint: 'f1', updated_at: now }, '同じ投稿の url と初回の公開日時は main の値を保ち、指紋と updated_at を書く');
  assert.deepStrictEqual(posts.fresh, fresh, '新規の投稿は、url と published_at と updated_at をそのまま書く');
  assert.deepStrictEqual(posts.replaced, { note: OLD.note, ...replaced }, 'key の違う新しい投稿には、main の古い投稿の url と published_at を残さない');
});

test('note-commit-ledger: jobs of the same push writing back at the same time all keep their records', async () => {
  const s = sandbox();
  // kept は main に記録のある投稿。その更新を、新規の投稿の書き戻しと同時に行う
  const KEPT = { note_key: 'nKEPT', url: 'https://note.com/u/n/nKEPT', note: '手で書いた説明', fingerprint: 'f0', title: '題', published_at: '2026-09-13T11:18:59.000Z' };
  const seed = s.clone('seed-kept');
  s.write(seed, LEDGER, s.ledger({ kept: KEPT }));
  s.commitAndPush(seed, 'ledger on main');
  const jobs = ['x', 'y', 'z'].map((id) => {
    const dir = s.clone(`job-${id}`);
    const key = `n${id.toUpperCase()}`;
    s.write(dir, LEDGER, s.ledger({ [id]: { note_key: key, url: `https://note.com/u/n/${key}`, fingerprint: `f${id}` } }));
    return dir;
  });
  // 更新の実行の記録は 18c948d が書いた形(開けない url と、更新の時刻の published_at)
  const now = '2026-09-22T13:02:04.765Z';
  const update = s.clone('job-kept');
  s.write(update, LEDGER, s.ledger({ kept: { note_key: 'nKEPT', url: 'https://note.com/notes/n/nKEPT', fingerprint: 'f1', title: '題', published_at: now, updated_at: now } }));
  jobs.push(update);
  const results = await Promise.all(
    jobs.map(
      (cwd) =>
        new Promise((resolve) => {
          const p = spawn(process.execPath, [SCRIPT], { cwd });
          let out = '';
          p.stdout.on('data', (d) => (out += d));
          p.stderr.on('data', (d) => (out += d));
          p.on('close', (status) => resolve({ status, out }));
        }),
    ),
  );
  for (const r of results) {
    assert.strictEqual(r.status, 0, r.out);
    assert.match(r.out, /committed and pushed/, r.out);
  }
  const posts = s.mainLedger().posts;
  assert.deepStrictEqual(Object.keys(posts).sort(), ['kept', 'x', 'y', 'z'], 'どの記録も main に残る');
  assert.deepStrictEqual(posts.kept, { ...KEPT, fingerprint: 'f1', updated_at: now }, '同じ投稿の url と初回の公開日時は main の値を保ち、指紋と updated_at を書く');
});

test("publish decision: a run started from an older commit decides with main's latest ledger, not its own working tree", () => {
  const s = sandbox();
  const runner = s.clone('runner'); // 待っていた実行: 先の実行が台帳を書き戻す前のコミットを取り出している
  const other = s.clone('other');
  s.write(other, LEDGER, s.ledger({ post: ENTRY })); // 先の実行が post を投稿し、記録を main へ書き戻した
  s.commitAndPush(other, 'ledger written back by the earlier run');

  const stale = decidePublish('post', 'f2', { ledgerPath: path.join(runner, LEDGER), status: 'ready' });
  assert.strictEqual(stale.action, 'create', '作業ツリーの台帳で判断すると、note にもう 1 本作ってしまう');
  const latest = readMainLedger({ cwd: runner });
  const d = decidePublish('post', 'f2', { ledger: latest, status: 'ready' });
  assert.strictEqual(d.action, 'update', 'main の最新の台帳で判断すれば、同じ投稿を書き換える');
  assert.strictEqual(d.entry.note_key, 'nNEW');
  assert.strictEqual(decidePublish('post', ENTRY.fingerprint, { ledger: latest, status: 'ready' }).action, 'skip');
  assert.strictEqual(decidePublish('post', 'f2', { ledger: latest, status: 'published' }).action, 'update');
});

// ---- V6: 未同期(id なし)の公開の Qiita 記事も、正本が未公開なら警告する

test('V6 warns about an unsynced public Qiita article whose Zenn source is unpublished', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'variants-v6-'));
  for (const d of ['scripts', 'lint']) fs.cpSync(path.join(ROOT, d), path.join(dir, d), { recursive: true });
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'), 'junction');
  execFileSync('git', ['init', '-q'], { cwd: dir });
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text, 'utf8');
  };
  write('articles/v6-fixture.md', '---\ntitle: "正本"\nemoji: "📝"\ntype: "tech"\ntopics: ["git"]\npublished: false\n---\n\n## 設計\n\n正本の本文です。\n');
  const qiita = (fm) => `---\ntitle: "Qiita の記事"\ntags:\n  - Git\n${fm}\n---\n\n正本: https://zenn.dev/takenori_kusaka/articles/v6-fixture\n\n別の本文です。\n`;
  const { checkVariants } = await import(pathToFileURL(path.join(dir, 'scripts/lint/check-variants.mjs')).href);
  const v6 = () =>
    checkVariants({ channel: 'qiita' })
      .warnings.filter((w) => w.code === 'V6')
      .map((w) => w.file);

  write('platforms/qiita/public/v6-fixture.md', qiita('private: false\nupdated_at: ""\nid: null'));
  assert.deepStrictEqual(v6(), ['platforms/qiita/public/v6-fixture.md'], '未同期でも private: false なら、最初の同期で公開の状態で作られる');
  write('platforms/qiita/public/v6-fixture.md', qiita('private: true\nupdated_at: ""\nid: null'));
  assert.deepStrictEqual(v6(), [], 'private: true(限定共有)は公開の状態として数えない');
});
