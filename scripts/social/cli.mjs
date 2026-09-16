import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPostFile, listPostFiles } from './load.mjs';
import { validatePost } from './validate.mjs';
import { renderPost, writeRedactedPreview } from './render.mjs';
import { getPostPublishStatus, appendLedger, resolveLedgerManually } from './ledger.mjs';
import { publishToLinkedIn } from './publish-linkedin.mjs';
import { publishToBluesky } from './publish-bluesky.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

/**
 * Resolves a post ID to its file path, searching in posts, fixtures, or invalid fixtures.
 */
function findPostPath(id) {
  const postsPath = path.join(ROOT, 'social/posts', `${id}.yaml`);
  if (fs.existsSync(postsPath)) return postsPath;
  const fixturesPath = path.join(ROOT, 'social/fixtures', `${id}.yaml`);
  if (fs.existsSync(fixturesPath)) return fixturesPath;
  const invalidFixturesPath = path.join(ROOT, 'social/fixtures/invalid', `${id}.yaml`);
  if (fs.existsSync(invalidFixturesPath)) return invalidFixturesPath;
  return postsPath; // fallback
}

/**
 * Parsed CLI Arguments.
 */
function parseArgs(args) {
  const params = {
    command: args[0],
    id: null,
    platform: null,
    sourceSha: null,
    output: null,
    dryRun: false,
    reason: null,
    remoteId: null,
    operator: null
  };

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--id') params.id = args[++i];
    else if (args[i] === '--platform') params.platform = args[++i];
    else if (args[i] === '--source-sha') params.sourceSha = args[++i];
    else if (args[i] === '--output' || args[i] === '-o') params.output = args[++i];
    else if (args[i] === '--dry-run') params.dryRun = true;
    else if (args[i] === '--reason') params.reason = args[++i];
    else if (args[i] === '--remote-id') params.remoteId = args[++i];
    else if (args[i] === '--operator') params.operator = args[++i];
  }

  return params;
}

/**
 * Validates a file and prints errors/warnings to stderr/stdout.
 */
function handleValidate(id) {
  const files = id
    ? [findPostPath(id)]
    : listPostFiles();

  if (files.length === 0) {
    console.log('No post files found to validate.');
    return true;
  }

  let allPassed = true;
  for (const fp of files) {
    const loaded = loadPostFile(fp);
    const result = validatePost(loaded);

    const relPath = path.relative(ROOT, fp);
    if (!result.valid) {
      allPassed = false;
      console.error(`❌ Validation Failed: ${relPath}`);
      result.errors.forEach(err => console.error(`   - [${err.code}] ${err.message}`));
    } else {
      console.log(`✅ Validation Passed: ${relPath}`);
    }

    if (result.warnings.length > 0) {
      result.warnings.forEach(warn => console.warn(`   ⚠️  [${warn.code}] ${warn.message}`));
    }
  }

  return allPassed;
}

/**
 * Renders previews for YAML post files.
 */
function handleRender(id, outputDir) {
  const files = id
    ? [findPostPath(id)]
    : listPostFiles();

  if (files.length === 0) {
    console.error('No post files found to render.');
    return false;
  }

  for (const fp of files) {
    const loaded = loadPostFile(fp);
    if (!loaded.valid) {
      console.error(`❌ Cannot render invalid post: ${path.basename(fp)}`);
      return false;
    }
    const rendered = renderPost(loaded.data);
    console.log(`✨ Rendered payload for: ${rendered.id}`);
    if (outputDir) {
      writeRedactedPreview(rendered, loaded.data, outputDir);
      console.log(`💾 Saved redacted preview to: ${outputDir}/${rendered.id}-preview.md`);
    }
  }
  return true;
}

/**
 * Handles real or dry-run publishing of a post.
 */
