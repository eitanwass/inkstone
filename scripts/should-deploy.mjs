// Vercel "Ignored Build Step" (see vercel.json). Vercel runs this before each
// build: exit 0 skips the build, exit 1 runs it.
//
// Production only deploys when package.json's version differs from the last
// version that was deployed, so releasing = bumping the version. Preview
// builds (pull requests, other branches) always run. If anything about the
// comparison can't be worked out, it builds — a redundant deploy is cheaper
// than a missed one.

import { execSync } from 'node:child_process';

const BUILD = 1;
const SKIP = 0;

function versionAt(rev) {
  const json = execSync(`git show ${rev}:package.json`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return JSON.parse(json).version;
}

function decide() {
  const { VERCEL_ENV, VERCEL_GIT_PREVIOUS_SHA } = process.env;

  if (VERCEL_ENV && VERCEL_ENV !== 'production') {
    console.log(`${VERCEL_ENV} build: always deploy.`);
    return BUILD;
  }

  // The last successful deployment's commit, or failing that the parent commit.
  // (HEAD~1, not HEAD^: a bare ^ is an escape character in Windows shells.)
  const previous = VERCEL_GIT_PREVIOUS_SHA || 'HEAD~1';
  let before;
  let after;
  try {
    before = versionAt(previous);
    after = versionAt('HEAD');
  } catch {
    console.log(`Couldn't compare package.json versions against ${previous}: deploying.`);
    return BUILD;
  }

  if (before === after) {
    console.log(`Version is still ${after}: skipping deploy.`);
    return SKIP;
  }
  console.log(`Version changed ${before} -> ${after}: deploying.`);
  return BUILD;
}

process.exit(decide());
