import * as Sentry from "@sentry/node";

// Initialized as early as possible (imported first in index.ts). No-ops without a DSN.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 1.0,
  environment: process.env.NEON_BRANCH_ID ? "branch" : "production",
});

export { Sentry };