async function handlePublish(params) {
  if (!params.id) {
    console.error('Error: --id is required for publish');
    return false;
  }
  if (!params.platform) {
    console.error('Error: --platform is required for publish');
    return false;
  }
  if (!params.sourceSha) {
    console.error('Error: --source-sha is required for publish');
    return false;
  }

  const isCI = process.env.CI === 'true' && process.env.GITHUB_ACTIONS === 'true';
  const isPublishAllowed = process.env.ALLOW_SOCIAL_PUBLISH === 'true';

  // @gate CI で明示的に許可されたときだけ実投稿する
  // Strict local actual publish block
  if (!params.dryRun && (!isCI || !isPublishAllowed)) {
    console.error('❌ SAFETY ERROR: Actual social publishing is blocked locally.');
    console.error('To run a safe local dry-run simulation, append the "--dry-run" flag.');
    return false;
  }

  const fp = findPostPath(params.id);
  if (!fs.existsSync(fp)) {
    console.error(`Error: Post file does not exist at ${fp}`);
    return false;
  }

  // Load and validate
  const loaded = loadPostFile(fp);
  const result = validatePost(loaded);
  if (!result.valid) {
    console.error('❌ Cannot publish invalid post data:');
    result.errors.forEach(err => console.error(`   - [${err.code}] ${err.message}`));
    return false;
  }

  const data = loaded.data;
  if (data.status !== 'ready' && !params.dryRun) {
    console.error(`Error: Post status is '${data.status}'. Only status 'ready' can be published.`);
    return false;
  }

  if (!params.dryRun) {
    if (!data.source?.revision) {
      console.error("Error: Post is missing 'source.revision'!");
      return false;
    }
    try {
      const { execSync } = await import('node:child_process');
      execSync(`git cat-file -e ${data.source.revision}`);
    } catch (err) {
      console.error(`Error: Post source.revision '${data.source.revision}' does not exist in git history!`);
      return false;
    }
  }

  const rendered = renderPost(data);
  const platforms = params.platform === 'both' ? ['linkedin', 'bluesky'] : [params.platform];

  if (params.dryRun) {
    console.log('🏁 --- DRY RUN SIMULATION ---');
    console.log(`Rendering payloads for ${platforms.join(' & ')} under Utm campaign '${data.campaign?.utm_campaign}'...`);
    console.log(JSON.stringify(rendered, null, 2));
    console.log('✅ Dry Run completed successfully (no APIs were called).');
    return true;
  }

  // Execution Phase
  let overallSuccess = true;

  for (const plat of platforms) {
    if (!data[plat] || !data[plat].enabled) {
      console.log(`ℹ️ Platform ${plat} is disabled in post YAML. Skipping.`);
      continue;
    }

    const key = `${plat}:${params.id}:${params.sourceSha}`;

    // Duplicate Check
    const existingStatus = getPostPublishStatus(plat, params.id, params.sourceSha);
    if (existingStatus === 'published' || existingStatus === 'partial' || existingStatus === 'pending-unknown') {
      console.error(`❌ Duplicate prevention: Post '${key}' already exists in ledger with status '${existingStatus}'!`);
      overallSuccess = false;
      continue;
    }

    // Write Pending before starting
    appendLedger(plat, {
      key,
      post_id: params.id,
      source_sha: params.sourceSha,
      status: 'pending'
    });

    console.log(`🚀 Publishing to ${plat}...`);

    if (plat === 'linkedin') {
      try {
        const credentials = {
          authorUrn: process.env.LINKEDIN_AUTHOR_URN,
          accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
          version: process.env.LINKEDIN_VERSION
        };
        const pubResult = await publishToLinkedIn(data, rendered, credentials);

        appendLedger('linkedin', {
          key,
          post_id: params.id,
          source_sha: params.sourceSha,
          status: 'published',
          remote_ids: [pubResult.remoteId]
        });
        console.log(`✅ LinkedIn Post Succeeded: ${pubResult.remoteId}`);
      } catch (err) {
        overallSuccess = false;
        console.error(`❌ LinkedIn Post Failed: ${err.message}`);
        appendLedger('linkedin', {
          key,
          post_id: params.id,
          source_sha: params.sourceSha,
          status: 'pending-unknown',
          error: err.message
        });
        console.error('⚠️ LinkedIn state set to pending-unknown. Human resolution required.');
      }
    } else if (plat === 'bluesky') {
      try {
        const credentials = {
          identifier: process.env.BSKY_IDENTIFIER,
          password: process.env.BSKY_APP_PASSWORD,
          service: process.env.BSKY_SERVICE || 'https://bsky.social'
        };
        const pubResult = await publishToBluesky(data, rendered, credentials);

        appendLedger('bluesky', {
          key,
          post_id: params.id,
          source_sha: params.sourceSha,
          status: 'published',
          remote_ids: pubResult.remoteIds.map(p => p.uri)
        });
        console.log(`✅ Bluesky Thread Succeeded!`);
      } catch (err) {
        overallSuccess = false;
        if (err.name === 'BlueskyPartialThreadError') {
          console.error(`❌ Bluesky Post Partially Failed: ${err.message}`);
          appendLedger('bluesky', {
            key,
            post_id: params.id,
            source_sha: params.sourceSha,
            status: 'partial',
            remote_ids: err.successfulPosts.map(p => p.uri),
            error: err.message
          });
        } else {
          console.error(`❌ Bluesky Post Fully Failed: ${err.message}`);
          appendLedger('bluesky', {
            key,
            post_id: params.id,
            source_sha: params.sourceSha,
            status: 'failed-before-send',
            error: err.message
          });
        }
      }
    }
  }

  return overallSuccess;
}

/**
 * Handle manual ledger resolution command.
 */
function handleLedgerResolve(params) {
  if (!params.platform || !params.id || !params.sourceSha || !params.reason || !params.remoteId || !params.operator) {
    console.error('Error: ledger resolve requires --platform, --id, --source-sha, --reason, --remote-id, and --operator');
    return false;
  }
  try {
    resolveLedgerManually({
      platform: params.platform,
      postId: params.id,
      sourceSha: params.sourceSha,
      reason: params.reason,
      remoteIds: params.remoteId.split(','),
      operator: params.operator
    });
    console.log(`✅ Ledger resolved manually for key: ${params.platform}:${params.id}:${params.sourceSha}`);
    return true;
  } catch (err) {
    console.error(`Error: ${err.message}`);
    return false;
  }
}

/**
 * Main Command Dispatcher.
 */
async function main() {
  const args = process.argv.slice(2);
  const params = parseArgs(args);

  let success = false;
  if (params.command === 'validate') {
    success = handleValidate(params.id);
  } else if (params.command === 'render') {
    success = handleRender(params.id, params.output);
  } else if (params.command === 'publish') {
    success = await handlePublish(params);
  } else if (params.command === 'ledger' && args[1] === 'resolve') {
    success = handleLedgerResolve(params);
  } else {
    console.error('Unknown or missing command. Available commands: validate, render, publish, ledger resolve');
    success = false;
  }

  process.exit(success ? 0 : 1);
}

// Check if run directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
