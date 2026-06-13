import * as Sentry from "@sentry/node";

// `NEON_BRANCH` is the branch id, injected at runtime on EVERY branch (including the default),
// so it can't be used as a truthy "is this a branch?" flag. Tag the project's default branch as
// "production" and every other branch by its id, using the default id passed in via neon.ts env.
const branch = process.env.NEON_BRANCH;
const environment =
  !branch || branch === process.env.PRODUCTION_BRANCH_ID ? "production" : branch;

// Initialized as early as possible (imported first in index.ts). No-ops without a DSN.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 1.0,
  environment,
});

export { Sentry };
